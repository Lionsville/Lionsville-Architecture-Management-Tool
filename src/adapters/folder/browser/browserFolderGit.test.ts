// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A browser folder's history in this browser's database: what the folder
 * suites cannot see from outside it — what a commit keeps, what it reads, and
 * that the folder holds none of it. The suites run over it in
 * `../folderRepositories.test.ts`.
 */
import { describe, expect, it } from 'vitest'
import { MemoryStore } from '../../memory/MemoryStore'
import { FakeDirectory } from '../fakeDirectory'
import { writeAt } from '../handles'
import { BrowserFolder } from './browserFolder'
import { browserFolderGit } from './browserFolderGit'

function history() {
  const root = new FakeDirectory()
  const store = new MemoryStore()
  const folder = new BrowserFolder(store, { folder: 'acme' }, (kept, mine) =>
    Promise.resolve((kept as { folder: string }).folder === (mine as { folder: string }).folder))
  return { root, store, folder, git: browserFolderGit(folder, root) }
}

async function kept(store: MemoryStore, kind: string): Promise<number> {
  const rows = await store.transaction(['folderData'], 'read', (tx) => tx.range('folderData', {}))
  return rows.filter(({ key }) => key.split('\u0000')[1] === kind).length
}

describe('a browser folder’s history', () => {
  it('keeps each content once and a commit as what it changed, and nothing of it in the folder', async () => {
    const { root, store, git } = history()
    expect(await git.keeping()).toBe(false)
    await writeAt(root, 'acme/model.json', '{}')
    await writeAt(root, 'acme/docs/crews.md', 'Crews.')
    await writeAt(root, 'acme/docs/same.md', 'Crews.')
    const first = await git.commit(['acme/model.json', 'acme/docs/crews.md', 'acme/docs/same.md'], 'one\n\nLionsville-Scope: s-1 acme')
    expect(await kept(store, 'object')).toBe(2)
    await writeAt(root, 'acme/model.json', '{"at":1}')
    const second = await git.commit(['acme/model.json', 'acme/docs/crews.md'], 'two')
    expect(await kept(store, 'object')).toBe(3)
    const [newest, older] = await git.log({ limit: 5 })
    expect([newest.sha, older.sha]).toEqual([second, first])
    expect(newest.parents).toEqual([first])
    expect(newest.changed).toEqual(['acme/model.json'])
    expect(await git.readAt(first!, ['acme/model.json'])).toEqual([{ path: 'acme/model.json', text: '{}' }])
    expect(root.paths().filter((path) => !path.startsWith('acme/'))).toEqual([])
    expect(await git.commit(['acme/model.json'], 'nothing')).toBeUndefined()
  })

  it('says what changed without reading a file whose size and time written are what was recorded', async () => {
    const { root, git } = history()
    await writeAt(root, 'acme/model.json', '{}')
    await writeAt(root, 'acme/images/map.png', new Uint8Array([1, 2, 3]))
    await git.commit(['acme/model.json', 'acme/images/map.png'], 'one')
    expect(await git.changes()).toEqual([])
    await writeAt(root, 'acme/model.json', '{"x":1}')
    expect((await git.changes()).map((change) => change.path)).toEqual(['acme/model.json'])
  })

  it('pages from a tip, filters by path and by what a message says, and keeps a tag once', async () => {
    const { root, git } = history()
    const made: string[] = []
    for (const [at, scope] of ['acme', 'globex', 'acme'].entries()) {
      await writeAt(root, `${scope}/model.json`, `{"at":${at}}`)
      made.push((await git.commit([`${scope}/model.json`], `step ${at}\n\nLionsville-Scope: id-${scope} ${scope}`))!)
    }
    expect((await git.log({ limit: 1, skip: 1 })).map((one) => one.subject)).toEqual(['step 1'])
    expect((await git.log({ limit: 5, paths: ['globex'] })).map((one) => one.subject)).toEqual(['step 1'])
    expect((await git.log({ limit: 5, grep: 'id-acme ', bare: true })).map((one) => [one.subject, one.changed])).toEqual([['step 2', []], ['step 0', []]])
    expect((await git.log({ limit: 5, tip: made[1] })).map((one) => one.subject)).toEqual(['step 1', 'step 0'])
    expect(await git.tag(made[0], 'f-a1/board', 'Board')).toBe('done')
    expect(await git.tag(made[1], 'f-a1/board', 'Again')).toBe('exists')
    expect(await git.tags()).toEqual([{ name: 'f-a1/board', sha: made[0], message: 'Board' }])
    const [blob] = (await git.treeAt(made[2], 'acme')).map((one) => one.blob)
    expect(await git.texts([blob, 'none'])).toEqual({ [blob]: '{"at":2}' })
  })
})

describe('what a browser folder’s history is kept of', () => {
  it('leaves out what no desktop repository would hold, and what the folder’s .gitignore names', async () => {
    const { root, git } = history()
    for (const path of [
      'acme/model.json', 'acme/.DS_Store', 'Thumbs.db', 'acme/desktop.ini', 'acme/.git/HEAD', '.git/config',
      'tools/node_modules/left/index.js', 'acme/build/out.txt', 'acme/notes.tmp', 'drafts/a.md', 'acme/drafts/b.md',
      'acme/docs/crews.md', 'acme/keep.log',
    ]) await writeAt(root, path, 'x')
    await writeAt(root, '.gitignore', '# what is built\nbuild/\n*.tmp\n/drafts\n!keep.log\n*.log\ndocs/**\n')
    expect((await git.changes()).map((change) => change.path)).toEqual([
      '.gitignore', 'acme/docs/crews.md', 'acme/drafts/b.md', 'acme/model.json',
    ])
  })

  it('keeps a file a commit names, or the history holds, whatever would leave it out', async () => {
    const { root, git } = history()
    await writeAt(root, 'tools/node_modules/kept/index.js', 'one')
    await writeAt(root, '.gitignore', 'tools/\n')
    expect(await git.changes()).toEqual([{ path: '.gitignore', deleted: false }])
    await git.commit(['tools/node_modules/kept/index.js'], 'named')
    await writeAt(root, 'tools/node_modules/kept/index.js', 'two')
    await writeAt(root, 'tools/node_modules/kept/other.js', 'new')
    expect((await git.changes()).map((change) => change.path)).toEqual(['.gitignore', 'tools/node_modules/kept/index.js'])
  })
})

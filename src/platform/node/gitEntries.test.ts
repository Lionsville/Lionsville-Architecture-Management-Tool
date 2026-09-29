// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the folder's history asks of git, against a real repository in a
 * temporary folder — for the reason `git.test.ts` gives: what is tested is
 * the conversation with git, which only the real one answers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chmod, mkdir, mkdtemp, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { git, gitAvailable, isRepository, snapshot, useHooksFolder } from './git'

const run = promisify(execFile)
import {
  allTags, blobsAt, changes, commitLog, commitPaths, folderGitAt, headOf, isScopeTagName, readAt, readiness, startHistory,
  sizesOf, tagCommit, textsOf, treeAt,
} from './gitEntries'

const available = await gitAvailable()

let root = ''

beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'lvarch-entries-')))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

async function put(path: string, contents: string | Uint8Array): Promise<void> {
  await mkdir(dirname(join(root, path)), { recursive: true })
  await writeFile(join(root, path), contents)
}

describe.skipIf(!available)('the history a folder’s repositories read', () => {
  it('runs no hook of the folder’s, wherever its configuration says hooks are', async () => {
    await startHistory(root)
    const marker = join(root, '..', `${basename(root)}-hook-ran`)
    const hook = `#!/bin/sh\ntouch "${marker}"\nexit 1\n`
    for (const folder of ['.git/hooks', 'own-hooks']) {
      for (const name of ['pre-commit', 'commit-msg', 'post-commit', 'post-index-change']) {
        await put(`${folder}/${name}`, hook)
        await chmod(join(root, folder, name), 0o755)
      }
    }
    await run('git', ['config', 'core.hooksPath', 'own-hooks'], { cwd: root })
    await put('model.json', '{}')
    expect(await commitPaths(root, ['model.json'], 'no hook')).toMatch(/^[0-9a-f]+$/)
    await put('model.json', '{"again":true}')
    expect(await snapshot(root, 'no hook either')).toMatch(/^[0-9a-f]+$/)
    expect(existsSync(marker)).toBe(false)
  })

  it('signs nothing and filters nothing with a program the folder’s configuration names', async () => {
    await startHistory(root)
    const marker = join(root, '..', `${basename(root)}-program-ran`)
    const program = join(root, '..', `${basename(root)}-program.sh`)
    await writeFile(program, `#!/bin/sh\ntouch "${marker}"\nexit 1\n`, { mode: 0o755 })
    for (const [key, value] of [
      ['commit.gpgsign', 'true'], ['gpg.program', program],
      ['filter.evil.clean', program], ['filter.evil.process', program],
    ]) await run('git', ['config', key, value], { cwd: root })
    await put('.gitattributes', '*.json filter=evil\n')
    await put('model.json', '{}')
    expect(await commitPaths(root, ['model.json', '.gitattributes'], 'plain')).toMatch(/^[0-9a-f]+$/)
    expect(existsSync(marker)).toBe(false)
    await rm(program, { force: true })
  })

  it('starts keeping one only where there is none, and says what differs from it', async () => {
    expect(await changes(root)).toEqual([])
    await startHistory(root)
    expect(await isRepository(root)).toBe(true)
    await put('acme/model.json', '{}')
    expect((await changes(root)).map((change) => change.path).sort()).toEqual(['.gitignore', 'acme/model.json'])
  })

  it('commits the paths named and no others, and nothing where none of them changed', async () => {
    await startHistory(root)
    await put('acme/model.json', '{}')
    await put('acme/rail/model.json', '{}')
    const sha = await commitPaths(root, ['acme/model.json'], 'Acme\n\nLionsville-Scope: s-1 acme')
    expect(sha).toMatch(/^[0-9a-f]{40,64}$/)
    const [commit] = await commitLog(root, { limit: 1 })
    expect(commit).toMatchObject({ sha, subject: 'Acme', changed: ['acme/model.json'] })
    expect(commit.message).toContain('Lionsville-Scope: s-1 acme')
    expect((await changes(root)).map((change) => change.path)).toContain('acme/rail/model.json')
    expect(await commitPaths(root, ['acme/model.json'], 'again')).toBeUndefined()
  })

  it('reads a path as the file it names, whatever it says, and commits one that is gone as gone', async () => {
    await startHistory(root)
    await put(':(glob)odd *name.md', 'odd')
    await put('acme/model.json', '{}')
    const sha = await commitPaths(root, [':(glob)odd *name.md', 'acme/model.json'], 'both')
    expect((await commitLog(root, { limit: 1 }))[0].changed.sort()).toEqual([':(glob)odd *name.md', 'acme/model.json'])
    await rm(join(root, 'acme/model.json'))
    expect(await changes(root)).toContainEqual({ path: 'acme/model.json', deleted: true })
    await commitPaths(root, ['acme/model.json'], 'gone')
    expect((await treeAt(root, (await commitLog(root, { limit: 1 }))[0].sha, '')).map((file) => file.path)).toEqual([':(glob)odd *name.md'])
    const [held] = await treeAt(root, sha!, 'acme')
    expect(held.path).toBe('acme/model.json')
    expect(held.blob).toMatch(/^[0-9a-f]{40,64}$/)
  })

  it('lists commits by the paths they changed, by what their messages say, and from one on', async () => {
    await startHistory(root)
    for (const [at, scope] of ['acme', 'globex', 'acme'].entries()) {
      await put(`${scope}/model.json`, `{"at":${at}}`)
      await commitPaths(root, [`${scope}/model.json`], `step ${at}\n\nLionsville-Scope: id-${scope} ${scope}`)
    }
    const all = await commitLog(root, { limit: 10 })
    expect(all.map((commit) => commit.subject)).toEqual(['step 2', 'step 1', 'step 0'])
    expect((await commitLog(root, { limit: 10, paths: ['globex'] })).map((commit) => commit.subject)).toEqual(['step 1'])
    expect((await commitLog(root, { limit: 10, grep: 'Lionsville-Scope: id-acme ' })).map((commit) => commit.subject))
      .toEqual(['step 2', 'step 0'])
    expect((await commitLog(root, { limit: 10, tip: all[1].sha })).map((commit) => commit.subject)).toEqual(['step 1', 'step 0'])
    expect(await commitLog(root, { limit: 10, tip: '--output=x' })).toEqual([])
  })

  it('lists a history with a merge from one tip, page after page, the merge with no path of its own', async () => {
    await startHistory(root)
    await put('model.json', '{"at":0}')
    await commitPaths(root, ['model.json'], 'base')
    const main = (await run('git', ['symbolic-ref', '--short', 'HEAD'], { cwd: root })).stdout.trim()
    await run('git', ['checkout', '-q', '-b', 'side'], { cwd: root })
    await put('side.md', 'side')
    await commitPaths(root, ['side.md'], 'on the side')
    await run('git', ['checkout', '-q', main], { cwd: root })
    await put('model.json', '{"at":1}')
    await commitPaths(root, ['model.json'], 'on the main line')
    await run('git', ['-c', 'user.name=A', '-c', 'user.email=a@example.org', 'merge', '-q', '--no-ff', '-m', 'merged', 'side'], { cwd: root })
    const tip = await headOf(root)
    const all = await commitLog(root, { limit: 10, tip })
    expect(all.map((commit) => commit.subject)).toContain('on the side')
    const merge = all.find((commit) => commit.subject === 'merged')!
    expect(merge.parents).toHaveLength(2)
    expect(merge.changed).toEqual([])
    const paged = [...await commitLog(root, { limit: 2, tip }), ...await commitLog(root, { limit: 2, tip, skip: 2 })]
    expect(paged.map((commit) => commit.sha)).toEqual(all.map((commit) => commit.sha))
    expect((await commitLog(root, { limit: 10, tip, firstParent: true })).map((commit) => commit.subject)).not.toContain('on the side')
    // A merge may be listed for a path, and lists none of its own.
    expect((await commitLog(root, { limit: 10, tip, paths: ['side.md'] })).filter((commit) => commit.changed.length).map((commit) => commit.subject))
      .toEqual(['on the side'])
  })

  it('reads files as they were at a commit: a picture as bytes, the rest as text, a missing one left out', async () => {
    await startHistory(root)
    await put('images/map.png', new Uint8Array([0x89, 0x50, 0, 1, 2]))
    await put('docs/crews.md', 'Plans the crews.\n')
    const sha = await commitPaths(root, ['images/map.png', 'docs/crews.md'], 'files')
    await put('docs/crews.md', 'Changed since.\n')
    expect(await readAt(root, sha!, ['docs/crews.md', 'images/map.png', 'docs/none.md'])).toEqual([
      { path: 'docs/crews.md', text: 'Plans the crews.\n' },
      { path: 'images/map.png', bytes: new Uint8Array([0x89, 0x50, 0, 1, 2]) },
    ])
  })

  it('reads a file whose name has a space in it, in a folder of its own', async () => {
    await startHistory(root)
    await put('acme/images/my rota.png', new Uint8Array([1, 2, 3]))
    await put('acme/docs/crews.md', 'Crews.\n')
    const sha = await commitPaths(root, ['acme/images/my rota.png', 'acme/docs/crews.md'], 'spaced')
    expect(await readAt(root, sha!, ['acme/images/my rota.png', 'acme/docs/crews.md'])).toEqual([
      { path: 'acme/images/my rota.png', bytes: new Uint8Array([1, 2, 3]) },
      { path: 'acme/docs/crews.md', text: 'Crews.\n' },
    ])
  })

  it('tags a commit once by a name, with its words, and never one git would refuse', async () => {
    await startHistory(root)
    await put('model.json', '{}')
    const sha = await commitPaths(root, ['model.json'], 'one')
    expect(await tagCommit(root, sha!, 'f-s1/board', 'Shown to the board')).toBe('done')
    expect(await tagCommit(root, sha!, 'f-s1/board', 'Again')).toBe('exists')
    await expect(tagCommit(root, sha!, 'bad..name', 'No')).rejects.toThrow()
    expect(await allTags(root)).toEqual([{ name: 'f-s1/board', sha, message: 'Shown to the board' }])
  })

  it('tags by a scope’s label name and nothing else: never an option, never a name of a person’s', async () => {
    await startHistory(root)
    await put('model.json', '{}')
    const sha = await commitPaths(root, ['model.json'], 'one')
    for (const name of ['--force', '-f', 'refs/tags/x', 'release', 'a/B', 's-1/--force', '/x', 's-1/x/y']) {
      expect(isScopeTagName(name), name).toBe(false)
      await expect(tagCommit(root, sha!, name, 'No'), name).rejects.toThrow('shell.pathRefused')
    }
    expect(isScopeTagName('3f2a9c1e-0b4d-4e8a-9f6b-1c2d3e4f5a6b/shown-to-the-board')).toBe(true)
    expect(await allTags(root)).toEqual([])
  })
})

describe.skipIf(!available)('a folder that keeps no history, and what is not asked right', () => {
  it('answers nothing, and starts nothing, where the folder keeps no history', async () => {
    expect(await changes(root)).toEqual([])
    expect(await commitLog(root, { limit: 5 })).toEqual([])
    expect(await treeAt(root, 'abc1234', '')).toEqual([])
    expect(await readAt(root, 'abc1234', ['model.json'])).toEqual([])
    expect(await allTags(root)).toEqual([])
    expect(await isRepository(root)).toBe(false)
  })

  it('answers nothing for a history with no commit, and for paths or commits it would not hand git', async () => {
    await startHistory(root)
    expect(await commitLog(root, { limit: 5 })).toEqual([])
    await put('model.json', '{}')
    const sha = await commitPaths(root, ['model.json'], 'one')
    expect(await commitPaths(root, ['../escape', '/etc/passwd', ''], 'nothing')).toBeUndefined()
    expect(await commitLog(root, { limit: 5, paths: ['../escape'] })).toEqual([])
    expect(await treeAt(root, sha!, '../escape')).toEqual([])
    expect(await treeAt(root, 'HEAD', '')).toEqual([])
    expect(await readAt(root, 'not-a-sha', ['model.json'])).toEqual([])
    expect(await readAt(root, sha!, ['../escape', 'line\nbreak'])).toEqual([])
  })

  it('never commits the machine’s own settings file an older build left', async () => {
    await startHistory(root)
    await put('.lionsville-architecture/local.json', '{}')
    await put('model.json', '{}')
    expect((await changes(root)).map((change) => change.path)).not.toContain('.lionsville-architecture/local.json')
    expect(await commitPaths(root, ['.lionsville-architecture/local.json'], 'settings')).toBeUndefined()
  })

  it('reads a tag a person made without words as its name alone', async () => {
    await startHistory(root)
    await put('model.json', '{}')
    const sha = await commitPaths(root, ['model.json'], 'one')
    await run('git', ['tag', 'by-hand', sha!], { cwd: root })
    expect(await allTags(root)).toEqual([{ name: 'by-hand', sha, message: '' }])
  })

  it('is the history over one folder, every member bound to it', async () => {
    const held = folderGitAt(root)
    expect(await held.keeping()).toBe(false)
    await held.start()
    expect(await held.keeping()).toBe(true)
    await put('model.json', '{}')
    expect((await held.changes()).map((change) => change.path)).toContain('model.json')
    const sha = await held.commit(['model.json'], 'one')
    const [commit] = await held.log({ limit: 1 })
    expect(commit.sha).toBe(sha)
    expect(await held.head()).toBe(sha)
    expect((await held.treeAt(sha!, '')).map((file) => file.path)).toContain('model.json')
    expect(await held.readAt(sha!, ['model.json'])).toEqual([{ path: 'model.json', text: '{}' }])
    expect(await held.tag(sha!, 'f-s1/one', 'One')).toBe('done')
    expect((await held.tags()).map((tag) => tag.name)).toEqual(['f-s1/one'])
  })

  it('runs every git with its hooks in the folder main names, made where it is not', async () => {
    const hooks = join(root, '..', `${basename(root)}-no-hooks`)
    useHooksFolder(hooks)
    await startHistory(root)
    await put('model.json', '{}')
    expect(await commitPaths(root, ['model.json'], 'one')).toMatch(/^[0-9a-f]+$/)
    expect(await readdir(hooks)).toEqual([])
    await rm(hooks, { recursive: true, force: true })
  })
})

describe.skipIf(!available)('a history in no state to take a record', () => {
  it('is refused part way through a merge, with a file unmerged, and on no branch; and taken again after', async () => {
    await startHistory(root)
    await put('model.json', '{"at":0}')
    await commitPaths(root, ['model.json'], 'base')
    const sh = (...args: string[]) => run('git', ['-c', 'user.name=A', '-c', 'user.email=a@example.org', ...args], { cwd: root })
    const main = (await sh('symbolic-ref', '--short', 'HEAD')).stdout.trim()
    await sh('checkout', '-q', '-b', 'side')
    await put('model.json', '{"at":"side"}')
    await commitPaths(root, ['model.json'], 'side')
    await sh('checkout', '-q', main)
    await put('model.json', '{"at":"main"}')
    await commitPaths(root, ['model.json'], 'main')
    await sh('merge', '-q', 'side').catch(() => undefined)
    expect(await readiness(root)).toBe('midway')
    await put('other.md', 'x')
    await expect(commitPaths(root, ['other.md'], 'during the merge')).rejects.toThrow('shell.historyMidway')
    await sh('merge', '--abort')
    expect(await readiness(root)).toBe('ready')
    await sh('checkout', '-q', '--detach')
    expect(await readiness(root)).toBe('detached')
    await expect(commitPaths(root, ['other.md'], 'detached')).rejects.toThrow('shell.historyDetached')
    await sh('checkout', '-q', main)
    expect(await commitPaths(root, ['other.md'], 'back on a branch')).toMatch(/^[0-9a-f]+$/)
  })

  it('commits a path already gone from the index as gone, beside one added, and writes nothing into .git', async () => {
    await startHistory(root)
    await put('a.md', 'a')
    await put('b.md', 'b')
    await commitPaths(root, ['a.md', 'b.md'], 'both')
    await run('git', ['rm', '-q', 'a.md'], { cwd: root })
    await put('c.md', 'c')
    const before = await readdir(join(root, '.git'))
    await commitPaths(root, ['a.md', 'c.md'], 'one gone, one new')
    const [commit] = await commitLog(root, { limit: 1 })
    expect(commit.changed.sort()).toEqual(['a.md', 'c.md'])
    expect((await readdir(join(root, '.git'))).filter((name) => !before.includes(name) && name.startsWith('lionsville'))).toEqual([])
  })
})

describe.skipIf(!available)('what changed, and what a file held', () => {
  it('says what each commit changed from and to, and reads what a file held by that id', async () => {
    expect(await headOf(root)).toBeUndefined()
    expect(await readiness(root)).toBe('ready')
    await startHistory(root)
    expect(await headOf(root)).toBeUndefined()
    await put('model.json', '{"at":0}')
    await commitPaths(root, ['model.json'], 'one')
    await put('model.json', '{"at":1}')
    const sha = await commitPaths(root, ['model.json'], 'two')
    expect(await headOf(root)).toBe(sha)
    const [commit] = await commitLog(root, { limit: 1 })
    const [before, after] = commit.blobs!['model.json']
    expect(await textsOf(root, [before, after, 'not-an-id'])).toEqual({ [before]: '{"at":0}', [after]: '{"at":1}' })
    expect(await textsOf(root, [])).toEqual({})
    expect(await sizesOf(root, [before, after, 'not-an-id', 'f'.repeat(40)])).toEqual({ [before]: 8, [after]: 8 })
    expect(await sizesOf(root, [])).toEqual({})
    const tree = (await run('git', ['rev-parse', `${sha}^{tree}`], { cwd: root })).stdout.trim()
    expect(await textsOf(root, [tree, after])).toEqual({ [after]: '{"at":1}' })
    const [bare] = await commitLog(root, { limit: 1, bare: true })
    expect([bare.changed, bare.blobs]).toEqual([[], undefined])
    expect(await blobsAt(root, [{ sha: sha!, path: 'model.json' }, { sha: sha!, path: 'none.json' }, { sha: 'nope', path: 'model.json' }]))
      .toEqual([after, undefined, undefined])
    expect(await blobsAt(root, [{ sha: 'nope', path: 'model.json' }])).toEqual([undefined])
    const held = folderGitAt(root)
    expect(await held.head()).toBe(sha)
    expect(await held.blobsAt([{ sha: sha!, path: 'model.json' }])).toEqual([after])
    expect(await held.readiness()).toBe('ready')
    expect(await held.texts([after])).toEqual({ [after]: '{"at":1}' })
    expect(await held.sizes([after])).toEqual({ [after]: 8 })
  })

  it('is part way while a file is left unmerged, whatever else git keeps', async () => {
    await startHistory(root)
    await put('model.json', '{"at":0}')
    await commitPaths(root, ['model.json'], 'base')
    const sh = (...args: string[]) => run('git', ['-c', 'user.name=A', '-c', 'user.email=a@example.org', ...args], { cwd: root })
    const main = (await sh('symbolic-ref', '--short', 'HEAD')).stdout.trim()
    await sh('checkout', '-q', '-b', 'side')
    await put('model.json', '{"at":"side"}')
    await commitPaths(root, ['model.json'], 'side')
    await sh('checkout', '-q', main)
    await put('model.json', '{"at":"main"}')
    await commitPaths(root, ['model.json'], 'main')
    await sh('merge', '-q', 'side').catch(() => undefined)
    await rm(join(root, '.git', 'MERGE_HEAD'))
    expect(await readiness(root)).toBe('midway')
  })
})

describe.skipIf(!available)('a machine with no git', () => {
  let nothing = ''

  beforeEach(async () => {
    nothing = await mkdtemp(join(tmpdir(), 'lvarch-no-git-'))
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    await rm(nothing, { recursive: true, force: true })
  })

  it('is said with a key a person can act on, by every way git is run, and not for a folder that is not there', async () => {
    await startHistory(root)
    await put('model.json', '{}')
    await commitPaths(root, ['model.json'], 'one')
    const [commit] = await commitLog(root, { limit: 1 })
    const [, blob] = commit.blobs!['model.json']
    vi.stubEnv('PATH', nothing)
    await expect(changes(root)).rejects.toThrow('shell.gitMissing')
    await expect(sizesOf(root, [blob])).rejects.toThrow('shell.gitMissing')
    const elsewhere = await git(join(root, 'not-there'), ['status']).then(() => undefined, (cause: unknown) => cause)
    expect(elsewhere).toBeInstanceOf(Error)
    expect((elsewhere as Error).message).not.toBe('shell.gitMissing')
    vi.unstubAllEnvs()
    expect(await sizesOf(root, [blob])).toEqual({ [blob]: 2 })
  })

  it('is looked for again once git is there, without a restart', async () => {
    vi.resetModules()
    const { checkGitVersion } = await import('./gitEntries')
    vi.stubEnv('PATH', nothing)
    await expect(checkGitVersion()).rejects.toThrow('shell.gitMissing')
    vi.unstubAllEnvs()
    await expect(checkGitVersion()).resolves.toBeUndefined()
  })
})

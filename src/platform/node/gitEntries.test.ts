// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the folder's history asks of git, against a real repository in a
 * temporary folder — for the reason `git.test.ts` gives: what is tested is
 * the conversation with git, which only the real one answers.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { chmod, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { gitAvailable, isRepository, snapshot } from './git'

const run = promisify(execFile)
import { allTags, changes, commitLog, commitPaths, isScopeTagName, readAt, startHistory, tagCommit, treeAt } from './gitEntries'

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
    expect(await treeAt(root, (await commitLog(root, { limit: 1 }))[0].sha, '')).toEqual([':(glob)odd *name.md'])
    expect(await treeAt(root, sha!, 'acme')).toEqual(['acme/model.json'])
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
    expect((await commitLog(root, { limit: 10, from: all[1].sha })).map((commit) => commit.subject)).toEqual(['step 1', 'step 0'])
    expect(await commitLog(root, { limit: 10, from: '--output=x' })).toEqual([])
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

  it('tags a commit once by a name, with its words, and never one git would refuse', async () => {
    await startHistory(root)
    await put('model.json', '{}')
    const sha = await commitPaths(root, ['model.json'], 'one')
    expect(await tagCommit(root, sha!, 's-1/board', 'Shown to the board')).toBe('done')
    expect(await tagCommit(root, sha!, 's-1/board', 'Again')).toBe('exists')
    await expect(tagCommit(root, sha!, 'bad..name', 'No')).rejects.toThrow()
    expect(await allTags(root)).toEqual([{ name: 's-1/board', sha, message: 'Shown to the board' }])
  })

  it('tags by a scope’s label name and nothing else: never an option, never a name of a person’s', async () => {
    await startHistory(root)
    await put('model.json', '{}')
    const sha = await commitPaths(root, ['model.json'], 'one')
    for (const name of ['--force', '-f', 'refs/tags/x', 'release', 'a/B', 's-1/--force', '/x', 's-1/x/y']) {
      expect(isScopeTagName(name), name).toBe(false)
      await expect(tagCommit(root, sha!, name, 'No'), name).rejects.toThrow('shell.pathRefused')
    }
    expect(isScopeTagName('3f2a-9c/shown-to-the-board')).toBe(true)
    expect(await allTags(root)).toEqual([])
  })
})

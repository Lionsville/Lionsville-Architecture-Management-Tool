/**
 * History, against a real repository in a temporary folder.
 *
 * Real git and not a double, because what is being tested is the conversation
 * with it: which command, which flags, and what its silences mean. A double
 * would agree with whatever this file believed on the day it was written —
 * including that `git log` fails on a repository with no commits, which is the
 * kind of thing only the real one tells you.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { filesAt, gitAvailable, history, initRepository, isRepository, snapshot } from './git'

const available = await gitAvailable()

let root = ''

beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'lvarch-git-')))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

async function project(name: string, contents: string): Promise<void> {
  await mkdir(join(root, 'acme/landscape'), { recursive: true })
  await writeFile(join(root, 'acme/landscape', name), contents, 'utf8')
}

describe.skipIf(!available)('git in a working directory', () => {
  it('knows a folder that is not a repository from one that is', async () => {
    expect(await isRepository(root)).toBe(false)
    await initRepository(root)
    expect(await isRepository(root)).toBe(true)
  })

  it('ignores what an operating system leaves behind, and nothing of the user’s', async () => {
    // A file this app wrote is a file worth committing; quietly excluding part
    // of somebody's project from their own history would be the wrong kind of
    // clever.
    await initRepository(root)
    const ignore = await readFile(join(root, '.gitignore'), 'utf8')
    expect(ignore).toContain('.DS_Store')
    expect(ignore).not.toContain('logos')
  })

  it('keeps a .gitignore the folder already had', async () => {
    await writeFile(join(root, '.gitignore'), 'secrets/\n', 'utf8')
    await initRepository(root)
    expect(await readFile(join(root, '.gitignore'), 'utf8')).toBe('secrets/\n')
  })

  it('takes a snapshot, and says nothing changed when nothing did', async () => {
    await initRepository(root)
    await project('project.json', '{"name":"Landscape"}')

    const first = await snapshot(root, 'The first one')
    expect(first).toMatch(/^[0-9a-f]{40}$/)
    // Two snapshots in a row with no editing between them genuinely have
    // nothing to record — the app writes only what changed.
    expect(await snapshot(root, 'Again')).toBeUndefined()
  })

  it('commits on a machine with no git identity configured', async () => {
    // A fresh laptop must be able to take a snapshot.
    await initRepository(root)
    await project('project.json', '{}')
    await expect(snapshot(root, 'On a fresh machine')).resolves.toBeTruthy()
  })

  it('reads the history newest first, with what each one said', async () => {
    await initRepository(root)
    await project('project.json', '{"n":1}')
    await snapshot(root, 'The first one')
    await project('project.json', '{"n":2}')
    await snapshot(root, 'The second one')

    const log = await history(root)
    expect(log.map((held) => held.subject)).toEqual(['The second one', 'The first one'])
    expect(log[0].at).toBeGreaterThan(1_600_000_000_000)
    expect(log[0].author).toBeTruthy()
  })

  it('reads an empty history as empty rather than as a failure', async () => {
    // git itself fails here, which is a fact about git and not about the folder.
    await initRepository(root)
    expect(await history(root)).toEqual([])
  })

  it('reads one project folder back as it was at a commit', async () => {
    await initRepository(root)
    await project('project.json', '{"name":"Before"}')
    await project('model.json', '{"elements":[]}')
    const sha = await snapshot(root, 'Before')
    await project('project.json', '{"name":"After"}')
    await snapshot(root, 'After')

    const files = await filesAt(root, sha!, 'acme/landscape')
    expect(files.map((file) => file.path).sort()).toEqual(['model.json', 'project.json'])
    expect(files.find((file) => file.path === 'project.json')?.text).toBe('{"name":"Before"}')
  })

  it('leaves the marks out of what it reads back', async () => {
    // A diff of the architecture does not need the bitmaps, and reading them as
    // text would be a lie about what they are.
    await initRepository(root)
    await project('project.json', '{}')
    await mkdir(join(root, 'acme/landscape/logos'), { recursive: true })
    await writeFile(join(root, 'acme/landscape/logos/own.png'), Buffer.from([1, 2, 3]))
    const sha = await snapshot(root, 'With a mark')

    expect((await filesAt(root, sha!, 'acme/landscape')).map((file) => file.path))
      .toEqual(['project.json'])
  })

  it('does not take somebody else’s repository for its own', async () => {
    // A working directory often sits inside one. Committing everything in THAT
    // repository because a landscape changed is not an accident to have.
    await initRepository(root)
    const inside = join(root, 'nested')
    await mkdir(inside)
    expect(await isRepository(inside)).toBe(false)
  })

  it('reads no history from the repository it merely sits inside', async () => {
    // Git walks up until it finds one, so a folder that keeps no history was
    // being handed the enclosing project's commits and showing them as its
    // own snapshots — which then cannot be read back once this folder has a
    // repository of its own: `ls-tree` answers `not a tree object`.
    await initRepository(root)
    await project('project.json', '{}')
    const outer = await snapshot(root, 'The enclosing project')

    const inside = join(root, 'nested')
    await mkdir(inside)
    expect(await history(inside)).toEqual([])
    expect(await filesAt(inside, outer!, 'acme/landscape')).toEqual([])
  })

  it('starts a repository here rather than committing into the one above', async () => {
    await initRepository(root)
    await project('project.json', '{}')
    await snapshot(root, 'The enclosing project')

    const inside = join(root, 'nested/landscape')
    await mkdir(inside, { recursive: true })
    await writeFile(join(inside, 'project.json'), '{}', 'utf8')

    expect(await snapshot(inside, 'The nested one')).toMatch(/^[0-9a-f]{40}$/)
    expect(await isRepository(inside)).toBe(true)
    expect((await history(inside)).map((held) => held.subject)).toEqual(['The nested one'])
    // And the folder above is untouched: its own snapshot is still the only one.
    expect((await history(root)).map((held) => held.subject)).toEqual(['The enclosing project'])
  })
})

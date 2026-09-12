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
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { filesAt, gitAvailable, history, initRepository, isRepository, label, snapshot } from './git'

const run = promisify(execFile)

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
    await project('scope.json', '{"name":"Landscape"}')

    const first = await snapshot(root, 'The first one')
    expect(first).toMatch(/^[0-9a-f]{40}$/)
    // Two snapshots in a row with no editing between them genuinely have
    // nothing to record — the app writes only what changed.
    expect(await snapshot(root, 'Again')).toBeUndefined()
  })

  it('commits on a machine with no git identity configured', async () => {
    // A fresh laptop must be able to take a snapshot.
    await initRepository(root)
    await project('scope.json', '{}')
    await expect(snapshot(root, 'On a fresh machine')).resolves.toBeTruthy()
  })

  it('reads the history newest first, with what each one said', async () => {
    await initRepository(root)
    await project('scope.json', '{"n":1}')
    await snapshot(root, 'The first one')
    await project('scope.json', '{"n":2}')
    await snapshot(root, 'The second one')

    const log = await history(root)
    expect(log.map((held) => held.subject)).toEqual(['The second one', 'The first one'])
    expect(log[0].at).toBeGreaterThan(1_600_000_000_000)
    expect(log[0].author).toBeTruthy()
  })

  it('reads the history of one path, and of every name a numbered file has had', async () => {
    await initRepository(root)
    await project('model.json', '{}')
    await project('0007-one-writer.md', '# One writer')
    await snapshot(root, 'Both')
    await project('model.json', '{"changed":true}')
    await snapshot(root, 'The model only')
    // Retitled: the file moves, the number stays.
    await rm(join(root, 'acme/landscape/0007-one-writer.md'))
    await project('0007-two-writers.md', '# Two writers')
    await snapshot(root, 'The decision only')

    const model = await history(root, 50, ['acme/landscape/model.json'])
    expect(model.map((held) => held.subject)).toEqual(['The model only', 'Both'])
    const decision = await history(root, 50, ['acme/landscape/0007-*.md'])
    expect(decision.map((held) => held.subject)).toEqual(['The decision only', 'Both'])
    // Several paths are one history: a diagram is two files.
    const both = await history(root, 50, ['acme/landscape/model.json', 'acme/landscape/0007-*.md'])
    expect(both.map((held) => held.subject)).toEqual(['The decision only', 'The model only', 'Both'])
    // A path nothing ever touched has no history rather than everybody's.
    expect(await history(root, 50, ['acme/landscape/nothing.md'])).toEqual([])
  })

  it('labels a snapshot, reads the label back beside it, and refuses the same word twice', async () => {
    await initRepository(root)
    await project('scope.json', '{}')
    const first = await snapshot(root, 'One')
    await project('scope.json', '{"n":2}')
    const second = await snapshot(root, 'Two')

    expect(await label(root, first!, 'Shown to the board')).toBe('done')
    expect(await label(root, first!, 'Shown to the board!')).toBe('exists')
    expect(await label(root, second!, '—')).toBe('unnamed')
    expect(await label(root, second!, 'Release 1.2')).toBe('done')

    const log = await history(root)
    expect(log.map((held) => held.labels)).toEqual([['Release 1.2'], ['Shown to the board']])
    // The tag is annotated and named from the slug: what any git client shows.
    expect((await run('git', ['tag', '-l', '-n1'], { cwd: root })).stdout).toContain('shown-to-the-board Shown to the board')
    // The subject was not touched: a label is beside it, never instead of it.
    expect(log.map((held) => held.subject)).toEqual(['Two', 'One'])
  })

  it('shows a tag somebody made in a terminal by its name, having no words for it', async () => {
    await initRepository(root)
    await project('scope.json', '{}')
    await snapshot(root, 'One')
    await run('git', ['tag', 'v1'], { cwd: root })
    expect((await history(root))[0].labels).toEqual(['v1'])
  })

  it('reads an empty history as empty rather than as a failure', async () => {
    // git itself fails here, which is a fact about git and not about the folder.
    await initRepository(root)
    expect(await history(root)).toEqual([])
  })

  it('reads one project folder back as it was at a commit', async () => {
    await initRepository(root)
    await project('scope.json', '{"name":"Before"}')
    await project('model.json', '{"elements":[]}')
    const sha = await snapshot(root, 'Before')
    await project('scope.json', '{"name":"After"}')
    await snapshot(root, 'After')

    const files = await filesAt(root, sha!, 'acme/landscape')
    expect(files.map((file) => file.path).sort()).toEqual(['model.json', 'scope.json'])
    expect(files.find((file) => file.path === 'scope.json')?.text).toBe('{"name":"Before"}')
  })

  it('leaves the marks out of what it reads back', async () => {
    // A diff of the architecture does not need the bitmaps, and reading them as
    // text would be a lie about what they are.
    await initRepository(root)
    await project('scope.json', '{}')
    await mkdir(join(root, 'acme/landscape/logos'), { recursive: true })
    await writeFile(join(root, 'acme/landscape/logos/own.png'), Buffer.from([1, 2, 3]))
    const sha = await snapshot(root, 'With a mark')

    expect((await filesAt(root, sha!, 'acme/landscape')).map((file) => file.path))
      .toEqual(['scope.json'])
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
    await project('scope.json', '{}')
    const outer = await snapshot(root, 'The enclosing project')

    const inside = join(root, 'nested')
    await mkdir(inside)
    expect(await history(inside)).toEqual([])
    expect(await filesAt(inside, outer!, 'acme/landscape')).toEqual([])
  })

  it('starts a repository here rather than committing into the one above', async () => {
    await initRepository(root)
    await project('scope.json', '{}')
    await snapshot(root, 'The enclosing project')

    const inside = join(root, 'nested/landscape')
    await mkdir(inside, { recursive: true })
    await writeFile(join(inside, 'scope.json'), '{}', 'utf8')

    expect(await snapshot(inside, 'The nested one')).toMatch(/^[0-9a-f]{40}$/)
    expect(await isRepository(inside)).toBe(true)
    expect((await history(inside)).map((held) => held.subject)).toEqual(['The nested one'])
    // And the folder above is untouched: its own snapshot is still the only one.
    expect((await history(root)).map((held) => held.subject)).toEqual(['The enclosing project'])
  })
})

/**
 * The remote (ADR-0005), against a bare repository in a second temporary
 * folder. Real git again, because what matters is what git says when it
 * refuses — and a fast-forward, a rejection and a merge with `-s ours` are
 * exactly the things a double would agree with whatever this file believed.
 */
import {
  excludeLocalSettings, pull, push, remote, resolve,
} from './git'
import { LOCAL_SETTINGS_PATH } from '../../src/projects/folderSettings'

const sh = (cwd: string, args: string[]) => run('git', args, {
  cwd, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
}).then((held) => held.stdout.trim())

let bare = ''
let other = ''

beforeEach(async () => {
  bare = await realpath(await mkdtemp(join(tmpdir(), 'lvarch-remote-')))
  other = await realpath(await mkdtemp(join(tmpdir(), 'lvarch-other-')))
  await sh(bare, ['init', '--bare', '--initial-branch=main'])
})

afterEach(async () => {
  await rm(bare, { recursive: true, force: true })
  await rm(other, { recursive: true, force: true })
})

/** A folder of ours, keeping history, with the bare repository as its origin. */
async function withRemote(): Promise<void> {
  await initRepository(root)
  await sh(root, ['checkout', '-b', 'main'])
  await sh(root, ['remote', 'add', 'origin', bare])
}

/** Somebody else's clone of the same remote, with one commit pushed. */
async function colleagueCommits(name: string, contents: string): Promise<void> {
  await sh(other, ['clone', '-q', bare, '.'])
  await sh(other, ['checkout', '-q', '-B', 'main'])
  await mkdir(join(other, 'acme/landscape'), { recursive: true })
  await writeFile(join(other, 'acme/landscape', name), contents, 'utf8')
  await sh(other, ['add', '-A'])
  await sh(other, ['-c', 'user.name=Colleague', '-c', 'user.email=c@example.test', 'commit', '-q', '-m', 'Theirs'])
  await sh(other, ['push', '-q', 'origin', 'HEAD:refs/heads/main'])
}

describe.skipIf(!available)('the remote', () => {
  it('has none for a folder that keeps no history, or has no remote', async () => {
    expect(await remote(root)).toBeUndefined()
    await initRepository(root)
    expect(await remote(root)).toBeUndefined()
    expect(await pull(root)).toBe('no-remote')
    expect(await push(root)).toBe('no-remote')
    expect(await resolve(root, 'theirs')).toBe('no-remote')
  })

  it('reads what git declares, and defaults to origin before any upstream is set', async () => {
    await withRemote()
    expect(await remote(root)).toEqual({ name: 'origin', branch: 'main', url: bare })
  })

  it('refuses rather than hangs when the remote is not there', async () => {
    await initRepository(root)
    await sh(root, ['remote', 'add', 'origin', join(bare, 'no-such-repository')])
    await project('scope.json', '{}')
    await snapshot(root, 'One')
    expect(await pull(root)).toBe('unreachable')
    expect(await push(root)).toBe('unreachable')
  })

  it('pushes, sets the upstream, and then has nothing to pull', async () => {
    await withRemote()
    await project('scope.json', '{"name":"Ours"}')
    await snapshot(root, 'Ours')

    expect(await push(root)).toBe('done')
    expect(await sh(bare, ['log', '--format=%s', 'main'])).toBe('Ours')
    expect(await sh(root, ['config', '--get', 'branch.main.remote'])).toBe('origin')
    expect(await pull(root)).toBe('done')
  })

  it('pushes nothing from a repository with no commits, and calls that done', async () => {
    await withRemote()
    expect(await push(root)).toBe('done')
  })

  it('fast-forwards to what a colleague pushed, into a folder with no commits yet', async () => {
    await withRemote()
    await colleagueCommits('scope.json', '{"name":"Theirs"}')
    expect(await pull(root)).toBe('done')
    expect(await readFile(join(root, 'acme/landscape/scope.json'), 'utf8')).toBe('{"name":"Theirs"}')
  })

  it('pushes a label with the branch, so a colleague sees the same mark', async () => {
    await withRemote()
    await project('scope.json', '{"n":1}')
    const sha = await snapshot(root, 'One')
    await label(root, sha!, 'Shown to the board')
    expect(await push(root)).toBe('done')
    expect(await sh(bare, ['tag', '-l'])).toBe('shown-to-the-board')
  })

  it('fast-forwards when only they moved on', async () => {
    await withRemote()
    await project('scope.json', '{"n":1}')
    await snapshot(root, 'One')
    await push(root)
    await colleagueCommits('model.json', '{"elements":[]}')
    expect(await pull(root)).toBe('done')
    expect(await readFile(join(root, 'acme/landscape/model.json'), 'utf8')).toBe('{"elements":[]}')
  })

  it('answers diverged from one end and rejected from the other when both moved on', async () => {
    await withRemote()
    await project('scope.json', '{"n":1}')
    await snapshot(root, 'One')
    await push(root)
    await colleagueCommits('model.json', '{"theirs":true}')
    await project('scope.json', '{"n":2}')
    await snapshot(root, 'Two')

    expect(await push(root)).toBe('rejected')
    expect(await pull(root)).toBe('diverged')
    // Neither merged, rebased nor stashed: ours is exactly as it was.
    expect(await readFile(join(root, 'acme/landscape/scope.json'), 'utf8')).toBe('{"n":2}')
    expect((await history(root)).map((held) => held.subject)).toEqual(['Two', 'One'])
  })

  it('take theirs: the remote stands, and ours is kept on a branch named for the moment', async () => {
    await withRemote()
    await project('scope.json', '{"n":1}')
    await snapshot(root, 'One')
    await push(root)
    await colleagueCommits('model.json', '{"theirs":true}')
    await project('scope.json', '{"n":2}')
    await snapshot(root, 'Two')
    // And something not yet recorded, which the reset must not destroy.
    await project('unrecorded.json', '{"kept":true}')

    expect(await resolve(root, 'theirs')).toBe('done')
    expect(await readFile(join(root, 'acme/landscape/scope.json'), 'utf8')).toBe('{"n":1}')
    expect(await readFile(join(root, 'acme/landscape/model.json'), 'utf8')).toBe('{"theirs":true}')
    const branches = await sh(root, ['branch', '--list', 'before-sync/*'])
    expect(branches).toMatch(/before-sync\//)
    const kept = branches.trim().replace(/^\*?\s*/, '')
    expect(await sh(root, ['show', `${kept}:acme/landscape/scope.json`])).toBe('{"n":2}')
    expect(await sh(root, ['show', `${kept}:acme/landscape/unrecorded.json`])).toBe('{"kept":true}')
    expect(await pull(root)).toBe('done')
  })

  it('keep ours: a merge commit whose tree is ours and whose parents are both sides', async () => {
    await withRemote()
    await project('scope.json', '{"n":1}')
    await snapshot(root, 'One')
    await push(root)
    await colleagueCommits('model.json', '{"theirs":true}')
    await project('scope.json', '{"n":2}')
    await snapshot(root, 'Two')

    expect(await resolve(root, 'ours')).toBe('done')
    expect(await readFile(join(root, 'acme/landscape/scope.json'), 'utf8')).toBe('{"n":2}')
    // Their file is not in our tree: no line of anything was combined.
    await expect(readFile(join(root, 'acme/landscape/model.json'), 'utf8')).rejects.toThrow()
    expect((await sh(root, ['log', '-1', '--format=%P'])).split(' ')).toHaveLength(2)
    // And it fast-forwards for everyone else.
    expect(await push(root)).toBe('done')
    expect(await sh(bare, ['rev-parse', 'main'])).toBe(await sh(root, ['rev-parse', 'HEAD']))
  })

  it('leaves the folder as it was when resolving is refused', async () => {
    await initRepository(root)
    await sh(root, ['remote', 'add', 'origin', join(bare, 'gone')])
    await project('scope.json', '{"n":1}')
    await snapshot(root, 'One')
    expect(await resolve(root, 'theirs')).toBe('unreachable')
    expect((await history(root)).map((held) => held.subject)).toEqual(['One'])
    expect(await sh(root, ['branch', '--list', 'before-sync/*'])).toBe('')
  })
})

describe.skipIf(!available)('this machine\'s settings file', () => {
  it('is never in a snapshot, and never picked up by a git add -A in a terminal', async () => {
    await initRepository(root)
    await mkdir(join(root, '.lionsville-architecture'), { recursive: true })
    await writeFile(join(root, LOCAL_SETTINGS_PATH), '{"version":1}', 'utf8')
    await project('scope.json', '{}')
    const sha = await snapshot(root, 'With the local file beside it')
    const listed = await sh(root, ['ls-tree', '-r', '--name-only', sha!])
    expect(listed).not.toContain('local.json')
    expect(listed).toContain('acme/landscape/scope.json')

    await sh(root, ['add', '-A'])
    expect(await sh(root, ['diff', '--cached', '--name-only'])).toBe('')
    expect(await readFile(join(root, '.git/info/exclude'), 'utf8')).toContain(LOCAL_SETTINGS_PATH)
  })

  it('does not write the user\'s .gitignore for it, and adds the exclude once', async () => {
    await writeFile(join(root, '.gitignore'), 'secrets/\n', 'utf8')
    await initRepository(root)
    await excludeLocalSettings(root)
    await excludeLocalSettings(root)
    expect(await readFile(join(root, '.gitignore'), 'utf8')).toBe('secrets/\n')
    const exclude = await readFile(join(root, '.git/info/exclude'), 'utf8')
    expect(exclude.split('\n').filter((line) => line === LOCAL_SETTINGS_PATH)).toHaveLength(1)
  })

  it('is nothing on a folder that keeps no history', async () => {
    await excludeLocalSettings(root)
    expect(await isRepository(root)).toBe(false)
  })
})

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the history over a folder asks of the machine's git (ADR-0031 §2):
 * the changes the folder holds, a commit of some of them, the commits with
 * what each changed, the files at one, and the tags.
 *
 * The same rules as `git.ts`, whose runner this uses: the system binary
 * without a shell, nothing that can ask a question, no hook and no file-system
 * monitor, and this folder and never one above it. Paths travel as literal pathspecs — a file a person
 * named `:(glob)*` is that file — and a list of them is handed to git on its
 * standard input rather than on the command line, which a folder of any size
 * would outgrow; nothing of ours is written into `.git`. The shape answered is the folder implementation's `FolderGit`
 * (`adapters/folder/folderGit.ts`), which this cannot import and meets as it
 * is written.
 */
import { execFile } from 'node:child_process'
import { access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { LOCAL_SETTINGS_PATH } from '../../projects/folderSettings'
import { isSpacedLabel } from '../../projects/label'
import { git, gitEnvironment, identityArgs, initRepository, isRepository, quietConfig } from './git'

const UNIT = '\x1f'
const RECORD = '\x1e'

/**
 * Whether a file is bytes rather than text: a picture that is not an SVG —
 * the folder format's rule (`isBinaryPath`), said here again because the
 * main process reads nothing of the format but this.
 */
function isBinary(path: string): boolean {
  return /\.(png|jpe?g|webp)$/i.test(path)
}

/** A commit named by what git names it: hex, never an option or a range. */
function isSha(value: string): boolean {
  return /^[0-9a-f]{7,64}$/.test(value)
}

/** A path inside the folder, as git is handed it: literal, and never an escape. */
function isInside(path: string): boolean {
  return path.length > 0 && !path.startsWith('/') && !path.includes('\0')
    && !path.split('/').some((segment) => segment === '..' || segment === '')
}

function literal(path: string): string {
  return `:(literal)${path}`
}

export type GitChange = { path: string; deleted: boolean }

/** Everything that differs from the last commit, files never committed included, paths from the root. */
export async function changes(root: string): Promise<GitChange[]> {
  if (!await isRepository(root)) return []
  const out = await git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--no-renames'])
  const found: GitChange[] = []
  for (const row of out.split('\0')) {
    if (row.length < 4) continue
    const path = row.slice(3)
    if (path === LOCAL_SETTINGS_PATH) continue
    found.push({ path, deleted: row[0] === 'D' || row[1] === 'D' })
  }
  return found
}

/** Keep a history here, where there is none. */
export async function startHistory(root: string): Promise<void> {
  await checkGitVersion()
  if (!await isRepository(root)) await initRepository(root)
}

/** The oldest git whose `--pathspec-from-file` this history uses. */
const OLDEST_GIT: readonly [number, number] = [2, 25]

let versionChecked: Promise<void> | undefined

/** Refuses, once for the process, with a key a person can act on, where the machine's git is older than this history needs. */
export function checkGitVersion(): Promise<void> {
  versionChecked ??= git(tmpdir(), ['--version']).then((out) => {
    const [, major, minor] = /(\d+)\.(\d+)/.exec(out) ?? []
    const [least, next] = OLDEST_GIT
    if (Number(major) < least || (Number(major) === least && Number(minor) < next)) throw new Error('shell.gitTooOld')
  })
  return versionChecked
}

/** Two letters of `git status --porcelain` that say a path is left unmerged. */
const UNMERGED = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'])

/** What git keeps while a merge, a rebase, a cherry-pick or a revert is part way. */
const MIDWAY = ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'REBASE_HEAD', 'rebase-merge', 'rebase-apply']

export type HistoryReadiness = 'ready' | 'midway' | 'detached'

/**
 * Whether the folder's history can take a record now: not part way through
 * a merge, a rebase, a cherry-pick or a revert, with nothing left unmerged,
 * and on a branch. A folder that keeps no history is ready: a record starts one.
 */
export async function readiness(root: string): Promise<HistoryReadiness> {
  await checkGitVersion()
  if (!await isRepository(root)) return 'ready'
  const places = (await git(root, ['rev-parse', ...MIDWAY.flatMap((name) => ['--git-path', name])])).split('\n').filter(Boolean)
  for (const place of places) {
    if (await access(isAbsolute(place) ? place : join(root, place)).then(() => true, () => false)) return 'midway'
  }
  const status = await git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=no'])
  if (status.split('\0').some((row) => UNMERGED.has(row.slice(0, 2)))) return 'midway'
  return await git(root, ['symbolic-ref', '-q', 'HEAD']).then(() => 'ready' as const, () => 'detached' as const)
}

/**
 * Those paths as they are now, and no others, as one commit — `undefined`
 * where none of them differs from the last. Whatever else a person has
 * staged stays staged and out of it. Refused, with a key, where the history
 * is in no state to take it ({@link readiness}). The paths go to git over its
 * standard input, and nothing of ours is written into `.git`.
 */
export async function commitPaths(root: string, paths: readonly string[], message: string): Promise<string | undefined> {
  const wanted = paths.filter(isInside).filter((path) => path !== LOCAL_SETTINGS_PATH)
  if (wanted.length === 0) return undefined
  await startHistory(root)
  const ready = await readiness(root)
  if (ready !== 'ready') throw new Error(ready === 'midway' ? 'shell.historyMidway' : 'shell.historyDetached')
  // A path already gone from the index is committed as gone; `add` would refuse it as matching nothing.
  const status = await git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=no', '--no-renames'])
  const goneFromIndex = new Set(status.split('\0').filter((row) => row[0] === 'D').map((row) => row.slice(3)))
  const list = (held: readonly string[]) => `${held.map(literal).join('\0')}\0`
  const fromInput = ['--pathspec-from-file=-', '--pathspec-file-nul']
  const adding = wanted.filter((path) => !goneFromIndex.has(path))
  if (adding.length) await gitWithInput(root, ['add', '-A', ...fromInput], list(adding))
  const before = await git(root, ['rev-parse', '--verify', '--quiet', 'HEAD']).catch(() => '')
  try {
    await gitWithInput(root, [...await identityArgs(root), 'commit', '--no-verify', '-q', '-m', message, ...fromInput], list(wanted))
  } catch (cause) {
    // Nothing of these to commit is an answer; anything else is a failure.
    const still = new Set((await changes(root)).map((change) => change.path))
    if (wanted.some((path) => still.has(path))) throw cause
    return undefined
  }
  const after = (await git(root, ['rev-parse', 'HEAD'])).trim()
  return after === before.trim() ? undefined : after
}

export type GitLogged = {
  sha: string; parents: string[]; at: number; author: string; subject: string; message: string; changed: string[]
  blobs?: Record<string, [string, string]>
}

/** An id git gives for nothing. */
const NO_BLOB = /^0+$/

/** What `--raw -z` says a commit changed: each path, with the id of what it held before and after. */
function rawChanges(rest: string): { changed: string[]; blobs: Record<string, [string, string]> } {
  const changed: string[] = []
  const blobs: Record<string, [string, string]> = {}
  const tokens = rest.split('\0')
  for (let at = 0; at < tokens.length; at += 1) {
    const header = /^\n?:\d+ \d+ ([0-9a-f]+) ([0-9a-f]+) [A-Z]\d*$/.exec(tokens[at])
    if (!header || at + 1 >= tokens.length) continue
    const path = tokens[at + 1]
    at += 1
    changed.push(path)
    blobs[path] = [NO_BLOB.test(header[1]) ? '' : header[1], NO_BLOB.test(header[2]) ? '' : header[2]]
  }
  return { changed, blobs }
}

export type LogWanted = {
  paths?: readonly string[]; grep?: string; limit: number; tip?: string; skip?: number; firstParent?: boolean; bare?: boolean
}

/** The commit the folder is at, or `undefined` where it keeps no history or has no commit. */
export async function headOf(root: string): Promise<string | undefined> {
  if (!await isRepository(root)) return undefined
  const sha = (await git(root, ['rev-parse', '--verify', '--quiet', 'HEAD']).catch(() => '')).trim()
  return isSha(sha) ? sha : undefined
}

/**
 * Commits, newest first, with every path each changed; none for a folder that
 * keeps no history or has no commit. Paths are a filter on the full history —
 * no side of a merge is simplified away — and a merge lists no path of its own.
 * Every path comes back as it is, never quoted.
 */
export async function commitLog(root: string, wanted: LogWanted): Promise<GitLogged[]> {
  if (!await isRepository(root)) return []
  if (wanted.tip !== undefined && !isSha(wanted.tip)) return []
  const paths = (wanted.paths ?? []).filter(isInside)
  if (wanted.paths && wanted.paths.length > 0 && paths.length === 0) return []
  let out: string
  try {
    out = await git(root, [
      'log', '-z', `-n${Math.max(1, Math.trunc(wanted.limit))}`, `--skip=${Math.max(0, Math.trunc(wanted.skip ?? 0))}`,
      '--no-renames', ...(wanted.bare ? [] : ['--raw', '--no-abbrev']), `--format=${RECORD}%H${UNIT}%P${UNIT}%at${UNIT}%an${UNIT}%B${UNIT}`,
      ...(paths.length ? ['--full-history'] : []),
      ...(wanted.firstParent ? ['--first-parent'] : []),
      ...(wanted.grep !== undefined ? ['--fixed-strings', `--grep=${wanted.grep}`] : []),
      wanted.tip ?? 'HEAD',
      '--', ...paths.map(literal),
    ])
  } catch {
    // A repository with no commit yet: `git log` fails rather than saying nothing.
    return []
  }
  return out.split(RECORD).flatMap((row) => {
    const [sha, parents, at, author, message, rest] = row.split(UNIT)
    if (!sha || message === undefined) return []
    const body = message.replace(/\n+$/, '')
    return [{
      sha, parents: (parents ?? '').split(' ').filter(Boolean), at: Number(at) * 1000, author: author ?? '',
      subject: body.split('\n')[0] ?? '', message: body,
      ...(wanted.bare ? { changed: [] } : rawChanges(rest ?? '')),
    }]
  })
}

export type GitTreeEntry = { path: string; blob: string }

/** Every file under `within` at a commit, paths from the root, with the id of what each held. */
export async function treeAt(root: string, sha: string, within: string): Promise<GitTreeEntry[]> {
  if (!isSha(sha) || !await isRepository(root)) return []
  if (within !== '' && !isInside(within)) return []
  const out = await git(root, ['ls-tree', '-r', '-z', sha, ...(within ? ['--', literal(within)] : [])])
    .catch(() => '')
  return out.split('\0').flatMap((row) => {
    const match = /^\d+ blob ([0-9a-f]+)\t([\s\S]+)$/.exec(row)
    return match ? [{ path: match[2], blob: match[1] }] : []
  })
}

export type GitFileAt = { path: string; text: string } | { path: string; bytes: Uint8Array }

/** Git fed on its standard input, answered in bytes. */
async function gitWithInput(root: string, args: readonly string[], input: string): Promise<Buffer> {
  const quiet = await quietConfig()
  return new Promise((resolve, reject) => {
    const child = execFile('git', [...quiet, ...args], {
      cwd: root, encoding: 'buffer', maxBuffer: 256 * 1024 * 1024, windowsHide: true, env: gitEnvironment(), timeout: 60_000,
    }, (failure, stdout) => (failure ? reject(failure) : resolve(stdout)))
    child.stdin?.end(input)
  })
}

/** The deepest folder every one of the paths is in; the empty string for the root. */
function commonFolder(paths: readonly string[]): string {
  const folders = paths.map((path) => path.split('/').slice(0, -1))
  const shared: string[] = []
  for (let at = 0; folders.every((one) => one.length > at && one[at] === folders[0][at]); at += 1) shared.push(folders[0][at])
  return shared.join('/')
}

/** Those files as they were at a commit, in one read of git's objects; one that is not there is left out. */
export async function readAt(root: string, sha: string, paths: readonly string[]): Promise<GitFileAt[]> {
  const wanted = paths.filter((path) => isInside(path) && !path.includes('\n'))
  if (!isSha(sha) || wanted.length === 0 || !await isRepository(root)) return []
  // Each file by the id of what it held, and its path beside it: `--filters`
  // reads a file kept as a pointer — a large picture in LFS — as what it
  // points at, as a checkout would, and a filter is chosen by a path.
  const blobs = new Map((await treeAt(root, sha, commonFolder(wanted))).map((file) => [file.path, file.blob]))
  const present = wanted.filter((path) => blobs.has(path))
  if (present.length === 0) return []
  const out = await gitWithInput(root, ['cat-file', '--batch', '--filters'], present.map((path) => `${blobs.get(path)} ${path}\n`).join(''))
  const found: GitFileAt[] = []
  let at = 0
  for (const path of present) {
    const end = out.indexOf(0x0a, at)
    if (end < 0) break
    const header = out.subarray(at, end).toString('utf8')
    at = end + 1
    const size = /^[0-9a-f]+ blob (\d+)$/.exec(header)?.[1]
    if (size === undefined) continue
    const bytes = new Uint8Array(out.subarray(at, at + Number(size)))
    at += Number(size) + 1
    found.push(isBinary(path) ? { path, bytes } : { path, text: new TextDecoder().decode(bytes) })
  }
  return found
}

/** What files held, as text, by the ids a tree or a log gave, in one read of git's objects. */
export async function textsOf(root: string, ids: readonly string[]): Promise<Record<string, string>> {
  const wanted = [...new Set(ids.filter(isSha))]
  if (wanted.length === 0 || !await isRepository(root)) return {}
  const out = await gitWithInput(root, ['cat-file', '--batch'], wanted.map((id) => `${id}\n`).join(''))
  const found: Record<string, string> = {}
  let at = 0
  for (const id of wanted) {
    const end = out.indexOf(0x0a, at)
    if (end < 0) break
    // `<id> <type> <size>` and the object, of whatever type; `<id> missing` and nothing.
    const [, type, size] = /^[0-9a-f]+ (\w+) (\d+)$/.exec(out.subarray(at, end).toString('utf8')) ?? []
    at = end + 1
    if (size === undefined) continue
    if (type === 'blob') found[id] = new TextDecoder().decode(out.subarray(at, at + Number(size)))
    at += Number(size) + 1
  }
  return found
}

/** How many bytes each id's content is, in one look at git's objects and without reading one; an id that is not there is left out. */
export async function sizesOf(root: string, ids: readonly string[]): Promise<Record<string, number>> {
  const wanted = [...new Set(ids.filter(isSha))]
  if (wanted.length === 0 || !await isRepository(root)) return {}
  const out = (await gitWithInput(root, ['cat-file', '--batch-check'], wanted.map((id) => `${id}\n`).join(''))).toString('utf8')
  const found: Record<string, number> = {}
  for (const line of out.split('\n')) {
    // `<id> <type> <size>`, or `<id> missing`.
    const [, id, size] = /^([0-9a-f]+) \w+ (\d+)$/.exec(line) ?? []
    if (id !== undefined) found[id] = Number(size)
  }
  return found
}

/** The id of what one file held at each of some commits, in one look at git's objects; `undefined` where it was not there. */
export async function blobsAt(root: string, at: readonly { sha: string; path: string }[]): Promise<(string | undefined)[]> {
  const usable = at.map(({ sha, path }) => isSha(sha) && isInside(path) && !path.includes('\n'))
  if (!usable.some(Boolean) || !await isRepository(root)) return at.map(() => undefined)
  const asked = at.filter((_one, index) => usable[index])
  const out = (await gitWithInput(root, ['cat-file', '--batch-check'], asked.map(({ sha, path }) => `${sha}:${path}\n`).join(''))).toString('utf8')
  const lines = out.split('\n')
  let next = 0
  return at.map((_one, index) => {
    if (!usable[index]) return undefined
    const [id, type] = (lines[next++] ?? '').split(' ')
    return type === 'blob' ? id : undefined
  })
}

export type GitTag = { name: string; sha: string; message: string }

/** Every tag, by name, on the commit it marks, with the words it carries; a lightweight one carries none. */
export async function allTags(root: string): Promise<GitTag[]> {
  if (!await isRepository(root)) return []
  const out = await git(root, [
    'for-each-ref', 'refs/tags', '--sort=creatordate',
    `--format=%(refname:short)${UNIT}%(objectname)${UNIT}%(*objectname)${UNIT}%(contents:subject)`,
  ]).catch(() => '')
  return out.split('\n').flatMap((line) => {
    const [name, object, target, subject] = line.split(UNIT)
    if (!name) return []
    return [{ name, sha: target || object, message: target ? subject?.trim() ?? '' : '' }]
  })
}

/**
 * The only tag name this history makes: a scope's label space and a label's
 * slug, `<space>/<slug>`. Nothing else is a name it tags with — not an option
 * (`--force` is a name git's own check lets through), not a name of a person's.
 */
export function isScopeTagName(name: string): boolean {
  return isSpacedLabel(name)
}

/** An annotated tag on a commit, never over one that is there, and only by a name {@link isScopeTagName} allows. */
export async function tagCommit(root: string, sha: string, name: string, message: string): Promise<'done' | 'exists'> {
  if (!isSha(sha) || !isScopeTagName(name) || !await isRepository(root)) throw new Error('shell.pathRefused')
  await git(root, ['check-ref-format', `refs/tags/${name}`])
  try {
    await git(root, ['rev-parse', '--verify', '--quiet', `refs/tags/${name}`])
    return 'exists'
  } catch {
    // No such tag, which is the ordinary case.
  }
  // After `--`, the name is a name whatever it says.
  await git(root, [...await identityArgs(root), 'tag', '-a', '-m', message, '--', name, sha])
  return 'done'
}

/** The history over one folder, as the folder implementation asks for it. */
export function folderGitAt(root: string) {
  return {
    keeping: () => isRepository(root),
    start: () => startHistory(root),
    readiness: () => readiness(root),
    changes: () => changes(root),
    commit: (paths: readonly string[], message: string) => commitPaths(root, paths, message),
    head: () => headOf(root),
    log: (wanted: LogWanted) => commitLog(root, wanted),
    treeAt: (sha: string, within: string) => treeAt(root, sha, within),
    readAt: (sha: string, paths: readonly string[]) => readAt(root, sha, paths),
    texts: (ids: readonly string[]) => textsOf(root, ids),
    sizes: (ids: readonly string[]) => sizesOf(root, ids),
    blobsAt: (at: readonly { sha: string; path: string }[]) => blobsAt(root, at),
    tags: () => allTags(root),
    tag: (sha: string, name: string, message: string) => tagCommit(root, sha, name, message),
  }
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the history over a folder asks of the machine's git (ADR-0031 §2):
 * the changes the folder holds, a commit of some of them, the commits with
 * what each changed, the files at one, and the tags.
 *
 * The same rules as `git.ts`, whose runner this uses: the system binary
 * without a shell, nothing that can ask a question, no hook, and this folder
 * and never one above it. Paths travel as literal pathspecs — a file a person
 * named `:(glob)*` is that file — and a list of them is handed to git in a
 * file rather than on the command line, which a folder of any size would
 * outgrow. The shape answered is the folder implementation's `FolderGit`
 * (`adapters/folder/folderGit.ts`), which this cannot import and meets as it
 * is written.
 */
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { LOCAL_SETTINGS_PATH } from '../../projects/folderSettings'
import { git, gitEnvironment, identityArgs, initRepository, isRepository } from './git'

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
  if (!await isRepository(root)) await initRepository(root)
}

/**
 * Those paths as they are now, and no others, as one commit — `undefined`
 * where none of them differs from the last. Whatever else a person has
 * staged stays staged and out of it.
 */
export async function commitPaths(root: string, paths: readonly string[], message: string): Promise<string | undefined> {
  const wanted = paths.filter(isInside).filter((path) => path !== LOCAL_SETTINGS_PATH)
  if (wanted.length === 0) return undefined
  await startHistory(root)
  const list = join(root, '.git', `lionsville-paths-${randomUUID()}`)
  await writeFile(list, `${wanted.map(literal).join('\0')}\0`)
  try {
    const from = ['--pathspec-from-file', list, '--pathspec-file-nul']
    await git(root, ['add', '-A', ...from])
    const before = await git(root, ['rev-parse', '--verify', '--quiet', 'HEAD']).catch(() => '')
    try {
      await git(root, [...await identityArgs(root), 'commit', '--no-verify', '-q', '-m', message, ...from])
    } catch (cause) {
      // Nothing of these to commit is an answer; anything else is a failure.
      const still = new Set((await changes(root)).map((change) => change.path))
      if (wanted.some((path) => still.has(path))) throw cause
      return undefined
    }
    const after = (await git(root, ['rev-parse', 'HEAD'])).trim()
    return after === before.trim() ? undefined : after
  } finally {
    await rm(list, { force: true })
  }
}

export type GitLogged = { sha: string; at: number; author: string; subject: string; message: string; changed: string[] }

export type LogWanted = { paths?: readonly string[]; grep?: string; limit: number; from?: string }

/** Commits, newest first, with every path each changed; none for a folder that keeps no history or has no commit. */
export async function commitLog(root: string, wanted: LogWanted): Promise<GitLogged[]> {
  if (!await isRepository(root)) return []
  if (wanted.from !== undefined && !isSha(wanted.from)) return []
  const paths = (wanted.paths ?? []).filter(isInside)
  if (wanted.paths && wanted.paths.length > 0 && paths.length === 0) return []
  let out: string
  try {
    out = await git(root, [
      '-c', 'core.quotePath=false', 'log', `-n${Math.max(1, Math.trunc(wanted.limit))}`, '--no-renames', '--name-only',
      `--format=${RECORD}%H${UNIT}%at${UNIT}%an${UNIT}%B${UNIT}`,
      ...(wanted.grep !== undefined ? ['--fixed-strings', `--grep=${wanted.grep}`] : []),
      ...(wanted.from !== undefined ? [wanted.from] : []),
      '--', ...paths.map(literal),
    ])
  } catch {
    // A repository with no commit yet: `git log` fails rather than saying nothing.
    return []
  }
  return out.split(RECORD).flatMap((row) => {
    const [sha, at, author, message, rest] = row.split(UNIT)
    if (!sha || message === undefined) return []
    const body = message.replace(/\n+$/, '')
    return [{
      sha, at: Number(at) * 1000, author: author ?? '', subject: body.split('\n')[0] ?? '', message: body,
      changed: (rest ?? '').split('\n').filter((path) => path.length > 0),
    }]
  })
}

/** Every file under `within` at a commit, paths from the root. */
export async function treeAt(root: string, sha: string, within: string): Promise<string[]> {
  if (!isSha(sha) || !await isRepository(root)) return []
  if (within !== '' && !isInside(within)) return []
  const out = await git(root, ['ls-tree', '-r', '--name-only', '-z', sha, ...(within ? ['--', literal(within)] : [])])
    .catch(() => '')
  return out.split('\0').filter((path) => path.length > 0)
}

export type GitFileAt = { path: string; text: string } | { path: string; bytes: Uint8Array }

/** Git fed on its standard input, answered in bytes. */
function gitWithInput(root: string, args: readonly string[], input: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = execFile('git', args, {
      cwd: root, encoding: 'buffer', maxBuffer: 256 * 1024 * 1024, windowsHide: true, env: gitEnvironment(), timeout: 60_000,
    }, (failure, stdout) => (failure ? reject(failure) : resolve(stdout)))
    child.stdin?.end(input)
  })
}

/** Those files as they were at a commit, in one read of git's objects; one that is not there is left out. */
export async function readAt(root: string, sha: string, paths: readonly string[]): Promise<GitFileAt[]> {
  const wanted = paths.filter((path) => isInside(path) && !path.includes('\n'))
  if (!isSha(sha) || wanted.length === 0 || !await isRepository(root)) return []
  const out = await gitWithInput(root, ['cat-file', '--batch'], wanted.map((path) => `${sha}:${path}\n`).join(''))
  const found: GitFileAt[] = []
  let at = 0
  for (const path of wanted) {
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
  return /^[A-Za-z0-9][A-Za-z0-9_-]*\/[a-z0-9]+(-[a-z0-9]+)*$/.test(name)
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
    changes: () => changes(root),
    commit: (paths: readonly string[], message: string) => commitPaths(root, paths, message),
    log: (wanted: LogWanted) => commitLog(root, wanted),
    treeAt: (sha: string, within: string) => treeAt(root, sha, within),
    readAt: (sha: string, paths: readonly string[]) => readAt(root, sha, paths),
    tags: () => allTags(root),
    tag: (sha: string, name: string, message: string) => tagCommit(root, sha, name, message),
  }
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The file channel's hands: everything it does to a real folder.
 *
 * Separate from `files.ts`, which is the IPC wiring, for two reasons. This file
 * imports no Electron, so it can be tested against a real temporary directory
 * by the ordinary test runner — and the checking below is the security of the
 * whole feature, which makes "can be tested" a requirement rather than a
 * convenience.
 *
 * **The renderer is untrusted.** It is where somebody else's document is
 * opened, and a path from it is a string an attacker may have chosen. Three
 * things follow, and all three are here rather than in the caller:
 *
 * - A path is relative, has no `..` and no empty segments, and no NUL. Checked
 *   before it is joined to anything, because `resolve()` will happily walk out
 *   of a folder if you let it.
 * - The result must still be inside the root once it is resolved — compared
 *   with `relative()`, not `startsWith`, so a sibling `landscape-evil/` does
 *   not pass for `landscape/`.
 * - And it must still be inside once symlinks are followed. A folder the user
 *   chose can contain a link to anywhere; without this, writing "a file in the
 *   project" can write over `~/.ssh/authorized_keys`.
 * - And never in the folder's `.git`, however it is spelled or linked to. The
 *   history is git's, and the main process runs git in this folder: a hook or
 *   a config written there by a page is a program run by the next commit.
 */
import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import {
  access, lstat, mkdir, open, readdir, readFile as read, realpath, rename, rm, stat, unlink,
} from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, sep } from 'node:path'
import type { DesktopEntry, DesktopFileContents, DesktopStamp } from '../../src/adapters/desktop/channel'

/** One path segment that is only ever a name. */
const BAD_SEGMENT = new Set(['', '.', '..'])

/**
 * Whether a name is the folder's history however a disk spells it: `.git` in
 * any case (macOS and Windows do not tell `.GIT` from it), with the trailing
 * dots and spaces Windows drops, or the short name Windows may give it.
 */
function isHistoryName(segment: string): boolean {
  const name = segment.toLowerCase().replace(/[. ]+$/, '')
  return name === '.git' || /^git~\d+$/.test(name)
}

/**
 * A relative path from the renderer, or `undefined` when it is not one.
 *
 * Refused rather than sanitised: a path with `..` in it is not a path somebody
 * typed slightly wrong, and quietly rewriting it into a different one is how a
 * check becomes a bypass.
 */
export function safeRelativePath(path: string): string | undefined {
  if (typeof path !== 'string' || path.includes('\0')) return undefined
  if (path === '') return ''
  if (isAbsolute(path) || /^[A-Za-z]:/.test(path)) return undefined
  const segments = path.split(/[/\\]/)
  if (segments.some((segment) => BAD_SEGMENT.has(segment))) return undefined
  if (isHistoryName(segments[0])) return undefined
  return segments.join(sep)
}

/** Is `target` the root itself or something under it, as strings? */
function within(root: string, target: string): boolean {
  if (target === root) return true
  const inside = relative(root, target)
  return inside !== '' && !inside.startsWith('..') && !isAbsolute(inside)
}

/**
 * The real path this request refers to, or `undefined` if it leaves the root.
 *
 * Symlinks are resolved as far as the path exists — a file being written does
 * not exist yet, so the deepest existing ancestor is what gets checked, which
 * is exactly where a link would have to be to divert the write.
 */
export async function resolveInside(root: string, path: string): Promise<string | undefined> {
  const relativePath = safeRelativePath(path)
  if (relativePath === undefined) return undefined

  let realRoot: string
  try {
    realRoot = await realpath(root)
  } catch {
    return undefined
  }

  const target = relativePath ? join(realRoot, relativePath) : realRoot
  if (!within(realRoot, target)) return undefined

  // Walk up to the deepest part that exists and resolve THAT: a link anywhere
  // along the way is what would take the write somewhere else.
  let existing = target
  while (existing !== realRoot) {
    try {
      await access(existing, constants.F_OK)
      break
    } catch {
      existing = dirname(existing)
    }
  }
  try {
    const real = await realpath(existing)
    if (!within(realRoot, real)) return undefined
    // A link inside the folder that leads into its history is refused as the history is.
    const first = relative(realRoot, real).split(sep)[0]
    if (first && isHistoryName(first)) return undefined
    return existing === target ? real : join(real, relative(existing, target))
  } catch {
    return undefined
  }
}

export async function listDirectory(root: string, path: string): Promise<DesktopEntry[] | undefined> {
  const target = await resolveInside(root, path)
  if (!target) return undefined
  try {
    const entries = await readdir(target, { withFileTypes: true })
    return entries
      // A symlink is neither, here: following one would be a second way into
      // the same escape the resolver above exists to close.
      .filter((entry) => entry.isFile() || entry.isDirectory())
      .map((entry) => ({ name: entry.name, kind: entry.isDirectory() ? 'directory' as const : 'file' as const }))
  } catch {
    return undefined
  }
}

export async function makeDirectory(root: string, path: string): Promise<void> {
  const target = await resolveInside(root, path)
  if (!target) throw new Error('shell.pathRefused')
  await mkdir(target, { recursive: true })
}

export async function readFile(root: string, path: string): Promise<DesktopFileContents | undefined> {
  const target = await resolveInside(root, path)
  if (!target) return undefined
  try {
    const [bytes, held] = await Promise.all([read(target), stat(target)])
    if (!held.isFile()) return undefined
    // The same fingerprint the watcher reports, so the renderer can tell a
    // report about bytes it has already seen from one about new ones.
    return {
      bytes: new Uint8Array(bytes), mtimeMs: held.mtimeMs, size: held.size,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    }
  } catch (cause) {
    // Not there, or a folder where a file was asked for, is an ordinary
    // answer. Anything else is a file that is there and will not read — no
    // permission, held by another process — and answered as absent it was
    // one a save removed as no longer wanted (ADR-0028, amended). Said by its
    // code alone: the message carries a path off the user's disk.
    if (isAbsence(cause)) return undefined
    // eslint-disable-next-line preserve-caught-error -- the cause names the path, which is the user's and stays here
    throw new Error(`NotReadableError: ${codeOf(cause)}`)
  }
}

const ABSENT = new Set(['ENOENT', 'ENOTDIR', 'EISDIR'])

function codeOf(cause: unknown): string {
  const code = (cause as { code?: unknown } | undefined)?.code
  return typeof code === 'string' ? code : 'unknown'
}

function isAbsence(cause: unknown): boolean {
  return ABSENT.has(codeOf(cause))
}

/**
 * A file written whole, or not at all: what every file of the app's own and
 * every file in a granted folder is written with.
 *
 * Temporary name in the same directory (a rename across filesystems is not
 * atomic), flushed to the platter before the rename (a rename is atomic in the
 * directory, which says nothing about whether the bytes arrived), then renamed
 * over. The temporary file is removed on any failure, so an interrupted save
 * leaves the previous file and nothing else, and a read meanwhile reads the
 * previous file whole. `mode` is the new file's, whatever the old one had.
 */
export async function writeWhole(target: string, data: Uint8Array | string, mode?: number): Promise<void> {
  await mkdir(dirname(target), { recursive: true })
  const temporary = `${target}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.tmp`
  try {
    const handle = await open(temporary, 'w', mode)
    try {
      await handle.writeFile(data)
      await handle.sync()
    } finally {
      await handle.close()
    }
    await rename(temporary, target)
  } catch (cause) {
    await unlink(temporary).catch(() => undefined)
    throw cause
  }
}

/** A file inside a granted folder, written whole or not at all (`writeWhole`), and its stamp. */
export async function writeFile(root: string, path: string, bytes: Uint8Array): Promise<DesktopStamp> {
  const target = await resolveInside(root, path)
  if (!target) throw new Error('shell.pathRefused')
  await writeWhole(target, bytes)
  return stampOf(bytes, await stat(target))
}

/**
 * Several files written and removed as one (ADR-0023, amendment 2): what a
 * working file lands with on the desktop.
 *
 * **Staged, then moved into place.** Every file is written under a temporary
 * name beside where it goes and flushed; only when every one of them is on
 * disk is any renamed over its target, and only then are the removals made.
 * A failure while staging removes what was staged and leaves the folder as it
 * was. Here rather than a file at a time from the renderer, because this is
 * the process a page reloading, a window closing or a renderer crashing does
 * not interrupt: once this call has begun, the folder ends up with all of it.
 * What is left is the machine itself stopping during the renames — a moment,
 * not a load — and each rename is atomic on its own.
 *
 * Every path is checked before anything is written, so one path outside the
 * root refuses the whole call. Answers each write's stamp, in order.
 */
export async function writeTogether(
  root: string,
  writes: readonly { path: string; bytes: Uint8Array }[],
  removals: readonly string[],
): Promise<DesktopStamp[]> {
  const targets = await Promise.all(writes.map((write) => resolveInside(root, write.path)))
  const gone = await Promise.all(removals.map(async (path) => (safeRelativePath(path) ? resolveInside(root, path) : undefined)))
  if (targets.some((target) => !target) || gone.some((target) => !target)) throw new Error('shell.pathRefused')
  const suffix = `.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.landing`
  const staged: string[] = []
  try {
    for (const [at, write] of writes.entries()) {
      const target = targets[at]!
      await mkdir(dirname(target), { recursive: true })
      const temporary = `${target}${suffix}`
      staged.push(temporary)
      const handle = await open(temporary, 'w')
      try {
        await handle.write(write.bytes)
        await handle.sync()
      } finally {
        await handle.close()
      }
    }
  } catch (cause) {
    await Promise.all(staged.map((temporary) => unlink(temporary).catch(() => undefined)))
    throw cause
  }
  for (const [at, temporary] of staged.entries()) await rename(temporary, targets[at]!)
  for (const target of gone) await rm(target!, { force: true })
  return Promise.all(writes.map(async (write, at) => stampOf(write.bytes, await stat(targets[at]!))))
}

/**
 * A file or a folder renamed to another place inside the root — a scope moved
 * with everything in it, links and empty folders included, and its bytes
 * never read. Refused, with nothing moved, where either path leads out or into
 * the history, where the root itself is asked for, where the thing moved is a
 * link (a rename would move the link and not what the page asked about), and
 * where something is at the new place already — but for the thing itself on
 * a disk that does not tell case apart, which a change of case only renames.
 * The folders on the way to it are made.
 */
export async function moveEntry(root: string, from: string, to: string): Promise<void> {
  const source = await resolveInside(root, from)
  const target = await resolveInside(root, to)
  const fromPath = safeRelativePath(from)
  const toPath = safeRelativePath(to)
  if (!source || !target || !fromPath || !toPath) throw new Error('shell.pathRefused')
  const realRoot = await realpath(root)
  const [named, naming] = [join(realRoot, fromPath), join(realRoot, toPath)]
  const held = await lstat(named).catch(() => undefined)
  if (!held || held.isSymbolicLink()) throw new Error('shell.pathRefused')
  const there = await lstat(naming).catch(() => undefined)
  const recased = there !== undefined && named !== naming && named.toLowerCase() === naming.toLowerCase()
    && there.ino === held.ino && there.dev === held.dev
  if (recased) {
    await rename(named, naming)
    return
  }
  if (there || within(source, target)) throw new Error('shell.pathRefused')
  await mkdir(dirname(target), { recursive: true })
  await rename(named, target)
}

export async function removeEntry(
  root: string, path: string, options?: { recursive?: boolean },
): Promise<void> {
  const target = await resolveInside(root, path)
  // Never the root itself: "remove everything the user chose" is not something
  // this channel offers, whatever the renderer asks for.
  if (!target || !safeRelativePath(path)) return
  await rm(target, { recursive: options?.recursive === true, force: true })
}

/** What a file is without reading it: its size, when it was last written, and its number on its disk; nothing for what is not a file. */
export async function stampAt(root: string, path: string): Promise<{ size: number; lastModified: number; inode: number } | undefined> {
  const target = await resolveInside(root, path)
  if (!target) return undefined
  const held = await stat(target).catch(() => undefined)
  return held?.isFile() ? { size: held.size, lastModified: held.mtimeMs, inode: held.ino } : undefined
}

export async function fingerprint(root: string, path: string): Promise<DesktopStamp | undefined> {
  const held = await readFile(root, path)
  if (!held) return undefined
  return { mtimeMs: held.mtimeMs, size: held.size, sha256: sha256(held.bytes) }
}

function stampOf(bytes: Uint8Array, held: { mtimeMs: number; size: number }): DesktopStamp {
  return { mtimeMs: held.mtimeMs, size: held.size, sha256: sha256(bytes) }
}

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

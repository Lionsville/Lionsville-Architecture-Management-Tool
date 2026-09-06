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
 */
import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import {
  access, mkdir, open, readdir, readFile as read, realpath, rename, rm, stat, unlink,
} from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, sep } from 'node:path'
import type { DesktopEntry, DesktopFileContents, DesktopStamp } from '../../src/adapters/desktop/channel'

/** One path segment that is only ever a name. */
const BAD_SEGMENT = new Set(['', '.', '..'])

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
    return { bytes: new Uint8Array(bytes), mtimeMs: held.mtimeMs, size: held.size }
  } catch {
    return undefined
  }
}

/**
 * Written whole, or not at all.
 *
 * Temporary name in the same directory (a rename across filesystems is not
 * atomic), flushed to the platter before the rename (a rename is atomic in the
 * directory, which says nothing about whether the bytes arrived), then renamed
 * over. The temporary file is removed on any failure, so an interrupted save
 * leaves the previous file and nothing else.
 */
export async function writeFile(root: string, path: string, bytes: Uint8Array): Promise<DesktopStamp> {
  const target = await resolveInside(root, path)
  if (!target) throw new Error('shell.pathRefused')
  await mkdir(dirname(target), { recursive: true })

  const temporary = `${target}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.tmp`
  try {
    const handle = await open(temporary, 'w')
    try {
      await handle.write(bytes)
      await handle.sync()
    } finally {
      await handle.close()
    }
    await rename(temporary, target)
  } catch (cause) {
    await unlink(temporary).catch(() => undefined)
    throw cause
  }
  return stampOf(bytes, await stat(target))
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

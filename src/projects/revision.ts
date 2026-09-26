// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A save may say what it expects to overwrite.
 *
 * A scope is read, changed and written back whole by everything outside the
 * open session — the organisation screen's dialogs, the four gestures, a move
 * carrying its references. Between the read and the write somebody else may
 * have written the same scope: another window, another person, a sync client.
 * A whole write over that is their work gone without anybody being told, and
 * the only party that can notice is the store, at the moment of writing. So a
 * store stamps what it read (`ScopeSnapshot.revision`), and a caller that read
 * before it writes hands that back; the store refuses the write when what it
 * holds is no longer what was read.
 *
 * The revision is the store's own word, and opaque. The ones this tree keeps
 * are a fingerprint of what is stored, because content is the one thing every
 * store can compare without keeping anything beside it: a counter would have to
 * be written somewhere, and a time is the same for two writes in one tick.
 */
import { ShellError } from '../platform/errors'
import type { FolderFile } from './folderFormat'

/** What a store refuses a save with when the scope moved since it was read. */
export const SCOPE_MOVED = 'shell.scopeMoved' as const

/** The refusal, as a store throws it. */
export function scopeMoved(path: string): ShellError {
  return new ShellError(SCOPE_MOVED, { path })
}

/** Was this failure a scope that moved since it was read, rather than a store that failed? */
export function isScopeMoved(cause: unknown): boolean {
  return cause instanceof ShellError && cause.key === SCOPE_MOVED
}

/**
 * A fingerprint of some text and bytes, in order.
 *
 * Two 32-bit lanes of a multiply-xorshift hash (the shape of `cyrb53`), so two
 * states of a scope collide once in about 2⁵³ rather than once in four billion.
 * Not a cryptographic hash and not meant as one: nobody chooses the contents
 * of a scope to collide with a colleague's, and it runs in every place a store
 * does, a browser tab included, without waiting for anything.
 */
export function fingerprint(parts: Iterable<string | Uint8Array>): string {
  let one = 0xdeadbeef
  let two = 0x41c6ce57
  const take = (code: number): void => {
    one = Math.imul(one ^ code, 2654435761)
    two = Math.imul(two ^ code, 1597334677)
  }
  for (const part of parts) {
    if (typeof part === 'string') {
      for (let at = 0; at < part.length; at += 1) take(part.charCodeAt(at))
    } else {
      for (const byte of part) take(byte)
    }
    // A separator no text or byte can be, so `ab` + `c` is not `a` + `bc`.
    take(0x10000)
  }
  one = Math.imul(one ^ (one >>> 16), 2246822507) ^ Math.imul(two ^ (two >>> 13), 3266489909)
  two = Math.imul(two ^ (two >>> 16), 2246822507) ^ Math.imul(one ^ (one >>> 13), 3266489909)
  return (4294967296 * (2097151 & two) + (one >>> 0)).toString(36)
}

/**
 * A scope's revision, from the files it is kept as: every path and what is in
 * it, in path order, so the order a folder happened to list them in does not
 * make two revisions of one state.
 */
export function folderRevision(files: readonly FolderFile[]): string {
  const sorted = [...files].sort((one, other) => (one.path < other.path ? -1 : one.path > other.path ? 1 : 0))
  return fingerprint(sorted.flatMap((file) => [file.path, 'text' in file ? file.text : file.bytes]))
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Several files written into a folder as one, by the folder's own handles
 * (ADR-0023, amendment 3): what a working file lands with in a browser tab
 * that was given a folder.
 *
 * **Staged, then moved into place**, the way the desktop's main process does
 * it (`electron/main/fileStore.ts`). Every file is written under a name of its
 * own beside where it goes — a writable's bytes land on `close()`, whole or
 * not at all — and only when every one of them is there is any renamed over
 * its target (`FileHandleLike.move`). A failure while staging removes what was
 * staged and leaves the folder as it was; so does the page going away while
 * it stages, but for the staged files themselves, which end in `.landing`,
 * are no file of the format and are read by nothing. What is left is the page
 * going away during the renames: a moment rather than a load, each rename
 * whole on its own.
 *
 * A handle with no `move` — a browser from before it could rename a file the
 * person chose — cannot stage, and a first rename that is refused says the
 * same; both answer `false` with the staged files removed and nothing written,
 * and the store then writes one file at a time. A rename refused after
 * another went through is a landing written in part, and says so.
 */
import { ShellError, reasonOf } from '../../platform/errors'
import type { DirectoryHandleLike } from '../../ports/DirectoryHandle'

/** One file to write: the folder it goes in, its name there, and what it holds. */
export type StagedWrite = { folder: DirectoryHandleLike; name: string; data: string | Uint8Array }

type Staged = { folder: DirectoryHandleLike; staged: string; name: string; move?: (name: string) => Promise<void> }

/** What a staged file is called: its target's name, the landing's own mark, and an ending nothing reads. */
function stagedName(name: string, mark: string): string {
  return `${name}.${mark}.landing`
}

async function unstage(held: readonly Staged[]): Promise<void> {
  // Best effort, and on purpose: the landing already failed, and a staged
  // file left behind is inert — no file of the format, read by nothing.
  await Promise.all(held.map(({ folder, staged }) => folder.removeEntry(staged).catch(() => undefined)))
}

/**
 * Write every file staged and then move each into place. `true` is written;
 * `false` is *this folder cannot stage*, with nothing written. Throws the
 * cause where staging failed (nothing written), and
 * `shell.workingFileLandedInPart` where a rename failed after another went
 * through.
 */
export async function writeStaged(writes: readonly StagedWrite[]): Promise<boolean> {
  const mark = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  const held: Staged[] = []
  try {
    for (const { folder, name, data } of writes) {
      const staged = stagedName(name, mark)
      const handle = await folder.getFileHandle(staged, { create: true })
      const move = handle.move?.bind(handle)
      held.push({ folder, staged, name, ...(move ? { move } : {}) })
      if (!move) {
        await unstage(held)
        return false
      }
      const writable = await handle.createWritable()
      try {
        await writable.write(data)
      } finally {
        await writable.close()
      }
    }
  } catch (cause) {
    await unstage(held)
    throw cause
  }
  for (const [at, { move, name }] of held.entries()) {
    try {
      // Every staged file has one: staging stopped at the first without.
      await move?.(name)
    } catch (cause) {
      await unstage(held.slice(at))
      if (at === 0) return false
      throw new ShellError('shell.workingFileLandedInPart', { reason: reasonOf(cause) })
    }
  }
  return true
}

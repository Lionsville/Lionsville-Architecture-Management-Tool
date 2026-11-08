// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One read of a file per open, over the desktop's file channel.
 *
 * Opening a view from a Home asks for the same scope several times at once:
 * the view, the scopes above it, the findings and the owners' descriptions each
 * read it, and a read of a scope reads its header again to find it. Over the
 * channel every one of those is a round trip to main, and on a team three
 * levels down an open came to over a thousand reads, most files two to four
 * times, before the first card was drawn.
 *
 * So a read, a listing or a stamp answered in the last {@link KEEP_MS} is answered again
 * from here, and one still on its way is shared. That is long enough for one
 * open and short enough that the next open reads the folder as it is now.
 * Anything that changes the folder through this channel forgets what was read
 * under that root before it is done, and so does a change the watcher reports
 * or a pull: what is kept is only ever what the folder said since its last
 * known change.
 */
import type { DesktopEntry, DesktopFileContents, DesktopFiles } from './channel'

type FileStamp = Awaited<ReturnType<DesktopFiles['stamp']>>

/** How long a read stands for the file: one open's worth, and well under the time a person takes to look. */
export const KEEP_MS = 1000

type Kept<T> = { at: number; answer: Promise<T> }

export type ReadingOnce = {
  files: DesktopFiles
  /** Forget what was read under a root: the folder changed in a way this channel did not see. */
  forget(root: string): void
}

export function readingOnce(files: DesktopFiles, keep = KEEP_MS, now: () => number = () => performance.now()): ReadingOnce {
  const reads = new Map<string, Kept<DesktopFileContents | undefined>>()
  const lists = new Map<string, Kept<DesktopEntry[] | undefined>>()
  const stamps = new Map<string, Kept<FileStamp>>()
  const keyFor = (root: string, path: string) => `${root}\u0000${path}`

  const forget = (root: string) => {
    const prefix = `${root}\u0000`
    for (const held of [reads, lists, stamps] as Map<string, unknown>[]) for (const key of held.keys()) if (key.startsWith(prefix)) held.delete(key)
  }

  function once<T>(held: Map<string, Kept<T>>, key: string, ask: () => Promise<T>): Promise<T> {
    const at = now()
    // Gone stale entries go as they are passed, so a long session keeps no bytes it will not hand out again.
    for (const [other, kept] of held) if (at - kept.at >= keep) held.delete(other)
    const kept = held.get(key)
    if (kept) return kept.answer
    const answer = ask()
    const entry = { at, answer }
    held.set(key, entry)
    // A failure is not kept: the next asker tries again.
    answer.catch(() => { if (held.get(key) === entry) held.delete(key) })
    return answer
  }

  /** A change made through this channel, forgetting before and after: a read that crossed it is not kept either. */
  async function changing<T>(root: string, change: () => Promise<T>): Promise<T> {
    forget(root)
    try {
      return await change()
    } finally {
      forget(root)
    }
  }

  // Before anyone else hears the change: the listeners that reload what changed read after this one has forgotten it.
  files.onChanged((change) => forget(change.root))

  return {
    forget,
    files: {
      ...files,
      read: (root, path) => once(reads, keyFor(root, path), () => files.read(root, path)),
      list: (root, path) => once(lists, keyFor(root, path), () => files.list(root, path)),
      stamp: (root, path) => once(stamps, keyFor(root, path), () => files.stamp(root, path)),
      makeDirectory: (root, path) => changing(root, () => files.makeDirectory(root, path)),
      write: (root, path, bytes) => changing(root, () => files.write(root, path, bytes)),
      create: (root, path, bytes) => changing(root, () => files.create(root, path, bytes)),
      writeTogether: (root, writes, removals) => changing(root, () => files.writeTogether(root, writes, removals)),
      remove: (root, path, options) => changing(root, () => files.remove(root, path, options)),
      move: (root, from, to) => changing(root, () => files.move(root, from, to)),
    },
  }
}

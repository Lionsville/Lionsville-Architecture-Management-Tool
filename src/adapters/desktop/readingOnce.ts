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
 * So a read answered in the last {@link KEEP_MS} is answered again from here,
 * and one still on its way is shared. That is long enough for one open and
 * short enough that the next open reads the folder as it is now.
 *
 * A listing and a stamp are kept longer where the folder is watched: until the
 * watcher reports a change under them, for at most {@link WATCHED_KEEP_MS}.
 * Dating the tree stamps every file of the organisation, and a team's open
 * asked main for all four hundred of them each time; the watcher hears every
 * file the app reads that changes, and is what the app already trusts to say
 * that the open scope changed elsewhere. A path with a dotted segment is what
 * the watcher does not report, and is kept for {@link KEEP_MS} only.
 *
 * What changes is forgotten by its path, never the whole folder: a file
 * written through this channel, and the listings of the folders above it,
 * before the write and again after it, so a read that crossed it is not kept;
 * what a change the watcher reports names, unless it is the echo of a write
 * this channel made — the same bytes it wrote; and everything at once on a
 * pull or a resolve, and on {@link ReadingOnce.forget}. One save used to forget
 * the whole folder at every echo, and the tree read again after it came to
 * hundreds of reads and listings and a stamp of every file.
 */
import type { DesktopChange, DesktopEntry, DesktopFileContents, DesktopFiles } from './channel'

type FileStamp = Awaited<ReturnType<DesktopFiles['stamp']>>

/** How long a read stands for the file: one open's worth, and well under the time a person takes to look. */
export const KEEP_MS = 1000

/** How long a listing or a stamp under a watched folder stands at most, where nothing reports it changed. */
export const WATCHED_KEEP_MS = 5 * 60_000

type Kept<T> = { at: number; answer: Promise<T>; keep: number }

export type ReadingOnce = {
  files: DesktopFiles
  /** Forget what was read under a root: the folder changed in a way this channel did not see. */
  forget(root: string): void
}

/** The folders a path is in, the root's own (`''`) among them. */
function foldersAbove(path: string): string[] {
  const parts = path.split('/')
  return parts.map((_, at) => parts.slice(0, at).join('/'))
}

/** A path the watcher reports a change to: none of its segments starts with a dot. */
const watchable = (path: string) => !path.split('/').some((segment) => segment.startsWith('.'))

export function readingOnce(files: DesktopFiles, keep = KEEP_MS, now: () => number = () => performance.now()): ReadingOnce {
  const reads = new Map<string, Kept<DesktopFileContents | undefined>>()
  const lists = new Map<string, Kept<DesktopEntry[] | undefined>>()
  const stamps = new Map<string, Kept<FileStamp>>()
  const every = [reads, lists, stamps] as Map<string, unknown>[]
  /** What this channel last wrote at a path, by its bytes' hash: the watcher's echo of it is no change. */
  const written = new Map<string, string>()
  const watched = new Set<string>()
  const keyFor = (root: string, path: string) => `${root}\u0000${path}`
  const watchedKeep = Math.max(keep, WATCHED_KEEP_MS)
  const keepFor = (root: string, path: string) => (watched.has(root) && watchable(path) ? watchedKeep : keep)

  const forget = (root: string) => {
    const prefix = `${root}\u0000`
    for (const held of every) for (const key of held.keys()) if (key.startsWith(prefix)) held.delete(key)
  }

  /** One path changed, and the listings of the folders it is in; `within`, all that was under it too. */
  const forgetPath = (root: string, path: string, within = false) => {
    reads.delete(keyFor(root, path))
    stamps.delete(keyFor(root, path))
    lists.delete(keyFor(root, path))
    for (const folder of foldersAbove(path)) lists.delete(keyFor(root, folder))
    if (!within) return
    const under = keyFor(root, `${path}/`)
    for (const held of every) for (const key of held.keys()) if (key.startsWith(under)) held.delete(key)
  }

  let swept = 0
  function once<T>(held: Map<string, Kept<T>>, root: string, path: string, ask: () => Promise<T>, longer = false): Promise<T> {
    const at = now()
    // What went stale goes now and then, so a long session keeps no bytes it will not hand out again.
    if (at - swept >= keep) {
      swept = at
      for (const map of every as Map<string, Kept<unknown>>[]) for (const [other, kept] of map) if (at - kept.at >= kept.keep) map.delete(other)
    }
    const key = keyFor(root, path)
    const kept = held.get(key)
    if (kept && at - kept.at < kept.keep) return kept.answer
    const answer = ask()
    const entry = { at, answer, keep: longer ? keepFor(root, path) : keep }
    held.set(key, entry)
    // A failure is not kept: the next asker tries again.
    answer.catch(() => { if (held.get(key) === entry) held.delete(key) })
    return answer
  }

  /** A change made through this channel, forgetting its paths before and after: a read that crossed it is not kept either. */
  async function changing<T>(root: string, paths: readonly string[], change: () => Promise<T>, within = false): Promise<T> {
    const forgetAll = () => { for (const path of paths) forgetPath(root, path, within) }
    forgetAll()
    try {
      return await change()
    } finally {
      forgetAll()
    }
  }

  const heard = (change: DesktopChange) => {
    const key = keyFor(change.root, change.path)
    // Our own write coming back: what it changed was forgotten when it was made, and what was read since is of it.
    if (change.stamp && written.get(key) === change.stamp.sha256) return
    written.delete(key)
    // Gone, which may be a folder and everything that was in it.
    forgetPath(change.root, change.path, !change.stamp)
  }
  // Before anyone else hears the change: the listeners that reload what changed read after this one has forgotten it.
  files.onChanged(heard)

  return {
    forget,
    files: {
      ...files,
      read: (root, path) => once(reads, root, path, () => files.read(root, path)),
      list: (root, path) => once(lists, root, path, () => files.list(root, path), true),
      stamp: (root, path) => once(stamps, root, path, () => files.stamp(root, path), true),
      watch: async (root) => {
        await files.watch(root)
        watched.add(root)
      },
      unwatch: async (root) => {
        watched.delete(root)
        forget(root)
        await files.unwatch(root)
      },
      makeDirectory: (root, path) => changing(root, [path], () => files.makeDirectory(root, path)),
      write: (root, path, bytes) => changing(root, [path], async () => {
        const stamp = await files.write(root, path, bytes)
        written.set(keyFor(root, path), stamp.sha256)
        return stamp
      }),
      create: (root, path, bytes) => changing(root, [path], () => files.create(root, path, bytes)),
      writeTogether: (root, writes, removals) => changing(root, [...writes.map((one) => one.path), ...removals], async () => {
        const stamps = await files.writeTogether(root, writes, removals)
        for (const [at, one] of writes.entries()) {
          const sha = stamps[at]?.sha256
          if (sha) written.set(keyFor(root, one.path), sha)
        }
        return stamps
      }),
      remove: (root, path, options) => changing(root, [path], () => files.remove(root, path, options), true),
      move: (root, from, to) => changing(root, [from, to], () => files.move(root, from, to), true),
    },
  }
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a browser folder's commits held, read back from what was kept of them
 * (`browserFolderGit.ts`).
 *
 * A commit is kept as what it changed, from and to, and not as the whole of
 * its tree: a folder of a thousand files recorded a thousand times would keep
 * a million rows. The whole tree is kept at every `CHECKPOINT`th commit
 * instead, so a commit's tree is the checkpoint at or before it with at most
 * `CHECKPOINT - 1` commits' changes laid over it. The commits from one
 * checkpoint to the next are read together, as a segment, and the last few
 * segments read are kept; a commit never changes, so a segment is right for
 * as long as it is kept, once it reaches the commit that is asked for.
 */
import type { FolderCommit } from '../folderGit'
import { Lru } from '../lru'
import type { BrowserFolder } from './browserFolder'

/** A commit as a log lists it, kept under its place in the line; `blobs` is what it changed, from and to (`''` for none). */
export type LogRow = Omit<FolderCommit, 'subject'> & { seq: number; blobs: Record<string, [string, string]> }

/** Where a commit is in the line, kept under its id. */
export type CommitRow = { seq: number }

/** A whole tree, each path to its contents' id: kept at a checkpoint. */
export type Tree = Record<string, string>

/** Every how many commits the whole tree is kept. */
export const CHECKPOINT = 64

/** How many segments are kept in memory once read. */
const SEGMENTS = 16

export function seqName(seq: number): string {
  return String(seq).padStart(12, '0')
}

/** The checkpoint at or before a commit: the first commit is one, and every `CHECKPOINT`th after it. */
export function checkpointOf(seq: number): number {
  return seq - ((seq - 1) % CHECKPOINT)
}

/** The commits from a checkpoint up to the next: its whole tree, and the changes of those after it, in order. */
type Segment = { at: number; tree: Tree; rows: readonly LogRow[] }

/** A tree with what one commit changed laid over it. */
export function laidOver(tree: Tree, row: Pick<LogRow, 'blobs'>): Tree {
  const next = { ...tree }
  for (const [path, [, to]] of Object.entries(row.blobs)) {
    if (to) next[path] = to
    else delete next[path]
  }
  return next
}

function treeIn(segment: Segment, seq: number): Tree {
  return segment.rows.slice(0, seq - segment.at).reduce(laidOver, segment.tree)
}

function blobIn(segment: Segment, seq: number, path: string): string | undefined {
  for (let at = seq - segment.at - 1; at >= 0; at -= 1) {
    const changed = segment.rows[at].blobs[path]
    if (changed) return changed[1] || undefined
  }
  return segment.tree[path]
}

/** A browser folder's commits' trees, read from its checkpoints and changes. */
export function browserTrees(folder: BrowserFolder) {
  const store = folder.store
  const segments = new Lru<number, Segment>(SEGMENTS)

  const segment = async (seq: number): Promise<Segment> => {
    const at = checkpointOf(seq)
    const held = segments.get(at)
    // A segment read before later commits were added to it is read again.
    if (held && held.at + held.rows.length >= seq) return held
    const [treeKey, from, below] = [
      await folder.keyOf('tree', seqName(at)), await folder.keyOf('seq', seqName(at + 1)), await folder.keyOf('seq', seqName(at + CHECKPOINT)),
    ]
    const read = await store.transaction(['folderData'], 'read', async (tx) => ({
      tree: await tx.get<Tree>('folderData', treeKey) ?? {},
      rows: (await tx.range<LogRow>('folderData', { from, below })).map(({ value }) => value),
    }))
    const found = { at, ...read }
    segments.set(at, found)
    return found
  }

  /** Where each commit is in the line, in one read; `undefined` for one this browser does not hold. */
  const seqsOf = async (shas: readonly string[]): Promise<Map<string, number | undefined>> => {
    const distinct = [...new Set(shas)]
    const keys = await Promise.all(distinct.map((sha) => folder.keyOf('commit', sha)))
    const rows = await store.transaction(['folderData'], 'read', (tx) => Promise.all(keys.map((key) => tx.get<CommitRow>('folderData', key))))
    return new Map(distinct.map((sha, at) => [sha, rows[at]?.seq]))
  }

  return {
    seqsOf,

    /** A commit's whole tree; empty for one this browser does not hold. */
    async treeAt(sha: string): Promise<Tree> {
      const seq = (await seqsOf([sha])).get(sha)
      return seq === undefined ? {} : treeIn(await segment(seq), seq)
    },

    /** What each path held at each commit, reading each segment once. */
    async blobsAt(at: readonly { sha: string; path: string }[]): Promise<(string | undefined)[]> {
      const seqs = await seqsOf(at.map(({ sha }) => sha))
      const found: (string | undefined)[] = []
      for (const { sha, path } of at) {
        const seq = seqs.get(sha)
        found.push(seq === undefined ? undefined : blobIn(await segment(seq), seq, path))
      }
      return found
    },
  }
}

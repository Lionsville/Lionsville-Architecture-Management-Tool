// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What travels with a record (ADR-0037 §6): its thread, when a merge folds
 * the record into a survivor or a move takes it to another scope.
 *
 * **The one seam for both.** {@link carryThread} takes the comments of the
 * scope a record leaves and of the scope it arrives in, and answers what both
 * lists become; the caller turns each into that scope's steps
 * (`model/commands.commentsToCommands`) in the same step as the record's own,
 * on every scope it writes — all or none, as the merge machinery writes.
 *
 * - **A merge** (ADR-0035): `about` is the absorbed record, `into` the
 *   survivor. Each comment is about the survivor from then on and gains
 *   `from`, the record it was written about, so the thread can say so.
 * - **A move** of an observation (ADR-0038): `into` is `about` — the record
 *   keeps its id — and the thread goes to the scope it now lives in, `from`
 *   saying the scope it came from.
 *
 * Every comment keeps its id, author, time, body and replies. A comment that
 * already came from somewhere keeps that first `from`: the record it was
 * written about does not change because it travelled twice.
 */
import type { Comment, CommentFrom } from '../model/comment'
import { isAbout } from '../model/comment'
import type { RecordKey } from '../model/recordKey'

/** One scope's comments, by the scope's path (`''` the organisation). */
export type ScopeComments = { readonly scope: string; readonly comments: readonly Comment[] }

/** What a thread carried leaves behind: both lists as they become, and how many comments went. */
export type Carried = { readonly from: Comment[]; readonly to: Comment[]; readonly moved: number }

/** Where a comment was written, as it arrives: the first place it said, or the record and scope it leaves. */
function cameFrom(comment: Comment, about: RecordKey, leaving: string, arriving: string): CommentFrom | undefined {
  if (comment.from) {
    return comment.from.scope === undefined && leaving !== arriving ? { ...comment.from, scope: leaving } : comment.from
  }
  return leaving === arriving ? { kind: about.kind, id: about.id } : { kind: about.kind, id: about.id, scope: leaving }
}

/**
 * Carry the thread about `about` from one scope's comments to another's,
 * about `into` from then on. Within one scope the comments keep their place;
 * across two they leave the one and are added at the end of the other, oldest
 * first. A record with no thread changes neither list (`moved` 0, the lists
 * the same objects' copies).
 */
export function carryThread(from: ScopeComments, to: ScopeComments, about: RecordKey, into: RecordKey): Carried {
  const travelling = (one: Comment) => isAbout(one, about)
  const arrived = (one: Comment): Comment => {
    const was = cameFrom(one, about, from.scope, to.scope)
    const same = was !== undefined && was.kind === into.kind && was.id === into.id && (was.scope ?? to.scope) === to.scope
    const { from: _was, ...rest } = one
    return { ...rest, about: into, ...(was && !same ? { from: was } : {}) }
  }
  const moved = from.comments.filter(travelling).length
  if (from.scope === to.scope) {
    const both = from.comments.map((one) => (travelling(one) ? arrived(one) : one))
    return { from: both, to: both, moved }
  }
  return {
    from: from.comments.filter((one) => !travelling(one)),
    to: [...to.comments, ...from.comments.filter(travelling).map(arrived)],
    moved,
  }
}

/** How many comments a carry of the thread about `about` would take: what a plan says before anything moves. */
export function threadSize(comments: readonly Comment[], about: RecordKey): number {
  return comments.filter((one) => isAbout(one, about)).length
}

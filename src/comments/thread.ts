// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A thread (ADR-0037 §4): the comments about one record, oldest first, each
 * with the replies that answer it under it — one level deep, never more.
 *
 * Pure, over the scope's list of comments as the model keeps it, so the
 * reader, the register's count and the agent read a thread the same way.
 */
import type { Comment, CommentId } from '../model/comment'
import { isAbout, isRemoved } from '../model/comment'
import type { RecordKey } from '../model/recordKey'

/** A comment and the replies under it, oldest first. */
export type ThreadEntry = { readonly comment: Comment; readonly replies: readonly Comment[] }

/**
 * The thread about a record: every comment that answers nothing, oldest
 * first, each with its replies under it. A reply whose comment is not in the
 * thread — a file edited by hand — stands on its own rather than vanishing.
 */
export function threadOf(comments: readonly Comment[], about: RecordKey): ThreadEntry[] {
  const mine = comments.filter((one) => isAbout(one, about))
  const tops = new Set(mine.filter((one) => one.replyTo === undefined).map((one) => one.id))
  const standing = mine.filter((one) => one.replyTo === undefined || !tops.has(one.replyTo))
  return standing.map((comment) => ({
    comment,
    replies: comment.replyTo === undefined ? mine.filter((one) => one.replyTo === comment.id) : [],
  }))
}

/** How many comments a record has that say something: a tombstone is not counted. */
export function commentCount(comments: readonly Comment[], about: RecordKey): number {
  return comments.filter((one) => isAbout(one, about) && !isRemoved(one)).length
}

/** A record's key as a map is keyed by it. */
export const recordKeyText = (about: RecordKey): string => `${about.kind}:${about.id}`

/** How many comments each record commented on has, keyed by {@link recordKeyText}: what a register's count reads. */
export function commentCounts(comments: readonly Comment[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>()
  for (const one of comments) {
    if (isRemoved(one)) continue
    const key = recordKeyText(one.about)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

/**
 * The comment a reply to `id` answers: the comment itself, or — answering a
 * reply — the comment that reply is under, so a thread is never more than
 * one level deep (§4). Nothing where the scope holds no such comment.
 */
export function replyTarget(comments: readonly Comment[], id: CommentId): CommentId | undefined {
  const held = comments.find((one) => one.id === id)
  if (!held) return undefined
  return held.replyTo ?? held.id
}

/** The newest comments of a scope, newest first: what the agent reads where no record is named. */
export function newestComments(comments: readonly Comment[], limit: number): Comment[] {
  return [...comments].sort((a, b) => b.at.localeCompare(a.at)).slice(0, Math.max(0, limit))
}

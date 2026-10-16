// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A comment: a record of the scope about another record of it (ADR-0037 §1).
 *
 * A remark is never an edit. The record it is about stays as it was, its
 * history its own; the comment is a record beside it, named by its own id and
 * pointing at the record by its key (`recordKey.ts`), so the diff, the
 * history, search and every repository read it as they read any list of the
 * scope. Which kinds may be commented on is `commentable.ts`'s to say.
 *
 * **Its author is a person in the register**, by id (ADR-0036 §8): a
 * `{ person }` and never text, so forgetting the person reaches the comment
 * as it reaches everything else.
 *
 * **Nothing vanishes silently.** A comment removed is a tombstone — its body
 * emptied, `removed` set — so the replies under it keep their place; one that
 * was edited says when.
 */
import type { PickedPerson } from './person'
import { isPicked } from './person'
import type { RecordKey, RecordKind } from './recordKey'
import { isRecordKind } from './recordKey'

/** A comment's id: drawn at random, never derived and never reused. */
export type CommentId = string

/**
 * Where a comment came from, where a merge or a move brought it to the record
 * it is about now (ADR-0037 §6): the record it was written about, and that
 * record's scope where it is another. A scope moved or renamed readdresses it
 * as it readdresses a link.
 */
export type CommentFrom = { readonly kind: RecordKind; readonly id: string; readonly scope?: string }

/** Who removed a comment, and when. */
export type CommentRemoved = { readonly at: string; readonly by: PickedPerson }

export type Comment = {
  readonly id: CommentId
  /** The record it is about: a kind and an id in this scope. */
  readonly about: RecordKey
  /** Its author, by register id: never text. */
  readonly by: PickedPerson
  /** When it was written, an ISO date and time. */
  readonly at: string
  /** What it says, with the Markdown a description takes. Empty once removed. */
  readonly body: string
  /** The comment it answers, where it is a reply: never a reply itself (§4). */
  readonly replyTo?: CommentId
  /** When its body was last changed, where it was. */
  readonly edited?: string
  /** Where it was removed: the thread shows *Comment removed* in its place. */
  readonly removed?: CommentRemoved
  /** The agent's name, where an agent wrote it for its person (§8). */
  readonly via?: string
  /** The record it was written about, where a merge or a move brought it here (§6). */
  readonly from?: CommentFrom
}

/** The fields a comment's update may change: its body, and when it was edited. */
export type CommentEdit = { body: string; edited: string }

/** Whether a comment is about this record. */
export function isAbout(comment: Pick<Comment, 'about'>, about: RecordKey): boolean {
  return comment.about.kind === about.kind && comment.about.id === about.id
}

/** Whether a comment was removed: a tombstone in its thread. */
export function isRemoved(comment: Pick<Comment, 'removed'>): boolean {
  return comment.removed !== undefined
}

const text = (value: unknown): string | undefined => (typeof value === 'string' && value !== '' ? value : undefined)

function picked(value: unknown): PickedPerson | undefined {
  return isPicked(value as PickedPerson) ? { person: (value as PickedPerson).person } : undefined
}

function keyOf(value: unknown): RecordKey | undefined {
  if (!value || typeof value !== 'object') return undefined
  const held = value as Record<string, unknown>
  return isRecordKind(held.kind) && typeof held.id === 'string' ? { kind: held.kind, id: held.id } : undefined
}

function fromOf(value: unknown): CommentFrom | undefined {
  const key = keyOf(value)
  if (!key) return undefined
  const scope = (value as Record<string, unknown>).scope
  return typeof scope === 'string' ? { ...key, scope } : key
}

/**
 * A comment out of whatever a file or a step carried, about `about` where the
 * row does not say (a thread's file names its record), or nothing where it
 * cannot be one: no id, no author picked from the register, no time, or no
 * record it is about. Unknown keys are dropped; a body that is not text is
 * empty only where the comment was removed.
 */
export function commentOf(value: unknown, about?: RecordKey): Comment | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const row = value as Record<string, unknown>
  const id = text(row.id)
  const by = picked(row.by)
  const at = text(row.at)
  const key = keyOf(row.about) ?? about
  const removedRow = row.removed && typeof row.removed === 'object' ? row.removed as Record<string, unknown> : undefined
  const removedBy = picked(removedRow?.by)
  const removedAt = text(removedRow?.at)
  const removed = removedBy && removedAt ? { at: removedAt, by: removedBy } : undefined
  const body = typeof row.body === 'string' ? row.body : undefined
  if (!id || !by || !at || !key || (body === undefined && !removed)) return undefined
  const replyTo = text(row.replyTo)
  const edited = text(row.edited)
  const via = text(row.via)
  const from = fromOf(row.from)
  return {
    id, about: key, by, at, body: removed ? '' : body ?? '',
    ...(replyTo ? { replyTo } : {}),
    ...(edited ? { edited } : {}),
    ...(removed ? { removed } : {}),
    ...(via ? { via } : {}),
    ...(from ? { from } : {}),
  }
}

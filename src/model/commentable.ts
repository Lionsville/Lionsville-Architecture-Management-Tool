// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Which kinds of record may be commented on (ADR-0037 §3): one line per kind.
 *
 * The line names the command that deletes a record of the kind, because a
 * record deleted takes its thread with it in the same step (§6) and undo
 * brings both back (`commands/table.ts` wraps that command so). A kind that
 * is not here is refused (`command.notCommentable`) whoever sends the
 * comment; a record the scope does not hold is refused too
 * (`command.unknownRecord`).
 *
 * In 3.7.0, in this order: the analysis — observations, causes, solutions
 * and experiments — then elements (and with them units), decisions and plans.
 * A kind taken on later is one line here and one `<CommentThread>` in its
 * reader.
 */
import type { CommandType } from './commands/handler'
import type { Model } from './normalised'
import { RECORD_LISTS } from './recordKey'
import type { RecordKey, RecordKind } from './recordKey'

export const COMMENTABLE = {
  observation: 'observation.remove',
  cause: 'cause.remove',
  solution: 'solution.remove',
  experiment: 'experiment.remove',
  element: 'element.delete',
  decision: 'decision.remove',
  transition: 'transition.remove',
} as const satisfies Partial<Record<keyof typeof RECORD_LISTS, CommandType>>

/** A kind that may be commented on. */
export type CommentableKind = keyof typeof COMMENTABLE

/** Every kind that may be commented on, in the registry's order. */
export const COMMENTABLE_KINDS = Object.keys(COMMENTABLE) as CommentableKind[]

export function isCommentable(kind: RecordKind | string): kind is CommentableKind {
  return Object.hasOwn(COMMENTABLE, kind)
}

/** Whether the scope holds the record a comment is about, of a kind that may be commented on. */
export function holdsCommentable(model: Model, about: RecordKey): boolean {
  if (!isCommentable(about.kind)) return false
  const list = model[RECORD_LISTS[about.kind]] as Record<string, unknown> | undefined
  return list !== undefined && Object.hasOwn(list, about.id)
}

/**
 * What a record commented on is called here: its title, or an element's
 * name — what the Activity list and a search hit name it by. Its id where the
 * scope no longer holds it.
 */
export function commentedName(model: Model, about: RecordKey): string {
  if (!isCommentable(about.kind)) return about.id
  const list = model[RECORD_LISTS[about.kind]] as Record<string, { title?: string; name?: string }> | undefined
  const held = list?.[about.id]
  return held?.title ?? held?.name ?? about.id
}

/** The kind whose deleting command this is, where it is one: what takes a record's thread with it. */
export function commentableRemovedBy(type: string): CommentableKind | undefined {
  return COMMENTABLE_KINDS.find((kind) => COMMENTABLE[kind] === type)
}

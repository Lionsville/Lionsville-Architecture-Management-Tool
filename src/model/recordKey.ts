// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One thing a scope holds, named by its kind and its id (ADR-0031 §1).
 *
 * "The history of `erp`" is a question about a record, not about where the
 * record happens to be kept: an element is an element however an
 * implementation keeps it, whole with its scope or one by one. So the history
 * of a thing is asked by its **record key**, and what a step touched is said
 * in the same words.
 *
 * **What a step touched is what changed**, read off the model before and after
 * it — not what its command says it writes (ADR-0028). A command's write set
 * is its own record: deleting an element also takes the relations that end on
 * it, the routes and places on every view, and the parent its children had,
 * and a relation's history that left out the step that removed it would be a
 * history with its last line missing. So each list is compared, and a record
 * whose value differs is a record the step touched, whatever the command
 * named.
 *
 * Coarse where a person asks coarsely: a node dragged on a board is a change
 * to the board, and a patch on an element's aspects is a change to the
 * element. A record key is a kind and an id and nothing under them.
 */
import type { Model } from './normalised'

/**
 * The kinds of record a scope holds: one per list the model keeps
 * (`ModelOrder`), the pictures its documents show, and the scope itself — its
 * name, its description and what it says about itself, which a history lists
 * as a thing like any other.
 */
export type RecordKind =
  | 'element' | 'relation' | 'diagram' | 'decision' | 'transition'
  | 'observation' | 'cause' | 'solution' | 'experiment'
  | 'image' | 'scope'

export const RECORD_KINDS: readonly RecordKind[] = [
  'element', 'relation', 'diagram', 'decision', 'transition',
  'observation', 'cause', 'solution', 'experiment', 'image', 'scope',
]

/**
 * One record. `id` is the record's own id — an element's, a view's, an
 * image's name — and the empty string for the scope itself, which has one of
 * it per scope.
 */
export type RecordKey = { readonly kind: RecordKind; readonly id: string }

/** The scope's own record: its name, its description, what it says about itself. */
export const SCOPE_RECORD: RecordKey = { kind: 'scope', id: '' }

export function isRecordKind(value: unknown): value is RecordKind {
  return typeof value === 'string' && (RECORD_KINDS as readonly string[]).includes(value)
}

export function sameRecord(one: RecordKey, other: RecordKey): boolean {
  return one.kind === other.kind && one.id === other.id
}

/** Each kind of record the model holds, and the list it is kept in: one per key of `ModelOrder`. */
export const RECORD_LISTS = {
  element: 'elements', relation: 'relations', diagram: 'diagrams', decision: 'decisions',
  transition: 'transitions', observation: 'observations', cause: 'causes', solution: 'solutions',
  experiment: 'experiments',
} as const satisfies Partial<Record<RecordKind, keyof Model>>

type Listed = keyof typeof RECORD_LISTS

/** A value as text with every object's keys in order, so two equal values are one text. */
export function stableText(value: unknown): string {
  return JSON.stringify(value, (_key, held: unknown) => (
    held && typeof held === 'object' && !Array.isArray(held)
      ? Object.fromEntries(Object.keys(held).sort().map((key) => [key, (held as Record<string, unknown>)[key]]))
      : held
  )) ?? 'undefined'
}

/** Whether two values are the same: the same object, or the same when written down. */
export function sameValue(one: unknown, other: unknown): boolean {
  return one === other || stableText(one) === stableText(other)
}

const NOT_OWN = new Set<string>([...Object.values(RECORD_LISTS), 'order'])

/**
 * Whether the model's own fields — its name, its description, its defaults,
 * every field that is not a list it holds — are the same in two models: key by
 * key, the same object first, and the same written value only where not. It
 * runs on every step, so it writes down no more than differs.
 */
function sameOwnFields(before: Model, after: Model): boolean {
  const was = before as unknown as Record<string, unknown>
  const is = after as unknown as Record<string, unknown>
  const keys = new Set([...Object.keys(was), ...Object.keys(is)])
  for (const key of keys) {
    if (NOT_OWN.has(key) || was[key] === is[key]) continue
    if (!sameValue(was[key], is[key])) return false
  }
  return true
}

/** The records of one kind whose value differs between two models, in the order the later one keeps them. */
function changedIn(kind: Listed, before: Model, after: Model): RecordKey[] {
  const list = RECORD_LISTS[kind]
  const was = before[list] as Record<string, unknown> | undefined
  const is = after[list] as Record<string, unknown> | undefined
  if (was === is) return []
  const ids = new Set([...Object.keys(is ?? {}), ...Object.keys(was ?? {})])
  return [...ids].filter((id) => !sameValue(was?.[id], is?.[id])).map((id) => ({ kind, id }))
}

/**
 * Whether the only difference in a list is the order it is kept in: the same
 * records, moved. A reorder is the scope's, since no one record changed.
 */
function reordered(before: Model, after: Model): boolean {
  if (before.order === after.order) return false
  return (Object.keys(after.order) as (keyof Model['order'])[])
    .some((list) => !sameValue(before.order[list], after.order[list]))
}

/**
 * Every record that differs between two models of one scope, once each: each
 * list compared record by record — the same object first, the same written
 * value to be sure — and the scope's own record where its own fields, or only
 * the order of a list, differ. Empty where the two are the same model.
 */
export function recordsChanged(before: Model, after: Model): RecordKey[] {
  if (before === after) return []
  const found = (Object.keys(RECORD_LISTS) as Listed[]).flatMap((kind) => changedIn(kind, before, after))
  const own = !sameOwnFields(before, after)
  if (own || (found.length === 0 && reordered(before, after))) found.push(SCOPE_RECORD)
  return found
}

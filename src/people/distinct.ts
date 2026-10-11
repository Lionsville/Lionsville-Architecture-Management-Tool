// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Two entries a person answered as **not the same person** (ADR-0036 §9, as
 * built in 3.6.1): a list beside the entries, not a field on them — an
 * unordered pair of ids, kept as `a < b`, and the day it was answered.
 *
 * Kept in the register and outside the history, as everything there is, and
 * taken back as easily: an answer merges nothing and removes nothing. It
 * names nobody — two random ids and a day — so a file made without names
 * carries it as it is.
 *
 * **It silences that pair and no other** (`duplicates.ts`): the two are no
 * longer offered as a possible duplicate, nor warned of when either is
 * corrected; a new person is still checked against both.
 *
 * **It follows its two entries** ({@link tidyDistinct}), whatever the change:
 * forgetting or removing either drops it, because a pseudonym is nobody to
 * compare; a merge of either into a third entry carries it to the entry kept,
 * and drops it where that entry is its other half, because one entry is not
 * two people. An answer naming an id the register does not hold — one removed
 * here, or one a file never carried — is dropped with it.
 */
import type { Person, PersonId } from './person'
import { redirectEnd } from './person'

export type DistinctPair = {
  /** The lower of the two ids. */
  readonly a: PersonId
  /** The higher of the two ids. */
  readonly b: PersonId
  /** The day it was answered. */
  readonly on: string
}

/** Two ids in the order a pair keeps them. */
function ordered(one: PersonId, other: PersonId): [PersonId, PersonId] {
  return one < other ? [one, other] : [other, one]
}

/** The pair two entries make, whichever is named first: `a < b`. */
export function distinctPair(one: PersonId, other: PersonId, on: string): DistinctPair {
  const [a, b] = ordered(one, other)
  return { a, b, on }
}

/** What names a pair whichever way round its ids are given: what a pair is found by, and kept under. */
export function pairKey(one: PersonId, other: PersonId): string {
  return ordered(one, other).join(' ')
}

/** The pairs answered, by their keys: what the signs ask before they suggest two entries. */
export function answeredKeys(distinct: readonly DistinctPair[]): ReadonlySet<string> {
  return new Set(distinct.map((pair) => pairKey(pair.a, pair.b)))
}

/** The other half of every pair an entry is in: whom it was answered as not being. */
export function answeredWith(distinct: readonly DistinctPair[], id: PersonId): ReadonlySet<PersonId> {
  return new Set(distinct.flatMap((pair) => (pair.a === id ? [pair.b] : pair.b === id ? [pair.a] : [])))
}

/**
 * A pair as a file or a store held it, where it reads as one; `undefined` for
 * anything else. Tolerant the way every reader of a saved file is: a key it
 * does not know is dropped, and its two ids are put in order.
 */
export function distinctFrom(value: unknown): DistinctPair | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const held = value as Record<string, unknown>
  const text = (key: string) => (typeof held[key] === 'string' && held[key] !== '' ? held[key] as string : undefined)
  const [a, b, on] = [text('a'), text('b'), text('on')]
  if (!a || !b || !on || a === b) return undefined
  return distinctPair(a, b, on)
}


/**
 * The answers as they stand over these entries: each half followed to the
 * entry a merge kept; a pair dropped where either half is not held — removed,
 * or never there — or forgotten, or where both halves are now one entry; and
 * each pair once, under the first day it was answered. In id order, so one
 * list is always written as the same bytes.
 */
export function tidyDistinct(distinct: readonly DistinctPair[], people: readonly Person[]): DistinctPair[] {
  const byId = new Map(people.map((person) => [person.id, person]))
  const kept = new Map<string, DistinctPair>()
  for (const pair of distinct) {
    const [one, other] = [redirectEnd(byId, pair.a), redirectEnd(byId, pair.b)]
    const held = [byId.get(one), byId.get(other)]
    if (one === other || held.some((person) => person === undefined || person.state === 'forgotten' || person.mergedInto !== undefined)) continue
    const key = pairKey(one, other)
    const there = kept.get(key)
    if (!there || pair.on < there.on) kept.set(key, distinctPair(one, other, pair.on))
  }
  return [...kept.entries()].sort(([one], [other]) => (one < other ? -1 : one > other ? 1 : 0)).map(([, pair]) => pair)
}

/** Whether two lists hold the same answers, on the same days, whatever order they were written in. */
export function sameDistinct(one: readonly DistinctPair[], other: readonly DistinctPair[]): boolean {
  const said = (pair: DistinctPair) => `${pairKey(pair.a, pair.b)} ${pair.on}`
  const mine = new Set(one.map(said))
  return mine.size === new Set(other.map(said)).size && other.every((pair) => mine.has(said(pair)))
}

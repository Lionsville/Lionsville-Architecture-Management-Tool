// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The arithmetic every entry's `writes` shares (ADR-0028): what a command
 * writes, as addresses.
 *
 * **Granularity is what a command names, not the record.** `element.update`
 * names the fields in its patch, so two authors editing the name and the
 * lifecycle of one application touch two different things; `node.set` names
 * the node on one diagram, so two drags of two boxes on one board do too.
 * **Coarse where a command is coarse**: a delete writes the whole record, so it
 * is the record's address with no field under it and is in the way of every
 * patch on it — a patch on something somebody removed is exactly what a person
 * has to look at. **Pure, and over the command alone**: a command whose effect
 * depends on the model (a delete takes the relations that end on it) is
 * covered by the record's own address, and whoever compares two write sets
 * only has to *suspect* an overlap for a person to be asked.
 */
import type { WriteKey } from './handler'

/** What a command nobody here recognises writes: anything at all. */
export const EVERYTHING: WriteKey = '*'

/** One address per id, under one prefix: `diagram/l7/node/crews`. */
export function each(at: string, ids: readonly string[]): WriteKey[] {
  return ids.map((id) => `${at}/${id}`)
}

/**
 * The fields a patch names. An empty patch writes the record, coarsely.
 *
 * **One level down into an object-valued field**, which is what `aspects` is
 * and what `lifecycleDates` is: two authors editing two different aspects of
 * one element are not editing the same thing, and a record that said they were
 * would put one whole aspects map over the other without naming what was lost.
 * One level and no further — it is the depth the model has, and a walk of any
 * depth would be this file inventing a shape for records it does not know.
 */
export function patchWrites(at: string, patch: object | undefined): WriteKey[] {
  const named = patch ? Object.entries(patch) : []
  if (named.length === 0) return [at]
  const keys: WriteKey[] = []
  for (const [field, value] of named) {
    const under = nested(value)
    // An empty object is the field cleared, which is the field, coarsely.
    if (!under || under.length === 0) keys.push(`${at}/${field}`)
    else for (const key of under) keys.push(`${at}/${field}/${key}`)
  }
  return keys
}

/**
 * The keys of a plain object-valued field, or nothing for everything else.
 *
 * An array is not addressed per item — a list written is the list — and
 * neither is a date, which is a value however it is spelt.
 */
function nested(value: unknown): string[] | undefined {
  if (value === null || typeof value !== 'object') return undefined
  if (Array.isArray(value) || value instanceof Date) return undefined
  return Object.keys(value as Record<string, unknown>)
}

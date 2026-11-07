// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the Checks page shows, as data: a work list and not a catalogue. To fix,
 * to review, then notes, each only what was found, and opening on the first fix,
 * because a list of forty-five rows with eight numbers in it is read by going
 * through a column of zeros. Found nothing folds into one line; asked to group by
 * category, every check is there, zeros included.
 *
 * Found is the shared list: one line per finding, the subject alone since the
 * check names the problem, grouped by what the check knows. Pure.
 */
import type { CheckCategory, CheckKey } from '../../model/checkCatalogue'
import type { ScopePath } from '../../projects/scopePath'
import type { CheckInstance, CheckRow } from './treeChecks'

/** How the work list is grouped. */
export type WorkGroup = 'weight' | 'category' | 'scope' | 'none'
export const WORK_GROUPS: readonly WorkGroup[] = ['weight', 'category', 'scope']

export type WorkSection = {
  readonly id: string
  /** A key of what names it: a weight, a category, a scope; the page says the words. */
  readonly kind: 'fix' | 'review' | 'note' | 'nothing' | 'notCounted' | 'category' | 'scope' | 'all'
  readonly category?: CheckCategory
  readonly scope?: ScopePath
  readonly rows: readonly CheckRow[]
  /** How many were found under it. */
  readonly count: number
}

const found = (rows: readonly CheckRow[]) => rows.reduce((sum, row) => sum + row.shown.length, 0)
const biggest = (rows: readonly CheckRow[]) => [...rows].sort((a, b) => b.shown.length - a.shown.length)

export function workSections(categories: readonly { category: CheckCategory; rows: readonly CheckRow[] }[], group: WorkGroup): readonly WorkSection[] {
  const every = categories.flatMap((one) => one.rows)
  if (group === 'category') {
    return categories.map(({ category, rows }) => ({ id: `category:${category}`, kind: 'category', category, rows, count: found(rows) }))
  }
  if (group === 'none') {
    const rows = biggest(every.filter((row) => row.shown.length > 0))
    return [{ id: 'all', kind: 'all', rows, count: found(rows) }]
  }
  if (group === 'scope') {
    const byScope = new Map<ScopePath, CheckRow[]>()
    for (const row of every) {
      for (const scope of new Set(row.shown.map((one) => one.scope ?? ''))) {
        byScope.set(scope, [...byScope.get(scope) ?? [], { ...row, shown: row.shown.filter((one) => (one.scope ?? '') === scope) }])
      }
    }
    return [...byScope].sort(([a], [b]) => a.localeCompare(b)).map(([scope, rows]) => ({ id: `scope:${scope}`, kind: 'scope', scope, rows, count: found(rows) }))
  }
  const of = (weight: CheckRow['entry']['weight']) => biggest(every.filter((row) => row.entry.weight === weight && row.counted && row.shown.length > 0))
  const nothing = every.filter((row) => row.counted && row.shown.length === 0)
  const notCounted = every.filter((row) => !row.counted)
  const sections: WorkSection[] = [
    { id: 'fix', kind: 'fix', rows: of('fix'), count: found(of('fix')) },
    { id: 'review', kind: 'review', rows: of('review'), count: found(of('review')) },
    { id: 'note', kind: 'note', rows: of('note'), count: found(of('note')) },
    { id: 'nothing', kind: 'nothing', rows: nothing, count: nothing.length },
    { id: 'notCounted', kind: 'notCounted', rows: notCounted, count: notCounted.length },
  ]
  return sections.filter((one) => one.rows.length > 0)
}

/** The check a page opens on: the first fix, never a review while one waits; else whatever comes first with anything found. */
export function firstCheck(categories: readonly { rows: readonly CheckRow[] }[]): CheckKey | undefined {
  const every = categories.flatMap((one) => one.rows)
  const first = (weight: CheckRow['entry']['weight']) => biggest(every.filter((row) => row.entry.weight === weight && row.shown.length > 0))[0]
  return (first('fix') ?? first('review') ?? first('note'))?.key
}

/** How many of a weight's findings the largest two checks hold, where that is most of them: a list that shape is not read row by row. */
export function heldByTwo(rows: readonly CheckRow[]): number | undefined {
  const [one, two] = biggest(rows)
  const total = found(rows)
  if (!one || !two || rows.length < 3) return undefined
  const held = one.shown.length + two.shown.length
  return held * 2 > total ? held : undefined
}

/** What a found list can group by: only what this check's findings say. */
export function foundGroups(instances: readonly CheckInstance[]): readonly ('role' | 'unitType' | 'master')[] {
  return [
    ...(instances.some((one) => one.role !== undefined) ? ['role' as const] : []),
    ...(instances.some((one) => one.unitType !== undefined) ? ['unitType' as const] : []),
    ...(new Set(instances.map((one) => one.scope)).size > 1 ? ['master' as const] : []),
  ]
}

/** The walk through a check: the findings that can be gone to, in the page's order. */
export function walkable(row: Pick<CheckRow, 'shown'>): readonly CheckInstance[] {
  return row.shown.filter((one) => one.opens !== undefined)
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a sheet is coloured by: one question at a time over the same rows, and
 * the layout never moves for it (the owner's decisions 8 to 10, 7 November 2026).
 *
 * Every function on the page gets one value under the lens that is up, so the
 * rows, the key's counts, an area's meter and the overview's squares cannot
 * disagree: they all read this. Pure, with no words: the page says each value,
 * and a value's mark or heat step is the theme's.
 *
 * **Covered by** is the default, and says four things where the coverage rows
 * say three: *moving* is a covered function one of whose applications is on its
 * way out, which the help promises can be seen and the rows alone do not say.
 * *People* is a complete answer and *nothing yet* the gap (ADR-0012 §9).
 *
 * **Who answers** is the only reading that names a unit on every row (decision
 * 8). A rating draws one hue in steps and always its number too; an unrated row
 * stays blank rather than looking low.
 */
import type { AspectScale } from '../model/aspectScale'
import { heatOf, ratingOn } from '../model/aspectScale'
import type { DesignElement, ElementId } from '../model'
import type { FunctionCoverage } from './coverage'

/** The questions a sheet can answer. A rating is a scale of the organisation's, said as an aspect is on a board. */
export type SheetLens = 'coveredBy' | 'who' | 'domains' | 'lifecycle' | 'retiring' | `aspect:${string}`

const WORDS: readonly SheetLens[] = ['coveredBy', 'who', 'domains', 'lifecycle', 'retiring']

export const DEFAULT_LENS: SheetLens = 'coveredBy'

/** Whether a word from an address or a saved view is a question this sheet has. */
export function isSheetLens(word: unknown, scales: readonly AspectScale[] = []): word is SheetLens {
  if (typeof word !== 'string') return false
  if ((WORDS as readonly string[]).includes(word)) return true
  return word.startsWith('aspect:') && scales.some((scale) => scale.key === word.slice('aspect:'.length))
}

/** Every question on offer, in the menu's order. */
export function sheetLenses(scales: readonly AspectScale[], has: { who: boolean; domains: boolean }): SheetLens[] {
  return [
    'coveredBy',
    ...(has.who ? ['who' as const] : []),
    ...(has.domains ? ['domains' as const] : []),
    'lifecycle', 'retiring',
    ...scales.map((scale) => `aspect:${scale.key}` as const),
  ]
}

/** What a row is under the lens. `value` is what the key counts and a press on the key singles out. */
export type LensValue = {
  value: string
  /** A heat step, 1 to 5, where the lens is a rating. */
  heat?: number
  /** What is written at the row's end: a rating's number, how many applications. */
  said?: string
  /** The ids a row's end names, each said by the page: the unit, the domain, the retiring application. */
  names?: readonly string[]
}

/** The facts the lens reads that a function does not hold itself. */
export type LensFacts = {
  coverage(functionId: ElementId): FunctionCoverage
  /** An application on its way out, on the day the page reads. Told by whoever knows it, since it may be kept elsewhere. */
  retiring(applicationId: ElementId): boolean
  /** The domains that took it up, where the page knows. */
  takenUpBy?(functionId: ElementId): readonly string[]
  scales?: readonly AspectScale[]
}

/** How many steps the heat tokens have. */
const HEAT_STEPS = 5

function covered(coverage: FunctionCoverage, facts: LensFacts): LensValue {
  if (coverage.coverage === 'uncovered') return { value: 'none' }
  if (coverage.coverage === 'manual') return { value: 'people' }
  const leaving = coverage.supportedBy.filter((id) => facts.retiring(id))
  return { value: leaving.length > 0 ? 'moving' : 'apps', said: String(coverage.supportedBy.length) }
}

function domains(element: DesignElement, facts: LensFacts): LensValue {
  const handed = element.scopes ?? []
  const took = facts.takenUpBy?.(element.id) ?? []
  if (took.length > 0) return { value: handed.length > 0 ? 'taken' : 'unasked', names: took }
  return handed.length > 0 ? { value: 'handed', names: handed } : { value: 'nobody' }
}

function rated(element: DesignElement, key: string, facts: LensFacts): LensValue {
  const scale = facts.scales?.find((held) => held.key === key)
  const number = scale && ratingOn(element, scale)
  if (scale === undefined || number === undefined) return { value: 'unrated' }
  const heat = Math.max(1, Math.min(HEAT_STEPS, Math.round(heatOf(scale, number) * (HEAT_STEPS - 1)) + 1))
  return { value: String(number), heat, said: String(number) }
}

/** One function's value under one lens. */
export function lensValue(element: DesignElement, lens: SheetLens, facts: LensFacts): LensValue {
  const coverage = facts.coverage(element.id)
  switch (lens) {
    case 'coveredBy':
      return covered(coverage, facts)
    case 'who':
      return coverage.assignedTo.length > 0 ? { value: 'held', names: coverage.assignedTo } : { value: 'nobody' }
    case 'domains':
      return domains(element, facts)
    case 'lifecycle':
      return { value: element.lifecycle }
    case 'retiring': {
      const leaving = coverage.supportedBy.filter((id) => facts.retiring(id))
      return leaving.length > 0 ? { value: 'retiring', names: leaving } : { value: 'not' }
    }
    default:
      return rated(element, lens.slice('aspect:'.length), facts)
  }
}

/** How many functions have each value: what the key says and the meter draws. */
export function lensCounts(values: Iterable<LensValue>): Map<string, number> {
  const counts = new Map<string, number>()
  for (const { value } of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return counts
}

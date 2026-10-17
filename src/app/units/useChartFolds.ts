// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What is folded on an organisation chart and in its outline (ADR-0036,
 * amended 11 October 2026).
 *
 * **For the session, keyed by the view.** A fold is what somebody is doing
 * this minute, as the scope tree's are: kept in the shell's memory for as long
 * as the window is open (`sessionFolds.ts`), under the view's own key, so a
 * tab closed and opened again — or a scope left and come back to — is as it
 * was left, and nothing of it is ever saved.
 *
 * **Two sets, and the outline leads** (3.7.3). The chart and the outline keep
 * a set each, so folding the outline — to find a way about — leaves the chart
 * as it is. Opening goes the other way: a unit unfolded or picked in the
 * outline is unfolded on the chart too, with every unit above it (`expand`),
 * and the page goes to it there. One direction only: a fold on the chart
 * never folds the outline, and one in the outline never folds the chart.
 *
 * **A first open shows two levels** (3.7.3). The first time a view is opened
 * with units on it, every unit below the second level is folded
 * (`model/orgChart.foldedOnFirstOpen`), in the chart and in the outline,
 * whatever the chart's size, and the page says so until a fold is changed.
 * From then on the person's own folds are what is kept. (Until 3.7.3 only a
 * chart of more than thirty units folded.)
 *
 * **Going somewhere unfolds the way.** *Find*, *Find me*, a finding, a pick in
 * the outline and a request from outside unfold every unit above the one they
 * go to, on both, so it is on screen when it is scrolled to.
 *
 * **Empty optional roles are folded away too** (3.6.1): a role nobody holds
 * and nobody needs to is a choice, not a gap, so the chart leaves it out
 * until *Show optional roles* is on — kept the way the folds are, for the
 * session and under the view's key, never as a preference.
 */
import { useCallback, useEffect, useState } from 'react'
import { foldable, foldedOnFirstOpen, unitsAboveIn } from '../../model/orgChart'
import type { OrgChart } from '../../model/orgChart'
import type { ElementId } from '../../model/types'
import { opened, toggled } from '../sessionFolds'
import type { SessionFolds } from '../sessionFolds'

export type ChartFolds = {
  /** The units folded on the chart: what is under each is not drawn. */
  folded: ReadonlySet<ElementId>
  /** The units folded in the outline, which folds on its own. */
  outline: ReadonlySet<ElementId>
  /** This open folded a large chart, and nobody has folded or unfolded since: the page says why. */
  foldedOnOpen: boolean
  toggle: (id: ElementId) => void
  toggleOutline: (id: ElementId) => void
  foldAll: () => void
  unfoldAll: () => void
  /** Unfold every unit above this one, on the chart and in the outline. */
  reveal: (id: ElementId) => void
  /** Unfold this unit and every unit above it on the chart, and the way to it in the outline: what the outline asks of the chart. */
  expand: (id: ElementId) => void
  /** Whether the chart draws the optional roles nobody holds. */
  optional: boolean
  toggleOptional: () => void
}

/** Where a view's two trees, and whether it shows its empty optional roles, are kept in the memory. */
export type FoldKeys = { chart: string; outline: string; optional: string }

/** What the memory holds under a view's `optional` key while the chart shows them: a set, as everything it keeps is. */
const SHOWN = 'shown'

type Held = { chart: ReadonlySet<ElementId>; outline: ReadonlySet<ElementId>; foldedOnOpen: boolean; decided: boolean }

/** What a view opens with: what the memory kept, or — the first time it has units — the first open's folds. */
function opening(chart: OrgChart, memory: SessionFolds, keys: FoldKeys): Held {
  const chartKept = memory.recall(keys.chart)
  const outlineKept = memory.recall(keys.outline)
  if (chartKept && outlineKept) return { chart: chartKept, outline: outlineKept, foldedOnOpen: false, decided: true }
  // Nothing drawn yet — the organisation still being read — decides nothing.
  if (chart.units === 0) return { chart: new Set(), outline: new Set(), foldedOnOpen: false, decided: false }
  const first = new Set(foldedOnFirstOpen(chart))
  return { chart: chartKept ?? first, outline: outlineKept ?? first, foldedOnOpen: !chartKept && first.size > 0, decided: true }
}

export function useChartFolds(chart: OrgChart, memory: SessionFolds, keys: FoldKeys): ChartFolds {
  const [held, setHeld] = useState<Held>(() => opening(chart, memory, keys))
  // A view opened before its units were read decides its first open once they are.
  useEffect(() => {
    if (!held.decided && chart.units > 0) setHeld(opening(chart, memory, keys))
  }, [held.decided, chart, memory, keys])
  useEffect(() => {
    if (!held.decided) return
    memory.keep(keys.chart, held.chart)
    memory.keep(keys.outline, held.outline)
  }, [held, memory, keys])
  const toggle = useCallback((id: ElementId) => setHeld((was) => ({ ...was, chart: toggled(was.chart, id), foldedOnOpen: false })), [])
  const toggleOutline = useCallback((id: ElementId) => setHeld((was) => ({ ...was, outline: toggled(was.outline, id) })), [])
  const foldAll = useCallback(() => setHeld((was) => ({ ...was, chart: new Set(foldable(chart)), foldedOnOpen: false })), [chart])
  const unfoldAll = useCallback(() => setHeld((was) => ({ ...was, chart: new Set(), foldedOnOpen: false })), [])
  const reveal = useCallback((id: ElementId) => {
    const above = unitsAboveIn(chart, id)
    setHeld((was) => {
      const next = { ...was, chart: opened(was.chart, above), outline: opened(was.outline, above) }
      return next.chart === was.chart && next.outline === was.outline ? was : next
    })
  }, [chart])
  const expand = useCallback((id: ElementId) => {
    const above = unitsAboveIn(chart, id)
    setHeld((was) => {
      const next = { ...was, chart: opened(was.chart, [...above, id]), outline: opened(was.outline, above) }
      if (next.chart === was.chart && next.outline === was.outline) return was
      // A unit opened from the outline is the person's own fold: the page no longer says why it opened folded.
      return { ...next, foldedOnOpen: next.chart === was.chart ? was.foldedOnOpen : false }
    })
  }, [chart])
  const [optional, setOptional] = useState(() => memory.recall(keys.optional)?.has(SHOWN) ?? false)
  useEffect(() => memory.keep(keys.optional, new Set(optional ? [SHOWN] : [])), [optional, memory, keys])
  const toggleOptional = useCallback(() => setOptional((was) => !was), [])
  return {
    folded: held.chart, outline: held.outline, foldedOnOpen: held.foldedOnOpen, toggle, toggleOutline, foldAll, unfoldAll, reveal, expand,
    optional, toggleOptional,
  }
}

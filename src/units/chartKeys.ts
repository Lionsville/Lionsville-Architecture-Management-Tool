// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The chart's keyboard, in the board's grammar: the arrows walk the tree that is
 * drawn, Enter picks and goes down, Shift and Enter goes up, M moves the unit
 * picked and F focuses on it. What a fold hides is not walked. Pure, over the
 * units drawn, so the walk is tested with no page.
 */
import type { ChartUnit } from '../../model/orgChart'
import type { ElementId } from '../../model/types'
import { chordHeld } from '../../widgets/kit/keys'

export type TreeStep = 'up' | 'down' | 'previous' | 'next'

/** The unit a step from `id` lands on, among the units drawn. Nothing where the tree ends that way. */
export function stepInTree(units: readonly ChartUnit[], folded: ReadonlySet<ElementId>, id: ElementId, step: TreeStep): ElementId | undefined {
  const walk = (siblings: readonly ChartUnit[], parent: ChartUnit | undefined): ElementId | undefined | null => {
    const at = siblings.findIndex((unit) => unit.id === id)
    if (at >= 0) {
      const unit = siblings[at]!
      switch (step) {
        case 'up': return parent?.id
        case 'down': return folded.has(unit.id) ? undefined : unit.children[0]?.id
        case 'previous': return siblings[at - 1]?.id
        case 'next': return siblings[at + 1]?.id
      }
    }
    for (const unit of siblings) {
      if (folded.has(unit.id)) continue
      const found = walk(unit.children, unit)
      if (found !== null) return found
    }
    return null
  }
  return walk(units, undefined) ?? undefined
}

/** What a key on a box means: the step it takes, a pick, or a verb. Nothing for a key that is not the chart's. */
export function chartKey(event: { key: string; shiftKey: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean }): TreeStep | 'pick' | 'move' | 'focus' | undefined {
  if (event.altKey || chordHeld(event)) return undefined
  switch (event.key) {
    case 'ArrowUp': return 'up'
    case 'ArrowDown': return 'down'
    case 'ArrowLeft': return 'previous'
    case 'ArrowRight': return 'next'
    case 'Enter': return event.shiftKey ? 'up' : 'pick'
    case 'm': case 'M': return 'move'
    case 'f': case 'F': return 'focus'
    default: return undefined
  }
}

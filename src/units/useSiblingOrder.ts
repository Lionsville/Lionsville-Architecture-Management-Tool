// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A unit's place among its siblings, moved from the organisation chart's
 * outline (ADR-0036, amended 11 October 2026).
 *
 * **Its siblings are of its type.** Units stand by their type's rank first,
 * so a unit moves among the units of its own type under the same parent
 * (`model/unitOrder.siblingsOfType`); a unit of another type keeps its place.
 * A move renumbers that list from 1 and writes the actor's own `order`, the
 * field the business tree already reads — no new field — and every list of
 * units follows it: the chart, the outline, the Conway map's columns and the
 * pickers.
 *
 * **One step in each scope that keeps one of them.** Siblings may be filed in
 * different scopes, so the rows are grouped by the scope that keeps each unit
 * and land as people's moves do (`landPeopleMoves`): the other scopes in one
 * apply, all or none, and the open scope's part through its session. Where
 * only the open scope is written, undo takes the move back whole; where other
 * scopes were written too, the open scope's step carries a barrier that says
 * so, and each scope is put back on its own. Who stands where is structure,
 * so a managing role's right does not reach it.
 */
import { useMemo, useState } from 'react'
import type { StringKey, Translate } from '../../i18n'
import type { Command } from '../../model/commands'
import type { DesignElement, ElementId } from '../../model/types'
import { siblingsOfType, unitMovedTo } from '../../model/unitOrder'
import { organisationOn } from '../../model/units'
import type { ScopePath } from '../../projects/scopePath'
import type { LandPeopleMoves, PeopleMoved } from './landPeopleMoves'
import type { UnitViewsHere } from './unitViewsHere'

/** What the open scope's step carries where other scopes were written as well. */
export const ORDER_BARRIER: StringKey = 'chart.orderBarrier'

export type SiblingOrder = {
  /** What the unit is among: its type's name, and the unit they sit in — none at the top. */
  type: string
  parent?: string
  /** Its place among them, from 0, and how many there are. */
  at: number
  of: number
  /** Move it one place earlier or later. */
  move: (by: -1 | 1) => void
  writing: boolean
  said?: { text: string; tone: 'ok' | 'error' }
}

/** What a move came to, said. */
function saidOf(answer: PeopleMoved, scope: ScopePath, t: Translate): { text: string; tone: 'ok' | 'error' } {
  if (!answer.ok) {
    const readOnly = answer.reason === 'shell.scopeReadOnly' || answer.reason === 'readOnly'
    return { text: t(readOnly ? 'move.refusedReadOnly' : 'move.refused'), tone: 'error' }
  }
  if (answer.changed.length > 1) return { text: t('chart.orderWrittenAcross', { scopes: answer.changed.length }), tone: 'ok' }
  return { text: t(answer.changed[0] === scope ? 'chart.orderWritten' : 'chart.orderWrittenThere'), tone: 'ok' }
}

/**
 * The rows of a move as each scope's step: an `element.update` of `order` per
 * unit, in the scope that keeps it. Nothing where a unit's scope is not known.
 */
export function orderSteps(
  rows: readonly { id: ElementId; order: number }[], scopeOf: (id: ElementId) => ScopePath | undefined,
): Map<ScopePath, Command[]> | undefined {
  const steps = new Map<ScopePath, Command[]>()
  for (const row of rows) {
    const scope = scopeOf(row.id)
    if (scope === undefined) return undefined
    const command: Command = { type: 'element.update', id: row.id, patch: { order: row.order } as Partial<DesignElement> }
    steps.set(scope, [...steps.get(scope) ?? [], command])
  }
  return steps
}

export function useSiblingOrder({ here, day, scope, unitId, land, t }: {
  here: UnitViewsHere
  day: string
  /** The scope open in this window. */
  scope: ScopePath
  unitId: ElementId | undefined
  /** How a move lands; absent where nothing may be moved here. */
  land: LandPeopleMoves | undefined
  t: Translate
}): SiblingOrder | undefined {
  // The parents the plans' moves give on the chart's day, as the chart draws them.
  const units = useMemo(() => organisationOn(here.at.organisation, day).units, [here, day])
  const [said, setSaid] = useState<{ unitId: ElementId; text: string; tone: 'ok' | 'error' } | undefined>(undefined)
  const [writing, setWriting] = useState(false)
  if (land === undefined || unitId === undefined) return undefined
  const siblings = siblingsOfType(units, unitId)
  if (siblings.length < 2) return undefined
  const at = siblings.findIndex((one) => one.id === unitId)
  const unit = siblings[at]
  const type = here.at.organisation.unitTypes.find((one) => one.id === unit.unitTypeId)?.name ?? unit.unitTypeId ?? ''
  const move = (by: -1 | 1) => {
    const steps = orderSteps(unitMovedTo(units, unitId, at + by), here.scopeOf)
    if (steps === undefined) { setSaid({ unitId, text: t('move.refused'), tone: 'error' }); return }
    if (steps.size === 0) return
    setWriting(true)
    void land(steps, ORDER_BARRIER).then(
      (answer) => setSaid({ unitId, ...saidOf(answer, scope, t) }),
      () => setSaid({ unitId, text: t('move.refused'), tone: 'error' }),
    ).finally(() => setWriting(false))
  }
  return {
    type, ...(unit.parentId !== undefined ? { parent: here.name(unit.parentId) } : {}), at, of: siblings.length, move, writing,
    ...(said?.unitId === unitId ? { said: { text: said.text, tone: said.tone } } : {}),
  }
}

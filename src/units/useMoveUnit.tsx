// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *Move to…* a unit, as the chart and the unit's inspector open it (3.7.1):
 * the dialog (`MoveUnitDialog`) and the move landed.
 *
 * **One step in each scope that keeps a unit moved**, as a unit's place
 * among its siblings lands (`useSiblingOrder`): the other scopes in one
 * apply, all or none, and the open scope's part through its session, after
 * the reducer has been asked (`landPeopleMoves`). Where only the open scope
 * is written, undo takes the move back whole; where others were written too,
 * the open scope's step carries a barrier that says so. Where a unit sits is
 * structure, so a managing role's right does not reach it.
 */
import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import type { StringKey, Translate } from '../../i18n'
import type { PersonId } from '../../model/person'
import type { ElementId } from '../../model/types'
import type { Organisation } from '../../model/units'
import type { ScopePath } from '../../projects/scopePath'
import type { LandPeopleMoves, PeopleMoved } from './landPeopleMoves'
import { MoveUnitDialog } from './MoveUnitDialog'

/** What the open scope's step carries where other scopes were written as well. */
export const UNIT_MOVE_BARRIER: StringKey = 'unitMove.barrier'

export type MoveUnit = {
  /** Open *Move to…* for a unit; absent where nothing may be moved here. */
  open: ((unitId: ElementId) => void) | undefined
  /** The dialog, while it is open. */
  dialog: ReactNode
}

/** What a landing that did not land says; nothing where it landed or had nothing to do. */
export function movedText(answer: PeopleMoved, t: Translate): string | undefined {
  if (answer.ok || answer.reason === 'unchanged') return undefined
  const readOnly = answer.reason === 'shell.scopeReadOnly' || answer.reason === 'readOnly'
  return t(readOnly ? 'move.refusedReadOnly' : 'move.refused')
}

export function useMoveUnit(at: {
  organisation: Organisation
  scopeOf: (id: ElementId) => ScopePath | undefined
  scopeLabel: (path: ScopePath) => string
  name: (id: ElementId) => string
  personName: (person: PersonId) => string
  today: string
  /** How a move lands; absent where nothing may be moved here. */
  land: LandPeopleMoves | undefined
  /** After a move landed: the chart goes to the unit in its new place. */
  onMoved?: (unitId: ElementId) => void
  t: Translate
}): MoveUnit {
  const { land, onMoved, t } = at
  const [unitId, setUnitId] = useState<ElementId | undefined>(undefined)
  const open = useCallback((id: ElementId) => setUnitId(id), [])
  const onMove = useCallback(async (steps: Parameters<LandPeopleMoves>[0]) => {
    if (!land) return t('move.refused')
    try {
      const answer = await land(steps, UNIT_MOVE_BARRIER)
      const refused = movedText(answer, t)
      if (refused === undefined && unitId !== undefined) onMoved?.(unitId)
      return refused
    } catch {
      return t('move.refused')
    }
  }, [land, onMoved, unitId, t])
  const dialog = unitId !== undefined && land ? (
    <MoveUnitDialog
      unitId={unitId} organisation={at.organisation} scopeOf={at.scopeOf} scopeLabel={at.scopeLabel} name={at.name}
      personName={at.personName} today={at.today} onMove={onMove} onClose={() => setUnitId(undefined)} s={t}
    />
  ) : null
  return { open: land ? open : undefined, dialog }
}

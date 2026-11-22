// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *Move to…* beside the chart (3.7.1, a panel in 4.0.0): the chart it changes
 * stays in view, its places lit, and a press on one chooses it, as a drag onto
 * it does. Nothing is written until Move: a move is a correction with no day, so
 * a stray drop must never change the structure. What it does is said first, by
 * the same plan the dialog elsewhere asks (`useMovePlan`).
 */
import type { Translate } from '../../i18n'
import type { PersonId } from '../../model/person'
import type { ElementId } from '../../model/types'
import type { UnitMovePlan, UnitMoveRefusal } from '../../model/unitMove'
import type { Organisation } from '../../model/units'
import { Button } from '../../widgets/kit/Button'
import { Panel } from '../../widgets/kit/Panel'
import { Picker } from '../../widgets/kit/Picker'
import type { PickerOption } from '../../widgets/kit/Picker'
import type { PickOption } from '../../widgets/PickToAdd'
import type { MovePlanning } from './MoveUnitDialog'
import { refusalText } from './MoveUnitDialog'
import { managedByWords } from './moveWords'
import { PANEL_HELP } from '../../platform/helpPlaces'

export type MovePanelProps = {
  unitId: ElementId
  organisation: Organisation
  name: (id: ElementId) => string
  personName: (person: PersonId) => string
  planning: MovePlanning
  onClose: () => void
  s: Translate
}

/** The places as the kit's picker lists them; one the units moved hold, or where it sits now, is shown and not offered. */
export function placesOf(options: readonly PickOption[], unitId: ElementId): PickerOption[] {
  return options.filter((one) => one.id !== unitId).map((one) => ({
    id: one.id, label: one.label, ...(one.group !== undefined ? { group: one.group } : {}),
    ...(one.disabled ? { refused: one.note ?? '' } : one.note !== undefined ? { detail: one.note } : {}),
  }))
}

export function MovePanel({ unitId, organisation, name, personName, planning, onClose, s }: MovePanelProps) {
  const { parent, setParent, options, current, along, toggleAlong, beside, plan, parentId, said, ready, move } = planning
  return (
    <div className="chart-move__holder" data-testid="move-unit-dialog">
    <Panel helpAt={PANEL_HELP.move}
      kind={s('unitMove.panelKind')} name={s('unitMove.panelName', { name: name(unitId) })} onClose={onClose} dataGuide="chart.moveUnit"
      facts={<span data-testid="move-unit-now">{current === undefined ? s('unitMove.atTopNow') : s('unitMove.sitsNow', { parent: name(current) })}</span>}
    >
      <div className="chart-move">
        <Picker
          label={s('unitMove.parent')} placeholder={s('unitMove.parent')} options={placesOf(options, unitId)} selected={parent ?? undefined} posture="open" autoFocus
          onPick={(place) => setParent(place.id)} onEscape={onClose} inputTestId="move-unit-parent" maxShown={200}
        />
        {plan && <WhatItDoes plan={plan} parentId={parentId} name={name} organisation={organisation} personName={personName} s={s} />}
        <details className="chart-move__along" data-testid="move-unit-along">
          <summary>{s('unitMove.along')}{beside.length === 0 ? ` · ${s('unitMove.alongNone')}` : ''}</summary>
          {beside.length > 0 && <p className="chart-move__quiet">{s('unitMove.alongHint')}</p>}
          {beside.map((one) => (
            <label key={one.id}>
              <input type="checkbox" checked={along.has(one.id)} onChange={() => toggleAlong(one.id)} aria-label={one.name} data-testid="move-unit-along-unit" data-unit-id={one.id} />
              {one.name}
            </label>
          ))}
        </details>
        <p className="chart-move__quiet">{s('unitMove.keeps')}</p>
        {said && <p className="chart-move__bad" role="status" data-testid="move-unit-said">{said}</p>}
        <div className="chart-move__grow" />
        <div className="chart-move__foot">
          <Button onClick={onClose}>{s('unitMove.cancel')}</Button>
          <Button variant="primary" reason={ready ? undefined : s('unitMove.pickFirst')} onClick={move} data-testid="move-unit-move">{s('unitMove.move')}</Button>
        </div>
      </div>
    </Panel>
    </div>
  )
}

/** What the move does, before it lands: refused, already there, a misfit, a plan's move, and who manages. */
function WhatItDoes({ plan, parentId, name, organisation, personName, s }: {
  plan: UnitMovePlan | UnitMoveRefusal; parentId: ElementId | undefined; name: (id: ElementId) => string
  organisation: Organisation; personName: (person: PersonId) => string; s: Translate
}) {
  if (!plan.ok) return <p className="chart-move__bad" role="status" data-testid="move-unit-refused">{refusalText(plan, name, s, parentId)}</p>
  if (plan.moved.length === 0) return <p className="chart-move__quiet" data-testid="move-unit-already">{s('unitMove.already')}</p>
  const typeName = (id: string | undefined) => organisation.unitTypes.find((one) => one.id === id)?.name ?? id ?? ''
  const typeOf = (id: ElementId) => organisation.units.find((one) => one.id === id)?.unitTypeId
  const managers = plan.managers.filter((one) => plan.moved.includes(one.unitId))
  const said = managedByWords(organisation, name, personName, s)
  return (
    <>
      {plan.fits.filter((one) => !one.fits).map((one) => (
        <p key={one.unitId} className="chart-move__warn" data-testid="move-unit-misfit">{s('unitMove.misfit', { unit: name(one.unitId), type: typeName(typeOf(one.unitId)) })}</p>
      ))}
      {plan.planned.map((one) => (
        <p key={`${one.unitId}/${one.on}`} className="chart-move__quiet" data-testid="move-unit-planned">
          {s(one.reached ? 'unitMove.plannedReached' : 'unitMove.plannedLater', { unit: name(one.unitId), day: one.on })}
        </p>
      ))}
      <div data-testid="move-unit-managed">
        <p className="chart-move__h" title={s('unitMove.managedHint')}>{s('unitMove.managedBy')}</p>
        {managers.map((one) => (
          <div key={one.unitId} data-testid="move-unit-managed-unit" data-unit-id={one.unitId}>
            {managers.length > 1 && <p className="chart-move__p"><strong>{name(one.unitId)}</strong></p>}
            <p className="chart-move__p" data-testid="move-unit-managed-before">{s('unitMove.managedNow', { managers: said(one.before) })}</p>
            <p className="chart-move__p" data-testid="move-unit-managed-after">{s('unitMove.managedAfter', { managers: said(one.after) })}</p>
          </div>
        ))}
      </div>
    </>
  )
}

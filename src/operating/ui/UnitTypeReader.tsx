// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A unit type read: its purpose, where it may sit, and each role it holds in one
 * line, how many and where its holders report. A line this type changes is the
 * only one that speaks up; a field appears on Change. What is rare is under More.
 */
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { RoleId, UnitType } from '../../model/operatingModel'
import { unitTypeLanes } from '../../model/unitOrder'
import { useStrings } from '../../i18n'
import { Button } from '../../widgets/kit/Button'
import { PropertyRow, PropertyRows } from '../../widgets/kit/Field'
import { MenuButton } from '../../widgets/kit/Menu'
import { PanelSection } from '../../widgets/kit/Panel'
import { addSlot, editUnitType, moveUnitType, setFlag, setLimit, setWithin } from '../edit'
import { Fold, OverTime, Prose, readerFoot, SourceWord, stackedFrame, Tick } from './ReaderParts'
import type { ReaderFrame, ReaderParts } from './ReaderParts'
import { howManyWords, lineWords, slotReading } from './reading'

export function UnitTypeReader({ type, parts, onOpenSlot, slotAside, frame = stackedFrame }: {
  type: UnitType; parts: ReaderParts; onOpenSlot(role: RoleId): void
  /** What the host says while a role somebody holds is being taken out. */
  slotAside: ReactNode
  frame?: ReaderFrame
}) {
  const { t } = useStrings()
  const { model, readOnly, dispatch, facts } = parts
  const [changingPlace, setChangingPlace] = useState(false)
  const others = model.unitTypes.filter((one) => one.id !== type.id)
  const name = (id: string) => model.unitTypes.find((one) => one.id === id)?.name ?? id
  const sits = [...(type.top ? [t('operating.atTheTop')] : []), ...type.within.map(name)]
  const { lanes, laneOf, nowhere } = useMemo(() => unitTypeLanes(model.unitTypes), [model.unitTypes])
  const holds = [...lanes.flatMap((one) => one.types), ...nowhere].filter((one) => one.within.includes(type.id))
  const free = model.roles.filter((role) => !type.slots.some((slot) => slot.role === role.id))
  const count = facts?.unitsOfType(type.id).length
  // Where it sits, what it may hold, its units and where it came from: the facts beside the text.
  const said = (
    <>
      <PanelSection title={t('operating.sitsInTitle')}>
        <div className="op-rowEnd">
          <span data-testid="operating-sits">{sits.length ? sits.join(', ') : t('operating.nowhere')}</span>
          {!readOnly && <Button variant="quiet" size="small" aria-expanded={changingPlace} data-testid="operating-change-place" onClick={() => setChangingPlace(!changingPlace)}>{t('operating.change')}</Button>}
        </div>
        {changingPlace && !readOnly && (
          <div data-testid="operating-place-ticks">
            <Tick checked={type.top === true} onChange={(on) => dispatch(setFlag('unitType', type.id, 'top', on))}>{t('operating.top')}</Tick>
            {others.map((other) => <Tick key={other.id} checked={type.within.includes(other.id)} onChange={(on) => dispatch(setWithin(type, other.id, on))}>{other.name}</Tick>)}
          </div>
        )}
        <div className="op-small">{t('operating.mayHoldLine', { names: holds.length ? holds.map((one) => one.name).join(', ') : t('operating.holdsNothing') })}</div>
      </PanelSection>
      {count !== undefined && parts.onOpenChart && (
        <button type="button" className="op-link" data-testid="operating-units-link" onClick={parts.onOpenChart}>{t(count === 1 ? 'operating.onChartOne' : 'operating.onChartOther', { count })}</button>
      )}
      <SourceWord basedOn={type.basedOn} />
    </>
  )
  const body = (
    <>
      <Prose label={t('operating.purpose')} value={type.purpose ?? ''} readOnly={readOnly} render={parts.renderMarkdown}
        onChange={(next) => dispatch(editUnitType(type.id, 'purpose', next))} testId="operating-purpose" />
      <PanelSection title={t('operating.slots')}>
        <div className="op-lines">
          {type.slots.map((slot) => {
            const role = model.roles.find((one) => one.id === slot.role)
            const { line, own } = slotReading(slot, role, 'solid')
            const words = own ? t('operating.ownLineHere', { line: lineWords(line, model.roles, t) }) : lineWords(line, model.roles, t)
            return (
              <button key={slot.role} type="button" className="op-line" data-testid="operating-slot" data-role={slot.role} onClick={() => onOpenSlot(slot.role)}>
                <span className="op-line__name">{role?.name ?? slot.role}</span>
                <span className="op-line__many">{howManyWords(slot, t)}</span>
                <span className="op-line__where" data-own={own || undefined}>{words}</span>
              </button>
            )
          })}
        </div>
        {slotAside}
        {!readOnly && free.length > 0 && (
          <div className="op-actions">
            <MenuButton label={t('operating.addSlot')} variant="quiet" size="small" items={free.map((role) => ({ label: role.name, onSelect: () => dispatch(addSlot(type, role.id)) }))} />
          </div>
        )}
      </PanelSection>
      <Fold label={t('operating.moreType')} testId="operating-more">
        <Tick checked={type.spans === true} disabled={readOnly} onChange={(on) => dispatch(setFlag('unitType', type.id, 'spans', on))}>{t('operating.spans')}</Tick>
        <PropertyRows readOnly={readOnly}>
          <PropertyRow
            label={t('operating.limit')} value={type.limit !== undefined ? String(type.limit) : ''} empty={t('operating.noLimit')} edit="text"
            check={(value) => (value === '' || /^\d+$/.test(value) ? undefined : t('operating.wholeNumber'))}
            onCommit={(value) => dispatch(setLimit(type, value === '' ? undefined : Number(value)))} data-guide="operating.typeLimit"
          />
        </PropertyRows>
        <p className="op-small">{t('operating.limitHint')}</p>
        <TypeOrder type={type} lane={laneOf.get(type.id)} siblings={laneOf.get(type.id) === undefined ? [] : lanes[(laneOf.get(type.id) as number) - 1].types} parts={parts} />
        <OverTime kind="unitType" item={type} others={model.unitTypes} readOnly={readOnly} dispatch={dispatch} />
      </Fold>
      {parts.aside}
    </>
  )
  return frame({ body, facts: said, foot: readerFoot(parts) })
}

function TypeOrder({ type, lane, siblings, parts }: { type: UnitType; lane: number | undefined; siblings: readonly UnitType[]; parts: ReaderParts }) {
  const { t } = useStrings()
  const at = siblings.findIndex((one) => one.id === type.id)
  const move = (to: number) => {
    const command = moveUnitType(parts.model, type.id, to)
    if (command) parts.dispatch(command)
  }
  if (lane === undefined) return <p className="op-small" data-testid="operating-type-place">{t('operating.orderNowhere')}</p>
  return (
    <div className="op-rowEnd" data-testid="operating-type-place">
      <span>{t('operating.orderAt', { lane, place: at + 1, count: siblings.length })}</span>
      {!parts.readOnly && (
        <span className="op-actions" data-guide="operating.typeOrder">
          <Button variant="quiet" size="small" reason={at <= 0 ? t('operating.orderFirst') : undefined} onClick={() => move(at - 1)}>{t('operating.orderUp')}</Button>
          <Button variant="quiet" size="small" reason={at >= siblings.length - 1 ? t('operating.orderLast') : undefined} onClick={() => move(at + 1)}>{t('operating.orderDown')}</Button>
        </span>
      )}
    </div>
  )
}


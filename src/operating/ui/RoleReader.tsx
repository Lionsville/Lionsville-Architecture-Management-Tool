// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A role read, beside the structure or the grid and in the Roles list's preview:
 * where it is held and by whom, its lines as text with Change, what it answers
 * for, and each unit that holds it with who holds it there, each a way to its
 * place in the organisation. Nothing here is stored for the reader.
 */
import { useState } from 'react'
import { inOwnOrder, linesSaid, typesHolding } from '../../model/operatingModel'
import type { LineKind, Role } from '../../model/operatingModel'
import { useStrings } from '../../i18n'
import { Button } from '../../widgets/kit/Button'
import { PropertyRow, PropertyRows } from '../../widgets/kit/Field'
import { PanelSection } from '../../widgets/kit/Panel'
import { editRole, moveRole, setFlag, setRoleReportsTo } from '../edit'
import { LinesEditor } from './LinesEditor'
import { Fold, OverTime, Prose, ReaderFoot, SourceWord, Tick } from './ReaderParts'
import type { ReaderParts } from './ReaderParts'
import { roleNamed } from './reading'
import { ReportedBy } from './SlotReader'

const PLACES_SHOWN = 5

export function RoleReader({ role, parts, partName, partDuties }: {
  role: Role; parts: ReaderParts
  /** The part of the responsibilities looked at, for saying the role's letters there first. */
  partName?: string | undefined
  partDuties?: readonly string[] | undefined
}) {
  const { t } = useStrings()
  const { model, readOnly, dispatch, facts } = parts
  const holding = typesHolding(model.unitTypes, role.id)
  const places = facts?.placesOf(role.id) ?? []
  const people = new Set(places.flatMap((place) => place.holders.map((one) => one.name))).size
  const vacant = places.reduce((sum, place) => sum + place.vacant, 0)
  const [changing, setChanging] = useState<LineKind | undefined>(undefined)
  const [allPlaces, setAllPlaces] = useState(false)
  const [allDuties, setAllDuties] = useState(false)
  const lines = linesSaid(role.reportsTo)
  const write = (next: Parameters<typeof setRoleReportsTo>[1]) => {
    const why = parts.refuseLine?.({ on: 'role', roleId: role.id, said: next })
    if (!why) dispatch(setRoleReportsTo(role, next))
    return why
  }
  const lineRow = (kind: LineKind, label: string) => {
    const line = lines.find((one) => one.kind === kind)
    return (
      <>
        <div className="op-rowEnd">
          <span>{label}: {line ? `${roleNamed(model.roles, line.role)}${line.within ? ` · ${t('operating.lineWithinShort')}` : ''}` : kind === 'solid' ? t('operating.byNestingCap') : t('operating.none')}</span>
          {!readOnly && <Button variant="quiet" size="small" aria-expanded={changing === kind} data-testid={`operating-role-change-${kind}`} onClick={() => setChanging(changing === kind ? undefined : kind)}>{t('operating.change')}</Button>}
        </div>
        {changing === kind && !readOnly && <LinesEditor roleId={role.id} name={role.name} kind={kind} said={lines} roles={model.roles} onChange={write} testId="operating-role-lines" />}
      </>
    )
  }
  const shownDuties = partDuties && !allDuties ? role.duties.filter((duty) => partDuties.includes(duty.responsibility)) : role.duties
  return (
    <div data-testid="operating-role-reader">
      <Prose label={t('operating.purpose')} value={role.purpose ?? ''} readOnly={readOnly} render={parts.renderMarkdown}
        onChange={(next) => dispatch(editRole(role.id, 'purpose', next))} testId="operating-purpose" />
      <PanelSection>
        <div data-testid="operating-held-in">{t('operating.heldInLine', { types: holding.length ? holding.map((type) => type.name).join(', ') : t('operating.inNoType') })}</div>
        {facts && <div data-testid="operating-holders">{t('operating.holdersLine', { people, vacant })}</div>}
        {lineRow('solid', t('operating.lineSolid'))}
        {lineRow('dotted', t('operating.lineDotted'))}
      </PanelSection>
      <PanelSection
        title={partName !== undefined && !allDuties ? t('operating.dutiesIn', { part: partName }) : t('operating.duties')}
        aside={partDuties && !allDuties && role.duties.length !== shownDuties.length
          ? <button type="button" className="op-link" onClick={() => setAllDuties(true)}>{t('operating.dutiesAll', { count: role.duties.length })}</button>
          : undefined}
      >
        {shownDuties.length === 0
          ? <span className="op-quiet">{t('operating.noDuties')}</span>
          : shownDuties.map((duty) => (
            <div className="op-duty" key={duty.responsibility}>
              <b>{duty.raci}</b>
              <button type="button" className="op-link" onClick={() => parts.onSelect(duty.responsibility)}>{model.responsibilities.find((one) => one.id === duty.responsibility)?.name ?? duty.responsibility}</button>
            </div>
          ))}
      </PanelSection>
      {facts && places.length > 0 && (
        <PanelSection title={t('operating.inTheOrganisation')}>
          {(allPlaces ? places : places.slice(0, PLACES_SHOWN)).map((place) => (
            <div className="op-inplace" key={place.unit.id} data-testid="operating-role-place">
              {parts.onOpenUnit
                ? <button type="button" className="op-link" onClick={() => parts.onOpenUnit?.(place.unit)}>{place.unit.name}</button>
                : <span>{place.unit.name}</span>}
              <span className="op-small">
                {place.holders.length
                  ? place.holders.map((one) => (one.acting ? t('operating.acting', { name: one.name }) : one.name)).join(', ')
                  // Vacant is what the slot's minimum says is missing, as the count above reads it; an optional place nobody holds is quiet.
                  : place.vacant > 0 ? <span className="op-vacant">{t('operating.vacant')}</span> : <span className="op-quiet">{t('operating.nobodyYet')}</span>}
              </span>
            </div>
          ))}
          {!allPlaces && places.length > PLACES_SHOWN && <button type="button" className="op-link" onClick={() => setAllPlaces(true)}>{t('operating.moreCount', { count: places.length - PLACES_SHOWN })}</button>}
          {parts.onOpenChart && <div className="op-actions"><Button variant="plain" size="small" data-testid="operating-open-chart" onClick={parts.onOpenChart}>{t('operating.openInOrganisation')}</Button></div>}
        </PanelSection>
      )}
      <ReportedBy slotRole={role.id} parts={parts} />
      <Tick checked={role.manages === true} disabled={readOnly} onChange={(on) => dispatch(setFlag('role', role.id, 'manages', on))}>{t('operating.managesHint')}</Tick>
      <div className="op-rowEnd"><span /><SourceWord basedOn={role.basedOn} /></div>
      <Fold label={t('operating.moreRole')} testId="operating-more">
        <PropertyRows readOnly={readOnly}>
          <PropertyRow label={t('operating.short')} value={role.short ?? ''} empty={t('operating.noShort')} edit="text" onCommit={(value) => dispatch(editRole(role.id, 'short', value))} />
        </PropertyRows>
        <RoleColumn role={role} parts={parts} />
        <OverTime kind="role" item={role} others={model.roles} readOnly={readOnly} dispatch={dispatch} />
      </Fold>
      <ReaderFoot parts={parts} />
    </div>
  )
}

function RoleColumn({ role, parts }: { role: Role; parts: ReaderParts }) {
  const { t } = useStrings()
  const ordered = inOwnOrder(parts.model.roles)
  const at = ordered.findIndex((one) => one.id === role.id)
  const left = moveRole(parts.model, role.id, -1)
  const right = moveRole(parts.model, role.id, 1)
  return (
    <div className="op-rowEnd">
      <span>{t('operating.roleOrderAt', { place: at + 1, count: ordered.length })}</span>
      {!parts.readOnly && (
        <span className="op-actions" data-guide="operating.roleOrder">
          <Button variant="quiet" size="small" reason={left ? undefined : t('operating.orderFirst')} onClick={() => left && parts.dispatch(left)}>{t('operating.orderLeft')}</Button>
          <Button variant="quiet" size="small" reason={right ? undefined : t('operating.orderLast')} onClick={() => right && parts.dispatch(right)}>{t('operating.orderRight')}</Button>
        </span>
      )}
    </div>
  )
}


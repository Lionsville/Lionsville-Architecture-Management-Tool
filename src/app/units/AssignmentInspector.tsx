// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One assignment, chosen on the organisation chart, in the inspector docked
 * beside it (ADR-0036 §4, §7): who holds it, the role and the unit, its first
 * and last day, the part of their time it takes, and a note where the person
 * holds more than all of their time on the chart's day.
 *
 * **Ended on a day the person chooses**, from a quiet action at the foot that
 * asks for it: ending someone's assignment is not the page's strongest act. It
 * is one step in the scope that keeps it, the day offered being the chart's less
 * one where that is still to come and today otherwise, and never before its
 * first. An ended one stays: it is what the person held. A correction, or a
 * removal of one made by mistake, is the unit's dialog (`AssignDialog`).
 *
 * **Open in People** goes to the register with the person picked, where the
 * register is there: the People page is the organisation's, so it leaves this
 * scope for its home.
 *
 * **Reports to** (ADR-0039, amended 17 October 2026): where this holder
 * reports, by which line or by nesting and who manages them, with
 * *Override…* for a line of their own and *Use the model's* to take it away
 * (`HolderLines`) — reached from the person picked on the chart, not only
 * from the unit's lines.
 *
 * Read on the chart's day, off the organisation as the open scope's session
 * has it laid over the tree, so an end made a second ago is said at once.
 * Where the scope is only read, a manager of the unit may still end and
 * correct it (ADR-0036 §12); everyone else reads it.
 */
import { useMemo, useState } from 'react'
import { useStrings } from '../../i18n'
import { Button } from '../../widgets/kit/Button'
import { Dialog } from '../../widgets/kit/Dialog'
import { TextField } from '../../widgets/kit/Field'
import type { Language, Translate } from '../../i18n'
import { formatDay } from '../../i18n/dates'
import type { Command } from '../../model/commands'
import type { HostModel } from '../../model/hostModel'
import { isDay } from '../../model/lifecycle'
import { mayChangeIn } from '../../model/managing'
import { overAllOfTheirTime } from '../../model/orgChart'
import { pickedPerson } from '../../model/person'
import type { PersonId } from '../../model/person'
import type { DesignDiagram } from '../../model/types'
import { dayBefore, loadOn, personOf, roleOn, shareOf, slotsOf } from '../../model/units'
import type { Assignment, Organisation } from '../../model/units'
import { registerOf, resolvePerson } from '../../people/shown'
import type { PeopleRegisterAccess } from '../../people/ui/access'
import { usePersonNames } from '../../people/ui/names'
import type { PersonNames } from '../../people/ui/names'
import type { ScopeIndex } from '../../projects/scopeIndex'
import type { ScopePath } from '../../projects/scopePath'
import { AssignDialog } from './AssignDialog'
import { reportsInto } from './chartLines'
import { HolderLines } from './HolderLines'
import { organisationHere } from './organisationHere'

export type AssignmentInspectorProps = {
  assignmentId: string
  /** The chart, with the day it is looked at on (`asOf`; absent is today). */
  diagram: DesignDiagram
  index: ScopeIndex
  scope: ScopePath
  /** The open scope's model as its session holds it now. */
  model: HostModel
  today: string
  readOnly: boolean
  people: PeopleRegisterAccess | undefined
  dispatch: (command: Command) => unknown
  makeId: (prefix: string) => string
  scopeName: string
  /** The People page with this person picked. Absent: there is nowhere to go. */
  onOpenPeople?: (person: PersonId) => void
  /** Kept in another scope: read here, changed there, and opened there by its button. Absent: kept in this one. */
  keptIn?: { name: string; open?: () => void }
}

export function AssignmentInspector(props: AssignmentInspectorProps) {
  const { t, language } = useStrings()
  const names = usePersonNames()
  const { index, scope, model, people } = props
  const day = props.diagram.asOf ?? props.today
  const at = useMemo(() => organisationHere(index, scope, model), [index, scope, model])
  const [correcting, setCorrecting] = useState(false)
  const { organisation } = at
  const held = organisation.assignments.find((one) => one.id === props.assignmentId)
  if (!held) return null
  const unit = organisation.units.find((one) => one.id === held.unitId)
  const roles = new Map(organisation.roles.map((role) => [role.id, role]))
  const entry = resolvePerson(personOf(held), registerOf(people?.people ?? []))
  const keptIn = props.keptIn
  const mayWrite = mayWriteHere(props, held)
  const roleName = roleNameOf(roles, held.roleId)
  const load = (person: PersonId) => loadOn(organisation.assignments, person, day, names.canonical)
  return (
    <div data-testid="assignment-inspector" className="chart-held">
      <Said held={held} unitName={unit?.name ?? held.unitId} roleName={roleName}
        external={entry?.kind === 'external' && entry.state !== 'forgotten'} load={load(personOf(held))} day={day} names={names} language={language} t={t} />
      <HolderLines organisation={organisation} held={held} day={day} editable={mayWrite} scopeOf={(id) => at.unitAt(id)?.scope}
        names={names} dispatch={props.dispatch} s={t} />
      <ReportsAndTime held={held} organisation={organisation} day={day} load={load(personOf(held))} names={names} t={t} />
      {keptIn && <KeptIn keptIn={keptIn} t={t} />}
      <div className="chart-held__acts">
        {mayWrite && people && unit && (
          <Button onClick={() => setCorrecting(true)} data-testid="assignment-correct">{t('chart.assignmentCorrect')}</Button>
        )}
        {props.onOpenPeople && people && entry && (
          <Button onClick={() => props.onOpenPeople?.(entry.id)} data-testid="assignment-people">{t('chart.assignmentPeople')}</Button>
        )}
      </div>
      {mayWrite && held.until === undefined && (
        <EndOn key={held.id} held={held} day={day} today={props.today} person={names.text(pickedPerson(personOf(held)))} role={roleName} language={language} t={t}
          onEnd={(until) => props.dispatch({ type: 'assignment.update', id: held.id, patch: { until } })} />
      )}
      {correcting && people && unit && (
        <AssignDialog
          assigning={{ mode: 'edit', assignment: held }} unit={{ id: unit.id, name: unit.name }}
          roles={slotsOf(unit, organisation.unitTypes.find((type) => type.id === unit.unitTypeId))
            .flatMap((slot) => roles.get(slot.role) ?? []).filter((role) => !props.readOnly || mayChangeIn(people.manages, unit.id, role.id))}
          others={organisation.roles.filter((role) => roleOn(role, day) && (!props.readOnly || mayChangeIn(people.manages, unit.id, role.id)))}
          register={people} today={day > props.today ? day : props.today} endOn={endDay(held, day, props.today)}
          makeId={props.makeId} dispatch={props.dispatch} scopeName={props.scopeName}
          loadOf={(one) => t('assign.load', { share: Math.round(load(one.id) * 100), day })}
          onClose={() => setCorrecting(false)} s={t}
        />
      )}
    </div>
  )
}

/** Where the scope is only read, a manager of the unit still ends and corrects it (ADR-0036 §12); one kept elsewhere is changed there. */
function mayWriteHere(props: AssignmentInspectorProps, held: Assignment): boolean {
  if (props.keptIn !== undefined) return false
  return !props.readOnly || mayChangeIn(props.people?.manages, held.unitId, held.roleId, held.id)
}

const roleNameOf = (roles: ReadonlyMap<string, { name: string }>, id: string) => roles.get(id)?.name ?? id

/** Who reports to them, and how much of their time it is. */
function ReportsAndTime({ held, organisation, day, load, names, t }: { held: Assignment; organisation: Organisation; day: string; load: number; names: PersonNames; t: Translate }) {
  const into = reportsInto(organisation, held, day)
  const share = shareOf(held)
  const roleName = (id: string) => organisation.roles.find((one) => one.id === id)?.name ?? id
  const unitName = (id: string) => organisation.units.find((one) => one.id === id)?.name ?? id
  return (
    <>
      <p className="chart-held__h">{t('chart.assignmentReportsThem')}</p>
      {into.length === 0
        ? <p className="chart-held__quiet" data-testid="assignment-reports-none">{t('chart.assignmentNobody')}</p>
        : into.map((one) => (
          <p key={one.id} className="chart-held__line" data-testid="assignment-reports">
            {names.text(pickedPerson(personOf(one)))}, {t('chart.assignmentIn', { role: roleName(one.roleId), unit: unitName(one.unitId) })}
          </p>
        ))}
      <p className="chart-held__h">{t('chart.assignmentTime')}</p>
      <p className="chart-held__line" data-testid="assignment-time">
        {load <= share + 0.005 ? t('chart.assignmentTimeOnly', { share: Math.round(share * 100) }) : t('chart.assignmentTimeOf', { share: Math.round(share * 100), all: Math.round(load * 100) })}
      </p>
    </>
  )
}

/** Where an assignment kept in another scope is changed, and the way there. */
function KeptIn({ keptIn, t }: { keptIn: NonNullable<AssignmentInspectorProps['keptIn']>; t: Translate }) {
  return (
    <>
      <p className="chart-held__quiet" data-testid="assignment-kept-in">{t('chart.assignmentKeptIn', { scope: keptIn.name })}</p>
      {keptIn.open && <Button onClick={keptIn.open} data-testid="assignment-open-there">{t('chart.assignmentOpenThere', { scope: keptIn.name })}</Button>}
    </>
  )
}

/** Who holds it — *ext* and *you* where they are — in which role and unit, for what share, on which days, and whether it is all too much. */
function Said({ held, unitName, roleName, external, load, day, names, language, t }: {
  held: Assignment; unitName: string; roleName: string; external: boolean; load: number; day: string
  names: PersonNames; language: Language; t: Translate
}) {
  const person = pickedPerson(personOf(held))
  const share = shareOf(held)
  return (
    <>
      <h2 className="chart-held__who" data-testid="assignment-person">
        {[names.text(person), external ? t('chart.external') : undefined, names.isMe(person) ? t('unit.you') : undefined].filter(Boolean).join(' · ')}
      </h2>
      <p className="chart-held__line" data-testid="assignment-role">
        {[
          t('chart.assignmentIn', { role: roleName, unit: unitName }),
          share < 1 ? t('chart.assignmentShare', { share: Math.round(share * 100) }) : undefined,
          held.acting ? t('unit.acting') : undefined,
        ].filter(Boolean).join(' · ')}
      </p>
      <p className="chart-held__quiet" data-testid="assignment-days">{daysText(held, language, t)}</p>
      {overAllOfTheirTime(load) && <p className="chart-held__over" data-testid="assignment-over">{t('chart.assignmentOver', { share: Math.round(load * 100), day: formatDay(day, language) })}</p>}
    </>
  )
}

/** Its first and last day, as far as it says them. */
function daysText(held: Assignment, language: Language, t: Translate): string {
  const from = held.from !== undefined ? formatDay(held.from, language) : undefined
  const until = held.until !== undefined ? formatDay(held.until, language) : undefined
  if (from !== undefined && until !== undefined) return t('chart.assignmentFromUntil', { from, until })
  if (from !== undefined) return t('chart.assignmentFrom', { from })
  if (until !== undefined) return t('chart.assignmentUntil', { until })
  return t('chart.assignmentAlways')
}

/**
 * The last day *End* offers first: the day before the chart's where that is
 * still to come, today otherwise — and never before the assignment's first
 * day, which would end it before it began.
 */
export function endDay(held: Pick<Assignment, 'from'>, day: string, today: string): string {
  const offered = day > today ? dayBefore(day) : today
  return held.from !== undefined && held.from > offered ? held.from : offered
}

/** *End this assignment…*: quiet, at the foot, and it asks for its last day before the step that sets it. */
function EndOn({ held, day, today, person, role, language, t, onEnd }: {
  held: Assignment; day: string; today: string; person: string; role: string; language: Language; t: Translate; onEnd: (until: string) => void
}) {
  const [asking, setAsking] = useState(false)
  const [until, setUntil] = useState(() => endDay(held, day, today))
  const early = isDay(until) && held.from !== undefined && until < held.from
  const ready = isDay(until) && !early
  return (
    <div data-testid="assignment-end" className="chart-end">
      <Button variant="quiet" onClick={() => setAsking(true)} data-testid="assignment-end-ask">{t('chart.assignmentEndAsk')}</Button>
      <Dialog
        open={asking} size="s" title={t('chart.assignmentEndTitle', { person, role })} onClose={() => setAsking(false)}
        onSubmit={() => { if (ready) { setAsking(false); onEnd(until) } }}
        actions={(
          <>
            <Button onClick={() => setAsking(false)}>{t('assign.cancel')}</Button>
            <Button type="submit" variant="primary" reason={ready ? undefined : t('chart.assignmentLastDay')} data-testid="assignment-end-on">{t('chart.assignmentEndOn')}</Button>
          </>
        )}
      >
        <TextField
          type="date" label={t('chart.assignmentLastDay')} value={until} onChange={setUntil} data-testid="assignment-until" autoFocus
          hint={t('chart.assignmentEndBody')} {...(early && held.from !== undefined ? { error: t('chart.assignmentEndEarly', { day: formatDay(held.from, language) }) } : {})}
        />
      </Dialog>
    </div>
  )
}

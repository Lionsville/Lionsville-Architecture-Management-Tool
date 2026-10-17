// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One assignment, chosen on the organisation chart, in the inspector docked
 * beside it (ADR-0036 §4, §7): who holds it, the role and the unit, its first
 * and last day, the part of their time it takes, and a note where the person
 * holds more than all of their time on the chart's day.
 *
 * **Ended on a day the person chooses.** An assignment that runs on is ended
 * here by its last day, one step in the scope that keeps it — the chart's day
 * less one where that is still to come, today otherwise, and any day the
 * person picks instead, not before its first. An ended one stays: it is what
 * the person held. A correction, or a removal of one made by mistake, is the
 * unit's dialog (`AssignDialog`), opened from here.
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
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useStrings } from '../../i18n'
import { SectionHeading } from '../../widgets/CompactForms'
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
import type { Assignment } from '../../model/units'
import { registerOf, resolvePerson } from '../../people/shown'
import type { PeopleRegisterAccess } from '../../people/ui/access'
import { usePersonNames } from '../../people/ui/names'
import type { PersonNames } from '../../people/ui/names'
import type { ScopeIndex } from '../../projects/scopeIndex'
import type { ScopePath } from '../../projects/scopePath'
import { AssignDialog } from './AssignDialog'
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

const SECTION = { fontSize: 12, fontWeight: 700, color: 'text.secondary', mt: 1.25, mb: 0.25 } as const
const LINE = { fontSize: 13 } as const
const QUIET = { fontSize: 12, color: 'text.secondary' } as const

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
  const load = (person: PersonId) => loadOn(organisation.assignments, person, day, names.canonical)
  return (
    <Box data-testid="assignment-inspector" sx={{ pt: 0.5 }}>
      <Said held={held} unitName={unit?.name ?? held.unitId} roleName={roles.get(held.roleId)?.name ?? held.roleId}
        external={entry?.kind === 'external' && entry.state !== 'forgotten'} load={load(personOf(held))} day={day} names={names} language={language} t={t} />
      <HolderLines organisation={organisation} held={held} day={day} editable={mayWrite} scopeOf={(id) => at.unitAt(id)?.scope}
        names={names} dispatch={props.dispatch} s={t} />
      {mayWrite && held.until === undefined && (
        <EndOn key={held.id} held={held} day={day} today={props.today} language={language} t={t}
          onEnd={(until) => props.dispatch({ type: 'assignment.update', id: held.id, patch: { until } })} />
      )}
      {keptIn && <KeptIn keptIn={keptIn} t={t} />}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
        {mayWrite && people && unit && (
          <Button size="small" variant="outlined" onClick={() => setCorrecting(true)} data-testid="assignment-correct">{t('chart.assignmentCorrect')}</Button>
        )}
        {props.onOpenPeople && people && entry && (
          <Button size="small" variant="outlined" onClick={() => props.onOpenPeople?.(entry.id)} data-testid="assignment-people">{t('chart.assignmentPeople')}</Button>
        )}
      </Box>
      <Typography sx={{ ...QUIET, mt: 1.5 }}>{t('chart.assignmentHeld')}</Typography>
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
    </Box>
  )
}

/** Where the scope is only read, a manager of the unit still ends and corrects it (ADR-0036 §12); one kept elsewhere is changed there. */
function mayWriteHere(props: AssignmentInspectorProps, held: Assignment): boolean {
  if (props.keptIn !== undefined) return false
  return !props.readOnly || mayChangeIn(props.people?.manages, held.unitId, held.roleId, held.id)
}

/** Where an assignment kept in another scope is changed, and the way there. */
function KeptIn({ keptIn, t }: { keptIn: NonNullable<AssignmentInspectorProps['keptIn']>; t: Translate }) {
  return (
    <>
      <Typography sx={{ ...QUIET, mt: 1 }} data-testid="assignment-kept-in">{t('chart.assignmentKeptIn', { scope: keptIn.name })}</Typography>
      {keptIn.open && (
        <Button size="small" variant="outlined" onClick={keptIn.open} data-testid="assignment-open-there" sx={{ mt: 1 }}>
          {t('chart.assignmentOpenThere', { scope: keptIn.name })}
        </Button>
      )}
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
      <SectionHeading>{t('chart.assignment')}</SectionHeading>
      <Typography component="h2" sx={{ fontSize: 16, fontWeight: 700 }} data-testid="assignment-person">
        {[names.text(person), external ? t('chart.external') : undefined, names.isMe(person) ? t('unit.you') : undefined].filter(Boolean).join(' · ')}
      </Typography>
      <Typography sx={LINE} data-testid="assignment-role">
        {[
          t('chart.assignmentIn', { role: roleName, unit: unitName }),
          share < 1 ? t('chart.assignmentShare', { share: Math.round(share * 100) }) : undefined,
          held.acting ? t('unit.acting') : undefined,
        ].filter(Boolean).join(' · ')}
      </Typography>
      <Typography sx={QUIET} data-testid="assignment-days">{daysText(held, language, t)}</Typography>
      {overAllOfTheirTime(load) && (
        <Typography sx={{ fontSize: 12, color: 'warning.main', mt: 0.5 }} data-testid="assignment-over">
          {t('chart.assignmentOver', { share: Math.round(load * 100), day: formatDay(day, language) })}
        </Typography>
      )}
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

/** *End it*: a last day, offered and changed, and the step that sets it. */
function EndOn({ held, day, today, language, t, onEnd }: {
  held: Assignment; day: string; today: string; language: Language; t: Translate; onEnd: (until: string) => void
}) {
  const [until, setUntil] = useState(() => endDay(held, day, today))
  const early = isDay(until) && held.from !== undefined && until < held.from
  return (
    <Box data-testid="assignment-end">
      <Typography sx={SECTION}>{t('chart.assignmentEnd')}</Typography>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField type="date" label={t('chart.assignmentLastDay')} value={until} onChange={(event) => setUntil(event.target.value)}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'data-testid': 'assignment-until' } }} />
        <Button size="small" variant="contained" disabled={!isDay(until) || early} onClick={() => onEnd(until)} data-testid="assignment-end-on">
          {t('chart.assignmentEndOn')}
        </Button>
      </Box>
      {early && held.from !== undefined && (
        <Typography sx={{ fontSize: 12, color: 'error.main', mt: 0.5 }}>{t('chart.assignmentEndEarly', { day: formatDay(held.from, language) })}</Typography>
      )}
    </Box>
  )
}

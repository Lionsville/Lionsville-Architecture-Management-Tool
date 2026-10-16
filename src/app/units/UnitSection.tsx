// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * An actor as a unit, in its inspector (ADR-0036 §3, §4, §7, §12): its type,
 * where it is filed and the domains it serves, what it owns and answers for,
 * the roles it holds and who holds them on the day, who manages it, the units
 * it works with, what the checks say of it, and how it changes over time.
 *
 * **Everything here is the model's, read on the day the board is looked at**
 * (ADR-0027, ADR-0036 §6): the board's look where somebody is looking at
 * another day, the board's own day where it has one, and today otherwise —
 * so the organisation beside a landscape is the organisation of that
 * landscape's day, the plans' moves of that day included. What it owns is every
 * application whose `partyId` names it; what it answers for is its `assigned`
 * rows; a vacancy is a slot's minimum less the people holding the role; who
 * manages it is whoever holds a managing role in it or above it. Core grants
 * nothing from the last: a build with accounts may (§12), and says so itself.
 *
 * **A unit's people are changed where it is kept.** A stand-in of a unit is
 * read here and its people are changed in the scope that answers for it; the
 * assignments are that scope's records. A person is named by the register,
 * and *you* is marked where this install says who you are.
 *
 * **Each link has one home and two ends** (ADR-0036, amended 11 October
 * 2026). *Serves* is the unit's `scopes`, a step here; a scope's *Served by*
 * writes the same field from the other end. *Responsible for* is the
 * `assigned` rows from it, each kept in the scope of the area, grouping or
 * capability it names: one picked here that this scope defines is a step
 * here, and one another scope defines is that scope's step, under its rights
 * (`writeIn`). A unit that answers for something in a domain it does not
 * serve says so among its checks (`check.unitNotServing`).
 *
 * **A manager changes their units' people where the scope is only read**
 * (ADR-0036 §12), where the source grants that right
 * (`PeopleRegisterAccess.manages`): *Assign*, a holder's correction, end and
 * removal on a unit they manage — a managing role's only strictly below one
 * they hold — and nothing else of the unit.
 *
 * **A unit comes first in its inspector** (as built 3.6.1). The host says
 * this section leads where the actor has a type (`UnitSlot`), so it sits under
 * the name: the type says what the unit is, with where it is filed beneath
 * it, and its parts follow in the order a person comes to a unit for. An
 * actor without a type keeps the section as it was, under General.
 */
import { useId, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { StringKey, Translate } from '../../i18n'
import type { Command } from '../../model/commands'
import type { HostModel } from '../../model/hostModel'
import type { Role, RoleSlot, UnitType } from '../../model/operatingModel'
import { slotRange } from '../../model/operatingModel'
import { pickedPerson } from '../../model/person'
import type { DesignElement } from '../../model/types'
import { dayBefore, holdersOn, isUnit, loadOn, managersOf, parentOn, personOf, runsOn, shareOf, slotsOf, unitLastDay } from '../../model/units'
import type { Assignment } from '../../model/units'
import { mayChangeIn } from '../../model/managing'
import { meIn } from '../../people/me'
import { personText, registerOf, resolvePerson } from '../../people/shown'
import type { PeopleRegisterAccess } from '../../people/ui/access'
import { CHECK_LIST_WORDS, groupByCheck } from '../../model/checkCatalogue'
import type { CheckAction } from '../../model/checkCatalogue'
import { checkMarksHere } from '../../projects/checkMarks'
import { findingSentence, findingsOfOrganisation } from '../../projects/checks'
import type { Finding } from '../../projects/checks'
import { movesOf } from '../../projects/scopeIndex'
import type { ScopeIndex } from '../../projects/scopeIndex'
import type { ScopePath } from '../../projects/scopePath'
import { scopeTrail } from '../../projects/scopeLabel'
import { transitionLabel } from '../../model/transition'
import { AssignDialog } from './AssignDialog'
import type { Assigning } from './AssignDialog'
import { InteractDialog, InteractionsSection } from './Interactions'
import { UnitLines } from './UnitLines'
import type { Interacting, InteractionLine } from './Interactions'
import { organisationHere } from './organisationHere'
import { functionChoices, scopeChoices } from './choices'
import { refusalKey } from './writeIn'
import type { WriteIn } from './writeIn'
import { scopesServed, scopesWith, scopesWithout } from '../../model/serving'
import { compareUnits, unitTypeRank } from '../../model/unitOrder'
import { FindingsList } from '../../widgets/FindingsList'
import { useFindingMarks } from '../checkMarking'
import type { FindingActions } from '../../widgets/FindingsList'
import { PickToAdd } from '../../widgets/PickToAdd'

export type UnitSectionProps = {
  element: DesignElement
  readOnly: boolean
  /** The scope open: where this record is kept. */
  scope: ScopePath
  /** The open scope's model as its session holds it now. */
  model: HostModel
  index: ScopeIndex
  dispatch: (command: Command) => unknown
  makeId: (prefix: string) => string
  /** A new row's id, from the scope's own id policy: what an interaction is written under. */
  newRowId: () => string
  people: PeopleRegisterAccess | undefined
  today: string
  /**
   * The day the organisation is looked at (ADR-0027): the board's look, or
   * its own day, or today. What the section shows is that day's; what it
   * writes starts from it where it is still to come.
   */
  day?: string
  scopeLabel: (path: ScopePath) => string
  /** Every scope of the tree, for the domains a unit serves. */
  scopes: readonly ScopePath[]
  /**
   * A link kept in another scope, written there as its step: an area, a
   * grouping or a capability another scope defines, picked for *Responsible
   * for*. Absent: only this scope's own are offered.
   */
  writeIn?: WriteIn
  /** A scope's home, opened from a domain the unit serves. Absent: the domains are not ways out. */
  onOpenHome?: (path: ScopePath) => void
  s: Translate
}

const SECTION = { fontSize: 12, fontWeight: 700, color: 'text.secondary', mt: 1.25, mb: 0.25 } as const
const LINE = { fontSize: 13 } as const
const QUIET = { fontSize: 12, color: 'text.secondary' } as const

/** What the section is worked out from, once per render, on the day it is looked at. */
function useUnitFacts(props: UnitSectionProps) {
  const { element, scope, model, index, people } = props
  const today = props.day ?? props.today
  return useMemo(() => {
    const at = organisationHere(index, scope, model)
    const { organisation } = at
    const types = organisation.unitTypes
    const type = types.find((one) => one.id === element.unitTypeId)
    const roles = new Map(organisation.roles.map((role) => [role.id, role]))
    const register = registerOf(people?.people ?? [])
    // A merged id is the entry it went into: one person, counted once and marked once (ADR-0036 §9).
    const canonical = (id: string) => resolvePerson(id, register)?.id ?? id
    const me = meIn(people?.me, register)?.id
    const isMe = (id: string) => me !== undefined && canonical(id) === me
    const unitName = (id: string) => organisation.units.find((one) => one.id === id)?.name ?? index.lookup(id)?.name ?? id
    const owns = [
      ...index.register().filter((entry) => entry.partyId === element.id && entry.master !== scope).map((entry) => entry.name),
      ...model.elements.filter((one) => one.kind === 'application' && one.ref === undefined && one.partyId === element.id).map((one) => one.name),
    ].sort((a, b) => a.localeCompare(b))
    // Each `assigned` row from it, with the scope that keeps it: this one's as the session has them, the rest the tree's.
    const answersFor: AnswerRow[] = [
      ...model.relations.filter((row) => row.type === 'assigned' && row.sourceId === element.id).map((row) => ({ row, keptIn: scope })),
      ...index.rowsOf(element.id).filter(({ scope: kept, relation }) => kept !== scope && relation.type === 'assigned' && relation.sourceId === element.id)
        .map(({ scope: keptIn, relation }) => ({ row: relation, keptIn })),
    ].map(({ row, keptIn }) => ({
      id: row.targetId, relationId: row.id, keptIn,
      name: model.elements.find((one) => one.id === row.targetId)?.name ?? index.lookup(row.targetId)?.name ?? row.targetId,
    }))
    const findings = findingsOfOrganisation(at, today, canonical)
    const holders = new Set(organisation.assignments.filter((one) => one.unitId === element.id && runsOn(one, today)).map((one) => canonical(personOf(one))))
    // What the checks find in it; its list splits off what was marked as intended (`model/checkMarks`).
    const said = findings.filter((one) => (one.person !== undefined
      ? holders.has(one.person)
      : one.id === element.id || (one.key === 'check.unitNotServing' && one.fields?.[0] === element.id)))
    // Its moves, each with the plan that makes it: the open scope's plans as the session holds them, the tree's for the rest.
    const moves = [...index.moves().filter((one) => one.scope !== scope), ...movesOf(scope, model)]
      .filter((one) => one.move.unitId === element.id)
      .sort((a, b) => a.move.on.localeCompare(b.move.on))
    const parent = parentOn(element, organisation.moves, today)
    const scopeOf = (id: string) => at.unitAt(id)?.scope
    return { organisation, types, type, roles, register, canonical, isMe, unitName, scopeOf, owns, answersFor, said, moves, parent }
  }, [element, scope, model, index, people?.people, today])
}

export function UnitSection(props: UnitSectionProps) {
  const { element, readOnly, scope, dispatch, people, scopeLabel, s } = props
  const today = props.day ?? props.today
  const facts = useUnitFacts(props)
  // What is written starts on the day looked at where that is still to come: an
  // assignment from it, and an end the day before it.
  const later = today > props.today
  const assignFrom = later ? today : props.today
  const endOn = later ? dayBefore(today) : props.today
  const [assigning, setAssigning] = useState<Assigning | undefined>(undefined)
  const standIn = element.ref !== undefined
  const editable = !readOnly && !standIn
  // The unit's people: wherever the scope may be written, and — where it is only
  // read — a unit the person manages, a managing role's only strictly below one they hold.
  const peopleHere = people !== undefined && !standIn && (!readOnly || (people.manages?.units.has(element.id) ?? false))
  const mayRole = (roleId: string) => peopleHere && (!readOnly || mayChangeIn(people?.manages, element.id, roleId))
  const name = (person: string) => personText(pickedPerson(person), facts.register, s)
  const update = (patch: Partial<DesignElement>) => dispatch({ type: 'element.update', id: element.id, patch })
  const unit = isUnit(element)
  return (
    <Box data-testid="unit-section" sx={{ mt: unit ? 0.5 : 1 }}>
      {/* A unit leads its inspector, under its name, and its type says what it is; an actor that is not one says Unit over the choice. */}
      {!unit && <Typography variant="overline" color="text.secondary" sx={{ display: 'block' }}>{s('unit.title')}</Typography>}
      {today !== props.today && <Typography sx={QUIET} data-testid="unit-day">{s('unit.onDay', { day: today })}</Typography>}
      <TypeField element={element} types={facts.types} editable={editable} onChange={(unitTypeId) => update({ unitTypeId })}
        {...(unit ? { filedIn: s('unit.filedInLine', { scope: scopeLabel(scope) }) } : {})} s={s} />
      {standIn && <Typography sx={QUIET}>{s('unit.elsewhere', { scope: scopeLabel(element.ref ?? '') })}</Typography>}
      {unit && (
        <UnitParts {...props} today={today} looking={today !== props.today} facts={facts} editable={editable}
          mayRole={mayRole} name={name} onAssign={setAssigning} update={update} />
      )}
      {assigning && people && (
        <AssignDialog
          assigning={assigning} unit={{ id: element.id, name: element.name }}
          roles={dialogRoles(element, facts, assigning).filter((role) => mayRole(role.id))}
          register={people} today={assignFrom} endOn={endOn} makeId={props.makeId} dispatch={dispatch} scopeName={scopeLabel(scope)}
          loadOf={(person) => s('assign.load', { share: Math.round(loadOn(facts.organisation.assignments, person.id, today, facts.canonical) * 100), day: today })}
          onClose={() => setAssigning(undefined)} s={s}
        />
      )}
    </Box>
  )
}

/**
 * The roles the assignment dialog offers: the unit's slots, in their order,
 * and the role of an assignment being changed where it holds no slot for it —
 * a holder of a role the unit does not hold, ended there from a finding.
 */
function dialogRoles(element: DesignElement, facts: Facts, assigning: Assigning): Role[] {
  const held = slotsOf(element, facts.type).flatMap((slot) => facts.roles.get(slot.role) ?? [])
  const roleId = assigning.mode === 'edit' ? assigning.assignment.roleId : undefined
  const role = roleId === undefined || held.some((one) => one.id === roleId) ? undefined : facts.roles.get(roleId)
  return role ? [...held, role] : held
}

/**
 * A unit's own sections, in the order a person comes to a unit for (as built
 * 3.6.1): who is in it and who manages it, then what it serves, owns and
 * answers for, the units it works with, how it changes over time, and what
 * the checks say of it.
 */
function UnitParts(props: UnitSectionProps & {
  looking: boolean; facts: Facts; editable: boolean; mayRole: (roleId: string) => boolean
  name: (person: string) => string; onAssign: (assigning: Assigning) => void; update: (patch: Partial<DesignElement>) => void
}) {
  const { element, facts, editable, update, scopeLabel, s } = props
  return (
    <>
      <Slots {...props} />
      {editable && <ExtraRole element={element} type={facts.type} roles={facts.organisation.roles} onAdd={(extraSlots) => update({ extraSlots })} s={s} />}
      {/* Its why? folds again for the next unit picked, as the element's fields do. */}
      <Managers key={element.id} {...props} />
      <UnitLines
        key={`lines-${element.id}`} element={element} organisation={facts.organisation} type={facts.type} day={props.today}
        editable={editable} scopeOf={facts.scopeOf} update={update} s={s}
      />
      <Serves {...props} type={facts.type} editable={editable} onChange={(scopes) => update({ scopes })} />
      <Typography sx={SECTION}>{s('unit.owns')}</Typography>
      <Typography sx={LINE} data-testid="unit-owns">{facts.owns.length ? facts.owns.join(', ') : s('unit.ownsNone')}</Typography>
      <AnswersFor {...props} rows={facts.answersFor} editable={editable} />
      <UnitInteractions {...props} facts={facts} editable={editable} />
      <OverTime element={element} facts={facts} s={s} />
      {facts.said.length > 0 && (
        <>
          <Typography sx={SECTION}>{s('unit.checks')}</Typography>
          <UnitChecks {...props} scopeLabel={scopeLabel} />
        </>
      )}
    </>
  )
}

/**
 * What the checks find in the unit and in the people holding its roles, in
 * the one list of findings (ADR-0036, amended 11 October 2026). What it is
 * about is what the person is looking at, so no action opens the unit; the
 * ones a unit's own section does are offered — *Assign…* a role short of
 * people, *End the assignment…* that outlives its unit or role — where the
 * person may change that role's people here.
 */
function UnitChecks({ element, facts, mayRole, name, onAssign, scope, scopeLabel, index, model, s }: UnitSectionProps & {
  facts: Facts; mayRole: (roleId: string) => boolean; name: (person: string) => string; onAssign: (assigning: Assigning) => void
}) {
  const remember = `unit\u0000${scope}\u0000${element.id}`
  const sentence = (finding: Finding) => findingSentence(finding, s, scopeLabel, name)
  // One marked as intended is not among the ones to look at: it is listed under Accepted.
  const marks = useMemo(() => checkMarksHere(index, scope, model), [index, scope, model])
  const { shown, more, accepted } = useFindingMarks(facts.said, { findingOf: (finding) => finding, sentence, marks, remember })
  const groups = useMemo(() => groupByCheck(shown), [shown])
  const actions: FindingActions<Finding, CheckAction> = {
    assign: (finding) => {
      const roleId = finding.fields?.[0]
      return finding.key === 'check.roleVacant' && roleId !== undefined && mayRole(roleId) ? () => onAssign({ mode: 'new', roleId }) : undefined
    },
    endAssignment: (finding) => {
      const assignment = facts.organisation.assignments.find((one) => one.id === finding.fields?.[0])
      return finding.key === 'check.assignmentEnded' && assignment && mayRole(assignment.roleId) ? () => onAssign({ mode: 'edit', assignment }) : undefined
    },
  }
  return (
    <FindingsList
      groups={groups} words={CHECK_LIST_WORDS} sentence={sentence} actions={actions} more={more} accepted={accepted}
      keyOf={(finding) => [finding.key, finding.scope, finding.id, finding.person ?? '', ...(finding.fields ?? [])].join('|')}
      attributesOf={() => ({ 'data-testid': 'unit-finding' })} remember={remember} testId="unit-findings"
    />
  )
}

/**
 * The unit type: none makes the actor a party again. A unit's says under it
 * where the unit is filed — the scope that keeps it — in one quiet line.
 */
function TypeField({ element, types, editable, onChange, filedIn, s }: {
  element: DesignElement; types: readonly UnitType[]; editable: boolean; onChange: (id: string | undefined) => void
  filedIn?: string; s: Translate
}) {
  const current = element.unitTypeId ?? ''
  if (!editable) {
    const named = types.find((one) => one.id === current)?.name ?? current
    return (
      <>
        <Typography sx={LINE} data-testid="unit-type">{current ? named : s('unit.notAUnit')}</Typography>
        {filedIn && <Typography sx={QUIET} data-testid="unit-filed-in">{filedIn}</Typography>}
      </>
    )
  }
  return (
    <>
      <TextField size="small" select fullWidth label={s('unit.type')} value={types.some((one) => one.id === current) || !current ? current : ''}
        onChange={(event) => onChange(event.target.value || undefined)}
        helperText={filedIn ? <span data-testid="unit-filed-in">{filedIn}</span> : undefined}
        slotProps={{ htmlInput: { 'data-testid': 'unit-type' } }} sx={{ mt: 0.5 }}>
        <MenuItem value="">{s('unit.notAUnit')}</MenuItem>
        {types.map((type) => <MenuItem key={type.id} value={type.id}>{type.name}</MenuItem>)}
      </TextField>
      {types.length === 0 && <Typography sx={QUIET}>{s('unit.noTypes')}</Typography>}
      {!current && types.length > 0 && <Typography sx={QUIET}>{s('unit.notAUnitHint')}</Typography>}
    </>
  )
}

/**
 * The domains it serves: the scope it is filed in where nothing is said and
 * that is a domain, and as many as its type allows — never the organisation
 * (`model/serving.scopesServed`). Each opens that scope's home, whose *Served
 * by* says the same from the other end.
 */
function Serves({ element, scope, scopes, scopeLabel, onOpenHome, type, editable, onChange, s }: UnitSectionProps & {
  type: UnitType | undefined; editable: boolean; onChange: (scopes: string[] | undefined) => void
}) {
  // Where it says nothing it serves the domain it is filed in, and goes on serving it beside one added.
  const filedIn = () => scope
  const serves = scopesServed(element, filedIn)
  const more = type?.spans === true || serves.length === 0
  const offered = scopeChoices({ scopes, leave: serves, scopeName: scopeLabel, s })
  return (
    <>
      <Typography sx={SECTION}>{s('unit.serves')}</Typography>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }} data-testid="unit-serves">
        {serves.length === 0 && !editable && <Typography sx={QUIET} data-testid="unit-serves-none">{s('unit.servesNone')}</Typography>}
        {serves.map((one) => (
          <Chip key={one} size="small" label={scopeTrail(one, scopeLabel)} data-testid="unit-serves-scope"
            {...(onOpenHome ? { onClick: () => onOpenHome(one), title: s('unit.servesOpen', { scope: scopeTrail(one, scopeLabel) }) } : {})}
            {...(editable && element.scopes ? { onDelete: () => onChange(scopesWithout(element, one)) } : {})} />
        ))}
        {editable && more && (
          <PickToAdd
            options={offered} label={s('unit.servesAdd')}
            field={s('pick.findScope')} nothing={s('pick.noScope')} testId="unit-serves-add"
            onPick={(one) => onChange(scopesWith(element, one, filedIn))}
            disabled={offered.length === 0}
          />
        )}
      </Box>
      {editable && !more && <Typography sx={QUIET}>{s('unit.servesOne', { type: type?.name ?? '' })}</Typography>}
    </>
  )
}

type Facts = ReturnType<typeof useUnitFacts>

/** One `assigned` row from the unit: what it names, the row, and the scope that keeps it. */
type AnswerRow = { id: string; relationId: string; name: string; keptIn: ScopePath }

/**
 * What it answers for (*Responsible for*): an area, a grouping or a
 * capability per `assigned` row, the rows kept here taken off here, and *+*
 * to make it responsible for another — this scope's own, or, where the
 * section can write there, one another scope defines, as that scope's step.
 */
function AnswersFor({ element, scope, model, index, dispatch, newRowId, writeIn, scopeLabel, rows, editable, s }: UnitSectionProps & {
  rows: readonly AnswerRow[]; editable: boolean
}) {
  const [refused, setRefused] = useState<StringKey | undefined>(undefined)
  if (rows.length === 0 && !editable) return null
  const definedHere = (id: string) => model.elements.some((one) => one.id === id && one.ref === undefined)
  const offered = functionChoices({ index, scope, model, leave: new Set(rows.map((one) => one.id)), scopeName: scopeLabel, s })
    .filter((one) => writeIn !== undefined || definedHere(one.id))
  const relation = (targetId: string) => ({ id: newRowId(), type: 'assigned' as const, sourceId: element.id, targetId })
  const pick = (id: string) => {
    setRefused(undefined)
    if (definedHere(id)) { dispatch({ type: 'relation.create', relation: relation(id) }); return }
    const master = index.lookup(id)?.master
    if (master === undefined || !writeIn) return
    void writeIn(master, () => [{ type: 'relation.create', relation: relation(id) }]).then(
      (written) => setRefused(refusalKey(written)),
      () => setRefused('pick.notWritten'),
    )
  }
  return (
    <>
      <Typography sx={SECTION}>{s('unit.answersFor')}</Typography>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }} data-testid="unit-answers-for">
        {rows.length === 0 && <Typography sx={QUIET}>{s('unit.answersForNone')}</Typography>}
        {rows.map((one) => (
          <Chip
            key={`${one.keptIn}/${one.relationId}`} size="small" data-testid="unit-answers-for-row"
            label={one.keptIn === scope ? one.name : `${one.name} · ${s('unit.keptIn', { scope: scopeLabel(one.keptIn) })}`}
            {...(editable && one.keptIn === scope ? { onDelete: () => dispatch({ type: 'relation.delete', id: one.relationId }) } : {})}
          />
        ))}
        {editable && (
          <PickToAdd
            options={offered} label={s('unit.answersForAdd')} field={s('pick.findFunction')} nothing={s('pick.noFunction')}
            testId="unit-answers-for-add" onPick={pick} disabled={offered.length === 0}
          />
        )}
      </Box>
      {refused && <Typography sx={{ fontSize: 12, color: 'warning.main' }} role="status">{s(refused)}</Typography>}
    </>
  )
}

/** The roles it holds and who holds them on the day, with the vacancies a slot's minimum leaves. */
function Slots({ element, today, looking, facts, mayRole, name, onAssign, s }: UnitSectionProps & {
  looking: boolean; facts: Facts; mayRole: (roleId: string) => boolean; name: (person: string) => string; onAssign: (assigning: Assigning) => void
}) {
  const slots = slotsOf(element, facts.type)
  const inSlots = new Set(slots.map((slot) => slot.role))
  const others = facts.organisation.assignments.filter((one) => one.unitId === element.id && !inSlots.has(one.roleId) && runsOn(one, today))
  return (
    <>
      <Typography sx={SECTION}>{looking ? s('unit.rolesOn', { day: today }) : s('unit.roles')}</Typography>
      {slots.length === 0 && <Typography sx={QUIET}>{s('unit.rolesNone')}</Typography>}
      {slots.map((slot) => (
        <SlotLine key={slot.role} slot={slot} role={facts.roles.get(slot.role)} element={element} facts={facts} today={today}
          editable={mayRole(slot.role)} name={name} onAssign={onAssign} s={s} />
      ))}
      {others.length > 0 && (
        <Box sx={{ mt: 0.5 }}>
          <Typography sx={QUIET}>{s('unit.otherRoles')}</Typography>
          {others.map((one, at) => (
            <Holder key={`${one.id}/${at}`} assignment={one} label={`${facts.roles.get(one.roleId)?.name ?? one.roleId}: ${name(personOf(one))}`}
              you={facts.isMe(personOf(one))} editable={mayRole(one.roleId)} onAssign={onAssign} s={s} />
          ))}
        </Box>
      )}
    </>
  )
}

function SlotLine({ slot, role, element, facts, today, editable, name, onAssign, s }: {
  slot: RoleSlot; role: Role | undefined; element: DesignElement; facts: Facts; today: string
  editable: boolean; name: (person: string) => string; onAssign: (assigning: Assigning) => void; s: Translate
}) {
  const holders = holdersOn(facts.organisation.assignments, element.id, slot.role, today)
  const vacant = Math.max(0, slot.min - holders.length)
  const room = slot.max === undefined || holders.length < slot.max
  return (
    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center', my: 0.25 }} data-testid={`unit-slot-${slot.role}`}>
      <Typography sx={{ fontSize: 12, minWidth: 120 }}>
        {role?.name ?? slot.role} <Box component="span" sx={{ color: 'text.secondary' }}>{slotRange(slot)}</Box>
        {role?.manages && <Box component="span" sx={{ ml: 0.5, fontSize: 10, color: 'text.secondary' }}>{s('unit.managesBadge')}</Box>}
      </Typography>
      {holders.map((one, at) => (
        <Holder key={`${one.id}/${at}`} assignment={one} label={name(personOf(one))} you={facts.isMe(personOf(one))} editable={editable} onAssign={onAssign} s={s} />
      ))}
      {Array.from({ length: vacant }, (_, at) => (
        <Chip key={`vacant-${at}`} size="small" variant="outlined" color="warning" label={s('unit.vacant')} data-testid="unit-vacant"
          {...(editable ? { onClick: () => onAssign({ mode: 'new', roleId: slot.role }) } : {})} />
      ))}
      {editable && vacant === 0 && room && (
        <Chip size="small" variant="outlined" label={s('unit.assign')} onClick={() => onAssign({ mode: 'new', roleId: slot.role })} data-testid="unit-assign" />
      )}
    </Box>
  )
}

/** One person in a role: their name, their share where it is not all of their time, acting, and *you*. */
function Holder({ assignment, label, you, editable, onAssign, s }: {
  assignment: Assignment; label: string; you: boolean; editable: boolean; onAssign: (assigning: Assigning) => void; s: Translate
}) {
  const share = shareOf(assignment)
  const text = [
    label,
    share < 1 ? `${Math.round(share * 100)}%` : undefined,
    assignment.acting ? s('unit.acting') : undefined,
    you ? s('unit.you') : undefined,
  ].filter(Boolean).join(' · ')
  return (
    <Chip size="small" label={text} data-testid="unit-holder" color={you ? 'primary' : 'default'}
      {...(editable ? { onClick: () => onAssign({ mode: 'edit', assignment }) } : {})} />
  )
}

/** A role beyond its type's: an optional slot, one person at most, which the unit may hold. */
function ExtraRole({ element, type, roles, onAdd, s }: {
  element: DesignElement; type: UnitType | undefined; roles: readonly Role[]; onAdd: (slots: RoleSlot[]) => void; s: Translate
}) {
  const held = new Set(slotsOf(element, type).map((slot) => slot.role))
  const free = roles.filter((role) => !held.has(role.id))
  if (free.length === 0) return null
  return (
    <TextField size="small" select fullWidth label={s('unit.extraRole')} value="" sx={{ mt: 0.75 }}
      onChange={(event) => onAdd([...(element.extraSlots ?? []), { role: event.target.value, min: 0, max: 1 }])}
      slotProps={{ htmlInput: { 'data-testid': 'unit-extra-role' } }}>
      {free.map((role) => <MenuItem key={role.id} value={role.id}>{role.name}</MenuItem>)}
    </TextField>
  )
}

/**
 * The units it works with (§7): every `interacts` row it is an end of, this
 * scope's to change and another's listed with where it is kept, and the way
 * to declare one.
 */
function UnitInteractions(props: UnitSectionProps & { facts: Facts; editable: boolean }) {
  const { element, model, index, scope, scopeLabel, facts, editable, s } = props
  const [interacting, setInteracting] = useState<Interacting | undefined>(undefined)
  const touches = (row: { sourceId: string; targetId: string }) => row.sourceId === element.id || row.targetId === element.id
  const other = (row: { sourceId: string; targetId: string }) => facts.unitName(row.sourceId === element.id ? row.targetId : row.sourceId)
  const lines: InteractionLine[] = [
    ...model.relations.filter((row) => row.type === 'interacts' && touches(row)).map((row) => ({ row, other: other(row), editable })),
    ...index.rowsOf(element.id).filter(({ scope: kept, relation }) => kept !== scope && relation.type === 'interacts')
      .map(({ scope: kept, relation }) => ({ row: relation, other: other(relation), keptIn: scopeLabel(kept), editable: false })),
  ]
  const from = { id: element.id, name: element.name }
  // In the one order every list of units reads: the type's rank, the unit's own order, its name.
  const units = facts.organisation.units.filter((unit) => isUnit(unit)).sort(compareUnits(unitTypeRank(facts.types)))
    .map((unit) => ({ id: unit.id, name: unit.name }))
  return (
    <>
      <InteractionsSection
        lines={lines} s={s} onEdit={(row) => setInteracting({ mode: 'edit', row, from })}
        {...(editable ? { onDeclare: () => setInteracting({ mode: 'new', from }) } : {})}
      />
      {interacting && (
        <InteractDialog
          interacting={interacting} units={units} newRowId={props.newRowId} dispatch={props.dispatch}
          scopeName={scopeLabel(scope)} onClose={() => setInteracting(undefined)} s={s}
        />
      )}
    </>
  )
}

/**
 * Who manages it on the day (§12): the holders of a managing role in it or
 * above it, one line each, nearest first — and, where a managing role on the
 * way reports by a solid line, whoever it lands on, said *by line* (ADR-0039
 * §4). Who manages the holders of one role that reports elsewhere is said
 * with its line, under *Reporting lines*. Why they are said to — and what a
 * build with accounts grants from it, where core grants nothing — is behind
 * *why?*, said once a person asks rather than on every unit.
 */
function Managers(props: UnitSectionProps & {
  looking: boolean; facts: Facts; name: (person: string) => string
}) {
  const { element, today, looking, facts, name, s } = props
  const managers = managersOf(facts.organisation, element.id, today)
  const [why, setWhy] = useState(false)
  const noteId = useId()
  return (
    <>
      <Typography sx={SECTION}>{s('unit.managedBy')}</Typography>
      {managers.length === 0 && <Typography sx={QUIET}>{looking ? s('unit.managedByNoneOn', { day: today }) : s('unit.managedByNone')}</Typography>}
      {managers.map((one, at) => (
        <Typography key={`${one.unitId}/${one.assignment.id}/${at}`} sx={LINE} data-testid="unit-manager">
          {s('unit.managedByLine', {
            person: name(one.person), role: facts.roles.get(one.roleId)?.name ?? one.roleId, unit: facts.unitName(one.unitId),
          })}
          {one.via === 'line' ? ` · ${s('unit.byLine')}` : ''}
          {facts.isMe(one.person) ? ` · ${s('unit.you')}` : ''}
        </Typography>
      ))}
      <Button
        size="small" variant="text" data-testid="unit-managed-why" aria-expanded={why} {...(why ? { 'aria-controls': noteId } : {})}
        onClick={() => setWhy((open) => !open)}
        sx={{ minWidth: 0, px: 0.5, py: 0, fontSize: 12, textTransform: 'none', color: 'text.secondary' }}
      >
        <Box component="span" aria-hidden sx={{ mr: 0.5 }}>{why ? '▾' : '▸'}</Box>
        {s('unit.managedByWhy')}
      </Button>
      {why && (
        <Typography id={noteId} sx={QUIET} data-testid="unit-managed-note">
          {s(props.people?.managingRight ? 'unit.managedByNoteGranted' : 'unit.managedByNote')}
        </Typography>
      )}
    </>
  )
}

/**
 * How it changes over time (ADR-0036 §6): the day it is there from and its
 * last day, the unit it sits under on the day looked at, and every move a plan
 * makes of it — a correction of where it sits is an edit of its parent, and a
 * change with a day is a plan's.
 */
function OverTime({ element, facts, s }: { element: DesignElement; facts: Facts; s: Translate }) {
  const live = element.lifecycleDates?.live
  const last = unitLastDay(element)
  if (!live && !last && facts.moves.length === 0) return null
  const parentName = (id: string | undefined) => (id === undefined ? s('unit.top') : facts.unitName(id))
  return (
    <Box data-testid="unit-over-time">
      <Typography sx={SECTION}>{s('unit.overTime')}</Typography>
      {live && <Typography sx={LINE}>{s('unit.liveFrom', { day: live })}</Typography>}
      {last && <Typography sx={LINE}>{s('unit.lastDay', { day: last })}</Typography>}
      {facts.moves.map(({ plan, move }) => (
        <Typography key={`${plan.id}/${move.on}`} sx={LINE} data-testid="unit-move">
          {s('unit.movedOn', { parent: parentName(move.parentId), day: move.on, plan: transitionLabel(plan) })}
        </Typography>
      ))}
      {facts.moves.length > 0 && element.parentId !== facts.parent && (
        <Typography sx={QUIET}>{s('unit.sitsUnder', { parent: parentName(facts.parent) })}</Typography>
      )}
    </Box>
  )
}

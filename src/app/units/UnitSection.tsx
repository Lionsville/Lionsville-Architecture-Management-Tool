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
 */
import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import type { Command } from '../../model/commands'
import type { HostModel } from '../../model/hostModel'
import type { Role, RoleSlot, UnitType } from '../../model/operatingModel'
import { slotRange } from '../../model/operatingModel'
import { pickedPerson } from '../../model/person'
import type { DesignElement } from '../../model/types'
import { dayBefore, holdersOn, isUnit, loadOn, managersOf, parentOn, personOf, runsOn, shareOf, slotsOf, unitLastDay } from '../../model/units'
import type { Assignment } from '../../model/units'
import { personText, registerOf } from '../../people/shown'
import type { PeopleRegisterAccess } from '../../people/ui/access'
import { findingSentence, findingsOfOrganisation } from '../../projects/checks'
import { movesOf } from '../../projects/scopeIndex'
import type { ScopeIndex } from '../../projects/scopeIndex'
import type { ScopePath } from '../../projects/scopePath'
import { transitionLabel } from '../../model/transition'
import { AssignDialog } from './AssignDialog'
import type { Assigning } from './AssignDialog'
import { InteractDialog, InteractionsSection } from './Interactions'
import type { Interacting, InteractionLine } from './Interactions'
import { organisationHere } from './organisationHere'

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
    const unitName = (id: string) => organisation.units.find((one) => one.id === id)?.name ?? index.lookup(id)?.name ?? id
    const owns = [
      ...index.register().filter((entry) => entry.partyId === element.id && entry.master !== scope).map((entry) => entry.name),
      ...model.elements.filter((one) => one.kind === 'application' && one.ref === undefined && one.partyId === element.id).map((one) => one.name),
    ].sort((a, b) => a.localeCompare(b))
    const answersFor = [
      ...model.relations.filter((row) => row.type === 'assigned' && row.sourceId === element.id).map((row) => row.targetId),
      ...index.rowsOf(element.id).filter(({ scope: kept, relation }) => kept !== scope && relation.type === 'assigned' && relation.sourceId === element.id)
        .map(({ relation }) => relation.targetId),
    ].map((id) => model.elements.find((one) => one.id === id)?.name ?? index.lookup(id)?.name ?? id)
    const findings = findingsOfOrganisation(at, today)
    const holders = new Set(organisation.assignments.filter((one) => one.unitId === element.id && runsOn(one, today)).map(personOf))
    const said = findings.filter((one) => (one.person !== undefined ? holders.has(one.person) : one.id === element.id))
    // Its moves, each with the plan that makes it: the open scope's plans as the session holds them, the tree's for the rest.
    const moves = [...index.moves().filter((one) => one.scope !== scope), ...movesOf(scope, model)]
      .filter((one) => one.move.unitId === element.id)
      .sort((a, b) => a.move.on.localeCompare(b.move.on))
    const parent = parentOn(element, organisation.moves, today)
    return { organisation, types, type, roles, register, unitName, owns, answersFor, said, moves, parent }
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
  const name = (person: string) => personText(pickedPerson(person), facts.register, s)
  const update = (patch: Partial<DesignElement>) => dispatch({ type: 'element.update', id: element.id, patch })
  return (
    <Box data-testid="unit-section" sx={{ mt: 1 }}>
      <Typography variant="overline" color="text.secondary" sx={{ display: 'block' }}>{s('unit.title')}</Typography>
      {today !== props.today && <Typography sx={QUIET} data-testid="unit-day">{s('unit.onDay', { day: today })}</Typography>}
      <TypeField element={element} types={facts.types} editable={editable} onChange={(unitTypeId) => update({ unitTypeId })} s={s} />
      {standIn && <Typography sx={QUIET}>{s('unit.elsewhere', { scope: scopeLabel(element.ref ?? '') })}</Typography>}
      {isUnit(element) && (
        <>
          <Typography sx={SECTION}>{s('unit.filedIn')}</Typography>
          <Typography sx={LINE}>{scopeLabel(scope)}</Typography>
          <Serves {...props} type={facts.type} editable={editable} onChange={(scopes) => update({ scopes })} />
          <Typography sx={SECTION}>{s('unit.owns')}</Typography>
          <Typography sx={LINE} data-testid="unit-owns">{facts.owns.length ? facts.owns.join(', ') : s('unit.ownsNone')}</Typography>
          {facts.answersFor.length > 0 && (
            <>
              <Typography sx={SECTION}>{s('unit.answersFor')}</Typography>
              <Typography sx={LINE}>{facts.answersFor.join(', ')}</Typography>
            </>
          )}
          <Slots {...props} today={today} looking={today !== props.today} facts={facts} editable={editable && people !== undefined} name={name} onAssign={setAssigning} />
          {editable && <ExtraRole element={element} type={facts.type} roles={facts.organisation.roles} onAdd={(extraSlots) => update({ extraSlots })} s={s} />}
          <Managers {...props} today={today} looking={today !== props.today} facts={facts} name={name} />
          <OverTime element={element} facts={facts} s={s} />
          <UnitInteractions {...props} facts={facts} editable={editable} />
          {facts.said.length > 0 && (
            <>
              <Typography sx={SECTION}>{s('unit.checks')}</Typography>
              {facts.said.map((finding, at) => (
                <Typography key={`${finding.key}/${finding.id}/${at}`} sx={{ fontSize: 12, color: 'warning.main' }} data-testid="unit-finding">
                  {findingSentence(finding, s, scopeLabel, name)}
                </Typography>
              ))}
            </>
          )}
        </>
      )}
      {assigning && people && (
        <AssignDialog
          assigning={assigning} unit={{ id: element.id, name: element.name }}
          roles={slotsOf(element, facts.type).flatMap((slot) => facts.roles.get(slot.role) ?? [])}
          register={people} today={assignFrom} endOn={endOn} makeId={props.makeId} dispatch={dispatch} scopeName={scopeLabel(scope)}
          loadOf={(person) => s('assign.load', { share: Math.round(loadOn(facts.organisation.assignments, person.id, today) * 100), day: today })}
          onClose={() => setAssigning(undefined)} s={s}
        />
      )}
    </Box>
  )
}

/** The unit type: none makes the actor a party again. */
function TypeField({ element, types, editable, onChange, s }: {
  element: DesignElement; types: readonly UnitType[]; editable: boolean; onChange: (id: string | undefined) => void; s: Translate
}) {
  const current = element.unitTypeId ?? ''
  if (!editable) {
    const named = types.find((one) => one.id === current)?.name ?? current
    return <Typography sx={LINE} data-testid="unit-type">{current ? named : s('unit.notAUnit')}</Typography>
  }
  return (
    <>
      <TextField size="small" select fullWidth label={s('unit.type')} value={types.some((one) => one.id === current) || !current ? current : ''}
        onChange={(event) => onChange(event.target.value || undefined)} slotProps={{ htmlInput: { 'data-testid': 'unit-type' } }} sx={{ mt: 0.5 }}>
        <MenuItem value="">{s('unit.notAUnit')}</MenuItem>
        {types.map((type) => <MenuItem key={type.id} value={type.id}>{type.name}</MenuItem>)}
      </TextField>
      {types.length === 0 && <Typography sx={QUIET}>{s('unit.noTypes')}</Typography>}
      {!current && types.length > 0 && <Typography sx={QUIET}>{s('unit.notAUnitHint')}</Typography>}
    </>
  )
}

/** The domains it serves: the scope it is filed in where nothing is said, and as many as its type allows. */
function Serves({ element, scope, scopes, scopeLabel, type, editable, onChange, s }: UnitSectionProps & {
  type: UnitType | undefined; editable: boolean; onChange: (scopes: string[] | undefined) => void
}) {
  const serves = element.scopes ?? [scope]
  const more = type?.spans === true || serves.length === 0
  const free = scopes.filter((one) => !serves.includes(one))
  return (
    <>
      <Typography sx={SECTION}>{s('unit.serves')}</Typography>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }} data-testid="unit-serves">
        {serves.map((one) => (
          <Chip key={one} size="small" label={scopeLabel(one)}
            {...(editable && element.scopes ? { onDelete: () => onChange(serves.filter((held) => held !== one).length ? serves.filter((held) => held !== one) : undefined) } : {})} />
        ))}
      </Box>
      {editable && more && free.length > 0 && (
        <TextField size="small" select fullWidth label={s('unit.servesAdd')} value="" onChange={(event) => onChange([...serves, event.target.value])}
          slotProps={{ htmlInput: { 'data-testid': 'unit-serves-add' } }} sx={{ mt: 0.75 }}>
          {free.map((one) => <MenuItem key={one} value={one}>{scopeLabel(one)}</MenuItem>)}
        </TextField>
      )}
      {editable && !more && <Typography sx={QUIET}>{s('unit.servesOne', { type: type?.name ?? '' })}</Typography>}
    </>
  )
}

type Facts = ReturnType<typeof useUnitFacts>

/** The roles it holds and who holds them on the day, with the vacancies a slot's minimum leaves. */
function Slots({ element, today, looking, people, facts, editable, name, onAssign, s }: UnitSectionProps & {
  looking: boolean; facts: Facts; editable: boolean; name: (person: string) => string; onAssign: (assigning: Assigning) => void
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
          me={people?.me} editable={editable} name={name} onAssign={onAssign} s={s} />
      ))}
      {others.length > 0 && (
        <Box sx={{ mt: 0.5 }}>
          <Typography sx={QUIET}>{s('unit.otherRoles')}</Typography>
          {others.map((one, at) => (
            <Holder key={`${one.id}/${at}`} assignment={one} label={`${facts.roles.get(one.roleId)?.name ?? one.roleId}: ${name(personOf(one))}`}
              me={people?.me} editable={editable} onAssign={onAssign} s={s} />
          ))}
        </Box>
      )}
    </>
  )
}

function SlotLine({ slot, role, element, facts, today, me, editable, name, onAssign, s }: {
  slot: RoleSlot; role: Role | undefined; element: DesignElement; facts: Facts; today: string; me: string | undefined
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
      {holders.map((one, at) => <Holder key={`${one.id}/${at}`} assignment={one} label={name(personOf(one))} me={me} editable={editable} onAssign={onAssign} s={s} />)}
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
function Holder({ assignment, label, me, editable, onAssign, s }: {
  assignment: Assignment; label: string; me: string | undefined; editable: boolean; onAssign: (assigning: Assigning) => void; s: Translate
}) {
  const share = shareOf(assignment)
  const text = [
    label,
    share < 1 ? `${Math.round(share * 100)}%` : undefined,
    assignment.acting ? s('unit.acting') : undefined,
    me !== undefined && personOf(assignment) === me ? s('unit.you') : undefined,
  ].filter(Boolean).join(' · ')
  return (
    <Chip size="small" label={text} data-testid="unit-holder" color={me !== undefined && personOf(assignment) === me ? 'primary' : 'default'}
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
  const units = facts.organisation.units.filter((unit) => isUnit(unit)).map((unit) => ({ id: unit.id, name: unit.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
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

/** Who manages it on the day (§12): the holders of a managing role in it or above it. Core grants nothing from it. */
function Managers({ element, today, looking, people, facts, name, s }: UnitSectionProps & {
  looking: boolean; facts: Facts; name: (person: string) => string
}) {
  const managers = managersOf(facts.organisation, element.id, today)
  return (
    <>
      <Typography sx={SECTION}>{s('unit.managedBy')}</Typography>
      {managers.length === 0 && <Typography sx={QUIET}>{looking ? s('unit.managedByNoneOn', { day: today }) : s('unit.managedByNone')}</Typography>}
      {managers.map((one, at) => (
        <Typography key={`${one.unitId}/${one.assignment.id}/${at}`} sx={LINE} data-testid="unit-manager">
          {s('unit.managedByLine', {
            person: name(one.person), role: facts.roles.get(one.roleId)?.name ?? one.roleId, unit: facts.unitName(one.unitId),
          })}
          {people?.me !== undefined && one.person === people.me ? ` · ${s('unit.you')}` : ''}
        </Typography>
      ))}
      <Typography sx={QUIET}>{s('unit.managedByNote')}</Typography>
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

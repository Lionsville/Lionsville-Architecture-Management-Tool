// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a change to the operating model leaves to decide about its people, on
 * the operating model's page (ADR-0036 §6, *when the model itself changes*).
 *
 * - **A role that ends** lists its people with *Move the people*: each with
 *   the role's successor in the same unit as the suggestion, and the ends
 *   and beginnings written as one step across the scopes that keep them.
 * - **A unit type that ends** lists the units still of it after its last
 *   day, with who holds a role in each: what each is now is a decision —
 *   another type in its inspector, or an end — and nothing here guesses it.
 * - **A role taken out of a unit type** ({@link SlotHolders}) lists, before
 *   it is taken out, who holds it in a unit of the type through the type
 *   alone, with *Move the people*: the role's successor the unit still
 *   holds as the suggestion, their last day in it today. *Write as one step*
 *   takes the role out of the type with their ends and beginnings, so the
 *   organisation is never left with people in a role their unit's type
 *   does not hold. A slot nobody holds is taken out at once, by the page.
 *
 * Drawn by the host beside the page's inspector, because it is the
 * organisation's: the units across the tree, the register's names, and the
 * scopes the people's moves are written to.
 */
import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import type { Command } from '../../model/commands'
import type { HostModel } from '../../model/hostModel'
import type { Role, RoleId, UnitType } from '../../model/operatingModel'
import { pickedPerson } from '../../model/person'
import { peopleMoveSteps, peopleToMove, placesIn, roleEnding, slotEnding, unitsOfEndedType, withoutSlot } from '../../model/reorganisation'
import type { PeopleChoice, PeopleMove } from '../../model/reorganisation'
import { addDays } from '../../model/transition'
import { personOf } from '../../model/units'
import { personText, registerOf, resolvePerson } from '../../people/shown'
import type { PeopleRegisterAccess } from '../../people/ui/access'
import type { ScopeIndex } from '../../projects/scopeIndex'
import { ROOT_SCOPE } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import { MovePeople } from './MovePeople'
import type { MoveNames } from './MovePeople'
import type { PeopleMoved } from './landPeopleMoves'
import { organisationHere } from './organisationHere'

export type EndedHoldersProps = {
  item: { kind: 'role'; item: Role } | { kind: 'unitType'; item: UnitType }
  scope: ScopePath
  model: HostModel
  index: ScopeIndex
  people: PeopleRegisterAccess | undefined
  readOnly: boolean
  makeId: (prefix: string) => string
  land: (steps: ReadonlyMap<ScopePath, readonly Command[]>) => Promise<PeopleMoved>
  s: Translate
}

const HEADING = { fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', mt: 2, mb: 0.5 } as const

/** The organisation as the open scope's session has it, and the names *Move the people* says it in. */
function useMoveFacts({ index, scope, model, people, s }: Pick<EndedHoldersProps, 'index' | 'scope' | 'model' | 'people' | 's'>) {
  return useMemo(() => {
    const at = organisationHere(index, scope, model)
    const register = registerOf(people?.people ?? [])
    const names: MoveNames = {
      person: (id) => personText(pickedPerson(id), register, s),
      canonical: (id) => resolvePerson(id, register)?.id ?? id,
      unit: (id) => at.organisation.units.find((one) => one.id === id)?.name ?? index.lookup(id)?.name ?? id,
      role: (id) => at.organisation.roles.find((one) => one.id === id)?.name ?? id,
    }
    return { at, names }
  }, [index, scope, model, people?.people, s])
}

export function EndedHolders(props: EndedHoldersProps) {
  const { item, people, readOnly, makeId, land, s } = props
  const facts = useMoveFacts(props)
  const until = item.item.until
  if (until === undefined) return null
  if (item.kind === 'unitType') {
    const units = unitsOfEndedType(facts.at.organisation, item.item)
    return (
      <Box data-testid="operating-ended">
        <Typography sx={HEADING}>{s('move.typeEnds', { day: until })}</Typography>
        {units.length === 0 && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s('move.typeEndsNone')}</Typography>}
        {units.map(({ unit, holders }) => (
          <Typography key={unit.id} sx={{ fontSize: 13 }} data-testid="operating-ended-unit">
            {unit.name}: {holders.length ? holders.map((one) => `${facts.names.person(personOf(one))} (${facts.names.role(one.roleId)})`).join(', ') : s('move.nobodyThere')}
          </Typography>
        ))}
        {units.length > 0 && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s('move.typeEndsHint')}</Typography>}
      </Box>
    )
  }
  const moves = peopleToMove(facts.at.organisation, { roles: roleEnding(item.item) })
  const placesFor = (move: PeopleMove) => placesIn(facts.at.organisation, [move.suggestion?.unitId ?? move.assignment.unitId, move.assignment.unitId], addDays(move.lastDay, 1))
  const write = (rows: { move: PeopleMove; choice: PeopleChoice }[]) => land(peopleMoveSteps(rows, {
    scopeOfAssignment: facts.at.assignmentAt, scopeOfUnit: (id) => facts.at.unitAt(id)?.scope, makeId, canonical: facts.names.canonical,
  }))
  return (
    <Box data-testid="operating-ended">
      <Typography sx={HEADING}>{s('move.roleEnds', { day: until })}</Typography>
      <MovePeople moves={moves} placesFor={placesFor} names={facts.names} readOnly={readOnly} onWrite={write} s={s}
        {...(people?.manages ? { manages: people.manages } : {})} />
    </Box>
  )
}

export type SlotHoldersProps = Omit<EndedHoldersProps, 'item'> & {
  /** The unit type as it is now: the role still in its slots, or already taken out. */
  type: UnitType
  roleId: RoleId
  /** The people's last day in the role: today, the day the type stops holding it. */
  today: string
  /** Done with it: the role taken out, or kept. */
  onDone: () => void
}

/**
 * A role being taken out of a unit type that somebody holds it through: who,
 * where each goes from tomorrow, and *Write as one step*, which takes the
 * role out of the type at the organisation with their ends and beginnings in
 * every scope that keeps one — all of it lands, or none of it. *Keep* leaves
 * the type as it is. Once it is taken out, what was written is said here.
 */
export function SlotHolders(props: SlotHoldersProps) {
  const { type, roleId, readOnly, makeId, land, today, onDone, s } = props
  const facts = useMoveFacts(props)
  const still = type.slots.some((slot) => slot.role === roleId)
  const role = facts.names.role(roleId)
  const moves = slotEnding(facts.at.organisation, type.id, roleId, today)
  const after = withoutSlot(facts.at.organisation, type.id, roleId)
  const placesFor = (move: PeopleMove) => placesIn(after, [move.assignment.unitId], addDays(move.lastDay, 1))
  const write = (rows: { move: PeopleMove; choice: PeopleChoice }[]) => {
    const steps = peopleMoveSteps(rows, {
      scopeOfAssignment: facts.at.assignmentAt, scopeOfUnit: (id) => facts.at.unitAt(id)?.scope, makeId, canonical: facts.names.canonical,
    })
    // The type is the organisation's: its step there takes the role out, with whatever ends are kept there too.
    const takeOut: Command = { type: 'unitType.update', id: type.id, patch: { slots: type.slots.filter((slot) => slot.role !== roleId) } }
    if (still) steps.set(ROOT_SCOPE, [takeOut, ...steps.get(ROOT_SCOPE) ?? []])
    return land(steps)
  }
  return (
    <Box data-testid="operating-slot-out" sx={{ mt: 1, mb: 1.5, p: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
      <Typography sx={{ ...HEADING, mt: 0 }}>{s(still ? 'move.slotOut' : 'move.slotOutDone', { role })}</Typography>
      {still && <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>{s('move.slotOutHint', { role, day: today })}</Typography>}
      <MovePeople moves={moves} placesFor={placesFor} names={facts.names} readOnly={readOnly} onWrite={write} s={s} />
      <Button size="small" onClick={onDone} sx={{ mt: 0.5, textTransform: 'none', px: 0 }} data-testid="operating-slot-out-done">
        {still ? s('move.slotKeep', { role }) : s('common.close')}
      </Button>
    </Box>
  )
}

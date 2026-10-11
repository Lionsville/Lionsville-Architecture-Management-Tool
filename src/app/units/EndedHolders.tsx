// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a unit type or a role that ends leaves to decide, on the operating
 * model's page (ADR-0036 §6, *when the model itself changes*).
 *
 * - **A role that ends** lists its people with *Move the people*: each with
 *   the role's successor in the same unit as the suggestion, and the ends
 *   and beginnings written as one step across the scopes that keep them.
 * - **A unit type that ends** lists the units still of it after its last
 *   day, with who holds a role in each: what each is now is a decision —
 *   another type in its inspector, or an end — and nothing here guesses it.
 *
 * Drawn by the host beside the page's inspector, because it is the
 * organisation's: the units across the tree, the register's names, and the
 * scopes the people's moves are written to.
 */
import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import type { Command } from '../../model/commands'
import type { HostModel } from '../../model/hostModel'
import type { Role, UnitType } from '../../model/operatingModel'
import { pickedPerson } from '../../model/person'
import { peopleMoveSteps, peopleToMove, placesIn, roleEnding, unitsOfEndedType } from '../../model/reorganisation'
import type { PeopleChoice, PeopleMove } from '../../model/reorganisation'
import { addDays } from '../../model/transition'
import { personOf } from '../../model/units'
import { personText, registerOf, resolvePerson } from '../../people/shown'
import type { PeopleRegisterAccess } from '../../people/ui/access'
import type { ScopeIndex } from '../../projects/scopeIndex'
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

export function EndedHolders(props: EndedHoldersProps) {
  const { item, scope, model, index, people, readOnly, makeId, land, s } = props
  const facts = useMemo(() => {
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
      <MovePeople moves={moves} placesFor={placesFor} names={facts.names} readOnly={readOnly} onWrite={write} s={s} />
    </Box>
  )
}

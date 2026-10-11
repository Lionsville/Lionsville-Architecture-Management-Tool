// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a plan does to the organisation, on its page (ADR-0036 §6): a
 * reorganisation is a plan.
 *
 * - **The units it moves**, in the facts beside the plan's other lists: a
 *   unit put under a new parent on a day, each one step, and shifted with the
 *   plan. A move outside a plan is a correction — an edit of the unit's
 *   parent in its inspector.
 * - **What it does**, said in a line each: the units it introduces and
 *   retires, the moves, and the roles that end the day before its day.
 * - **Before and after**: the organisation the day before its first day and
 *   on its last, the units under the smallest trees that hold the change,
 *   with who holds a role in each.
 * - **Move the people**: every assignment in a unit or a role that ends, each
 *   with a suggestion, written as one step.
 * - **Still open on the day** (`PlanStillOpen`): what the checks find in
 *   those units then, every responsibility that loses its *A*, and every
 *   interaction the plan's units are left to declare.
 *
 * Drawn by the host, because all of it is the organisation's: the units kept
 * across the tree, the register's names, and the scopes the people's moves
 * are written to. The plan's page holds the slot.
 */
import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import type { Command } from '../../model/commands'
import type { HostModel } from '../../model/hostModel'
import { isDay } from '../../model/lifecycle'
import { pickedPerson } from '../../model/person'
import {
  beforeAndAfter, peopleMoveSteps, peopleToMove, placesIn, planReorganisation, reorganisationRoots, unitTree,
} from '../../model/reorganisation'
import type { PeopleChoice, PeopleMove, UnitNode } from '../../model/reorganisation'
import { addDays, movesWith } from '../../model/transition'
import type { Transition } from '../../model/transition'
import { compareUnits, unitTypeRank } from '../../model/unitOrder'
import { isUnit, makesLoop, personOf } from '../../model/units'
import type { UnitMove } from '../../model/units'
import type { Organisation } from '../../model/units'
import { personText, registerOf, resolvePerson } from '../../people/shown'
import type { PeopleRegisterAccess } from '../../people/ui/access'
import type { ScopeIndex } from '../../projects/scopeIndex'
import type { ScopePath } from '../../projects/scopePath'
import { CloseIcon } from '../../widgets/icons'
import { MovePeople } from './MovePeople'
import type { MoveNames } from './MovePeople'
import type { PeopleMoved } from './landPeopleMoves'
import { organisationHere } from './organisationHere'
import { StillOpen } from './PlanStillOpen'

export type PlanOrganisationProps = {
  plan: Transition
  /** The scope open, which keeps the plan. */
  scope: ScopePath
  /** The open scope's model as its session holds it now. */
  model: HostModel
  index: ScopeIndex
  people: PeopleRegisterAccess | undefined
  readOnly: boolean
  dispatch: (command: Command) => unknown
  makeId: (prefix: string) => string
  /** Write the people's moves, one step per scope, together. */
  land: (steps: ReadonlyMap<ScopePath, readonly Command[]>) => Promise<PeopleMoved>
  scopeLabel: (path: ScopePath) => string
  /** Open a unit a finding is about, wherever it is kept; absent, the findings are lines. */
  onOpenElement?: (id: string) => void
  s: Translate
}

const HEADING = { fontSize: 11, fontWeight: 700, color: 'text.secondary', mt: 1.5, mb: 0.5 } as const
const LINE = { fontSize: 13 } as const
const QUIET = { fontSize: 12, color: 'text.secondary' } as const

/** What the plan's organisation is worked out from, once per render. */
function usePlanFacts(props: PlanOrganisationProps) {
  const { plan, scope, model, index, people, s } = props
  return useMemo(() => {
    const at = organisationHere(index, scope, model)
    const { organisation } = at
    const reorganisation = planReorganisation(plan, organisation)
    const register = registerOf(people?.people ?? [])
    const names: MoveNames = {
      person: (id) => personText(pickedPerson(id), register, s),
      canonical: (id) => resolvePerson(id, register)?.id ?? id,
      unit: (id) => organisation.units.find((one) => one.id === id)?.name ?? index.lookup(id)?.name ?? id,
      role: (id) => organisation.roles.find((one) => one.id === id)?.name ?? id,
    }
    const typeName = (id: string | undefined) => organisation.unitTypes.find((one) => one.id === id)?.name ?? ''
    const responsibilities = scope === '' ? model.responsibilities ?? [] : index.operatingModel().responsibilities
    return { at, organisation, reorganisation, names, typeName, responsibilities }
  }, [plan, scope, model, index, people?.people, s])
}

type PlanFacts = ReturnType<typeof usePlanFacts>

/** Two moves of one unit to one place on one day. */
function samePlace(one: UnitMove, other: UnitMove): boolean {
  return one.unitId === other.unitId && one.on === other.on && one.parentId === other.parentId
}

/** The units the plan moves, in the plan's facts: each one step, and a move added on a day. */
export function PlanMoves(props: PlanOrganisationProps) {
  const { plan, readOnly, dispatch, s } = props
  const facts = usePlanFacts(props)
  const moves = plan.moves ?? []
  const set = (next: Transition['moves']) => dispatch({ type: 'transition.update', id: plan.id, patch: { moves: next } })
  const parentName = (id: string | undefined) => (id === undefined ? s('unit.top') : facts.names.unit(id))
  return (
    <Box data-testid="plan-moves">
      <Typography sx={HEADING}>{s('move.moves')}</Typography>
      {moves.length === 0 && <Typography sx={QUIET}>{s('move.movesNone')}</Typography>}
      {moves.map((move) => (
        <Box key={move.unitId} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} data-testid={`plan-move-${move.unitId}`}>
          <Typography sx={{ ...LINE, flex: 1 }}>
            {s('move.moveLine', { unit: facts.names.unit(move.unitId), parent: parentName(move.parentId), day: move.on })}
          </Typography>
          {!readOnly && (
            <IconButton size="small" aria-label={s('move.moveRemove', { unit: facts.names.unit(move.unitId) })}
              onClick={() => set(movesWith(moves, move.unitId, undefined))}>
              <CloseIcon />
            </IconButton>
          )}
        </Box>
      ))}
      {!readOnly && <AddMove units={facts.organisation.units.filter(isUnit).sort(compareUnits(unitTypeRank(facts.organisation.unitTypes)))} on={plan.to ?? ''} parentName={parentName}
        loops={(unitId, parentId, on) => makesLoop(
          // The plans' moves but this plan's of the same unit, which the new one takes the place of.
          { ...facts.organisation, moves: (facts.organisation.moves ?? []).filter((one) => !(one.unitId === unitId && moves.some((mine) => samePlace(mine, one)))) },
          { unitId, parentId, on },
        )}
        onAdd={(unitId, parentId, on) => set(movesWith(moves, unitId, { ...(parentId ? { parentId } : {}), on }))} s={s} />}
      <Typography sx={QUIET}>{s('move.movesHint')}</Typography>
    </Box>
  )
}

const TOP = ''

/** A unit, the unit it moves under — or the top — and the day; the units in the order every list of them reads. */
function AddMove({ units, on: start, parentName, loops, onAdd, s }: {
  units: Organisation['units']; on: string; parentName: (id: string | undefined) => string
  /** Whether putting a unit under a parent from a day would put it under itself then or later. */
  loops: (unitId: string, parentId: string, on: string) => boolean
  onAdd: (unitId: string, parentId: string | undefined, on: string) => void; s: Translate
}) {
  const [unitId, setUnitId] = useState('')
  const [parentId, setParentId] = useState(TOP)
  const [on, setOn] = useState(start)
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, mt: 0.75 }}>
      <TextField select size="small" label={s('move.unit')} value={unitId} onChange={(event) => setUnitId(event.target.value)}
        slotProps={{ htmlInput: { 'data-testid': 'plan-move-unit' } }}>
        {units.map((one) => <MenuItem key={one.id} value={one.id}>{one.name}</MenuItem>)}
      </TextField>
      <TextField select size="small" label={s('move.parent')} value={parentId} onChange={(event) => setParentId(event.target.value)}
        slotProps={{ htmlInput: { 'data-testid': 'plan-move-parent' } }}>
        <MenuItem value={TOP}>{parentName(undefined)}</MenuItem>
        {units.filter((one) => one.id !== unitId && !(unitId && isDay(on) && loops(unitId, one.id, on)))
          .map((one) => <MenuItem key={one.id} value={one.id}>{one.name}</MenuItem>)}
      </TextField>
      <TextField size="small" type="date" label={s('move.on')} value={on} onChange={(event) => setOn(event.target.value)}
        slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'data-testid': 'plan-move-on' } }} />
      <Button size="small" variant="outlined" disabled={!unitId || !isDay(on)} data-testid="plan-move-add"
        onClick={() => { onAdd(unitId, parentId === TOP ? undefined : parentId, on); setUnitId(''); setParentId(TOP) }}>
        {s('move.add')}
      </Button>
    </Box>
  )
}

/**
 * The plan's organisation beside its facts: what it does, before and after,
 * the people to move and what is still open on its day. Nothing where the
 * plan touches no unit.
 */
export function PlanOrganisation(props: PlanOrganisationProps) {
  const { s } = props
  const facts = usePlanFacts(props)
  const days = beforeAndAfter(facts.reorganisation)
  const { reorganisation } = facts
  const touches = reorganisation.introduces.length + reorganisation.retires.length + reorganisation.moves.length + reorganisation.roles.length > 0
  if (!touches) return null
  return (
    <Box data-testid="plan-organisation" sx={{ px: 3, py: 1.5, borderBottom: 1, borderColor: 'divider', maxHeight: '55%', overflow: 'auto', flexShrink: 0 }}>
      <Typography sx={{ ...HEADING, mt: 0 }}>{s('move.does')}</Typography>
      <Does facts={facts} s={s} />
      {days && <BeforeAndAfter facts={facts} before={days.before} after={days.after} s={s} />}
      <Typography sx={HEADING}>{s('move.people')}</Typography>
      <PeopleToMove {...props} facts={facts} />
      {days && <StillOpen at={facts.at} reorganisation={reorganisation} responsibilities={facts.responsibilities} names={facts.names}
        before={days.before} after={days.after} index={props.index} scope={props.scope} model={props.model}
        scopeLabel={props.scopeLabel} onOpen={props.onOpenElement} remember={`plan\u0000${props.scope}\u0000${props.plan.id}`} s={s} />}
    </Box>
  )
}

/** One line for each thing the plan does to the organisation. */
function Does({ facts, s }: { facts: PlanFacts; s: Translate }) {
  const { reorganisation: r, names, organisation } = facts
  const typeOf = (id: string) => facts.typeName(organisation.units.find((one) => one.id === id)?.unitTypeId)
  const role = (id: string) => organisation.roles.find((one) => one.id === id)
  const lines = [
    ...r.introduces.map((one) => s(one.on ? 'move.doesIntroduceOn' : 'move.doesIntroduce', { unit: names.unit(one.unitId), type: typeOf(one.unitId), day: one.on ?? '' })),
    ...r.retires.map((one) => s('move.doesRetire', { unit: names.unit(one.unitId), day: one.lastDay })),
    ...r.moves.map((one) => s('move.moveLine', { unit: names.unit(one.unitId), parent: one.parentId ? names.unit(one.parentId) : s('unit.top'), day: one.on })),
    ...r.roles.map((one) => {
      const successors = (role(one.roleId)?.successors ?? []).map(names.role)
      return s(successors.length ? 'move.doesEndRoleFor' : 'move.doesEndRole', { role: names.role(one.roleId), day: one.lastDay, successors: successors.join(', ') })
    }),
  ]
  return <>{lines.map((line) => <Typography key={line} sx={LINE} data-testid="plan-does">{line}</Typography>)}</>
}

/** The organisation the day before the plan and on its day, side by side. */
function BeforeAndAfter({ facts, before, after, s }: { facts: PlanFacts; before: string; after: string; s: Translate }) {
  const roots = reorganisationRoots(facts.organisation, facts.reorganisation, before, after)
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 2, mt: 1 }}>
      {([['before', before], ['after', after]] as const).map(([when, day]) => (
        <Box key={when} data-testid={`plan-${when}`}>
          <Typography sx={HEADING}>{s(when === 'before' ? 'move.before' : 'move.after', { day })}</Typography>
          <Tree nodes={unitTree(facts.organisation, day, roots)} when={when} facts={facts} s={s} />
        </Box>
      ))}
    </Box>
  )
}

function Tree({ nodes, when, facts, s }: { nodes: readonly UnitNode[]; when: 'before' | 'after'; facts: PlanFacts; s: Translate }) {
  const r = facts.reorganisation
  const mark = (id: string) => {
    if (when === 'before' && r.retires.some((one) => one.unitId === id)) return s('move.markGone')
    if (when === 'after' && r.introduces.some((one) => one.unitId === id)) return s('move.markNew')
    if (when === 'after' && r.moves.some((one) => one.unitId === id)) return s('move.markMoved')
    return undefined
  }
  if (nodes.length === 0) return null
  return (
    <Box component="ul" sx={{ listStyle: 'none', pl: 1.5, m: 0, borderLeft: 1, borderColor: 'divider' }}>
      {nodes.map((node) => (
        <Box component="li" key={node.unit.id} sx={{ my: 0.25 }} data-testid={`plan-${when}-${node.unit.id}`}>
          <Typography component="div" sx={LINE}>
            <Box component="span" sx={{ color: 'text.secondary', mr: 0.5 }}>{facts.typeName(node.unit.unitTypeId)}</Box>
            {node.unit.name}
            {mark(node.unit.id) && <Chip size="small" label={mark(node.unit.id)} sx={{ ml: 0.75, height: 18, fontSize: 10 }} />}
          </Typography>
          {node.holders.length > 0 && <Typography sx={QUIET}>{holdersLine(node, facts)}</Typography>}
          <Tree nodes={node.children} when={when} facts={facts} s={s} />
        </Box>
      ))}
    </Box>
  )
}

/** Who holds which role in a unit on the day: "Cluster lead: Omar · Product manager: Sanne". */
function holdersLine(node: UnitNode, facts: PlanFacts): string {
  const byRole = new Map<string, string[]>()
  for (const one of node.holders) byRole.set(one.roleId, [...byRole.get(one.roleId) ?? [], facts.names.person(personOf(one))])
  return [...byRole].map(([role, persons]) => `${facts.names.role(role)}: ${persons.join(', ')}`).join(' · ')
}

/** Every assignment that ends under the plan, with its suggestion, written as one step. */
function PeopleToMove(props: PlanOrganisationProps & { facts: PlanFacts }) {
  const { facts, readOnly, makeId, land, s } = props
  const { organisation, reorganisation: r, at } = facts
  const moves = peopleToMove(organisation, { units: r.retires, roles: r.roles })
  const offered = [...r.introduces.map((one) => one.unitId), ...r.moves.map((one) => one.parentId).filter((id): id is string => id !== undefined)]
  const placesFor = (move: PeopleMove) => placesIn(organisation, [
    ...(move.suggestion ? [move.suggestion.unitId] : []), ...offered, move.assignment.unitId,
  ], addDays(move.lastDay, 1))
  const write = (rows: { move: PeopleMove; choice: PeopleChoice }[]) => land(peopleMoveSteps(rows, {
    scopeOfAssignment: at.assignmentAt, scopeOfUnit: (id) => at.unitAt(id)?.scope, makeId, canonical: facts.names.canonical,
  }))
  return (
    <MovePeople moves={moves} placesFor={placesFor} names={facts.names} readOnly={readOnly} onWrite={write} s={s}
      {...(props.people?.manages ? { manages: props.people.manages } : {})} />
  )
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What deleting a unit takes with it, wherever in the tree it is kept
 * (ADR-0036, amended 12 October 2026; 3.6.2): the units inside it, the
 * applications that name it as their team, and the rows that name it.
 *
 * `element.delete` takes what its own scope keeps — the unit's assignments,
 * its relations, its places on diagrams (`commands/elements.ts`). What this
 * adds is what the delete cannot see from there:
 *
 * - **The units inside it** (`parentId`), kept here or in another scope. They
 *   are moved up into its parent by default, where their type may sit there
 *   (`top`, `within`); where it may not, the default is another unit of the
 *   deleted unit's own type. Moving them up anyway is a choice, and they then
 *   show as misplaced; deleting them too takes the whole subtree, each with
 *   its own people. An actor inside that is not a unit goes where they go.
 * - **The applications that name it as their team** (`partyId`): cleared, in
 *   the scope that keeps each, so they show as owned by nobody.
 * - **Every row that names it** and is kept in another scope — the
 *   `assigned` rows to capabilities kept where the capability is, above all —
 *   deleted there, so nothing points at a unit that is not there.
 *
 * Worked out here once, as one list of commands per scope, for the screens'
 * confirmation and for the agent's `element.remove` alike; the caller lands
 * them together, the open scope's as one step with the delete. Pure, and
 * with no words: the screen says what the plan holds.
 */
import type { Command } from './commands'
import type { UnitType, UnitTypeId } from './operatingModel'
import type { DesignElement, ElementId, ElementKind, Relation } from './types'
import { isUnit, mayHaveParent, rolesEndedBy } from './units'
import type { Assignment, RoleHeld } from './units'

/** An actor, and the scope that keeps it. */
export type KeptActor = Pick<DesignElement, 'id' | 'name' | 'kind' | 'parentId' | 'unitTypeId' | 'scopes'> & { scope: string }

/** A row, and the scope that keeps it. */
export type KeptRow = { scope: string; relation: Relation }

/** A record whose `partyId` names an actor, and the scope that keeps it. */
export type KeptOwned = { scope: string; id: ElementId; name: string; kind: ElementKind }

/**
 * The tree as a delete of a unit reads it: the open scope as its session has
 * it, everything else as the tree was read.
 */
export type DeletionWorld = {
  /** The scope open, which keeps the units deleted from it. */
  scope: string
  /** Every actor that may sit in a unit: the open scope's own, and the units the rest of the tree keeps. */
  actors: readonly KeptActor[]
  unitTypes: readonly UnitType[]
  /** Every row with this id at either end, wherever it is kept. */
  rows(id: ElementId): readonly KeptRow[]
  /** Every record whose `partyId` names this id, wherever it is kept. */
  owned(id: ElementId): readonly KeptOwned[]
  /** Every assignment in the tree. */
  assignments: readonly Assignment[]
}

/** Where the units inside go: up into the deleted unit's parent, into another unit of its type, or deleted too. */
export type UnitsChoice = 'up' | 'delete' | `into:${string}`

/** One record moved, or cleared: the scope that keeps it and its id. */
export type KeptId = { scope: string; id: ElementId; name: string }

export type UnitDeletion = {
  /** The units deleted that the person picked, kept in the open scope. */
  units: readonly KeptActor[]
  /** What sits directly inside them and is not deleted with them. */
  inside: readonly KeptActor[]
  /** Up: the parent each moves to, the first one's for the screen to name, and whether every unit inside may sit there. */
  up: { parentId?: ElementId; fits: boolean }
  /** Other units of the deleted unit's type, outside what goes, to move them into: only where one unit is deleted. */
  into: readonly KeptActor[]
  /** What a person or an agent is offered first. */
  initial: UnitsChoice
  /** The choice this plan was worked out for. */
  choice: UnitsChoice
  /** Everything under the units inside, which `delete` takes too. */
  below: readonly KeptActor[]
  /** Who stops being what, over every unit that goes; and how many assignments already over go too. */
  roles: readonly RoleHeld[]
  earlierAssignments: number
  /** The applications whose team is cleared. */
  applications: readonly KeptId[]
  /** The domains the units deleted serve, as they name them. */
  serves: readonly string[]
  /** How many areas, groupings and capabilities the units that go answer for (`assigned`). */
  responsibleFor: number
  /** The commands, one list per scope: the open scope's do not hold the delete of `units` itself, which the caller makes. */
  steps: ReadonlyMap<string, readonly Command[]>
}

/** Whether a choice names a unit, and which. */
export function intoOf(choice: UnitsChoice): ElementId | undefined {
  return choice.startsWith('into:') ? choice.slice('into:'.length) : undefined
}

/** A choice as an agent or a control hands it over, or nothing where it is not one. */
export function unitsChoiceOf(value: unknown): UnitsChoice | undefined {
  if (value === 'up' || value === 'delete') return value
  return typeof value === 'string' && value.startsWith('into:') && value.length > 'into:'.length ? value as UnitsChoice : undefined
}

/** Every actor below the ones given, through `parentId`, each once and none of the ones given. */
function descendantsOf(actors: readonly KeptActor[], roots: ReadonlySet<ElementId>): KeptActor[] {
  const below: KeptActor[] = []
  const seen = new Set(roots)
  let frontier = new Set(roots)
  while (frontier.size > 0) {
    const next = new Set<ElementId>()
    for (const actor of actors) {
      if (actor.parentId === undefined || !frontier.has(actor.parentId) || seen.has(actor.id)) continue
      seen.add(actor.id)
      below.push(actor)
      next.add(actor.id)
    }
    frontier = next
  }
  return below
}

/** The nearest parent above an actor that does not go. */
function survivingParent(byId: ReadonlyMap<ElementId, KeptActor>, gone: ReadonlySet<ElementId>, id: ElementId): ElementId | undefined {
  const seen = new Set<ElementId>()
  let at = byId.get(id)?.parentId
  while (at !== undefined && gone.has(at) && !seen.has(at)) {
    seen.add(at)
    at = byId.get(at)?.parentId
  }
  return at !== undefined && gone.has(at) ? undefined : at
}

/** Whether every unit among `actors` may sit under `parentId`, by its type; a type the model does not hold is not asked. */
function fitUnder(actors: readonly KeptActor[], parentId: ElementId | undefined, byId: ReadonlyMap<ElementId, KeptActor>, types: ReadonlyMap<UnitTypeId, UnitType>): boolean {
  const parent = parentId === undefined ? undefined : byId.get(parentId)
  const parentType = parent && isUnit(parent) ? parent.unitTypeId : undefined
  return actors.every((actor) => {
    if (!isUnit(actor)) return true
    const type = types.get(actor.unitTypeId ?? '')
    return !type || mayHaveParent(type, parentType)
  })
}

/** The scope keeping each id that goes, by id. */
function keptBy(gone: readonly KeptActor[]): Map<ElementId, string> {
  return new Map(gone.map((actor) => [actor.id, actor.scope]))
}

/** A list of commands per scope, added to in order. */
class Steps {
  readonly map = new Map<string, Command[]>()
  private readonly said = new Set<string>()
  add(scope: string, key: string, command: Command): void {
    if (this.said.has(`${scope}\u0000${key}`)) return
    this.said.add(`${scope}\u0000${key}`)
    this.map.set(scope, [...this.map.get(scope) ?? [], command])
  }
}

/**
 * The rows that name what goes and are kept where no delete of their ends
 * takes them, and the records naming it as their team: deleted, and cleared,
 * each in the scope that keeps it.
 */
function cleanUp(world: DeletionWorld, gone: ReadonlyMap<ElementId, string>, also: ReadonlySet<ElementId>, steps: Steps): KeptId[] {
  const applications: KeptId[] = []
  const deletedIn = (id: ElementId, scope: string) => gone.get(id) === scope || (scope === world.scope && also.has(id))
  for (const id of gone.keys()) {
    for (const { scope, relation } of world.rows(id)) {
      if (deletedIn(relation.sourceId, scope) || deletedIn(relation.targetId, scope)) continue
      steps.add(scope, `relation:${relation.id}`, { type: 'relation.delete', id: relation.id })
    }
    for (const owned of world.owned(id)) {
      if (deletedIn(owned.id, owned.scope) || gone.has(owned.id)) continue
      steps.add(owned.scope, `party:${owned.id}`, { type: 'element.update', id: owned.id, patch: { partyId: undefined } })
      if (owned.kind === 'application' && !applications.some((one) => one.id === owned.id)) {
        applications.push({ scope: owned.scope, id: owned.id, name: owned.name })
      }
    }
  }
  return applications
}

/**
 * The other units of one unit's type, outside what goes: its siblings first —
 * the units inside are moved to one under the same parent unless the person
 * picks another — then the rest, each by name.
 */
function othersOfType(world: DeletionWorld, unit: KeptActor, gone: ReadonlySet<ElementId>): KeptActor[] {
  const sibling = (actor: KeptActor) => (actor.parentId === unit.parentId ? 0 : 1)
  return world.actors
    .filter((actor) => isUnit(actor) && actor.unitTypeId === unit.unitTypeId && !gone.has(actor.id))
    .sort((a, b) => sibling(a) - sibling(b) || a.name.localeCompare(b.name))
}

/**
 * What deleting these elements from the open scope takes, for the units
 * among them: nothing where none is a unit the open scope keeps. `choice`
 * says where the units inside go; absent, or one this delete does not offer,
 * it is the default.
 */
export function unitDeletion(
  world: DeletionWorld, elementIds: readonly ElementId[], choice?: UnitsChoice, today?: string,
): UnitDeletion | undefined {
  const asked = new Set(elementIds)
  const byId = new Map(world.actors.map((actor) => [actor.id, actor]))
  const units = world.actors.filter((actor) => asked.has(actor.id) && actor.scope === world.scope && isUnit(actor))
  if (units.length === 0) return undefined
  const picked = new Set(units.map((unit) => unit.id))
  const types = new Map(world.unitTypes.map((type) => [type.id, type]))
  const inside = world.actors.filter((actor) => actor.parentId !== undefined && picked.has(actor.parentId) && !asked.has(actor.id))
  const upOf = (actor: KeptActor) => survivingParent(byId, picked, actor.id)
  const fits = inside.every((actor) => fitUnder([actor], upOf(actor), byId, types))
  const subtree = new Set([...picked, ...descendantsOf(world.actors, picked).map((actor) => actor.id)])
  const into = units.length === 1 ? othersOfType(world, units[0], subtree) : []
  const initial: UnitsChoice = inside.length === 0 || fits || into.length === 0 ? 'up' : `into:${into[0].id}`
  const target = choice !== undefined ? intoOf(choice) : undefined
  const chosen: UnitsChoice = choice === undefined || (target !== undefined && !into.some((one) => one.id === target)) ? initial : choice
  const below = descendantsOf(world.actors, picked).filter((actor) => !asked.has(actor.id))

  const steps = new Steps()
  const goes = chosen === 'delete' ? [...units, ...below] : units
  for (const actor of inside) {
    if (chosen === 'delete') break
    const parentId = chosen === 'up' ? upOf(actor) : intoOf(chosen)
    steps.add(actor.scope, `move:${actor.id}`, { type: 'element.update', id: actor.id, patch: { parentId } })
  }
  // Below the units picked, deleted from the bottom up in the scope each is kept in.
  if (chosen === 'delete') {
    for (const actor of [...below].reverse()) steps.add(actor.scope, `delete:${actor.id}`, { type: 'element.delete', id: actor.id })
  }
  const gone = keptBy(goes)
  const applications = cleanUp(world, gone, asked, steps)
  const ended = rolesEndedBy(world.assignments, gone.keys(), today)
  const responsibleFor = new Set([...gone.keys()].flatMap((id) => world.rows(id)
    .filter(({ relation }) => relation.type === 'assigned' && relation.sourceId === id)
    .map(({ relation }) => relation.targetId)))
  return {
    units, inside, up: { parentId: inside.length > 0 ? upOf(inside[0]) : units[0].parentId, fits }, into, initial, choice: chosen, below,
    roles: ended.roles, earlierAssignments: ended.earlier, applications,
    serves: [...new Set(units.flatMap((unit) => unit.scopes ?? []))],
    responsibleFor: responsibleFor.size,
    steps: steps.map,
  }
}

/**
 * The open scope's step for a delete: what the plan adds here, then the
 * delete's own commands — every one said once, so a row the person picked
 * and the plan both name is deleted once.
 */
export function openStep(plan: UnitDeletion, scope: string, here: readonly Command[]): Command[] {
  const key = (command: Command) => ('id' in command && typeof command.id === 'string' ? `${command.type}:${command.id}` : '')
  const own = new Set(here.map(key))
  return [...(plan.steps.get(scope) ?? []).filter((command) => !own.has(key(command))), ...here]
}

/**
 * The tree for a delete of a unit, put together from the open scope as its
 * session has it and the rest as the tree was read: the open scope's own
 * actors, rows and records, then everything kept elsewhere.
 */
export function deletionWorld(
  open: {
    scope: string
    elements: readonly DesignElement[]
    relations: readonly Relation[]
    assignments: readonly Assignment[]
  },
  elsewhere: {
    units: readonly { scope: string; unit: DesignElement }[]
    rowsOf(id: ElementId): readonly KeptRow[]
    owned: readonly { scope: string; id: ElementId; name: string; kind: ElementKind; partyId?: ElementId }[]
    assignments: readonly { scope: string; assignment: Assignment }[]
    unitTypes: readonly UnitType[]
  },
): DeletionWorld {
  const { scope } = open
  const mine = open.elements.filter((element) => element.ref === undefined)
  const here = new Set(mine.map((element) => element.id))
  const actors: KeptActor[] = [
    ...mine.filter((element) => element.kind === 'actor').map((element) => keptActor(element, scope)),
    ...elsewhere.units.filter((one) => one.scope !== scope && !here.has(one.unit.id)).map((one) => keptActor(one.unit, one.scope)),
  ]
  return {
    scope,
    actors,
    unitTypes: elsewhere.unitTypes,
    rows: (id) => [
      ...open.relations.filter((relation) => relation.sourceId === id || relation.targetId === id).map((relation) => ({ scope, relation })),
      ...elsewhere.rowsOf(id).filter((row) => row.scope !== scope),
    ],
    owned: (id) => [
      ...mine.filter((element) => element.partyId === id).map((element) => ({ scope, id: element.id, name: element.name, kind: element.kind })),
      ...elsewhere.owned.filter((one) => one.partyId === id && one.scope !== scope && !here.has(one.id))
        .map((one) => ({ scope: one.scope, id: one.id, name: one.name, kind: one.kind })),
    ],
    assignments: [...open.assignments, ...elsewhere.assignments.filter((one) => one.scope !== scope).map((one) => one.assignment)],
  }
}

function keptActor(element: DesignElement, scope: string): KeptActor {
  return {
    id: element.id, name: element.name, kind: element.kind, scope,
    ...(element.parentId !== undefined ? { parentId: element.parentId } : {}),
    ...(element.unitTypeId !== undefined ? { unitTypeId: element.unitTypeId } : {}),
    ...(element.scopes !== undefined ? { scopes: element.scopes } : {}),
  }
}

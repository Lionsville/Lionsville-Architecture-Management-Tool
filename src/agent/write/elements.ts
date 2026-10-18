// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * `element.add`, `element.update` and `element.remove`, and the one reading of
 * an element's fields the first two share: a new row is a bare row with the
 * same patch an update would lay over it.
 */
import { transaction, placeOn } from '../../model/commands'
import type { Diagram } from '../../model/normalised'
import { rolesOf, toArrays, unitTypesOf } from '../../model/normalised'
import { CANVAS_KINDS, canPlaceKind } from '../../model/placement'
import { isDay } from '../../model/lifecycle'
import { isPlatformArchetype } from '../../model/relations'
import { isServable } from '../../model/serving'
import { wouldCycle } from '../../business/tree'
import type { AspectStatus, DesignElement, ElementId, ElementKind } from '../../model/types'
import { isUnit } from '../../model/units'
import { unitFits, unitMove } from '../../model/unitMove'
import type { ReadView } from '../answer'
import type { AgentAnswer } from '../tools'
import { json, refused } from '../tools'
import { seedPlacement } from './placement'
import { organisationKnown, unitKeptElsewhere } from './organisation'
import { isUnitRemoval, unitRemoval } from './removeUnit'
import type { Args, Handler, Prepared, WriteView } from './shared'
import { diagramOrRefusal, hexColour, merged, personArgument } from './shared'

export const addElement: Handler = (args, view) => {
  const { model } = view
  const name = (args.name as string).trim()
  if (!name) return refused('agent.badArguments', '"name" must not be blank')
  const kind = (args.kind as ElementKind | undefined) ?? 'application'
  // A record kind is drawn nowhere, so it needs no diagram: an agent on a
  // scope whose home is up — nothing on screen — can still add a function or
  // a step. A diagram it names is still checked, because naming one that does
  // not exist is a mistake worth hearing about.
  const record = !CANVAS_KINDS.includes(kind)
  const diagram = record && args.diagramId === undefined ? undefined : diagramOrRefusal(args, view)
  if (diagram && 'ok' in diagram) return diagram
  const parentId = args.parentId as string | undefined
  if (parentId !== undefined && !model.elements[parentId]) {
    return refused('agent.unknownId', `element ${parentId}`)
  }

  const id = view.ids.element(name)
  // Read before the row is built: `outside` decides what the box is drawn as,
  // and therefore where it lands and how big it is (ADR-0012 §4).
  const bare = bareElement(id, name, kind, args.outside === true, parentId, diagram)
  // The same fields, read the same way as an update, applied to the bare row.
  const patch = elementPatch(args, bare, view)
  if ('ok' in patch) return patch
  const element = merged(bare, patch)

  // A record and a drawing are two acts (ADR-0012 §10). A business kind has no
  // place on a canvas — a sheet is laid out from the tree, not dragged — so the
  // record is made and nothing is drawn, and the answer says which happened
  // rather than refusing a thing that is perfectly real.
  if (!diagram || !canPlaceKind(kind, diagram.kind).ok) return recordOnly(element, diagram)
  const seeded = seedPlacement(model, diagram, id, element, args)
  if ('ok' in seeded) return seeded
  const { placement, layout } = seeded
  return {
    command: transaction([
      { type: 'element.create', element },
      placeOn(diagram.id, [placement]),
      ...(layout ? [layout] : []),
    ], { origin: 'agent' }),
    answer: json({ id, name, kind, diagramId: diagram.id, x: placement.x, y: placement.y, zone: placement.zone, domainGroup: placement.group }),
  }
}

/** A new row before the request's fields are laid over it. */
function bareElement(
  id: ElementId, name: string, kind: ElementKind, outside: boolean, parentId: string | undefined, diagram: Diagram | undefined,
): DesignElement {
  return {
    id,
    kind,
    ...(outside ? { outside: true as const } : {}),
    name,
    lifecycle: 'live',
    // Managed unless nobody here runs it: a person or a team, a
    // responsibility, a journey, or a system — or a platform, or what it
    // offers — somebody else owns.
    isManaged: (kind === 'application' || kind === 'component' || kind === 'platform' || kind === 'platformService') && !outside,
    aspects: {},
    ...(parentId !== undefined
      ? { parentId }
      : kind === 'component' && diagram?.kind === 'container' && diagram.applicationElementId
        ? { parentId: diagram.applicationElementId }
        : {}),
  }
}

/** A row made and drawn nowhere, and the answer that says why. */
function recordOnly(element: DesignElement, diagram: Diagram | undefined): Prepared {
  const { id, name, kind } = element
  // A root step is a journey, and a sheet draws one only when told which:
  // say so here, because the sheet that says "no journey yet" cannot.
  const journey = kind === 'step' && element.parentId === undefined
  return {
    command: transaction([{ type: 'element.create', element }], { origin: 'agent' }),
    answer: json({
      id, name, kind, drawn: false,
      reason: diagram ? `a ${kind} is not drawn on a ${diagram.kind} view` : `a ${kind} is a record and is drawn nowhere`,
      ...(journey ? { hint: `a root step is a journey; name it as a sheet's journeyId with diagram.update, and add its phases as steps under it` } : {}),
    }),
  }
}

export const updateElement: Handler = (args, view) => {
  const id = args.id as string
  const held = view.model.elements[id]
  if (!held) {
    // A unit is changed where it is kept (ADR-0012 §7): its place too (3.7.1).
    const keptIn = unitKeptElsewhere(view, id)
    if (keptIn !== undefined) return refused('agent.scopeNotOpen', `unit ${id} is kept in ${keptIn || 'the organisation'}: it is changed there, its parent too`)
    return refused('agent.unknownId', `element ${id}`)
  }
  const patch = elementPatch(args, held, view)
  if ('ok' in patch) return patch
  // A stand-in's owner's detail belongs to the scope that defines it, and
  // the refusal carries that scope so a client can go and open it.
  const owned = view.ownedElsewhere?.(id, patch)
  if (owned) return refused('check.ownedElsewhere', owned.owner ?? '')
  return {
    command: { type: 'element.update', id, patch, origin: 'agent' },
    answer: json({ id, changed: Object.keys(patch), ...misplacedBy(view, held, patch) }),
  }
}

/**
 * A unit moved where its type may not sit (`top`, `within`): moved all the
 * same, as the screens move it, and said, since `check.unitMisplaced` will
 * stand until it moves again or the operating model lets it sit there.
 */
function misplacedBy(view: WriteView, held: DesignElement, patch: Partial<DesignElement>): { misplaced?: true; hint?: string } {
  if (!('parentId' in patch) || !keptUnit({ ...held, ...patch })) return {}
  const organisation = organisationKnown(view)
  if (unitFits(organisation, { ...held, ...patch }, patch.parentId)) return {}
  return { misplaced: true, hint: 'its unit type may not sit there, so it shows as misplaced (check.unitMisplaced) until it moves again or the type is allowed there' }
}

export const removeElement: Handler = (args, view) => {
  const id = args.id as string
  const held = view.model.elements[id]
  if (!held) return refused('agent.unknownId', `element ${id}`)
  // A unit takes its assignments, moves or takes the units inside it, and clears what names it (3.6.2).
  const unit = unitRemoval(args, view)
  if (unit && !isUnitRemoval(unit)) return unit
  if (unit && unit.others.size > 0) {
    return refused('agent.scopeNotOpen', `removing ${held.name} changes ${[...unit.others.keys()].map((scope) => scope || 'the organisation').join(', ')} `
      + 'as well; call element.remove on its own, not inside a batch')
  }
  if (unit) return { command: unit.open, answer: json(unit.answer) }
  if (args.units !== undefined) return refused('agent.badArguments', `${held.name} is not a unit kept here: units says where a unit's units go`)
  return { command: { type: 'element.delete', id, origin: 'agent' }, answer: json({ id, name: held.name, removed: true }) }
}

// --- an element's fields ----------------------------------------------------------------

/**
 * One group of an element's fields, read into the patch, or the refusal that
 * stops the request. The groups run in a fixed order, so the first mistake in
 * a request is the one it hears about and the patch's keys come out in the
 * order `changed` has always listed them.
 */
type FieldReader = (args: Args, held: DesignElement, view: WriteView, patch: Record<string, unknown>) => AgentAnswer | undefined

/** Null or the empty string: a field asked to be cleared. */
const cleared = (value: unknown) => value === null || value === ''

const words: FieldReader = (args, _held, view, patch) => {
  if (typeof args.name === 'string') {
    if (!args.name.trim()) return refused('agent.badArguments', '"name" must not be blank')
    patch.name = args.name.trim()
  }
  for (const key of ['description', 'category', 'vendor', 'technology'] as const) {
    if (cleared(args[key])) patch[key] = undefined
    else if (typeof args[key] === 'string') patch[key] = args[key]
  }
  // A person from the register by id, or text (ADR-0036 §8).
  if (cleared(args.owner)) patch.owner = undefined
  else if (args.owner !== undefined) {
    const owner = personArgument(args.owner, view, 'owner')
    if ('ok' in owner) return owner
    patch.owner = owner.ref
  }
  return undefined
}

const technologyFields: FieldReader = (args, held, _view, patch) => {
  if (cleared(args.platformArchetype)) patch.platformArchetype = undefined
  else if (typeof args.platformArchetype === 'string') {
    if (held.kind !== 'platform') return refused('agent.badArguments', 'only a platform has a platformArchetype')
    if (!isPlatformArchetype(args.platformArchetype)) return refused('agent.badArguments', '"platformArchetype" is not place, service or network')
    patch.platformArchetype = args.platformArchetype
  }
  if (args.shared !== undefined) {
    if (held.kind !== 'platformService') return refused('agent.badArguments', 'only a platformService is shared')
    patch.shared = args.shared === true ? true : undefined
  }
  return undefined
}

const lifecycleFields: FieldReader = (args, held, view, patch) => {
  if (typeof args.lifecycle === 'string') patch.lifecycle = args.lifecycle
  if (typeof args.isManaged === 'boolean') patch.isManaged = args.isManaged
  if (cleared(args.successorId)) patch.successorId = undefined
  else if (typeof args.successorId === 'string') {
    if (!view.model.elements[args.successorId]) return refused('agent.unknownId', `element ${args.successorId}`)
    if (args.successorId === held.id) return refused('agent.badArguments', 'an element cannot succeed itself')
    patch.successorId = args.successorId
  }
  return undefined
}

const DATE_FIELDS = { liveOn: 'live', retiringOn: 'retiring', retiredOn: 'retired' } as const

/**
 * The three date arguments are one field on the element, merged with what it
 * has, and gone altogether when nothing is left. The reducer refuses dates out
 * of order, so they are not checked here beyond being days.
 */
const dates: FieldReader = (args, held, _view, patch) => {
  if (!Object.keys(DATE_FIELDS).some((key) => args[key] !== undefined)) return undefined
  const kept: Record<string, string> = { ...held.lifecycleDates }
  for (const [key, phase] of Object.entries(DATE_FIELDS)) {
    const value = args[key]
    if (value === undefined) continue
    if (cleared(value)) delete kept[phase]
    else if (isDay(value)) kept[phase] = value
    else return refused('agent.badArguments', `${key} must be yyyy-mm-dd`)
  }
  patch.lifecycleDates = Object.keys(kept).length ? kept : undefined
  return undefined
}

const look: FieldReader = (args, held, _view, patch) => {
  if (args.aspects !== undefined && args.aspects !== null) {
    const aspects = { ...held.aspects }
    for (const [key, status] of Object.entries(args.aspects as Record<string, string | null>)) {
      if (status === null) delete aspects[key]
      else aspects[key] = { ...aspects[key], status: status as AspectStatus }
    }
    patch.aspects = aspects
  }
  if (args.accentColor !== undefined) {
    const color = args.accentColor === null ? '' : hexColour(args.accentColor)
    if (color === false) return refused('agent.badArguments', '"accentColor" must be a hex colour like #2e86c1')
    patch.accentColor = color === '' ? undefined : color
  }
  if (args.iconKey !== undefined) {
    patch.iconKey = cleared(args.iconKey) ? undefined : args.iconKey
  }
  return undefined
}

/**
 * The fact of ownership (ADR-0012 §3, §4). These were in the schema before
 * they were read here, which is how an agent came to set `outside` thirty
 * times and be answered `changed: []` each time.
 */
const ownership: FieldReader = (args, _held, view, patch) => {
  if (args.outside !== undefined) patch.outside = args.outside === true ? true : undefined
  if (cleared(args.partyId)) patch.partyId = undefined
  else if (typeof args.partyId === 'string') {
    const party = partyOf(view, args.partyId)
    if ('ok' in party) return party
    if (party.kind !== 'actor') return refused('agent.badArguments', '"partyId" must name an actor')
    patch.partyId = args.partyId
  }
  if (args.order === null) patch.order = undefined
  else if (typeof args.order === 'number') patch.order = args.order
  return undefined
}

/**
 * The actor a `partyId` names: this scope's own, or one a scope above it keeps
 * — the parties *Belongs to* offers a person (ADR-0012 §4, ADR-0011). Ids are
 * unique across the tree, so the id is written as it is wherever the actor
 * lives. A sibling's or a child's actor is not one this scope can see.
 */
function partyOf(view: ReadView, id: string): { kind: ElementKind } | AgentAnswer {
  const own = view.model.elements[id]
  if (own) return own
  const entry = view.tree?.lookup(id)
  if (!entry || entry.master === undefined) return refused('agent.unknownId', `element ${id}`)
  if (!isAbove(entry.master, view.scopePath)) {
    return refused('agent.badArguments', `"partyId" ${id} is kept in ${entry.master || 'the organisation'}, which is not this scope or one above it`)
  }
  return entry
}

/** Is `path` a scope strictly above `scope`? The organisation, the empty path, is above every other. */
function isAbove(path: string, scope: string): boolean {
  if (path === scope) return false
  return path === '' || scope.startsWith(`${path}/`)
}

/** The tree: a step's lane, and the parent — a loop refused rather than hidden. */
const tree: FieldReader = (args, held, view, patch) => {
  if (cleared(args.lane)) patch.lane = undefined
  else if (typeof args.lane === 'string') {
    if (held.kind !== 'step') return refused('agent.badArguments', 'only a step has a lane')
    const actor = view.model.elements[args.lane]
    if (!actor) return refused('agent.unknownId', `element ${args.lane}`)
    if (actor.kind !== 'actor') return refused('agent.badArguments', '"lane" must name an actor')
    patch.lane = args.lane
  }
  if (cleared(args.parentId)) {
    patch.parentId = undefined
    if (keptUnit(held)) unitStartsAfresh(held, args, patch)
  } else if (typeof args.parentId === 'string') {
    // A unit's parent is any unit in the organisation, wherever it is kept (3.7.1).
    const placed = keptUnit(held) ? unitPlaced(view, held, args.parentId) : undefined
    if (placed) return placed === true ? unitStartsAfresh(held, args, Object.assign(patch, { parentId: args.parentId })) : placed
    if (!view.model.elements[args.parentId]) return refused('agent.unknownId', `element ${args.parentId}`)
    // A loop is offered and refused rather than hidden, as the sheet's own
    // inspector does — a tree with a cycle in it is a page that never ends.
    if (wouldCycle(toArrays(view.model).elements, held.id, args.parentId)) {
      return refused('agent.badArguments', `"parentId" ${args.parentId} would make a loop`)
    }
    patch.parentId = args.parentId
  }
  return undefined
}

/** A unit this scope keeps: a stand-in's `parentId` is where this scope draws it, not where the unit sits. */
function keptUnit(held: DesignElement): boolean {
  return held.ref === undefined && isUnit(held)
}

/** A unit moved starts afresh among its new siblings (3.7.1), unless the call says its order. Nothing to refuse. */
function unitStartsAfresh(held: DesignElement, args: Args, patch: Record<string, unknown>): undefined {
  if (args.order === undefined && held.order !== undefined) patch.order = undefined
  return undefined
}

/**
 * A unit put under another unit (ADR-0036, amended 17 October 2026; 3.7.1):
 * the parent found anywhere in the organisation by its id, and a loop
 * looked for over the whole of it — today, and on every later day a plan's
 * move reaches (`model/unitMove`). `true` where it may go there; nothing
 * where the parent is no unit the organisation has, which the scope's own
 * tree then answers for — an actor that is only a group, here.
 */
function unitPlaced(view: WriteView, held: DesignElement, parentId: string): true | AgentAnswer | undefined {
  const organisation = organisationKnown(view)
  if (!organisation.units.some((one) => one.id === parentId)) return undefined
  const answer = unitMove({ organisation, scopeOf: () => view.scopePath, unitIds: [held.id], parentId, day: view.today() })
  if (answer.ok) return true
  if (answer.reason === 'itself') return refused('agent.badArguments', 'a unit cannot sit under itself')
  if (answer.reason === 'loop') {
    return refused('agent.badArguments', `"parentId" ${parentId} sits inside ${held.id} on ${answer.day}: the move would make a loop`)
  }
  return refused('agent.unknownId', `unit ${parentId}`)
}

/**
 * The domains a unit or a function names, checked against the tree (ADR-0040
 * §4): a path the tree does not hold is a link to nothing, and a function is
 * handed only to a scope below the one that defines it, because handing it
 * on is said by the scope above. A unit may serve any scope. Where no tree
 * is lent — or one not read yet, which lists nothing — the paths are taken
 * as given, as an id is.
 */
function domainsWrong(paths: readonly string[], held: DesignElement, view: WriteView): AgentAnswer | undefined {
  const listed = view.tree?.scopes?.()
  const known = listed && listed.length > 0 ? new Set(listed.map((one) => one.path)) : undefined
  for (const [index, path] of paths.entries()) {
    if (!isServable(path)) continue
    if (known && !known.has(path)) return refused('agent.unknownScope', `scopes[${index}]: ${path}`)
    const below = view.scopePath === '' || path.startsWith(`${view.scopePath}/`)
    if (held.kind !== 'actor' && !below) {
      return refused('agent.badArguments', `scopes[${index}]: ${path} — a function is handed to the scopes below the one that defines it`)
    }
  }
  return undefined
}

/**
 * An actor as a unit (ADR-0036 §3): its unit type, the domains it serves and
 * its roles beyond its type's. A unit type and a role are checked against
 * the organisation's operating model where this scope can see it; what the
 * model then contradicts — a unit where its type may not sit, several domains
 * under a type that serves one — is a finding, not a refusal. `scopes` is a
 * function's too, and is read for both.
 */
const unit: FieldReader = (args, held, view, patch) => {
  const operating = view.scopePath === '' ? { unitTypes: Object.values(unitTypesOf(view.model)), roles: Object.values(rolesOf(view.model)) }
    : view.tree?.operatingModel?.()
  if (cleared(args.unitTypeId)) patch.unitTypeId = undefined
  else if (typeof args.unitTypeId === 'string') {
    if (held.kind !== 'actor') return refused('agent.badArguments', 'only an actor has a unit type: it makes the actor a unit')
    if (operating && !operating.unitTypes.some((type) => type.id === args.unitTypeId)) return refused('agent.unknownId', `unit type ${args.unitTypeId}`)
    patch.unitTypeId = args.unitTypeId
  }
  if (args.scopes === null) patch.scopes = undefined
  else if (Array.isArray(args.scopes)) {
    const wrong = domainsWrong(args.scopes as string[], held, view)
    if (wrong) return wrong
    // The organisation is no domain, for a unit or a function (`model/serving.isServable`; ADR-0036, amended 13 October 2026).
    const domains = [...new Set(args.scopes as string[])].filter(isServable)
    patch.scopes = domains.length ? domains : undefined
  }
  if (args.extraSlots === null) patch.extraSlots = undefined
  else if (Array.isArray(args.extraSlots)) {
    const slots: { role: string; min: number; max?: number }[] = []
    for (const [index, one] of (args.extraSlots as Record<string, unknown>[]).entries()) {
      const role = one.roleId as string
      if (operating && !operating.roles.some((known) => known.id === role)) return refused('agent.unknownId', `extraSlots[${index}]: role ${role}`)
      const max = typeof one.max === 'number' ? one.max : undefined
      if (max !== undefined && max < (one.min as number)) return refused('agent.badArguments', `extraSlots[${index}]: max ${max} is less than min ${String(one.min)}`)
      slots.push({ role, min: one.min as number, ...(max !== undefined ? { max } : {}) })
    }
    patch.extraSlots = slots.length ? slots : undefined
  }
  return undefined
}

const ELEMENT_FIELDS: readonly FieldReader[] = [words, technologyFields, lifecycleFields, dates, look, ownership, tree, unit]

/**
 * The patch an element.update or element.add asks for. Null clears an
 * optional field — a saved file should look hand-written.
 */
function elementPatch(args: Args, held: DesignElement, view: WriteView): Partial<DesignElement> | AgentAnswer {
  const patch: Record<string, unknown> = {}
  for (const read of ELEMENT_FIELDS) {
    const wrong = read(args, held, view, patch)
    if (wrong) return wrong
  }
  return patch as Partial<DesignElement>
}

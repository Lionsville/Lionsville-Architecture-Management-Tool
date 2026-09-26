// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** A row between two elements (ADR-0012 §5): made, rewritten, taken away. */
import { reverse, transaction } from '../commands'
import type { Command, CommandMeta } from '../commands'
import type { Model, RelationId } from '../normalised'
import { routesOf } from '../normalised'
import { mayBeHosted } from '../hosting'
import { technologyEndsRefusal } from '../relations'
import { refinementRefusal } from '../refines'
import type { Relation } from '../types'
import { gone, taken } from './handler'
import type { ApplyResult, CommandTable, Refused } from './handler'
import { drop, patched, put, setDiagram, withRelations, withRoutes } from './rows'

const REFINES_REFUSAL = {
  ends: { ok: false, reason: 'command.refinesEnds' },
  level: { ok: false, reason: 'command.refinesLevel' },
} as const

export const RELATION_COMMANDS = {
  'relation.create': {
    apply(model, command, { meta }) {
      const { relation, at } = command
      // One end is enough (ADR-0012 §5): a row is this scope's when it is
      // about something this scope holds, and the other end may be an id the
      // tree knows — an organisation's capability supported by a landscape's
      // application. Neither end held is a row about nothing.
      if (!model.elements[relation.sourceId] && !model.elements[relation.targetId]) return gone
      if (relation.id in model.relations) return taken
      const refused = landingRefusal(model, relation) ?? hostingRefusal(model, relation)
      if (refused) return refused
      const rows = put(model.relations, model.order.relations, relation.id, relation, at)
      return landed(
        withRelations(model, rows),
        [{ type: 'relation.delete', id: relation.id }],
        relation.refines,
        meta,
      )
    },
  },

  'relation.update': {
    apply(model, command, { meta }) {
      const held = model.relations[command.id]
      if (!held) return gone
      const { row, inverse } = patched(held, command.patch)
      const refused = landingRefusal(model, row) ?? hostingRefusal(model, row)
      if (refused) return refused
      const rows = put(model.relations, model.order.relations, command.id, row)
      return landed(
        withRelations(model, rows),
        [{ type: 'relation.update', id: command.id, patch: inverse }],
        landingArriving(held, command.patch),
        meta,
      )
    },
  },

  'relation.delete': {
    apply: (model, command, { meta }) => deleteRelation(model, command.id, meta),
  },
} satisfies Partial<CommandTable>

/** A relation's own delete: the row, and its route on every diagram. */
function deleteRelation(model: Model, id: RelationId, meta: CommandMeta): ApplyResult {
  if (!model.relations[id]) return gone
  const undo: Command[] = [{
    type: 'relation.create',
    relation: model.relations[id],
    at: model.order.relations.indexOf(id),
  }]
  for (const diagramId of model.order.diagrams) {
    const diagram = model.diagrams[diagramId]
    const route = routesOf(diagram)[id]
    if (!route) continue
    undo.push({
      type: 'route.set', diagramId, routes: [route], at: [diagram.order.routes.indexOf(id)],
    })
  }
  // What landed on it becomes an interface of its own (ADR-0013). A `refines`
  // pointing at a row that is gone would be a landing nobody can see and
  // nobody can clear, so the writer never leaves one — whatever asked for the
  // delete, and whether or not a screen offered the choice.
  let next = removeRelation(model, id)
  for (const landingId of next.order.relations) {
    if (next.relations[landingId].refines !== id) continue
    const { row, inverse } = patched(next.relations[landingId], { refines: undefined })
    next = withRelations(next, put(next.relations, next.order.relations, landingId, row))
    undo.push({ type: 'relation.update', id: landingId, patch: inverse })
  }
  return { ok: true, model: next, inverse: transaction(undo, meta) }
}

// --- an interface landing (ADR-0013) -----------------------------------------

/**
 * Whether this row may say what it says about landing, checked against the
 * model it is going into.
 *
 * `refines` is the one field on a relation whose meaning depends on two other
 * rows and two elements, so it is the one the writer has to hold to its
 * meaning: `model/refines.ts` says what the rule is and this says no.
 */
function landingRefusal(model: Model, row: Relation): Refused | undefined {
  if (row.refines === undefined) return undefined
  const refined = model.relations[row.refines]
  if (!refined) return gone
  const refusal = refinementRefusal(row, refined, (id) => model.elements[id])
  return refusal ? REFINES_REFUSAL[refusal] : undefined
}

/**
 * Whether this row may say where something runs (ADR-0013, redone; ADR-0014).
 *
 * A `hostedOn` runs from an application or a container to a platform and
 * nothing else: a platform inside a platform is `parentId`, the one
 * containment, and a row saying the same thing twice is what `model/
 * relations.ts` refuses. An application with containers does not run anywhere
 * — the things it is made of do — so a `hostedOn` from one is refused rather
 * than kept as a second answer beside theirs. An application with none says
 * it itself, which is the only sentence anybody can write about a
 * vendor-hosted service.
 */
function hostingRefusal(model: Model, row: Relation): Refused | undefined {
  if (row.type !== 'hostedOn') return undefined
  if (technologyEndsRefusal(row, (id) => model.elements[id])) return { ok: false, reason: 'command.technologyEnds' }
  return mayBeHosted(Object.values(model.elements), row.sourceId)
    ? undefined
    : { ok: false, reason: 'command.hostedOnContainers' }
}

/**
 * The `refines` a write newly puts on a row — what makes an interface land,
 * as against a landed row rewritten for some other reason.
 */
function landingArriving(held: Relation, patch: Partial<Relation>): string | undefined {
  return patch.refines !== undefined && patch.refines !== held.refines ? patch.refines : undefined
}

/**
 * The write, with the interface's own protocol taken off where one just
 * landed on it.
 *
 * An application line with landings has no protocol of its own: the protocols
 * are the landings', because that is the level at which anybody knows them.
 * Taking it off here rather than asking the caller to is what makes the
 * landing and the stripping one step and one undo — a person who lands a line
 * and presses ⌘Z gets both back.
 */
function landed(model: Model, undo: Command[], arriving: string | undefined, meta: CommandMeta): ApplyResult {
  const refined = arriving === undefined ? undefined : model.relations[arriving]
  if (!refined || refined.protocol === undefined) {
    return { ok: true, model, inverse: reverse(undo, meta) }
  }
  const { row, inverse } = patched(refined, { protocol: undefined })
  const rows = put(model.relations, model.order.relations, refined.id, row)
  return {
    ok: true,
    model: withRelations(model, rows),
    inverse: reverse([...undo, { type: 'relation.update', id: refined.id, patch: inverse }], meta),
  }
}

/** The relation and its geometry, gone from the model and from every diagram. */
export function removeRelation(model: Model, id: RelationId): Model {
  let next = withRelations(model, drop(model.relations, model.order.relations, id))
  for (const diagramId of next.order.diagrams) {
    const diagram = next.diagrams[diagramId]
    if (!routesOf(diagram)[id]) continue
    next = setDiagram(next, diagramId, withRoutes(diagram, drop(routesOf(diagram), diagram.order.routes, id)))
  }
  return next
}

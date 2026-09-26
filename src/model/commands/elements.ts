// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** An element: made, rewritten, taken away with everything about it, and stood in for. */
import { NOTHING, replacement, transaction } from '../commands'
import type { Command, CommandMeta, StandInCache } from '../commands'
import { asStandIn, isLinked, writesOwnersDetail } from '../standIn'
import type { Model } from '../normalised'
import { routesOf } from '../normalised'
import { datesInOrder } from '../lifecycle'
import type { DesignElement, ElementId } from '../types'
import { gone, ok, outOfOrder, taken } from './handler'
import type { ApplyResult, CommandTable, PatchKeys } from './handler'
import { drop, patched, put, setDiagram, withDiagrams, withElements, withMembers } from './rows'
import type { Rows } from './rows'
import { removeRelation } from './relations'
import { patchWrites } from './writes'

/** Every field of an element but its id: what `element.update` may name. */
const ELEMENT_FIELDS: PatchKeys<'element.update'> = {
  kind: true, ref: true, parentId: true, order: true, lane: true, name: true,
  category: true, vendor: true, technology: true, platformArchetype: true, shared: true,
  description: true, outside: true, partyId: true, scopes: true,
  lifecycle: true, lifecycleDates: true, successorId: true, owner: true, isManaged: true, aspects: true,
  accentColor: true, shapeVariant: true, iconKey: true, iconSize: true,
}

export const ELEMENT_COMMANDS = {
  'element.create': {
    carries: { element: true },
    writes: (command) => [`element/${command.element.id}`],
    apply(model, command, { meta }) {
      const { element, at } = command
      if (element.id in model.elements) return taken
      const rows = put(model.elements, model.order.elements, element.id, element, at)
      return ok(withElements(model, rows), { type: 'element.delete', id: element.id }, meta)
    },
  },

  'element.update': {
    carries: { id: true, patch: true },
    patch: { keys: ELEMENT_FIELDS, row: (model, command) => model.elements[command.id] },
    writes: (command) => patchWrites(`element/${command.id}`, command.patch),
    /**
     * A stand-in's owner's detail, its caches and its description are the
     * defining scope's (`projects/mayEdit.ts`, `model/standIn.ts`).
     */
    guard(model, command) {
      const held = model.elements[command.id]
      return held && writesOwnersDetail(held, command.patch) ? 'command.ownedElsewhere' : undefined
    },
    apply(model, command, { meta }) {
      const held = model.elements[command.id]
      if (!held) return gone
      const { row, inverse } = patched(held, command.patch)
      // A lifecycle that runs backwards is not a landscape anybody can read,
      // and refusing here rather than in the inspector means the agent, a
      // paste and an undo all get the same answer (ADR-0009).
      if (!datesInOrder(row.lifecycleDates)) return outOfOrder
      const rows = put(model.elements, model.order.elements, command.id, row)
      return ok(withElements(model, rows), { type: 'element.update', id: command.id, patch: inverse }, meta)
    },
  },

  'element.delete': {
    carries: { id: true },
    writes: (command) => [`element/${command.id}`],
    apply: (model, command, { meta }) => deleteElement(model, command.id, meta),
  },

  /**
   * A stand-in's caches, written back to what the tree says (ADR-0012 §9).
   *
   * Every row that would change nothing is dropped, so a refresh over a
   * scope that is already up to date is one command that lands nothing and
   * therefore is not a step — which is what keeps the Activity list from
   * filling up with "refreshed 0" every time somebody presses it. A row for
   * an id this scope does not hold, or holds as a DEFINITION, is ignored:
   * turning a definition into a stand-in is *link*, a gesture of its own
   * with a confirmation, and never a side effect of refreshing.
   */
  'standin.refresh': {
    carries: { entries: true },
    writes: (command) => command.entries.map((entry) => `element/${entry.id}`),
    apply(model, command, { meta }) {
      const wanted = command.entries.filter((entry) => {
        const row = model.elements[entry.id]
        return row?.ref !== undefined && (row.name !== entry.name || row.ref !== entry.ref)
      })
      if (wanted.length === 0) return ok(model, NOTHING, meta)
      let rows: Rows<DesignElement> = { by: model.elements, order: model.order.elements }
      const before: StandInCache[] = []
      for (const entry of wanted) {
        const row = model.elements[entry.id]
        before.push({ id: entry.id, name: row.name, ref: row.ref! })
        rows = put(rows.by, rows.order, entry.id, { ...row, name: entry.name, ref: entry.ref })
      }
      return ok(withElements(model, rows), { type: 'standin.refresh', entries: before }, meta)
    },
  },

  /**
   * A definition becomes a stand-in — *link* (ADR-0012 §10).
   *
   * The inverse is the whole record put back, because a link drops nine
   * fields and an undo that restored the name and the ref alone would leave
   * the lifecycle, the vendor and the aspects gone for good. A record that
   * is already exactly this stand-in is not a step, the way a refresh that
   * finds nothing stale is not one.
   */
  'element.link': {
    carries: { id: true, name: true, ref: true },
    // The name, the ref and the owner's detail together: the record, coarsely,
    // because that is what the gesture is.
    writes: (command) => [`element/${command.id}`],
    apply(model, command, { meta }) {
      const held = model.elements[command.id]
      if (!held) return gone
      if (isLinked(held, command)) return ok(model, NOTHING, meta)
      const next = asStandIn(held, command)
      const rows = put(model.elements, model.order.elements, command.id, next)
      return ok(
        withElements(model, rows),
        { type: 'element.update', id: command.id, patch: replacement(next, held) },
        meta,
      )
    },
  },
} satisfies Partial<CommandTable>

/**
 * Deleting an element takes with it every relation that ends on it, its
 * membership and node on every diagram, the routes of those relations, and any
 * container view that was about it — which is exactly what the batch did,
 * spelled out.
 *
 * The inverse is a transaction that puts each of those back at the index it was
 * at, in the order that keeps the model referentially whole at every step:
 * the element, then its relations, then the diagrams, then the geometry.
 */
function deleteElement(model: Model, id: ElementId, meta: CommandMeta): ApplyResult {
  const element = model.elements[id]
  if (!element) return gone

  // A container view exists ABOUT one application; without it there is a tab
  // named after something that is not there any more. It goes whole, and comes
  // back whole — so nothing else in the undo may speak about its insides.
  const doomed = new Set(model.order.diagrams.filter((diagramId) => {
    const diagram = model.diagrams[diagramId]
    return diagram.kind === 'container' && diagram.applicationElementId === id
  }))

  const undo: Command[] = [{ type: 'element.create', element, at: model.order.elements.indexOf(id) }]
  let next = withElements(model, drop(model.elements, model.order.elements, id))

  model.order.diagrams.forEach((diagramId, at) => {
    if (!doomed.has(diagramId)) return
    undo.push({ type: 'diagram.create', diagram: model.diagrams[diagramId], at })
    next = withDiagrams(next, drop(next.diagrams, next.order.diagrams, diagramId))
  })

  // Indices are read off the ORIGINAL order, and pushed in ascending order, so
  // putting them back one at a time lands each on the index it came from.
  model.order.relations.forEach((relationId, at) => {
    const relation = model.relations[relationId]
    if (relation.sourceId !== id && relation.targetId !== id) return
    undo.push({ type: 'relation.create', relation, at })
    for (const diagramId of next.order.diagrams) {
      const diagram = model.diagrams[diagramId]
      const route = routesOf(diagram)[relationId]
      if (!route) continue
      undo.push({
        type: 'route.set', diagramId, routes: [route], at: [diagram.order.routes.indexOf(relationId)],
      })
    }
    next = removeRelation(next, relationId)
  })

  for (const diagramId of next.order.diagrams) {
    const diagram = next.diagrams[diagramId]
    if (!diagram.members[id]) continue
    undo.push({
      type: 'member.set',
      diagramId,
      members: [diagram.members[id]],
      at: [diagram.order.members.indexOf(id)],
    })
    if (diagram.nodes[id]) {
      undo.push({ type: 'node.set', diagramId, nodes: [diagram.nodes[id]] })
    }
    const nodes = { ...diagram.nodes }
    delete nodes[id]
    next = setDiagram(next, diagramId, {
      ...withMembers(diagram, drop(diagram.members, diagram.order.members, id)),
      nodes,
    })
  }

  // What was filed under a platform or a service comes out from under it
  // (ADR-0014 §2.7), the way a landing on a deleted interface becomes an
  // interface of its own: `parentId` is the one containment on the
  // technology layer, and a namespace pointing at a cluster that is gone
  // would sit under nothing every reader could walk to. The same step, so
  // one undo puts the tree back whole.
  if (element.kind === 'platform' || element.kind === 'platformService') {
    for (const childId of next.order.elements) {
      const child = next.elements[childId]
      if (child.parentId !== id) continue
      const { row, inverse } = patched(child, { parentId: undefined })
      next = withElements(next, put(next.elements, next.order.elements, childId, row))
      undo.push({ type: 'element.update', id: childId, patch: inverse })
    }
  }

  return { ok: true, model: next, inverse: transaction(undo, meta) }
}

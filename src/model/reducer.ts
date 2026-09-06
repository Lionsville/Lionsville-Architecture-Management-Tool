/**
 * The one writer (ADR-0002).
 *
 * `apply` takes a model and a command and returns the model that results,
 * together with **the command that undoes it** — computed from the state it just
 * saw, which is the only moment at which the inverse is both exact and cheap.
 * Undo is `apply(model, inverse)`; redo is the original command again. Nothing
 * else in the app may change a model.
 *
 * Three properties are worth stating, because everything downstream leans on
 * them and `reducer.test.ts` pins all three:
 *
 * - **Proportional.** A command touches the path it names. Renaming a diagram
 *   copies the model, its diagram record and that one diagram; every other
 *   diagram, every element and every route comes out of it by identity, so
 *   memoisation below the reducer holds.
 * - **Reversible.** `apply(apply(m, c).model, inverse)` is `m` again, deep
 *   equal, order arrays included — which is why a delete's inverse carries the
 *   index the row was at rather than appending it back at the end.
 * - **Atomic.** A transaction that refuses anywhere changes nothing.
 *
 * **A refusal is a key**, never a sentence, and it is a value rather than a
 * throw: a command that cannot be carried out is an ordinary answer here, the
 * way `openProjectDocument`'s three refusals are.
 *
 * One rule about absence is worth knowing before reading the decision and route
 * cases. `decisions` and a diagram's `edgeRoutes` are optional in the file, and
 * emptying one **removes the key** rather than leaving an empty list behind —
 * again, a saved file should look like a hand-written one. The consequence is
 * that a list which arrives empty-but-present (only an older build wrote one)
 * becomes absent the first time anything touches it. Nothing reads the
 * difference; `decisionsOf` and `routesOf` answer the same either way.
 */
import { transaction, reverse, NOTHING } from './commands'
import type { Command, CommandMeta, DiagramPatch, ProjectPatch } from './commands'
import type { Adr } from './adr'
import type { ConnectionId, Diagram, DiagramId, Model, ModelOrder } from './normalised'
import { decisionsOf, routesOf } from './normalised'
import type {
  DesignConnection, DesignElement, DiagramPlacement, DiagramSettings, EdgeRoute, ElementId,
} from './types'

/**
 * Why a command was not carried out. A key the shell turns into words, and a
 * closed set — anything that is not one of these is a bug in the caller, not a
 * refusal to show somebody.
 */
export type CommandRefusal = 'command.gone' | 'command.lastLandscape'

export type ApplyResult =
  | { ok: true; model: Model; inverse: Command }
  | { ok: false; reason: CommandRefusal }

const gone = { ok: false, reason: 'command.gone' } as const

// --- indexed collections, immutably -----------------------------------------

type Rows<T> = { by: Record<string, T>; order: string[] }

/**
 * Upsert one row. An existing id keeps its place and the ORDER ARRAY ITSELF —
 * the identity is what tells the caller nothing moved, so it can leave the
 * surrounding object alone.
 */
function put<T>(by: Record<string, T>, order: string[], id: string, row: T, at?: number): Rows<T> {
  const next = { ...by, [id]: row }
  if (id in by) return { by: next, order }
  const grown = [...order]
  grown.splice(at ?? grown.length, 0, id)
  return { by: next, order: grown }
}

function drop<T>(by: Record<string, T>, order: string[], id: string): Rows<T> {
  const next = { ...by }
  delete next[id]
  return { by: next, order: order.filter((held) => held !== id) }
}

// --- patches -----------------------------------------------------------------

/**
 * A row with a patch applied, and the patch that puts it back. A key whose value
 * is `undefined` deletes the field; the inverse names the same keys, so a field
 * that was not there comes back as not there.
 */
function patched<T extends object>(row: T, patch: Partial<T>): { row: T; inverse: Partial<T> } {
  const out = { ...row }
  const inverse: Partial<T> = {}
  for (const key of Object.keys(patch) as (keyof T)[]) {
    inverse[key] = row[key]
    const value = patch[key]
    if (value === undefined) delete out[key]
    else out[key] = value
  }
  return { row: out, inverse }
}

// --- putting a model back together -------------------------------------------

function withOrder(model: Model, field: keyof ModelOrder, order: string[]): Model['order'] {
  return order === model.order[field] ? model.order : { ...model.order, [field]: order }
}

function withElements(model: Model, rows: Rows<DesignElement>): Model {
  return { ...model, elements: rows.by, order: withOrder(model, 'elements', rows.order) }
}

function withConnections(model: Model, rows: Rows<DesignConnection>): Model {
  return { ...model, connections: rows.by, order: withOrder(model, 'connections', rows.order) }
}

function withDiagrams(model: Model, rows: Rows<Diagram>): Model {
  return { ...model, diagrams: rows.by, order: withOrder(model, 'diagrams', rows.order) }
}

function withDecisions(model: Model, rows: Rows<Adr>): Model {
  const order = withOrder(model, 'decisions', rows.order)
  // Emptied means gone, not present and empty — see the note at the top.
  if (rows.order.length === 0) {
    const out = { ...model, order }
    delete out.decisions
    return out
  }
  return { ...model, decisions: rows.by, order }
}

function setDiagram(model: Model, id: DiagramId, diagram: Diagram): Model {
  return { ...model, diagrams: { ...model.diagrams, [id]: diagram } }
}

function withPlacements(diagram: Diagram, rows: Rows<DiagramPlacement>): Diagram {
  const order = rows.order === diagram.order.placements
    ? diagram.order
    : { ...diagram.order, placements: rows.order }
  return { ...diagram, placements: rows.by, order }
}

function withRoutes(diagram: Diagram, rows: Rows<EdgeRoute>): Diagram {
  const order = rows.order === diagram.order.routes
    ? diagram.order
    : { ...diagram.order, routes: rows.order }
  if (rows.order.length === 0) {
    const out = { ...diagram, order }
    delete out.edgeRoutes
    return out
  }
  return { ...diagram, edgeRoutes: rows.by, order }
}

// --- the reducer --------------------------------------------------------------

export function apply(model: Model, command: Command): ApplyResult {
  const meta: CommandMeta = {}
  if (command.label !== undefined) meta.label = command.label
  if (command.coalesce !== undefined) meta.coalesce = command.coalesce
  if (command.undoable !== undefined) meta.undoable = command.undoable
  const ok = (next: Model, inverse: Command): ApplyResult =>
    ({ ok: true, model: next, inverse: { ...inverse, ...meta } })

  switch (command.type) {
    // --- elements -----------------------------------------------------------
    case 'element.create': {
      const { element, at } = command
      const rows = put(model.elements, model.order.elements, element.id, element, at)
      return ok(withElements(model, rows), { type: 'element.delete', id: element.id })
    }

    case 'element.update': {
      const held = model.elements[command.id]
      if (!held) return gone
      const { row, inverse } = patched(held, command.patch)
      const rows = put(model.elements, model.order.elements, command.id, row)
      return ok(withElements(model, rows), { type: 'element.update', id: command.id, patch: inverse })
    }

    case 'element.delete':
      return deleteElement(model, command.id, meta)

    // --- connections --------------------------------------------------------
    case 'connection.create': {
      const { connection, at } = command
      if (!model.elements[connection.sourceId] || !model.elements[connection.targetId]) return gone
      const rows = put(model.connections, model.order.connections, connection.id, connection, at)
      return ok(withConnections(model, rows), { type: 'connection.delete', id: connection.id })
    }

    case 'connection.update': {
      const held = model.connections[command.id]
      if (!held) return gone
      const { row, inverse } = patched(held, command.patch)
      const rows = put(model.connections, model.order.connections, command.id, row)
      return ok(withConnections(model, rows), { type: 'connection.update', id: command.id, patch: inverse })
    }

    case 'connection.delete':
      return deleteConnection(model, command.id, meta)

    // --- geometry -----------------------------------------------------------
    case 'placement.set': {
      const diagram = model.diagrams[command.diagramId]
      if (!diagram) return gone
      let rows: Rows<DiagramPlacement> = { by: diagram.placements, order: diagram.order.placements }
      const restore: DiagramPlacement[] = []
      const restoreAt: number[] = []
      const remove: ElementId[] = []
      command.placements.forEach((placement, i) => {
        if (!model.elements[placement.elementId]) return
        const held = rows.by[placement.elementId]
        if (held) {
          restore.push(held)
          restoreAt.push(rows.order.indexOf(placement.elementId))
        } else remove.push(placement.elementId)
        rows = put(rows.by, rows.order, placement.elementId, placement, command.at?.[i])
      })
      if (!restore.length && !remove.length) return ok(model, NOTHING)
      const undo: Command[] = []
      if (remove.length) undo.push({ type: 'placement.remove', diagramId: command.diagramId, elementIds: remove })
      if (restore.length) {
        undo.push({ type: 'placement.set', diagramId: command.diagramId, placements: restore, at: restoreAt })
      }
      return ok(
        setDiagram(model, command.diagramId, withPlacements(diagram, rows)),
        transaction(undo, meta),
      )
    }

    case 'placement.remove': {
      const diagram = model.diagrams[command.diagramId]
      if (!diagram) return gone
      let rows: Rows<DiagramPlacement> = { by: diagram.placements, order: diagram.order.placements }
      const restore: DiagramPlacement[] = []
      const restoreAt: number[] = []
      // Ascending, so putting them back one at a time lands each on its own index.
      for (const id of diagram.order.placements) {
        if (!command.elementIds.includes(id)) continue
        restore.push(diagram.placements[id])
        restoreAt.push(diagram.order.placements.indexOf(id))
        rows = drop(rows.by, rows.order, id)
      }
      if (!restore.length) return ok(model, NOTHING)
      return ok(
        setDiagram(model, command.diagramId, withPlacements(diagram, rows)),
        { type: 'placement.set', diagramId: command.diagramId, placements: restore, at: restoreAt },
      )
    }

    case 'route.set': {
      const diagram = model.diagrams[command.diagramId]
      if (!diagram) return gone
      let rows: Rows<EdgeRoute> = { by: routesOf(diagram), order: diagram.order.routes }
      const restore: EdgeRoute[] = []
      const restoreAt: number[] = []
      const clear: ConnectionId[] = []
      command.routes.forEach((route, i) => {
        if (!model.connections[route.connectionId]) return
        const held = rows.by[route.connectionId]
        if (held) {
          restore.push(held)
          restoreAt.push(rows.order.indexOf(route.connectionId))
        } else clear.push(route.connectionId)
        rows = put(rows.by, rows.order, route.connectionId, route, command.at?.[i])
      })
      if (!restore.length && !clear.length) return ok(model, NOTHING)
      const undo: Command[] = []
      if (clear.length) undo.push({ type: 'route.clear', diagramId: command.diagramId, connectionIds: clear })
      if (restore.length) {
        undo.push({ type: 'route.set', diagramId: command.diagramId, routes: restore, at: restoreAt })
      }
      return ok(setDiagram(model, command.diagramId, withRoutes(diagram, rows)), transaction(undo, meta))
    }

    case 'route.clear': {
      const diagram = model.diagrams[command.diagramId]
      if (!diagram) return gone
      const held = routesOf(diagram)
      let rows: Rows<EdgeRoute> = { by: held, order: diagram.order.routes }
      const restore: EdgeRoute[] = []
      const restoreAt: number[] = []
      for (const id of diagram.order.routes) {
        if (!command.connectionIds.includes(id)) continue
        restore.push(held[id])
        restoreAt.push(diagram.order.routes.indexOf(id))
        rows = drop(rows.by, rows.order, id)
      }
      if (!restore.length) return ok(model, NOTHING)
      return ok(
        setDiagram(model, command.diagramId, withRoutes(diagram, rows)),
        { type: 'route.set', diagramId: command.diagramId, routes: restore, at: restoreAt },
      )
    }

    case 'layout.set': {
      const diagram = model.diagrams[command.diagramId]
      if (!diagram) return gone
      const { row, inverse } = patched(diagram, { layoutConfig: command.layoutConfig })
      return ok(
        setDiagram(model, command.diagramId, row),
        { type: 'layout.set', diagramId: command.diagramId, layoutConfig: inverse.layoutConfig },
      )
    }

    // --- diagrams -----------------------------------------------------------
    case 'diagram.create': {
      const { diagram, at } = command
      const rows = put(model.diagrams, model.order.diagrams, diagram.id, diagram, at)
      return ok(withDiagrams(model, rows), { type: 'diagram.delete', id: diagram.id })
    }

    case 'diagram.rename': {
      const diagram = model.diagrams[command.id]
      if (!diagram) return gone
      const name = command.name.trim()
      // A nameless tab is not something the caller meant to ask for.
      if (!name || name === diagram.name) return ok(model, NOTHING)
      return ok(
        setDiagram(model, command.id, { ...diagram, name }),
        { type: 'diagram.rename', id: command.id, name: diagram.name },
      )
    }

    case 'diagram.settings': {
      const diagram = model.diagrams[command.id]
      if (!diagram) return gone
      if (!command.settings.name.trim()) return ok(model, NOTHING)
      return ok(
        setDiagram(model, command.id, applySettings(diagram, command.settings)),
        { type: 'diagram.settings', id: command.id, settings: settingsOf(diagram) },
      )
    }

    case 'diagram.update': {
      const diagram = model.diagrams[command.id]
      if (!diagram) return gone
      const { row, inverse } = patched(diagram, command.patch as Partial<Diagram>)
      return ok(
        setDiagram(model, command.id, row),
        { type: 'diagram.update', id: command.id, patch: inverse as DiagramPatch },
      )
    }

    case 'diagram.delete': {
      const diagram = model.diagrams[command.id]
      if (!diagram) return gone
      // The last landscape always stays; the editor disables the menu item and
      // this is the safety net underneath it.
      if (diagram.kind === 'layer7'
        && model.order.diagrams.filter((id) => model.diagrams[id].kind === 'layer7').length <= 1) {
        return { ok: false, reason: 'command.lastLandscape' }
      }
      const at = model.order.diagrams.indexOf(command.id)
      return ok(
        withDiagrams(model, drop(model.diagrams, model.order.diagrams, command.id)),
        { type: 'diagram.create', diagram, at },
      )
    }

    // --- decisions ----------------------------------------------------------
    case 'decision.add': {
      const { decision, at } = command
      const rows = put(decisionsOf(model), model.order.decisions, decision.id, decision, at)
      return ok(withDecisions(model, rows), { type: 'decision.remove', id: decision.id })
    }

    case 'decision.update': {
      const held = decisionsOf(model)[command.id]
      if (!held) return gone
      const { row, inverse } = patched(held, command.patch)
      const rows = put(decisionsOf(model), model.order.decisions, command.id, row)
      return ok(withDecisions(model, rows), { type: 'decision.update', id: command.id, patch: inverse })
    }

    case 'decision.remove': {
      const held = decisionsOf(model)[command.id]
      if (!held) return gone
      const at = model.order.decisions.indexOf(command.id)
      const rows = drop(decisionsOf(model), model.order.decisions, command.id)
      return ok(withDecisions(model, rows), { type: 'decision.add', decision: held, at })
    }

    // --- the project itself -------------------------------------------------
    case 'project.settings': {
      const { row, inverse } = patched(model, command.patch as Partial<Model>)
      return ok(row, { type: 'project.settings', patch: inverse as ProjectPatch })
    }

    // --- several changes, one undo step -------------------------------------
    case 'transaction': {
      let next = model
      const inverses: Command[] = []
      for (const inner of command.commands) {
        const result = apply(next, inner)
        if (!result.ok) return result
        next = result.model
        inverses.push(result.inverse)
      }
      if (next === model) return ok(model, NOTHING)
      return ok(next, reverse(inverses, meta))
    }
  }
}

/** A run of commands, or the first refusal. One step, one inverse. */
export function applyAll(model: Model, commands: Command[], meta: CommandMeta = {}): ApplyResult {
  return apply(model, transaction(commands, meta))
}

/**
 * Deleting an element takes with it every connection that ends on it, its
 * placement on every diagram, the routes of those connections, and any container
 * view that was about it — which is exactly what the batch did, spelled out.
 *
 * The inverse is a transaction that puts each of those back at the index it was
 * at, in the order that keeps the model referentially whole at every step:
 * the element, then its connections, then the diagrams, then the geometry.
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
  model.order.connections.forEach((connectionId, at) => {
    const connection = model.connections[connectionId]
    if (connection.sourceId !== id && connection.targetId !== id) return
    undo.push({ type: 'connection.create', connection, at })
    for (const diagramId of next.order.diagrams) {
      const diagram = model.diagrams[diagramId]
      const route = routesOf(diagram)[connectionId]
      if (!route) continue
      undo.push({
        type: 'route.set', diagramId, routes: [route], at: [diagram.order.routes.indexOf(connectionId)],
      })
    }
    next = removeConnection(next, connectionId)
  })

  for (const diagramId of next.order.diagrams) {
    const diagram = next.diagrams[diagramId]
    if (!diagram.placements[id]) continue
    undo.push({
      type: 'placement.set',
      diagramId,
      placements: [diagram.placements[id]],
      at: [diagram.order.placements.indexOf(id)],
    })
    next = setDiagram(
      next, diagramId, withPlacements(diagram, drop(diagram.placements, diagram.order.placements, id)))
  }

  return { ok: true, model: next, inverse: transaction(undo, meta) }
}

/** A connection's own delete: the row, and its route on every diagram. */
function deleteConnection(model: Model, id: ConnectionId, meta: CommandMeta): ApplyResult {
  if (!model.connections[id]) return gone
  const undo: Command[] = [{
    type: 'connection.create',
    connection: model.connections[id],
    at: model.order.connections.indexOf(id),
  }]
  for (const diagramId of model.order.diagrams) {
    const diagram = model.diagrams[diagramId]
    const route = routesOf(diagram)[id]
    if (!route) continue
    undo.push({
      type: 'route.set', diagramId, routes: [route], at: [diagram.order.routes.indexOf(id)],
    })
  }
  return { ok: true, model: removeConnection(model, id), inverse: transaction(undo, meta) }
}

/** The connection and its geometry, gone from the model and from every diagram. */
function removeConnection(model: Model, id: ConnectionId): Model {
  let next = withConnections(model, drop(model.connections, model.order.connections, id))
  for (const diagramId of next.order.diagrams) {
    const diagram = next.diagrams[diagramId]
    if (!routesOf(diagram)[id]) continue
    next = setDiagram(next, diagramId, withRoutes(diagram, drop(routesOf(diagram), diagram.order.routes, id)))
  }
  return next
}

/** The fields the settings dialog owns; see {@link DiagramSettings}. */
const SETTING_FIELDS = [
  'author', 'client', 'documentDate', 'showTitleBlock', 'aspectConfig', 'showAspects',
] as const

function applySettings(diagram: Diagram, settings: DiagramSettings): Diagram {
  const next = { ...diagram, name: settings.name.trim() }
  // Written out one by one, and deleted rather than set to undefined, so what
  // lands in a saved file is what a hand-written one would look like.
  const writable = next as unknown as Record<string, unknown>
  for (const field of SETTING_FIELDS) {
    if (settings[field] === undefined) delete writable[field]
    else writable[field] = settings[field]
  }
  return next
}

function settingsOf(diagram: Diagram): DiagramSettings {
  const settings: DiagramSettings = { name: diagram.name }
  const writable = settings as unknown as Record<string, unknown>
  for (const field of SETTING_FIELDS) {
    if (diagram[field] !== undefined) writable[field] = diagram[field]
  }
  return settings
}

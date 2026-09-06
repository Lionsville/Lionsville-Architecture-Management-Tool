/**
 * The model, indexed.
 *
 * The same landscape the working file holds, with its four identified lists —
 * elements, connections, diagrams, decisions — turned from arrays into records
 * keyed by id, and the order the file had them in kept beside them. Diagrams do
 * the same for their placements and routes.
 *
 * This is the shape a command reducer wants (ADR-0002). A command names a path;
 * applying it touches that path and copies nothing else, so an untouched diagram
 * keeps its object identity and everything memoised downstream of it holds. The
 * array shape wants the opposite: every lookup is a `find`, every change is a
 * `map` over a list, and every list walked is a new array whose consumers all
 * re-render.
 *
 * **The file does not change.** `fromArrays` and `toArrays` sit at the boundary
 * and are exact inverses, down to the bytes:
 *
 * - Order is carried explicitly rather than left to the record's own key order.
 *   `Object.keys` puts integer-like keys first, and an element key is a slug of
 *   a name — an application called "2024" would quietly move to the front of
 *   every list it is in.
 * - The indexed fields keep the names and the positions they have in the file
 *   (`placements`, not `placementsById`), because a spread that replaces a
 *   value in place preserves key order and `JSON.stringify` does not sort.
 * - Absence is not emptiness. `decisions` and `edgeRoutes` are optional in the
 *   file, so they are optional here too: an absent one comes back absent and an
 *   empty one comes back empty. Read them through {@link decisionsOf} and
 *   {@link routesOf} rather than defaulting at each site.
 */
import type {
  DesignConnection, DesignDiagram, DesignElement, DiagramPlacement, EdgeRoute, ElementId,
} from './types'
import type { Adr } from './adr'
import type { HostModel } from './fromInterchange'

export type ConnectionId = string
export type DiagramId = string
export type AdrId = string

/** What the file's array order encoded implicitly, said out loud. */
export type ModelOrder = {
  elements: ElementId[]
  connections: ConnectionId[]
  diagrams: DiagramId[]
  decisions: AdrId[]
}

/** A diagram's own two lists, in the order the file had them. */
export type DiagramOrder = {
  placements: ElementId[]
  routes: ConnectionId[]
}

export type Diagram = Omit<DesignDiagram, 'placements' | 'edgeRoutes'> & {
  placements: Record<ElementId, DiagramPlacement>
  /** Present exactly when the file carried the key; see the note at the top. */
  edgeRoutes?: Record<ConnectionId, EdgeRoute>
  order: DiagramOrder
}

export type Model = Omit<HostModel, 'elements' | 'connections' | 'diagrams' | 'decisions'> & {
  elements: Record<ElementId, DesignElement>
  connections: Record<ConnectionId, DesignConnection>
  diagrams: Record<DiagramId, Diagram>
  /** Present exactly when the file carried the key; see the note at the top. */
  decisions?: Record<AdrId, Adr>
  order: ModelOrder
}

/** The decisions on this model, whether or not the file carried the key. */
export function decisionsOf(model: Model): Record<AdrId, Adr> {
  return model.decisions ?? {}
}

/** The routes on this diagram, whether or not the file carried the key. */
export function routesOf(diagram: Diagram): Record<ConnectionId, EdgeRoute> {
  return diagram.edgeRoutes ?? {}
}

/** The elements in order — for the code that still wants a list. */
export function elementList(model: Model): DesignElement[] {
  return model.order.elements.map((id) => model.elements[id])
}

export function connectionList(model: Model): DesignConnection[] {
  return model.order.connections.map((id) => model.connections[id])
}

export function diagramList(model: Model): Diagram[] {
  return model.order.diagrams.map((id) => model.diagrams[id])
}

export function decisionList(model: Model): Adr[] {
  const by = decisionsOf(model)
  return model.order.decisions.map((id) => by[id])
}

export function placementList(diagram: Diagram): DiagramPlacement[] {
  return diagram.order.placements.map((id) => diagram.placements[id])
}

export function routeList(diagram: Diagram): EdgeRoute[] {
  const by = routesOf(diagram)
  return diagram.order.routes.map((id) => by[id])
}

/**
 * A list into a record and an order.
 *
 * A repeated id collapses onto the last row and appears once in the order — the
 * only place either function is not a pure rearrangement. A model with two rows
 * under one id is broken in a way nothing downstream can act on, and carrying
 * the duplicate through would hide it rather than keep it.
 */
function index<T>(rows: readonly T[], idOf: (row: T) => string): [Record<string, T>, string[]] {
  const by: Record<string, T> = {}
  const order: string[] = []
  for (const row of rows) {
    const id = idOf(row)
    if (!(id in by)) order.push(id)
    by[id] = row
  }
  return [by, order]
}

function unindex<T>(by: Record<string, T>, order: readonly string[]): T[] {
  return order.map((id) => by[id])
}

/** One diagram, indexed. Exported because a command carries whole diagrams. */
export function toDiagram(diagram: DesignDiagram): Diagram {
  const [placements, placementOrder] = index(diagram.placements ?? [], (p) => p.elementId)
  const out = { ...diagram } as unknown as Diagram
  out.placements = placements
  let routeOrder: ConnectionId[] = []
  if (diagram.edgeRoutes !== undefined) {
    const [routes, order] = index(diagram.edgeRoutes, (r) => r.connectionId)
    out.edgeRoutes = routes
    routeOrder = order
  }
  out.order = { placements: placementOrder, routes: routeOrder }
  return out
}

/** One diagram, back in the shape the file wants. */
export function fromDiagram(diagram: Diagram): DesignDiagram {
  const out = { ...diagram } as unknown as DesignDiagram & { order?: DiagramOrder }
  out.placements = unindex(diagram.placements, diagram.order.placements)
  if (diagram.edgeRoutes !== undefined) {
    out.edgeRoutes = unindex(diagram.edgeRoutes, diagram.order.routes)
  }
  delete out.order
  return out
}

/** The model as it comes off disk, indexed. */
export function fromArrays(host: HostModel): Model {
  const [elements, elementOrder] = index(host.elements ?? [], (e) => e.id)
  const [connections, connectionOrder] = index(host.connections ?? [], (c) => c.id)
  const [diagrams, diagramOrder] = index(host.diagrams ?? [], (d) => d.id)
  const out = { ...host } as unknown as Model
  out.elements = elements
  out.connections = connections
  out.diagrams = Object.fromEntries(
    Object.entries(diagrams).map(([id, d]) => [id, toDiagram(d)]))
  let decisionOrder: AdrId[] = []
  if (host.decisions !== undefined) {
    const [decisions, order] = index(host.decisions, (a) => a.id)
    out.decisions = decisions
    decisionOrder = order
  }
  out.order = {
    elements: elementOrder,
    connections: connectionOrder,
    diagrams: diagramOrder,
    decisions: decisionOrder,
  }
  return out
}

/** The model as the file wants it: arrays, in the order they were in. */
export function toArrays(model: Model): HostModel {
  const out = { ...model } as unknown as HostModel & { order?: ModelOrder }
  out.elements = unindex(model.elements, model.order.elements)
  out.connections = unindex(model.connections, model.order.connections)
  out.diagrams = model.order.diagrams.map((id) => fromDiagram(model.diagrams[id]))
  if (model.decisions !== undefined) {
    out.decisions = unindex(model.decisions, model.order.decisions)
  }
  delete out.order
  return out
}

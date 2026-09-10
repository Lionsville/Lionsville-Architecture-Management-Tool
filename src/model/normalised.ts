/**
 * The model, indexed.
 *
 * The same landscape the working file holds, with its four identified lists —
 * elements, relations, diagrams, decisions — turned from arrays into records
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
  DesignDiagram, DesignElement, DiagramGroup, DiagramPlacement, EdgeRoute, ElementId, Relation,
} from './types'
import type { Adr } from './adr'
import type { HostModel } from './fromInterchange'
import type { Transition } from './transition'

export type RelationId = string
/** A dashed group's id — unique on its diagram, and nowhere else (ADR-0012 §6). */
export type GroupId = string
export type DiagramId = string
export type AdrId = string
export type TransitionId = string

/** What the file's array order encoded implicitly, said out loud. */
export type ModelOrder = {
  elements: ElementId[]
  relations: RelationId[]
  diagrams: DiagramId[]
  decisions: AdrId[]
  transitions: TransitionId[]
}

/** A diagram's own lists, in the order the file had them. */
export type DiagramOrder = {
  placements: ElementId[]
  routes: RelationId[]
  groups: GroupId[]
}

export type Diagram = Omit<DesignDiagram, 'placements' | 'edgeRoutes' | 'groups'> & {
  placements: Record<ElementId, DiagramPlacement>
  /** Present exactly when the file carried the key; see the note at the top. */
  edgeRoutes?: Record<RelationId, EdgeRoute>
  /** The dashed groups, by id. Absent exactly as `edgeRoutes` is. */
  groups?: Record<GroupId, DiagramGroup>
  order: DiagramOrder
}

export type Model = Omit<HostModel, 'elements' | 'relations' | 'diagrams' | 'decisions' | 'transitions'> & {
  elements: Record<ElementId, DesignElement>
  relations: Record<RelationId, Relation>
  diagrams: Record<DiagramId, Diagram>
  /** Present exactly when the file carried the key; see the note at the top. */
  decisions?: Record<AdrId, Adr>
  /** The plans (ADR-0009). Absent exactly as `decisions` is, and for the same reason. */
  transitions?: Record<TransitionId, Transition>
  order: ModelOrder
}

/** The decisions on this model, whether or not the file carried the key. */
export function decisionsOf(model: Model): Record<AdrId, Adr> {
  return model.decisions ?? {}
}

/** The plans on this model, whether or not the file carried the key. */
export function transitionsOf(model: Model): Record<TransitionId, Transition> {
  return model.transitions ?? {}
}

/** The routes on this diagram, whether or not the file carried the key. */
export function routesOf(diagram: Diagram): Record<RelationId, EdgeRoute> {
  return diagram.edgeRoutes ?? {}
}

/** The dashed groups on this diagram, whether or not the file carried the key. */
export function groupsOf(diagram: Diagram): Record<GroupId, DiagramGroup> {
  return diagram.groups ?? {}
}

export function groupList(diagram: Diagram): DiagramGroup[] {
  const by = groupsOf(diagram)
  return diagram.order.groups.map((id) => by[id])
}

/** The elements in order — for the code that still wants a list. */
export function elementList(model: Model): DesignElement[] {
  return model.order.elements.map((id) => model.elements[id])
}

export function relationList(model: Model): Relation[] {
  return model.order.relations.map((id) => model.relations[id])
}

export function diagramList(model: Model): Diagram[] {
  return model.order.diagrams.map((id) => model.diagrams[id])
}

export function decisionList(model: Model): Adr[] {
  const by = decisionsOf(model)
  return model.order.decisions.map((id) => by[id])
}

/** The plans in the order the file had them (ADR-0009). */
export function transitionList(model: Model): Transition[] {
  const by = transitionsOf(model)
  return model.order.transitions.map((id) => by[id])
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
  let routeOrder: RelationId[] = []
  if (diagram.edgeRoutes !== undefined) {
    const [routes, order] = index(diagram.edgeRoutes, (r) => r.relationId)
    out.edgeRoutes = routes
    routeOrder = order
  }
  let groupOrder: GroupId[] = []
  if (diagram.groups !== undefined) {
    const [groups, order] = index(diagram.groups, (g) => g.id)
    out.groups = groups
    groupOrder = order
  }
  out.order = { placements: placementOrder, routes: routeOrder, groups: groupOrder }
  return out
}

/**
 * One diagram, back in the shape the file wants.
 *
 * The answer is kept against the diagram it was made from, so a diagram no
 * command has touched comes back as the SAME object every time the model is
 * converted. That is what carries "an untouched diagram keeps its identity"
 * (ADR-0002) across this boundary: without it, a keystroke in an inspector
 * rebuilds all thirty diagram objects, and everything memoised on one of them
 * downstream — the canvas's nodes and edges, first of all — re-derives for a
 * change that was nowhere near it.
 *
 * Safe because a converted diagram is never mutated: every writer in the app
 * returns a new one. Bounded by the collector rather than by a size limit, for
 * the same reason.
 */
export function fromDiagram(diagram: Diagram): DesignDiagram {
  const held = converted.get(diagram)
  if (held) return held
  const out = { ...diagram } as unknown as DesignDiagram & { order?: DiagramOrder }
  out.placements = unindex(diagram.placements, diagram.order.placements)
  if (diagram.edgeRoutes !== undefined) {
    out.edgeRoutes = unindex(diagram.edgeRoutes, diagram.order.routes)
  }
  if (diagram.groups !== undefined) {
    const groups = unindex(diagram.groups, diagram.order.groups)
    // A diagram whose last group was dissolved keeps the key in memory so that
    // putting one back lands it where it was (see `withGroups`); the document
    // says nothing rather than saying nothing twice.
    if (groups.length) out.groups = groups
    else delete out.groups
  }
  delete out.order
  converted.set(diagram, out)
  return out
}

const converted = new WeakMap<Diagram, DesignDiagram>()

/** The model as it comes off disk, indexed. */
export function fromArrays(host: HostModel): Model {
  const [elements, elementOrder] = index(host.elements ?? [], (e) => e.id)
  const [relations, relationOrder] = index(host.relations ?? [], (r) => r.id)
  const [diagrams, diagramOrder] = index(host.diagrams ?? [], (d) => d.id)
  const out = { ...host } as unknown as Model
  out.elements = elements
  out.relations = relations
  out.diagrams = Object.fromEntries(
    Object.entries(diagrams).map(([id, d]) => [id, toDiagram(d)]))
  let decisionOrder: AdrId[] = []
  if (host.decisions !== undefined) {
    const [decisions, order] = index(host.decisions, (a) => a.id)
    out.decisions = decisions
    decisionOrder = order
  }
  let transitionOrder: TransitionId[] = []
  if (host.transitions !== undefined) {
    const [transitions, order] = index(host.transitions, (t) => t.id)
    out.transitions = transitions
    transitionOrder = order
  }
  out.order = {
    elements: elementOrder,
    relations: relationOrder,
    diagrams: diagramOrder,
    decisions: decisionOrder,
    transitions: transitionOrder,
  }
  return out
}

/** The model as the file wants it: arrays, in the order they were in. */
export function toArrays(model: Model): HostModel {
  const out = { ...model } as unknown as HostModel & { order?: ModelOrder }
  out.elements = unindex(model.elements, model.order.elements)
  out.relations = unindex(model.relations, model.order.relations)
  out.diagrams = model.order.diagrams.map((id) => fromDiagram(model.diagrams[id]))
  if (model.decisions !== undefined) {
    out.decisions = unindex(model.decisions, model.order.decisions)
  }
  if (model.transitions !== undefined) {
    out.transitions = unindex(model.transitions, model.order.transitions)
  }
  delete out.order
  return out
}

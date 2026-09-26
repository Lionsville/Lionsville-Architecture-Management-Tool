// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The arithmetic every command's entry shares: an indexed collection changed
 * immutably, a row patched with the patch that puts it back, and a model put
 * back together around what changed — touching only the path a command names,
 * so memoisation below the reducer holds.
 *
 * One rule about absence is worth knowing before reading the decision and route
 * rows. `decisions` and a diagram's `edgeRoutes` are optional in the file, and
 * emptying one **removes the key** rather than leaving an empty list behind —
 * again, a saved file should look like a hand-written one. The consequence is
 * that a list which arrives empty-but-present (only an older build wrote one)
 * becomes absent the first time anything touches it. Nothing reads the
 * difference; `decisionsOf` and `routesOf` answer the same either way.
 */
import type { Adr } from '../adr'
import type { Transition } from '../transition'
import type { Cause, Experiment, Observation, Solution } from '../observation'
import type { Diagram, DiagramId, Model, ModelOrder } from '../normalised'
import type { DesignElement, DiagramGroup, DiagramMember, EdgeRoute, Relation } from '../types'

// --- indexed collections, immutably -----------------------------------------

export type Rows<T> = { by: Record<string, T>; order: string[] }

/**
 * Upsert one row. An existing id keeps its place and the ORDER ARRAY ITSELF —
 * the identity is what tells the caller nothing moved, so it can leave the
 * surrounding object alone.
 */
export function put<T>(by: Record<string, T>, order: string[], id: string, row: T, at?: number): Rows<T> {
  const next = { ...by, [id]: row }
  if (id in by) return { by: next, order }
  const grown = [...order]
  grown.splice(at ?? grown.length, 0, id)
  return { by: next, order: grown }
}

export function drop<T>(by: Record<string, T>, order: string[], id: string): Rows<T> {
  const next = { ...by }
  delete next[id]
  return { by: next, order: order.filter((held) => held !== id) }
}

/**
 * Two rows that say the same thing.
 *
 * Rows here are small, flat and built by one writer, so this is honest — and
 * what it buys is identity: a drag that re-states the band a card is already
 * in must not hand back a fresh object, or everything memoised below it
 * re-renders and `diff.ts` reports a change nobody made.
 */
export function same<T extends object>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

// --- patches -----------------------------------------------------------------

/**
 * A row with a patch applied, and the patch that puts it back. A key whose value
 * is `undefined` deletes the field; the inverse names the same keys, so a field
 * that was not there comes back as not there.
 */
export function patched<T extends object>(row: T, patch: Partial<T>): { row: T; inverse: Partial<T> } {
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

export function withElements(model: Model, rows: Rows<DesignElement>): Model {
  return { ...model, elements: rows.by, order: withOrder(model, 'elements', rows.order) }
}

export function withRelations(model: Model, rows: Rows<Relation>): Model {
  return { ...model, relations: rows.by, order: withOrder(model, 'relations', rows.order) }
}

export function withDiagrams(model: Model, rows: Rows<Diagram>): Model {
  return { ...model, diagrams: rows.by, order: withOrder(model, 'diagrams', rows.order) }
}

export function withDecisions(model: Model, rows: Rows<Adr>): Model {
  const order = withOrder(model, 'decisions', rows.order)
  // Emptied means gone, not present and empty — see the note at the top.
  if (rows.order.length === 0) {
    const out = { ...model, order }
    delete out.decisions
    return out
  }
  return { ...model, decisions: rows.by, order }
}

export function withTransitions(model: Model, rows: Rows<Transition>): Model {
  const order = withOrder(model, 'transitions', rows.order)
  // Emptied means gone, exactly as `decisions` is — see the note at the top.
  if (rows.order.length === 0) {
    const out = { ...model, order }
    delete out.transitions
    return out
  }
  return { ...model, transitions: rows.by, order }
}

export function withObservations(model: Model, rows: Rows<Observation>): Model {
  const order = withOrder(model, 'observations', rows.order)
  if (rows.order.length === 0) {
    const out = { ...model, order }
    delete out.observations
    return out
  }
  return { ...model, observations: rows.by, order }
}

export function withCauses(model: Model, rows: Rows<Cause>): Model {
  const order = withOrder(model, 'causes', rows.order)
  if (rows.order.length === 0) {
    const out = { ...model, order }
    delete out.causes
    return out
  }
  return { ...model, causes: rows.by, order }
}

export function withSolutions(model: Model, rows: Rows<Solution>): Model {
  const order = withOrder(model, 'solutions', rows.order)
  if (rows.order.length === 0) {
    const out = { ...model, order }
    delete out.solutions
    return out
  }
  return { ...model, solutions: rows.by, order }
}

export function withExperiments(model: Model, rows: Rows<Experiment>): Model {
  const order = withOrder(model, 'experiments', rows.order)
  if (rows.order.length === 0) {
    const out = { ...model, order }
    delete out.experiments
    return out
  }
  return { ...model, experiments: rows.by, order }
}

export function setDiagram(model: Model, id: DiagramId, diagram: Diagram): Model {
  return { ...model, diagrams: { ...model.diagrams, [id]: diagram } }
}

export function withMembers(diagram: Diagram, rows: Rows<DiagramMember>): Diagram {
  const order = rows.order === diagram.order.members
    ? diagram.order
    : { ...diagram.order, members: rows.order }
  return { ...diagram, members: rows.by, order }
}

/**
 * Emptied means gone in the FILE, and `fromDiagram` is where that happens —
 * the record is kept here, holding nothing (see {@link Diagram.groups}).
 */
export function withGroups(diagram: Diagram, rows: Rows<DiagramGroup>): Diagram {
  const order = rows.order === diagram.order.groups
    ? diagram.order
    : { ...diagram.order, groups: rows.order }
  return { ...diagram, groups: rows.by, order }
}

export function withRoutes(diagram: Diagram, rows: Rows<EdgeRoute>): Diagram {
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

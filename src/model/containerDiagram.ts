/**
 * What belongs on a container diagram when you have just made it.
 *
 * This lived in `main.tsx`, in the middle of a `useCallback`, tangled up with
 * `setModel` and an id generator — and so only checkable by hand, even though it
 * is the one place where rule 5 of the format is carried out: a component of
 * *another* application does not belong here, its parent application does. That
 * is an agreement about the format, not screen work.
 */
import { transaction } from './commands'
import type { Command } from './commands'
import { acceptImplied, impliedInterfaces } from './implied'
import type { Held } from './refines'
import type { DesignDiagram, DesignElement, ElementId, Relation } from '.'
import type { HostModel } from './hostModel'

/** The container diagram already belonging to this application, if there is one. */
export function findContainerDiagram(
  model: HostModel,
  applicationId: string,
): DesignDiagram | undefined {
  return model.diagrams.find(
    (d) => d.kind === 'container' && d.applicationElementId === applicationId,
  )
}

/**
 * The elements the fresh diagram carries: the application, its components, and
 * the context they are attached to.
 *
 * "Context" is everything on the far side of a LINE that does not itself
 * belong here. If that is a component of another application, its parent
 * application takes its place — a stray component from elsewhere says nothing on
 * this drawing, and the format does not allow it.
 *
 * A line is a flow and nothing else (ADR-0012 §5), so what an application runs
 * on and what it uses put nothing here: a platform on a container diagram is a
 * dashed box drawn around what it hosts (ADR-0013), and a card for it beside
 * that box would be the same fact twice.
 *
 * The order is fixed (application, components, context) because placement
 * follows it: a diagram that comes up differently every time is not a diagram.
 */
export function containerDiagramMembers(model: HostModel, applicationId: string): string[] {
  const componentIds = model.elements
    .filter((e) => e.kind === 'component' && e.parentId === applicationId)
    .map((e) => e.id)
  const inScope = new Set([applicationId, ...componentIds])

  const context = new Set<string>()
  const addContext = (id: string) => {
    const other = model.elements.find((e) => e.id === id)
    if (!other) return
    const hoisted = other.kind === 'component' && other.parentId !== applicationId
      ? other.parentId
      : other.id
    if (hoisted && !inScope.has(hoisted)) context.add(hoisted)
  }
  model.relations.forEach((c) => {
    if (c.type !== 'flow') return
    if (inScope.has(c.sourceId) && !inScope.has(c.targetId)) addContext(c.targetId)
    if (inScope.has(c.targetId) && !inScope.has(c.sourceId)) addContext(c.sourceId)
  })

  return [applicationId, ...componentIds, ...context]
}

/**
 * The fresh diagram, or `undefined` when that application does not exist.
 *
 * `id` and `name` come from outside: one is a counter with a clock in it, the
 * other hangs off the shell's language. Neither belongs in a function you must
 * be able to call twice for the same answer.
 */
export function seedContainerDiagram(
  model: HostModel,
  applicationId: string,
  make: { id: string; name: (applicationName: string) => string },
): DesignDiagram | undefined {
  const app = model.elements.find((e) => e.id === applicationId)
  if (!app) return undefined
  return {
    id: make.id,
    kind: 'container',
    name: make.name(app.name),
    applicationElementId: applicationId,
    members: containerDiagramMembers(model, applicationId).map((id) => ({ id })),
    // No coordinates at all: a machine put these on the view and nobody has
    // looked yet, so the editor lays them out on first open (ADR-0012 §6).
    geometry: { nodes: [], needsLayout: true },
  }
}


/**
 * Taking the container diagram off an application, and leaving the application
 * standing.
 *
 * The inverse of {@link seedContainerDiagram}, and deliberately not the same
 * thing as deleting the application: somebody who has decided they do not want
 * to model the inside of this system wants the detail gone, not the system.
 * Deleting the application is what `deleteElement` does, and it takes this
 * diagram with it — this is the other direction, and it is the one the boards
 * table asks for.
 *
 * Three things, in one step, because they are one decision:
 *
 * 1. **The interfaces move up first.** A container line that refined nothing
 *    was carrying an interface the landscape never heard about (`implied.ts`),
 *    and dropping the containers would drop it with them — so every interface
 *    those lines imply is written as a real application line before anything
 *    is removed. A line that had already landed needs nothing: its interface
 *    is on the landscape already, and only the landing goes.
 * 2. **The containers go**, and the reducer's own cascade takes their lines,
 *    their memberships and their placements with them.
 * 3. **The diagram goes.**
 *
 * The order is what makes it safe rather than tidy: the writer refuses a
 * landing on a row that is not there, and a relation deleted in step 2 cannot
 * be landed in step 1 afterwards.
 *
 * `newId` is called once per interface written, for the same reason
 * `seedContainerDiagram` takes its id from outside.
 */
export function removeContainerDiagram(
  model: HostModel,
  diagramId: string,
  newId: () => string,
): Command | undefined {
  const diagram = model.diagrams.find((d) => d.id === diagramId)
  if (!diagram || diagram.kind !== 'container') return undefined
  const drop: Command = { type: 'diagram.delete', id: diagramId }
  const applicationId = diagram.applicationElementId
  if (applicationId === undefined) return drop

  const byId = new Map(model.elements.map((e) => [e.id, e]))
  const held: Held = (id) => byId.get(id)
  const containers = model.elements
    .filter((e) => e.kind === 'component' && e.parentId === applicationId)
    .map((e) => e.id)
  if (containers.length === 0) return drop
  const going = new Set(containers)

  // Only the interfaces this application's containers were carrying. Another
  // pair's unrefined lines are somebody else's finding and stay one: accepting
  // them here would write rows nobody asked for, on a screen about one view.
  const promoted = impliedInterfaces(model.relations, held)
    .filter((row) => row.relations.some((line) => going.has(line.sourceId) || going.has(line.targetId)))
    .map((row) => acceptImplied(row, newId(), (id) => byId.get(id)?.name ?? id))

  return transaction([
    ...promoted,
    ...containers.map((id): Command => ({ type: 'element.delete', id })),
    drop,
  ])
}


// --- what a container diagram draws, once interfaces land on it (ADR-0013) ---

/** The diagram's own application, or `undefined` for a view that is not one. */
type Subject = Pick<DesignDiagram, 'kind' | 'applicationElementId'>

/**
 * Where an end attaches on this diagram.
 *
 * A component of ANOTHER application draws at that application's context box,
 * exactly as {@link containerDiagramMembers} already hoists it into the
 * membership — so a row between two applications' containers is drawn on both
 * their diagrams, each hoisting the far end, and is one row either way. The
 * subject's own components are never hoisted: a line to the boundary is what
 * an interface that has NOT landed looks like, and hoisting a landing into one
 * would be drawing the very line the landing replaces.
 */
export function hoistedEnd(
  byId: (id: ElementId) => Pick<DesignElement, 'kind' | 'parentId'> | undefined,
  diagram: Subject,
  id: ElementId,
): ElementId {
  if (diagram.kind !== 'container' || diagram.applicationElementId === undefined) return id
  const element = byId(id)
  if (element?.kind !== 'component') return id
  const parent = element.parentId
  if (parent === undefined || parent === diagram.applicationElementId) return id
  return parent
}

/**
 * The interfaces this diagram draws the landings of, and therefore draws NO
 * line to the boundary for.
 *
 * An interface that has not landed attaches to the boundary box and is the
 * ordinary line it has always been. Once one or more landings arrive on this
 * diagram's own containers, those ARE the interface here, and a boundary line
 * beside them would be the same fact drawn twice — which is the whole of what
 * this step is for. Never both.
 *
 * `placed` is what the board actually draws on the day it shows, so a landing
 * on a container that is retired by then does not take the boundary line away
 * with it.
 */
export function landedInterfaces(
  relations: readonly Relation[],
  byId: (id: ElementId) => Pick<DesignElement, 'kind' | 'parentId'> | undefined,
  diagram: Subject,
  placed: ReadonlySet<ElementId>,
): Set<string> {
  const landed = new Set<string>()
  const subject = diagram.applicationElementId
  if (diagram.kind !== 'container' || subject === undefined) return landed
  const onSubject = (id: ElementId) => {
    const element = byId(id)
    return element?.kind === 'component' && element.parentId === subject && placed.has(id)
  }
  for (const relation of relations) {
    if (relation.refines === undefined) continue
    if (onSubject(relation.sourceId) || onSubject(relation.targetId)) landed.add(relation.refines)
  }
  return landed
}

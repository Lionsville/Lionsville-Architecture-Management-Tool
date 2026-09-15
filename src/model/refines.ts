/**
 * What it means for a container line to be part of an application interface
 * (ADR-0013, redone).
 *
 * Interfaces are defined on the application layer, and a level down the lines
 * from the other applications have to arrive somewhere — a container. Those
 * are the same interface seen twice, and before `refines` the model had no way
 * to say so: the landscape's line and the container diagram's line were two
 * unrelated rows kept in step by hand.
 *
 * **One field, one direction.** A container line names the application line it
 * is part of, never the other way round, so an interface with three landings
 * is one row and three rows rather than a list that can disagree with itself.
 * What a landing means is then all derived: the protocols an application line
 * shows, the line the container diagram draws instead of one to the boundary,
 * and which interfaces cross a platform.
 *
 * **The rule is about the ends**, and this file is where it is said once:
 * source under source, target under target, one level only. The reducer
 * refuses what does not satisfy it, the editor greys out what the reducer
 * would refuse, and both ask here.
 */
import type { DesignElement, ElementId, Relation } from './types'

/** Where an id sits: the element, where this model holds it. */
export type Held = (id: ElementId) => Pick<DesignElement, 'kind' | 'parentId'> | undefined

/**
 * A line with at least one `component` end: the level below the landscape.
 *
 * An end this scope does not hold is not a component — a stand-in of another
 * domain's application is an application, and a dangling end is treated as
 * one too, which is the reading that keeps an unknown end off the container
 * diagrams it says nothing about.
 */
export function isContainerLine(relation: Pick<Relation, 'type' | 'sourceId' | 'targetId'>, held: Held): boolean {
  if (relation.type !== 'flow') return false
  return held(relation.sourceId)?.kind === 'component' || held(relation.targetId)?.kind === 'component'
}

/** A flow between two applications: the line the landscape draws. */
export function isApplicationLine(relation: Pick<Relation, 'type' | 'sourceId' | 'targetId'>, held: Held): boolean {
  return relation.type === 'flow' && !isContainerLine(relation, held)
}

/** The application an end belongs to: a component's parent, anything else itself. */
export function applicationOf(id: ElementId, held: Held): ElementId {
  const element = held(id)
  return element?.kind === 'component' && element.parentId !== undefined ? element.parentId : id
}

/** The container lines that say they are part of this interface, in order. */
export function refinementsOf(relations: readonly Relation[], interfaceId: string): Relation[] {
  return relations.filter((relation) => relation.refines === interfaceId)
}

/** Whether anything lands on this interface at all — what decides how it is drawn. */
export function hasRefinements(relations: readonly Relation[], interfaceId: string): boolean {
  return relations.some((relation) => relation.refines === interfaceId)
}

/**
 * The protocols the landings carry, in refinement order and without repeats:
 * what an application line shows where it used to show its own.
 */
export function protocolsOf(relations: readonly Relation[], interfaceId: string): string[] {
  const seen: string[] = []
  for (const row of refinementsOf(relations, interfaceId)) {
    if (row.protocol !== undefined && row.protocol !== '' && !seen.includes(row.protocol)) seen.push(row.protocol)
  }
  return seen
}

/** Why a landing was refused, or `undefined` when it holds. */
export type RefinementRefusal = 'ends' | 'level'

/**
 * Whether this line may say it is part of that one.
 *
 * Both ends have to sit under the interface's ends, each under its own:
 * a container line from the WMS's API to Order management is part of the
 * interface from the WMS to Order management, and the same two containers
 * the other way round are part of the interface the other way round. A line
 * that already refines something may not be refined in turn — an interface
 * lands once, and a chain would make "which landscape line is this" a walk
 * rather than a read.
 */
export function refinementRefusal(
  refining: Pick<Relation, 'sourceId' | 'targetId'>,
  refined: Pick<Relation, 'sourceId' | 'targetId' | 'refines'>,
  held: Held,
): RefinementRefusal | undefined {
  if (refined.refines !== undefined) return 'level'
  const under = (end: ElementId, over: ElementId) => {
    if (end === over) return true
    const element = held(end)
    return element?.kind === 'component' && element.parentId === over
  }
  if (!under(refining.sourceId, refined.sourceId) || !under(refining.targetId, refined.targetId)) return 'ends'
  return undefined
}

/** The containers of one application that an interface could land on. */
export function landingPlaces(elements: readonly DesignElement[], applicationId: ElementId): DesignElement[] {
  return elements.filter((element) => element.kind === 'component' && element.parentId === applicationId)
}

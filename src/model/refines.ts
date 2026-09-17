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
import type { DesignDiagram, DesignElement, ElementId, Relation } from './types'

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
 * the other way round are part of the interface the other way round — unless
 * the interface says it runs both ways, which is precisely the sentence that
 * makes either direction part of it. A line that already refines something may
 * not be refined in turn — an interface lands once, and a chain would make
 * "which landscape line is this" a walk rather than a read.
 */
export function refinementRefusal(
  refining: Pick<Relation, 'sourceId' | 'targetId'>,
  refined: Pick<Relation, 'sourceId' | 'targetId' | 'refines' | 'isBidirectional'>,
  held: Held,
): RefinementRefusal | undefined {
  if (refined.refines !== undefined) return 'level'
  const under = (end: ElementId, over: ElementId) => {
    if (end === over) return true
    const element = held(end)
    return element?.kind === 'component' && element.parentId === over
  }
  const sitsUnder = (source: ElementId, target: ElementId) =>
    under(refining.sourceId, source) && under(refining.targetId, target)
  if (sitsUnder(refined.sourceId, refined.targetId)) return undefined
  // A two-way interface answers EITHER way, which is what saying it runs both
  // ways means — the same reading `candidateInterfaces` already offers below.
  // Without this the inspector offers a landing the writer then refuses, and
  // `acceptImplied` cannot land the lines that made it two-way in the first
  // place.
  if (refined.isBidirectional === true && sitsUnder(refined.targetId, refined.sourceId)) return undefined
  return 'ends'
}

/** The containers of one application that an interface could land on. */
export function landingPlaces(elements: readonly DesignElement[], applicationId: ElementId): DesignElement[] {
  return elements.filter((element) => element.kind === 'component' && element.parentId === applicationId)
}


// --- the gestures, decided here so the canvas only carries them out ----------

/**
 * What dropping a line's end somewhere on a container diagram MEANS.
 *
 * The canvas knows a drag ended on a node; which of four different writes that
 * is, is a question about the model, and this is where it is answered — so the
 * menu's *Lands on*, the drag, and a tool call all take the same four paths.
 */
export type LandingGesture =
  /** An interface leaves the boundary and lands: a container line, refining it. */
  | { kind: 'land'; interfaceId: string; containerId: ElementId }
  /** A landing moves to another container of the same application. */
  | { kind: 'move'; containerId: ElementId }
  /** A landing goes back to the boundary: the container line is removed. */
  | { kind: 'unland' }
  /**
   * A landing end, dropped somewhere that means no landing — on the pane, on a
   * context box, on another application's container.
   *
   * NOT a reconnect. The end at the boundary and the end on a container are
   * grabbed to land and to move; re-pointing the functional line at somebody
   * else is never what that gesture means, and doing it silently would move an
   * interface between two applications because a drop missed by ten pixels.
   * Nothing happens.
   */
  | { kind: 'none' }
  /** Nothing to do with landing — an ordinary reconnect. */
  | { kind: 'reconnect' }

export function landingGesture(
  diagram: Pick<DesignDiagram, 'kind' | 'applicationElementId'>,
  relation: Relation,
  ends: { sourceId: ElementId; targetId: ElementId },
  held: Held,
): LandingGesture {
  const subject = diagram.applicationElementId
  if (diagram.kind !== 'container' || subject === undefined) return { kind: 'reconnect' }
  const ordinary = { kind: 'reconnect' } as const
  if (relation.type !== 'flow') return ordinary
  const isOwnContainer = (id: ElementId) => {
    const element = held(id)
    return element?.kind === 'component' && element.parentId === subject
  }

  // Which end moved. A drag moves one; anything else is not a gesture of ours.
  const movedSource = ends.sourceId !== relation.sourceId
  const movedTarget = ends.targetId !== relation.targetId
  if (movedSource === movedTarget) return ordinary
  const was = movedSource ? relation.sourceId : relation.targetId
  const now = movedSource ? ends.sourceId : ends.targetId

  // The boundary end of an interface, dropped on one of the application's own
  // containers: the interface lands there. The application line itself is
  // never re-ended — it is the functional line and stays what it is, which is
  // why a drop anywhere else is nothing rather than a reconnect.
  if (was === subject) {
    return isOwnContainer(now)
      ? { kind: 'land', interfaceId: relation.id, containerId: now }
      : { kind: 'none' }
  }
  // A landed end, grabbed again: onto another container it moves, onto the
  // boundary box it goes back — and going back removes the container line,
  // because the boundary line reappears by derivation with nothing written.
  if (relation.refines !== undefined && isOwnContainer(was)) {
    if (isOwnContainer(now)) return { kind: 'move', containerId: now }
    if (now === subject) return { kind: 'unland' }
    return { kind: 'none' }
  }
  return ordinary
}

/**
 * The container line that lands an interface on one of its application's
 * containers.
 *
 * It takes the protocol and the technology down with it, because that is the
 * level at which they are known and the interface is about to lose its own
 * (see the reducer). It takes the direction, because a landing's direction has
 * to agree with its interface's. It leaves the label and the window, which
 * stay the interface's and are inherited.
 */
export function landingRow(
  relation: Relation,
  subject: ElementId,
  containerId: ElementId,
  id: string,
): Relation {
  const onSource = relation.sourceId === subject
  return {
    id,
    type: 'flow',
    sourceId: onSource ? containerId : relation.sourceId,
    targetId: onSource ? relation.targetId : containerId,
    refines: relation.id,
    ...(relation.protocol !== undefined ? { protocol: relation.protocol } : {}),
    ...(relation.technology !== undefined ? { technology: relation.technology } : {}),
    ...(relation.isBidirectional ? { isBidirectional: true } : {}),
  }
}

/**
 * Which end of a landing sits on the application whose diagram this is: the
 * end a drag may grab, and the one *Lands on* moves.
 */
export function landedEnd(
  relation: Pick<Relation, 'sourceId' | 'targetId'>,
  subject: ElementId,
  held: Held,
): 'source' | 'target' | undefined {
  const own = (id: ElementId) => {
    const element = held(id)
    return element?.kind === 'component' && element.parentId === subject
  }
  if (own(relation.sourceId)) return 'source'
  if (own(relation.targetId)) return 'target'
  return undefined
}


/**
 * The application interfaces a container line could be part of: the lines
 * between the two applications its ends belong to, running the same way.
 *
 * Direction counts, because the rule the reducer applies counts it — an
 * interface from Order management to the WMS is not what a line from the WMS
 * back to Order management is part of. A bidirectional interface answers
 * either way, which is what saying it runs both ways means.
 *
 * With exactly one answer the drawing hand is almost never wrong, so a fresh
 * container line takes it and the inspector shows it ticked; with several the
 * inspector asks; with none the line is an interface of its own, and the
 * roadmap offers to draw the application line for it.
 */
export function candidateInterfaces(
  relations: readonly Relation[],
  relation: Pick<Relation, 'id' | 'sourceId' | 'targetId'>,
  held: Held,
): Relation[] {
  const source = applicationOf(relation.sourceId, held)
  const target = applicationOf(relation.targetId, held)
  if (source === target) return []
  return relations.filter((row) => {
    if (row.id === relation.id) return false
    if (row.refines !== undefined) return false
    if (!isApplicationLine(row, held)) return false
    if (row.sourceId === source && row.targetId === target) return true
    return row.isBidirectional === true && row.sourceId === target && row.targetId === source
  })
}

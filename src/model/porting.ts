/**
 * Which interface moves where, and when (ADR-0010).
 *
 * A migration is a list of lines, each moving from an element a plan retires
 * to one it introduces, on a day. The model already says a moved line
 * completely — the original with a `validUntil`, a twin on the new end with a
 * `validFrom` the day after — and nothing new is stored for it. What is *not*
 * stored is the list, so this file derives it: every line on an element the
 * plan moves from, paired with its twin on an introduced element when one
 * exists.
 *
 * ## What a twin is
 *
 * A line on an introduced element with the same counterpart, the same
 * direction and the same protocol as a line on a retiring one. Deliberately
 * loose about the label, because a label is prose, and deliberately strict
 * about the protocol, because a line that changes protocol when it moves is a
 * new interface and should read as one. That is a heuristic and ADR-0010 says
 * so; the table shows what it matched, and a wrong match is corrected by
 * editing the twin.
 *
 * ## Who moves from where
 *
 * Lines leave the elements the plan **retires**, and — so that a split can be
 * said — the elements it **changes**, since a split's source stays and is
 * listed as changed. Lines arrive on what it **introduces**. A line between
 * two of those (the tap of a shadow run, old → new) is not an interface that
 * moves and is left out.
 *
 * Pure, and in `model/` for the reason `checks.ts` is: the plan page reads
 * this and so does the agent, and `agent` may not see `roadmap`.
 */
import type { Command } from './commands'
import { flowsOf } from './relations'
import { addDays } from './transition'
import type { Transition } from './transition'
import type { DesignElement, ElementId, Relation } from './types'

export type Port = {
  /** The line on the element the plan moves from. */
  from: Relation
  /** Which end of `from` is leaving. */
  fromElementId: ElementId
  /** The other end, which stays where it is. */
  counterpartId: ElementId
  /** Its twin on an introduced element, when one has been drawn. */
  to?: Relation
  /** The day the twin starts; absent means not yet planned. */
  on?: string
  /**
   * The original's last day, when no twin of this plan's explains it: some
   * other plan, or a hand, closed the line already. "Every interface not yet
   * planned" leaves these alone, which is what keeps one plan's *port all*
   * from re-dating what another plan decided.
   */
  closedOn?: string
}

type Landscape = {
  elements: readonly Pick<DesignElement, 'id'>[]
  relations: readonly Relation[]
}

function idsWithRole(plan: Transition, ...roles: Transition['elements'][number]['role'][]): Set<ElementId> {
  return new Set(plan.elements.filter((one) => roles.includes(one.role)).map((one) => one.elementId))
}

/** Which end of a line this element is, or nothing if it is neither. */
function endOf(relation: Relation, id: ElementId): 'source' | 'target' | undefined {
  if (relation.sourceId === id) return 'source'
  if (relation.targetId === id) return 'target'
  return undefined
}

function otherEnd(relation: Relation, id: ElementId): ElementId {
  return relation.sourceId === id ? relation.targetId : relation.sourceId
}

/** Whether `twin` is `line` moved onto `toId`: same counterpart, same end, same direction, same protocol. */
function isTwin(line: Relation, fromId: ElementId, twin: Relation, toId: ElementId): boolean {
  const end = endOf(line, fromId)
  if (!end || endOf(twin, toId) !== end) return false
  if (otherEnd(twin, toId) !== otherEnd(line, fromId)) return false
  if (twin.isBidirectional !== line.isBidirectional) return false
  return (twin.protocol ?? '') === (line.protocol ?? '')
}

/** The interfaces of a plan still to be dated — and not dated by anybody else either. */
export function unplannedPorts(ports: readonly Port[]): Port[] {
  return ports.filter((port) => port.on === undefined && port.closedOn === undefined)
}

/**
 * Every interface a plan moves, with where it has gone so far.
 *
 * In the order the lines are in the model, which is the order they were drawn
 * in, so the table does not reshuffle when a port is written.
 */
export function portsOf(model: Landscape, plan: Transition): Port[] {
  const leaving = idsWithRole(plan, 'retires', 'changes')
  const arriving = idsWithRole(plan, 'introduces')
  if (leaving.size === 0 || arriving.size === 0) return []
  const known = new Set(model.elements.map((element) => element.id))

  const ports: Port[] = []
  // An interface is a flow. The other relation types say what covers what
  // (ADR-0012 §5); they are not lines anybody moves from one end to another.
  for (const line of flowsOf(model.relations)) {
    const fromElementId = [line.sourceId, line.targetId].find((id) => leaving.has(id))
    if (fromElementId === undefined) continue
    const counterpartId = otherEnd(line, fromElementId)
    // The tap, or a line between two things that are both leaving: not an
    // interface anybody has to move.
    if (arriving.has(counterpartId) || leaving.has(counterpartId)) continue
    if (!known.has(counterpartId)) continue

    const to = flowsOf(model.relations).find((candidate) => (
      candidate.id !== line.id
      && [...arriving].some((toId) => isTwin(line, fromElementId, candidate, toId))
    ))
    ports.push({
      from: line,
      fromElementId,
      counterpartId,
      ...(to ? { to } : {}),
      ...(to?.validFrom ? { on: to.validFrom } : {}),
      ...(!to && line.validUntil ? { closedOn: line.validUntil } : {}),
    })
  }
  return ports
}

/** How many of a plan's interfaces have a day, out of how many there are. */
export function portProgress(model: Landscape, plan: Transition): { done: number; total: number } {
  const ports = portsOf(model, plan)
  return { done: ports.filter((port) => port.on !== undefined).length, total: ports.length }
}

/**
 * The twin a port would draw: the same line with the leaving end replaced.
 *
 * Presentation comes along — colour, style, routing — because the twin is
 * the same interface, and a line that changed colour when it moved would
 * read as a different one. Waypoints do not: they belong to a diagram's
 * routes, and the twin is routed fresh by whichever board draws it.
 */
export function twinOf(port: Port, toId: ElementId, id: string, on: string): Relation {
  const end = endOf(port.from, port.fromElementId)
  const { validFrom: _from, validUntil: _until, ...rest } = port.from
  void _from; void _until
  return {
    ...rest,
    id,
    sourceId: end === 'source' ? toId : port.from.sourceId,
    targetId: end === 'target' ? toId : port.from.targetId,
    validFrom: on,
  }
}

/** The last day the original line is there: the day before the twin starts. */
export function lastDayBefore(on: string): string {
  return addDays(on, -1)
}

/**
 * The commands that write a port: the twin with its `validFrom`, and the
 * original closed the day before. One transaction, so a port is one undo
 * step. A twin that is already there is moved or re-dated rather than drawn
 * twice; `mintId` is asked only when one has to be drawn.
 */
export function portCommands(port: Port, toId: ElementId, on: string, mintId: () => string): Command[] {
  const close: Command = { type: 'relation.update', id: port.from.id, patch: { validUntil: lastDayBefore(on) } }
  if (port.to) {
    const end = endOf(port.from, port.fromElementId)
    const moved: Partial<Relation> = {
      validFrom: on,
      ...(end === 'source' && port.to.sourceId !== toId ? { sourceId: toId } : {}),
      ...(end === 'target' && port.to.targetId !== toId ? { targetId: toId } : {}),
    }
    return [{ type: 'relation.update', id: port.to.id, patch: moved }, close]
  }
  return [{ type: 'relation.create', relation: twinOf(port, toId, mintId(), on) }, close]
}

/** The inverse gesture: the twin goes, and the original is open-ended again. */
export function unportCommands(port: Port): Command[] {
  const reopen: Command = { type: 'relation.update', id: port.from.id, patch: { validUntil: undefined } }
  return port.to ? [{ type: 'relation.delete', id: port.to.id }, reopen] : [reopen]
}

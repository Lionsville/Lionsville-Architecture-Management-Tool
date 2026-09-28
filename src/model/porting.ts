// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
 * Two refinements of it. An interface that has landed has handed its
 * protocol down to its landings (ADR-0013; the writer takes it off), so its
 * own says nothing and is not compared: a port that draws a twin with
 * landings would otherwise not recognise the twin it just drew. And a twin is
 * one line's: two lines alike enough to share one would both write it, and a
 * *port all* would write it twice.
 *
 * ## Who moves from where
 *
 * Lines leave the elements the plan **retires**, and — so that a split can be
 * said — the elements it **changes**, since a split's source stays and is
 * listed as changed. Lines arrive on what it **introduces**. A line between
 * two of those (the tap of a shadow run, old → new) is not an interface that
 * moves and is left out.
 *
 * ## A landing moves with its interface
 *
 * A container line that `refines` an application interface (ADR-0013) is
 * that interface seen a level down, not a second interface, so it is never a
 * row of its own here: listing it asked for a twin that the writer refuses —
 * a line from the new application cannot be part of an interface from the
 * old one — and since a *port all* is one transaction, the refusal took every
 * other row down with it. It also held the plan's gate shut for good, since a
 * landing with no window of its own is dated by its interface
 * (`model/liveness.ts`) and never by a port of its own.
 *
 * So a port moves the interface, and its landings follow by the rule
 * ADR-0013 sets for them: a landing is where the interface *arrives*, which
 * is a fact about the application at that end. The counterpart's landings are
 * facts about the counterpart, which is not moving, so the twin arrives where
 * the original did — each is drawn again on the twin, the leaving end moved to
 * the new application's boundary. Landings on the leaving side are facts about
 * the application that is going: they go with it, and where the twin arrives
 * on the new one is a question for that application's container diagram,
 * asked there when somebody knows the answer. A landing that arrived only on
 * the leaving side therefore draws nothing on the twin.
 *
 * The originals are not touched: with no window of their own they close with
 * their interface, and one with a window of its own keeps it, which is the
 * liveness rule and not porting's to overrule.
 *
 * Pure, and in `model/` for the reason `checks.ts` is: the plan page reads
 * this and so does the agent, and `agent` may not see `roadmap`.
 */
import type { Command } from './commands'
import { livenessOf } from './liveness'
import { applicationOf, refinementsOf } from './refines'
import type { Held } from './refines'
import { flowsOf } from './relations'
import { isDay } from './lifecycle'
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
  /**
   * The container lines that are part of the original (ADR-0013), in model
   * order. Not ports themselves: they move with this one.
   */
  landings: Landing[]
  /** The container lines that are part of the twin, when there is one. */
  twinLandings: Landing[]
}

/** A container line that is part of an interface a port moves, read against the end that moves. */
export type Landing = {
  row: Relation
  /** Which end of the landing sits on the moving application, or on one of its containers. */
  end: 'source' | 'target'
  /**
   * Whether it arrives on one of the counterpart's containers — a fact about
   * the end that stays, and so drawn again wherever the interface goes. A
   * landing that arrives only on the moving side goes with that side.
   */
  follows: boolean
}

type Landscape = {
  elements: readonly DesignElement[]
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

/**
 * Whether `twin` is `line` moved onto `toId`: same counterpart, same end, same
 * direction, and the same protocol where neither has landed.
 */
function isTwin(line: Relation, fromId: ElementId, twin: Relation, toId: ElementId, landed: ReadonlySet<string>): boolean {
  const end = endOf(line, fromId)
  if (!end || endOf(twin, toId) !== end) return false
  if (otherEnd(twin, toId) !== otherEnd(line, fromId)) return false
  if (twin.isBidirectional !== line.isBidirectional) return false
  if (landed.has(line.id) || landed.has(twin.id)) return true
  return (twin.protocol ?? '') === (line.protocol ?? '')
}

/** The landings of an interface, each read against the application at the end that moves. */
function landingsOf(relations: readonly Relation[], line: Relation, movingId: ElementId, held: Held): Landing[] {
  return refinementsOf(relations, line.id).map((row) => {
    const end = applicationOf(row.sourceId, held) === movingId ? 'source' : 'target'
    const staying = end === 'source' ? row.targetId : row.sourceId
    return { row, end, follows: staying !== applicationOf(staying, held) }
  })
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
  const byId = new Map(model.elements.map((element) => [element.id, element]))
  const held: Held = (id) => byId.get(id)
  // Whether a line has closed is read the way every other reader reads it.
  const { windowOf } = livenessOf(model)

  // An interface is a flow. The other relation types say what covers what
  // (ADR-0012 §5); they are not lines anybody moves from one end to another.
  // A landing is part of an interface, and moves with it (see above), so it
  // is neither a row here nor anybody's twin.
  const interfaces = flowsOf(model.relations).filter((line) => line.refines === undefined)
  const moving: Moving[] = []
  for (const line of interfaces) {
    const fromElementId = [line.sourceId, line.targetId].find((id) => leaving.has(id))
    if (fromElementId === undefined) continue
    const counterpartId = otherEnd(line, fromElementId)
    // The tap, or a line between two things that are both leaving: not an
    // interface anybody has to move.
    if (arriving.has(counterpartId) || leaving.has(counterpartId)) continue
    if (!byId.has(counterpartId)) continue
    moving.push({ line, fromElementId, counterpartId })
  }

  const twins = pairTwins(moving, interfaces, arriving, model.relations)
  return moving.map(({ line, fromElementId, counterpartId }) => {
    const to = twins.get(line.id)
    const on = to ? windowOf(to).validFrom : undefined
    const closedOn = to ? undefined : windowOf(line).validUntil
    return {
      from: line,
      fromElementId,
      counterpartId,
      ...(to ? { to } : {}),
      ...(on ? { on } : {}),
      ...(closedOn ? { closedOn } : {}),
      landings: landingsOf(model.relations, line, fromElementId, held),
      twinLandings: to ? landingsOf(model.relations, to, otherEnd(to, counterpartId), held) : [],
    }
  })
}

type Moving = { line: Relation; fromElementId: ElementId; counterpartId: ElementId }

/**
 * Each moving line's twin, one line's each.
 *
 * A twin whose window meets the line's — it starts the day after the line's
 * last — is that line's before it is anybody else's, because that is what a
 * port wrote; only then does a line take the first twin still free. Without
 * the first pass, porting the second of two lines alike would hand its twin
 * to the first on the next read, and taking it back would take back the
 * wrong one.
 */
function pairTwins(
  moving: readonly Moving[],
  interfaces: readonly Relation[],
  arriving: ReadonlySet<ElementId>,
  relations: readonly Relation[],
): Map<string, Relation> {
  const landed = new Set(relations.flatMap((row) => (row.refines === undefined ? [] : [row.refines])))
  const claimed = new Set<string>()
  const twins = new Map<string, Relation>()
  const pair = (meets: boolean) => {
    for (const { line, fromElementId } of moving) {
      if (twins.has(line.id)) continue
      const to = interfaces.find((candidate) => (
        candidate.id !== line.id
        && !claimed.has(candidate.id)
        && (!meets || (isDay(candidate.validFrom) && line.validUntil === lastDayBefore(candidate.validFrom)))
        && [...arriving].some((toId) => isTwin(line, fromElementId, candidate, toId, landed))
      ))
      if (!to) continue
      claimed.add(to.id)
      twins.set(line.id, to)
    }
  }
  pair(true)
  pair(false)
  return twins
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
 * The landings a fresh twin arrives on: the original's that follow it, with
 * the moving end on the new application's boundary and `refines` on the twin.
 *
 * Presentation, protocol and technology come along, as they do for the twin
 * itself; the window does not, because a landing with none takes the twin's,
 * which starts the day the port says. Two landings that arrive at the same
 * container the same way from two of the old application's containers are
 * one landing once the old containers are out of the picture.
 */
function followingLandings(port: Port, toId: ElementId, twinId: string, mintId: () => string): Relation[] {
  const drawn = new Set<string>()
  const out: Relation[] = []
  for (const { row, end, follows } of port.landings) {
    if (!follows) continue
    const { validFrom: _from, validUntil: _until, ...rest } = row
    void _from; void _until
    const landing: Relation = { ...rest, [end === 'source' ? 'sourceId' : 'targetId']: toId, refines: twinId, id: '' }
    const key = JSON.stringify([landing.sourceId, landing.targetId, landing.protocol, landing.technology, landing.isBidirectional])
    if (drawn.has(key)) continue
    drawn.add(key)
    out.push({ ...landing, id: mintId() })
  }
  return out
}

/**
 * A drawn twin moved onto another introduced application takes its landings
 * with it by the same rule as a fresh one: those arriving on the
 * counterpart's containers are re-ended onto the new application, and those
 * arriving only on the old one's containers go, since the interface no
 * longer touches it. Deleting them rather than leaving them is the writer's
 * own reading — a landing whose interface no longer sits over its ends would
 * otherwise be a row the reducer can neither draw nor clear.
 */
function movedLandings(port: Port, toId: ElementId): Command[] {
  return port.twinLandings.map(({ row, end, follows }): Command => (
    follows
      ? { type: 'relation.update', id: row.id, patch: end === 'source' ? { sourceId: toId } : { targetId: toId } }
      : { type: 'relation.delete', id: row.id }
  ))
}

/**
 * The commands that write a port: the twin with its `validFrom`, the
 * landings that follow it, and the original closed the day before. One
 * transaction, so a port is one undo step. A twin that is already there is
 * moved or re-dated rather than drawn twice, and what landed on it stays as
 * drawn; `mintId` is asked only for what has to be drawn.
 *
 * The original's landings are not written at all: with no window of their
 * own they close with it (`model/liveness.ts`).
 */
export function portCommands(port: Port, toId: ElementId, on: string, mintId: () => string): Command[] {
  const close: Command = { type: 'relation.update', id: port.from.id, patch: { validUntil: lastDayBefore(on) } }
  if (port.to) {
    const end = endOf(port.from, port.fromElementId)
    const reEnded = end === 'source' ? port.to.sourceId !== toId : port.to.targetId !== toId
    const moved: Partial<Relation> = {
      validFrom: on,
      ...(reEnded ? (end === 'source' ? { sourceId: toId } : { targetId: toId }) : {}),
    }
    // The twin first: a landing is checked against its interface as it
    // stands when the landing is written.
    return [{ type: 'relation.update', id: port.to.id, patch: moved }, ...(reEnded ? movedLandings(port, toId) : []), close]
  }
  const twin = twinOf(port, toId, mintId(), on)
  const landings = followingLandings(port, toId, twin.id, mintId)
  return [
    { type: 'relation.create', relation: twin },
    ...landings.map((relation): Command => ({ type: 'relation.create', relation })),
    close,
  ]
}

/**
 * The inverse gesture: the twin goes with everything that landed on it, and
 * the original is open-ended again. The landings go first and by name,
 * because the writer, left to delete the twin under them, would keep each
 * as an interface of its own (ADR-0013) — a line nobody drew.
 */
export function unportCommands(port: Port): Command[] {
  const reopen: Command = { type: 'relation.update', id: port.from.id, patch: { validUntil: undefined } }
  if (!port.to) return [reopen]
  return [
    ...port.twinLandings.map(({ row }): Command => ({ type: 'relation.delete', id: row.id })),
    { type: 'relation.delete', id: port.to.id },
    reopen,
  ]
}

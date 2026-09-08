/**
 * What the dates contradict (ADR-0009).
 *
 * A landscape with dates on it can be wrong in ways a landscape without them
 * cannot. The four below are the ones that cost money: something retires with
 * things still hanging off it, a replacement that lands after the thing it
 * replaces has gone, a line that outlives one of its ends, and a plan whose
 * window closed while it was still running.
 *
 * **They catch contradictions, never staleness.** Nothing here can tell that a
 * landscape is out of date — only that it disagrees with itself. A project
 * nobody has touched for a year will pass every one of these and still be
 * fiction, and no check can be written that would say so. ADR-0009 says this
 * out loud as an accepted cost, and it is repeated here because the list
 * looking thorough is exactly what would make somebody trust it too far.
 *
 * Pure and node-tested, and deliberately not part of the reducer: a landscape
 * mid-edit disagrees with itself constantly, and a model that refused to hold a
 * contradiction would refuse the keystroke in the middle of typing a date.
 *
 * In `model/` and not in `roadmap/` beside the page that draws them, because
 * the import matrix said so and was right: an agent asks for these too
 * (`roadmap.check`), and `agent` may not see `roadmap`. They are arithmetic
 * over a landscape, which is what this module is for.
 */
import { connectionLiveAt, isDay, phaseAt } from './lifecycle'
import { isTransitionFinished } from './transition'
import type { Transition } from './transition'
import type { DesignConnection, DesignElement, DesignModel, ElementId } from './types'

export type FindingKind =
  /** Something retires while things are still connected to it. */
  | 'retiresWithDependants'
  /** Its replacement does not go live until after it is gone. */
  | 'successorTooLate'
  /** It retires and nothing is named to replace it. */
  | 'successorMissing'
  /** A line is still valid on a day one of its ends is retired. */
  | 'lineOutlivesEnd'
  /** A plan is still running after the day it was due to end. */
  | 'planOverdue'

export type FindingSubject = 'element' | 'connection' | 'transition'

export type Finding = {
  kind: FindingKind
  subject: FindingSubject
  /** What it is about; what a click on the row should open. */
  id: string
  /** What that thing is called. */
  name: string
  /** The other thing the sentence names — a successor, a neighbour, a day. */
  detail?: string
  /** How many, where the finding is about several. */
  count?: number
}

export type CheckContext = {
  model: Pick<DesignModel, 'elements' | 'connections'> & { transitions?: Transition[] }
  /** The day "now" is, so a test is not at the mercy of the clock. */
  today: string
}

/** The day an element is gone, if it has one. */
function retiredOn(element: DesignElement): string | undefined {
  const day = element.lifecycleDates?.retired
  return isDay(day) ? day : undefined
}

/** Whether this line is drawn on this day, ends and window together. */
function liveOn(
  connection: DesignConnection,
  day: string,
  byId: Map<ElementId, DesignElement>,
): boolean {
  if (!connectionLiveAt(connection, day)) return false
  const source = byId.get(connection.sourceId)
  const target = byId.get(connection.targetId)
  if (!source || !target) return false
  return phaseAt(source, day) !== 'retired' && phaseAt(target, day) !== 'retired'
}

/**
 * Everything the dates disagree about, worst first.
 *
 * "Worst" is by kind rather than by count: a retirement with things still
 * plugged into it is an outage, and a plan a week overdue is a conversation.
 */
export function findings({ model, today }: CheckContext): Finding[] {
  const byId = new Map(model.elements.map((element) => [element.id, element]))
  const found: Finding[] = []

  for (const element of model.elements) {
    const gone = retiredOn(element)
    if (!gone) continue

    // Who is still talking to it the day after it goes. Counted on the day
    // itself plus one, because `retired` names the day it is gone.
    const dependants = model.connections.filter((connection) => {
      const other = connection.sourceId === element.id ? connection.targetId
        : connection.targetId === element.id ? connection.sourceId : undefined
      if (other === undefined) return false
      // A line with its own window that closes in time is the correct answer to
      // this problem, not an instance of it.
      if (!connectionLiveAt(connection, gone)) return false
      const neighbour = byId.get(other)
      return Boolean(neighbour) && phaseAt(neighbour!, gone) !== 'retired'
    })
    if (dependants.length) {
      found.push({
        kind: 'retiresWithDependants',
        subject: 'element',
        id: element.id,
        name: element.name,
        count: dependants.length,
        detail: gone,
      })
    }

    const successor = element.successorId ? byId.get(element.successorId) : undefined
    if (!element.successorId) {
      found.push({ kind: 'successorMissing', subject: 'element', id: element.id, name: element.name, detail: gone })
    } else if (successor && phaseAt(successor, gone) === 'planned') {
      // Live strictly after the day the old one is gone: a same-day cutover is
      // the plan working, not a gap.
      found.push({
        kind: 'successorTooLate',
        subject: 'element',
        id: element.id,
        name: element.name,
        detail: successor.name,
      })
    }
  }

  for (const connection of model.connections) {
    const { validUntil } = connection
    // Only a line that says when it ends can outlive an end: one with no window
    // follows its ends by definition and cannot contradict them.
    if (!isDay(validUntil)) continue
    const source = byId.get(connection.sourceId)
    const target = byId.get(connection.targetId)
    if (!source || !target) continue
    const dead = [source, target].find((element) => {
      const gone = retiredOn(element)
      return gone !== undefined && gone < validUntil
    })
    if (dead) {
      found.push({
        kind: 'lineOutlivesEnd',
        subject: 'connection',
        id: connection.id,
        name: connection.label || `${source.name} → ${target.name}`,
        detail: dead.name,
      })
    }
  }

  for (const transition of model.transitions ?? []) {
    if (isTransitionFinished(transition)) continue
    if (isDay(transition.to) && transition.to < today) {
      found.push({
        kind: 'planOverdue',
        subject: 'transition',
        id: transition.id,
        name: transition.title,
        detail: transition.to,
      })
    }
  }

  const severity: Record<FindingKind, number> = {
    retiresWithDependants: 0,
    successorTooLate: 1,
    lineOutlivesEnd: 2,
    planOverdue: 3,
    successorMissing: 4,
  }
  return found.sort((a, b) => severity[a.kind] - severity[b.kind] || a.name.localeCompare(b.name))
}

/** Whether a connection is drawn on a day, for a caller that wants one answer. */
export { liveOn as connectionDrawnOn }

/**
 * One journey, several paths through it (ADR-0012 §4).
 *
 * A journey is rarely one path: a key account on a project runs differently
 * from a customer who orders directly, and a marketplace partner that handles
 * fulfilment runs differently again. So a `step` may name a `lane` — the
 * `actor` whose own path it is — and the sheet draws a row per lane under the
 * same phases, the common row first.
 *
 * **Everything else is derived**, which is the point of the record: a lane's
 * *fork* and *join* are the first and last phase in which it has a step of its
 * own; a phase inside that span where it has none is *as the row above*, drawn
 * as a pass-through; outside the span nothing is drawn at all. Nothing stores
 * where a path leaves and rejoins, so nothing can disagree with where its
 * steps are.
 *
 * In phases, not pixels — the roadmap's *days rather than pixels* rule
 * (`roadmap/timeline.ts`). A page turns a phase into a column; this file has
 * no opinion about how wide one is.
 *
 * What a lane is **not** is a decision inside one path. That is a process, and
 * it lives in its ```bpmn fence.
 */
import type { DesignElement, ElementId } from '../model'
import { childrenOf } from './tree'

/** A phase of the journey, and what one lane does in it. */
export type LaneCell = {
  phaseId: ElementId
  /** This lane's own steps in that phase, in order. Empty for a pass-through. */
  steps: DesignElement[]
  /**
   * Inside the lane's span, with no step of its own: the row above is what
   * happens here. Drawn as a pass-through rather than a hole, which is a
   * different thing from a phase outside the span, where this lane is not
   * drawn at all.
   */
  passThrough: boolean
}

export type Lane = {
  /**
   * The actor whose path this is, or absent for the common row — the one every
   * lane shares, and the one a journey with no lanes at all consists of.
   */
  actorId?: ElementId
  /** The phase this lane's own path begins in; absent when it has no steps. */
  fork?: ElementId
  /** The phase it ends in. */
  join?: ElementId
  /**
   * One cell per phase of the journey, in the journey's order — including the
   * phases outside this lane's span, where `steps` is empty and `passThrough`
   * is false, so a page can lay the row out against the same columns without
   * counting anything itself.
   */
  cells: LaneCell[]
}

export type Journey = {
  /** The phases across the top, in the journey's own order. */
  phases: DesignElement[]
  /** The common row first, then the lanes. */
  lanes: Lane[]
}

/**
 * The journey as rows and phases.
 *
 * `order` is the sheet's — which actors get a row and in which order
 * (`Diagram.lanes`, ADR-0012 §6) — and is a parameter rather than something
 * read from a view, so the arithmetic is the same whoever asks: an agent
 * reporting the journey, a page drawing it, a check counting what nobody
 * inside covers. A lane with steps that the order does not name still gets a
 * row, after the named ones, because a step that names a lane is a fact and
 * leaving it undrawn would lose it; a named lane with no steps gets an empty
 * row, because the sheet asked for it.
 *
 * The common row is always first and always present, even when every step
 * names a lane — an empty row above is what makes the forks read as forks.
 */
export function journeyOf(
  elements: readonly DesignElement[],
  journeyId: ElementId,
  order: readonly ElementId[] = [],
): Journey {
  const phases = childrenOf(elements, journeyId)
  const stepsByPhase = new Map(phases.map((phase) => [phase.id, childrenOf(elements, phase.id)]))

  const named = order.filter((id, index) => order.indexOf(id) === index)
  const rest: ElementId[] = []
  for (const phase of phases) {
    for (const step of stepsByPhase.get(phase.id) ?? []) {
      const lane = step.lane
      if (lane !== undefined && !named.includes(lane) && !rest.includes(lane)) rest.push(lane)
    }
  }

  return {
    phases,
    lanes: [undefined, ...named, ...rest].map((actorId) =>
      laneOf(actorId, phases, stepsByPhase)),
  }
}

function laneOf(
  actorId: ElementId | undefined,
  phases: readonly DesignElement[],
  stepsByPhase: Map<ElementId, DesignElement[]>,
): Lane {
  const own = phases.map((phase) =>
    (stepsByPhase.get(phase.id) ?? []).filter((step) => step.lane === actorId))
  const busy = own.map((steps) => steps.length > 0)
  const first = busy.indexOf(true)
  const last = busy.lastIndexOf(true)

  return {
    ...(actorId !== undefined ? { actorId } : {}),
    ...(first === -1 ? {} : { fork: phases[first].id, join: phases[last].id }),
    cells: phases.map((phase, index) => ({
      phaseId: phase.id,
      steps: own[index],
      passThrough: first !== -1 && index > first && index < last && !busy[index],
    })),
  }
}

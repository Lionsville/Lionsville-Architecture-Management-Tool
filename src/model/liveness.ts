// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Whether a thing, or a line, is there on a day — said once (ADR-0009,
 * ADR-0010, ADR-0013).
 *
 * The same question used to be answered in six places — the checks, the
 * container diagram, the enterprise map, the technology overlay and the
 * service report — and each had its own half of the answer: one knew that a
 * landing follows its interface, another that a container goes with its
 * application, a third neither. A board and a finding disagreeing about one
 * row is a reader told two things, so the rules live here and every reader
 * asks.
 *
 * ## The rules
 *
 * - **`validUntil` is the last day a line is there; `lifecycleDates.retired`
 *   is the first day an element is gone** (`lifecycle.relationLiveAt`,
 *   `lifecycle.phaseAt`). A line valid until the day an end retires is
 *   therefore there on a day that end is gone, which is the contradiction
 *   `lineOutlivesEnd` reports and not a same-day handover.
 * - **A line's window is its own `validFrom` / `validUntil`.** A line with
 *   neither that refines an application interface (ADR-0013, redone) takes the
 *   interface's: dating the application line dates every landing on it, and a
 *   landing with a window of its own keeps it.
 * - **An element is gone on a day when it is retired that day** — its phase on
 *   that day is `retired` — **or it is a component whose parent application is
 *   retired that day.** A container is part of its application and goes with
 *   it, whatever it says about itself.
 * - **A line is there on a day when its window holds that day and neither end
 *   is gone.**
 * - **A stand-in carries no dates of its own** (ADR-0012 §2, §3; `standIn.ts`):
 *   its dates are the scope's that defines it, and they arrive through
 *   {@link DatesElsewhere} from the index by way of the host. An id this model
 *   does not hold at all is judged the same way, and with nobody to say
 *   otherwise it is not gone: a row into another scope is still a row.
 *
 * What a board draws is a narrower statement than what is gone, and stays the
 * board's: a card whose stored phase is `retired` with no day is still drawn,
 * dimmed (ADR-0010, `lifecycle.isGoneOn`). That is about a picture, not about
 * whether something depends on it.
 *
 * Pure, and built once per model: a reader over a landscape of thousands asks
 * per row, so the lookups are maps and nothing here walks a list per question.
 */
import { isDay, phaseAt } from './lifecycle'
import type { DesignElement, ElementId, Relation } from './types'

/**
 * What the scope that defines a thing says about its dates, where this model
 * holds only a stand-in of it or does not hold it at all (ADR-0012 §3). The
 * index knows, and the host hands it over; absent, a stand-in has no dates.
 */
export type DatesElsewhere = {
  /** The day the defining scope says this id is gone, `yyyy-mm-dd`. */
  retiredOf?(id: ElementId): string | undefined
}

/** A line's window: the two days that bound it, either of which may be absent. */
export type Window = Pick<Relation, 'validFrom' | 'validUntil'>

export type Liveness = {
  /** The days this line is there by its own say, or its interface's (see the rules above). */
  windowOf(relation: Relation): Window
  /** Whether this line's window holds this day. Says nothing about its ends. */
  windowHolds(relation: Relation, day: string): boolean
  /** Whether this id is gone on this day, itself or — a container — with its application. */
  goneOn(id: ElementId, day: string): boolean
  /**
   * The first day this id is gone by a date: its own retirement or, for a
   * container, its application's, whichever is earlier. Absent where no date
   * says so — including a thing stored as retired with no day, which is gone
   * on every day and has no first one.
   */
  goneFrom(id: ElementId): string | undefined
  /** Whether this line is there on this day: its window holds it and neither end is gone. */
  thereOn(relation: Relation, day: string): boolean
  /**
   * The end this line's window outlives, if any: an end whose first day gone
   * falls inside the window. Only a window that says when it ends can outlive
   * anything — one with no end follows its ends by the rules above.
   */
  outlivedEnd(relation: Relation): ElementId | undefined
}

/** The rules, over one model. */
export function livenessOf(
  model: { elements: readonly DesignElement[]; relations: readonly Relation[] },
  elsewhere: DatesElsewhere = {},
): Liveness {
  const byId = new Map(model.elements.map((element) => [element.id, element]))
  const relationById = new Map(model.relations.map((relation) => [relation.id, relation]))

  const windowOf = (relation: Relation): Window => {
    if (isDay(relation.validFrom) || isDay(relation.validUntil) || relation.refines === undefined) return relation
    return relationById.get(relation.refines) ?? relation
  }
  const holds = (window: Window, day: string) => (
    !(isDay(window.validFrom) && day < window.validFrom) && !(isDay(window.validUntil) && day > window.validUntil)
  )
  // A definition's dates are its own; a stand-in's and a stranger's are the
  // defining scope's, when anybody has told us.
  const ownDay = (id: ElementId): string | undefined => {
    const held = byId.get(id)
    const day = held !== undefined && held.ref === undefined ? held.lifecycleDates?.retired : elsewhere.retiredOf?.(id)
    return isDay(day) ? day : undefined
  }
  const ownGone = (id: ElementId, day: string): boolean => {
    const held = byId.get(id)
    if (held !== undefined && held.ref === undefined) return phaseAt(held, day) === 'retired'
    const gone = ownDay(id)
    return gone !== undefined && day >= gone
  }
  const applicationOf = (id: ElementId): ElementId | undefined => {
    const held = byId.get(id)
    return held?.kind === 'component' ? held.parentId : undefined
  }
  const goneOn = (id: ElementId, day: string): boolean => {
    if (ownGone(id, day)) return true
    const application = applicationOf(id)
    return application !== undefined && ownGone(application, day)
  }
  const goneFrom = (id: ElementId): string | undefined => {
    const application = applicationOf(id)
    const days = [ownDay(id), application !== undefined ? ownDay(application) : undefined]
      .filter((day): day is string => day !== undefined)
    return days.length ? days.reduce((a, b) => (b < a ? b : a)) : undefined
  }

  return {
    windowOf,
    windowHolds: (relation, day) => holds(windowOf(relation), day),
    goneOn,
    goneFrom,
    thereOn: (relation, day) => holds(windowOf(relation), day)
      && !goneOn(relation.sourceId, day) && !goneOn(relation.targetId, day),
    outlivedEnd: (relation) => {
      const window = windowOf(relation)
      if (!isDay(window.validUntil)) return undefined
      return [relation.sourceId, relation.targetId].find((id) => {
        const gone = goneFrom(id)
        if (gone === undefined) return false
        // The first day of the window on which this end is gone.
        const first = isDay(window.validFrom) && window.validFrom > gone ? window.validFrom : gone
        return holds(window, first)
      })
    },
  }
}

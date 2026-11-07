// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The landscape on an axis (ADR-0009).
 *
 * One row per thing that has a date, each row a run of coloured spans saying
 * which phase it is in when — and the plans underneath as bands with their
 * milestones on them. This file works all of that out in **days**, not pixels:
 * where a span starts is a date, and turning a date into a position is the
 * page's business, which is what lets the whole thing be tested in node.
 *
 * Only what has a date appears. A landscape of four thousand elements with nine
 * dates in it is a roadmap with a handful of rows, which is the roadmap
 * somebody wanted — the rest of the landscape is on the canvas, where it
 * belongs.
 */
import { daysBetween, isDay, LIFECYCLE_ORDER, phaseAt } from '../model/lifecycle'
import { elementsWithRole, transitionDays } from '../model/transition'
import type { Transition } from '../model/transition'
import type { DesignElement, DesignModel, Lifecycle, Relation } from '../model/types'

/** One stretch of one phase. `to` absent means "and onwards". */
export type PhaseSpan = {
  phase: Lifecycle
  from: string
  /** The day the next phase starts; absent on the last span. */
  to?: string
}

export type ElementTrack = {
  element: DesignElement
  spans: PhaseSpan[]
  /**
   * Present on a row that another scope's initiative brought here (ADR-0012
   * §7): which scope holds the element, and which of its plans named it. The
   * element is drawn as that scope has it, and opened there.
   */
  below?: { scope: string; planId: string }
}

/**
 * A plan a scope below filed and flagged, with the elements it names as that
 * scope holds them — what the index hands a roadmap above, so the applications
 * an initiative changes can be plotted beside this scope's own.
 */
export type InitiativeBelow = {
  scope: string
  plan: Transition
  elements: readonly DesignElement[]
}

/**
 * One relation that says something about time (ADR-0012 §5).
 *
 * A window on a row, whatever the row means: the temporary sync of a hybrid
 * run, and "the WMS supports fulfilment from March" alike. The two ends are
 * carried by name because that is the whole of the row's label and the page
 * has no other way to look them up in days.
 *
 * Either end of the window may be absent, and absent means the axis's own —
 * an interface that opens in March and is never dated shut is drawn to the
 * edge of the page, which is what "and onwards" looks like.
 */
export type RelationTrack = {
  relation: Relation
  sourceName: string
  targetName: string
}

export type Roadmap = {
  /** The window the axis covers, inclusive. */
  from: string
  to: string
  tracks: ElementTrack[]
  /** The relations with a window of their own, first day first. */
  relations: RelationTrack[]
  transitions: Transition[]
}

/**
 * The phases this element passes through, as spans.
 *
 * Built by walking the phases in order and asking when each one begins, so a
 * skipped phase — an application dated straight from live to retired — produces
 * no empty span for the one it skipped.
 */
export function spansFor(element: DesignElement, windowFrom: string): PhaseSpan[] {
  const dates = element.lifecycleDates
  const starts: { phase: Lifecycle; from: string }[] = []
  // Where it begins: the stored phase, from the start of the window, unless a
  // date names that same phase later.
  const firstDated = LIFECYCLE_ORDER
    .map((phase) => ({ phase, day: phase === 'planned' ? undefined : dates?.[phase] }))
    .filter((one) => isDay(one.day))
  const opening = phaseAt(element, windowFrom)
  starts.push({ phase: opening, from: windowFrom })
  for (const one of firstDated) {
    if (one.day! <= windowFrom) continue
    starts.push({ phase: one.phase, from: one.day! })
  }
  // A phase that begins on the same day as the next one is a cutover, not a
  // span: keep the later of the two, which is where the element actually is.
  // And a phase that begins again where it already was is not a new span — an
  // element stored as `retiring` with a `retiring` date would otherwise draw
  // the same colour twice with a seam down the middle.
  const kept = starts.filter((one, at) => (
    (at === starts.length - 1 || one.from !== starts[at + 1].from)
    && (at === 0 || one.phase !== starts[at - 1].phase)
  ))
  return kept.map((one, at) => ({
    phase: one.phase,
    from: one.from,
    ...(kept[at + 1] ? { to: kept[at + 1].from } : {}),
  }))
}

/**
 * The window the axis covers.
 *
 * Everything the model has an opinion about, plus today, plus a month of air at
 * each end so the first and last marks are not against the frame. A model with
 * no dates at all gets a year around today, so the page has an axis to draw
 * rather than a degenerate one.
 */
export function rangeOf(days: readonly string[], today: string): { from: string; to: string } {
  const all = [...days.filter(isDay), today].sort()
  const first = all[0] ?? today
  const last = all[all.length - 1] ?? today
  if (daysBetween(first, last) < 60) {
    return { from: monthsFrom(today, -6), to: monthsFrom(today, 6) }
  }
  return { from: monthsFrom(first, -1), to: monthsFrom(last, 1) }
}

/** A day, some whole months away. UTC, for the reason every day here is. */
export function monthsFrom(day: string, months: number): string {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1 + months, date)).toISOString().slice(0, 10)
}

/** The days an element's lifecycle names, for the axis to cover. */
function elementDays(element: DesignElement): string[] {
  return LIFECYCLE_ORDER
    .map((phase) => (phase === 'planned' ? undefined : element.lifecycleDates?.[phase]))
    .filter(isDay)
}

/**
 * The roadmap for a model: the rows that have something to say, oldest first.
 *
 * Ordered by when each one's first dated thing happens, so a reader goes down
 * the page and forwards in time.
 *
 * The initiatives of the scopes below are taken in as well: the axis reaches
 * their windows, and the dated elements they name get a row each beside this
 * scope's own, marked with where they came from. One row per id — an element
 * this scope already tracks is this scope's row, and one named by two plans
 * below is the first plan's — because an id means one thing across the tree
 * (ADR-0012 §2) and two rows for it would say otherwise. The plans themselves
 * are not in `transitions`: they are drawn under their scope's name, and
 * edited there.
 */
export function roadmapOf(
  model: Pick<DesignModel, 'elements' | 'relations'> & { transitions?: Transition[] },
  today: string,
  fromBelow: readonly InitiativeBelow[] = [],
): Roadmap {
  const transitions = model.transitions ?? []
  const dated = model.elements.filter((element) => elementDays(element).length > 0)
  const windowed = model.relations.filter(hasWindow)

  const tracked = new Set(dated.map((element) => element.id))
  const brought: { element: DesignElement; below: { scope: string; planId: string } }[] = []
  for (const { scope, plan, elements } of fromBelow) {
    for (const element of elements) {
      if (tracked.has(element.id) || elementDays(element).length === 0) continue
      tracked.add(element.id)
      brought.push({ element, below: { scope, planId: plan.id } })
    }
  }

  const days = [
    ...dated.flatMap(elementDays),
    ...brought.flatMap(({ element }) => elementDays(element)),
    ...windowed.flatMap((relation) => [relation.validFrom, relation.validUntil].filter(isDay)),
    ...transitions.flatMap(transitionDays),
    ...fromBelow.flatMap(({ plan }) => transitionDays(plan)),
  ]
  const { from, to } = rangeOf(days, today)

  const tracks = [
    ...dated.map((element) => ({ element, spans: spansFor(element, from) })),
    ...brought.map(({ element, below }) => ({ element, spans: spansFor(element, from), below })),
  ].sort((a, b) => firstMark(a).localeCompare(firstMark(b)) || a.element.name.localeCompare(b.element.name))

  const named = new Map(model.elements.map((element) => [element.id, element.name]))
  const relations = windowed
    .map((relation) => ({
      relation,
      // A dangling end keeps its id rather than going blank: a row that says
      // nothing is worse than one that says which id nobody holds.
      sourceName: named.get(relation.sourceId) ?? relation.sourceId,
      targetName: named.get(relation.targetId) ?? relation.targetId,
    }))
    .sort((a, b) => opensAt(a.relation).localeCompare(opensAt(b.relation))
      || a.relation.id.localeCompare(b.relation.id))

  return { from, to, tracks, relations, transitions }
}

/** Whether this row says anything about time at all. */
function hasWindow(relation: Relation): boolean {
  return isDay(relation.validFrom) || isDay(relation.validUntil)
}

/** The first day a row has an opinion about, for ordering. */
function opensAt(relation: Relation): string {
  return isDay(relation.validFrom) ? relation.validFrom! : relation.validUntil!
}

/** The first day a track actually changes, for ordering. */
function firstMark(track: ElementTrack): string {
  return track.spans[1]?.from ?? track.spans[0]?.from ?? ''
}

/**
 * The shadow run of a plan: from the day the first thing it introduces is
 * live to the day the first thing it retires is gone — the stretch where
 * both are there and the new one taps the old (ADR-0010). Read off the
 * elements' own dates, so it moves when they do; absent when the plan is not
 * a replacement or the dates do not make one.
 */
export function shadowRunOf(
  model: Pick<DesignModel, 'elements'>,
  plan: Transition,
): { from: string; to: string } | undefined {
  const byId = new Map(model.elements.map((element) => [element.id, element]))
  const days = (ids: string[], phase: 'live' | 'retired') => ids
    .map((id) => byId.get(id)?.lifecycleDates?.[phase])
    .filter(isDay)
    .sort()
  const from = days(elementsWithRole(plan, 'introduces'), 'live')[0]
  const to = days(elementsWithRole(plan, 'retires'), 'retired')[0]
  return from !== undefined && to !== undefined && from < to ? { from, to } : undefined
}

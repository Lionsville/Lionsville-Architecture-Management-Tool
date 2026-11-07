// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The questions a reader comes to the decisions page with, answered from the
 * status: is it still open, in force, or over? A list ordered by what a record
 * is about answers the question least asked, so what it is about is a filter
 * and these three are the groups.
 *
 * And where a record stands on its way, and which moves it has, in the order
 * they are offered: one verb first, because a row of equal *Move to* buttons
 * makes a person work out which comes next.
 *
 * Pure, and no words: the page says them.
 */
import type { Step } from '../widgets/kit/NextStep'
import type { StringKey } from '../i18n'
import { adrMovesFrom } from '../model/adr'
import type { Adr, AdrStatus } from '../model/adr'

export type AdrStanding = 'open' | 'inForce' | 'ended'

/** The order the groups are read in: what still wants something first. */
export const STANDINGS: readonly AdrStanding[] = ['open', 'inForce', 'ended']

export const STANDING_LABEL: Record<AdrStanding, StringKey> = {
  open: 'adr.groupOpen',
  inForce: 'adr.groupInForce',
  ended: 'adr.groupEnded',
}

export function standingOf(status: AdrStatus): AdrStanding {
  if (status === 'accepted') return 'inForce'
  return status === 'proposed' || status === 'reviewing' ? 'open' : 'ended'
}

/** What the filter calls a record about the scope itself; no element's id has this shape. */
export const ABOUT_THE_SCOPE = ':scope'

/** What a record is about, as the About filter reads it. */
export function aboutOf(adr: Pick<Adr, 'subjectId'>): string {
  return adr.subjectId ?? ABOUT_THE_SCOPE
}

export type AboutGroup = 'scope' | 'withRecords' | 'none' | 'removed'

export type AboutOption = {
  readonly value: string
  readonly group: AboutGroup
  /** The element's name; a subject that left the model has only its id. */
  readonly name?: string
  readonly count: number
}

/**
 * Every place a record here can be about: the scope, the subjects that have
 * records, every other application, and those that have left the model, which
 * stay because a record about them is history and hiding it would be losing it
 * quietly. `subjects` is in the order to show, an application named or anything
 * else that holds a record.
 */
export function aboutOptions(
  records: readonly Pick<Adr, 'subjectId'>[],
  subjects: readonly { id: string; name: string }[],
): readonly AboutOption[] {
  const counts = new Map<string, number>()
  for (const adr of records) counts.set(aboutOf(adr), (counts.get(aboutOf(adr)) ?? 0) + 1)
  const known = new Set(subjects.map((one) => one.id))
  const named = (group: AboutGroup, list: readonly { id: string; name: string }[]) => list.map((one) => ({
    value: one.id, group, name: one.name, count: counts.get(one.id) ?? 0,
  }))
  return [
    { value: ABOUT_THE_SCOPE, group: 'scope', count: counts.get(ABOUT_THE_SCOPE) ?? 0 },
    ...named('withRecords', subjects.filter((one) => counts.has(one.id))),
    ...named('none', subjects.filter((one) => !counts.has(one.id))),
    ...[...counts].filter(([id]) => id !== ABOUT_THE_SCOPE && !known.has(id))
      .map(([id, count]) => ({ value: id, group: 'removed' as const, count })),
  ]
}

/**
 * The stepper: *Proposed → Under review → Accepted or rejected*, until the record
 * has gone one way, and then the way it went. A record superseded was accepted,
 * so that is a step it did; a rejected one may have been withdrawn before review,
 * which the stepper does not pretend to know, as nothing keeps it.
 */
export function stepsOf(status: AdrStatus, say: (key: StringKey) => string): readonly Step[] {
  const step = (id: string, key: StringKey, state: Step['state']): Step => ({ id, label: say(key), state })
  const proposed = step('proposed', 'adr.statusProposed', status === 'proposed' ? 'current' : 'done')
  const reviewing = step('reviewing', 'adr.statusReviewing', status === 'proposed' ? 'todo' : status === 'reviewing' ? 'current' : 'done')
  if (status === 'proposed' || status === 'reviewing') return [proposed, reviewing, step('verdict', 'adr.stepVerdict', 'todo')]
  if (status === 'rejected') return [proposed, reviewing, step('rejected', 'adr.statusRejected', 'current')]
  if (status === 'accepted') return [proposed, reviewing, step('accepted', 'adr.statusAccepted', 'current')]
  return [proposed, reviewing, step('accepted', 'adr.statusAccepted', 'done'), step('superseded', 'adr.statusSuperseded', 'current')]
}

export type AdrMove = {
  readonly to: AdrStatus
  /** What pressing it is called: the outcome, so never a status. */
  readonly label: StringKey
  /** The one thing that happens next, of which a record has one at most. */
  readonly primary?: boolean
  /** Out of the way under More: it ends a record people came to read, or it goes back. */
  readonly more?: boolean
}

const VERB: Record<AdrStatus, Partial<Record<AdrStatus, Omit<AdrMove, 'to'>>>> = {
  proposed: {
    reviewing: { label: 'adr.verbReview', primary: true },
    rejected: { label: 'adr.verbWithdraw', more: true },
  },
  reviewing: {
    accepted: { label: 'adr.verbAccept', primary: true },
    rejected: { label: 'adr.verbReject' },
    proposed: { label: 'adr.verbSendBack', more: true },
  },
  accepted: { superseded: { label: 'adr.verbSupersede', more: true } },
  rejected: {},
  superseded: {},
}

/** Every move the status machine allows from here, as it is offered: a move with no verb would be a move lost, so the table is read over the machine. */
export function movesOf(status: AdrStatus): readonly AdrMove[] {
  return adrMovesFrom(status).map((to) => ({ to, ...(VERB[status][to] ?? { label: 'adr.moveTo', more: true }) }))
}

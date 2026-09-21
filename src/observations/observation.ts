/**
 * The rules for observations and causes (ADR-0021): numbering, what a new one
 * starts as, seeing one again, sharing it upward, folding two into one, and
 * the links from a cause to what it explains.
 *
 * Pure, and over lists: the page and the agent hand a list in and take a list
 * out, and the caller commits the difference. The shapes are `model/
 * observation.ts`, re-exported here so a caller never sees the split.
 *
 * ## Two records, one graph
 *
 * An observation is what was seen; a cause is what the team says lies behind
 * it. The link is on the cause — `explains` names observations and shallower
 * causes — because that is the direction analysis runs: a cause is written to
 * explain something, and an observation knows nothing about why. A cause
 * nobody explains is a **root cause**, derived and never stored, so that
 * finding what lies behind a root is one link and not a flag to remember.
 *
 * ## Merging is history, not deletion
 *
 * Two observations judged to be the same thing become one by the second being
 * **absorbed** into the first: its sightings move over, the links to it move
 * over, and both records say so in their dated history. The absorbed record
 * stays — it is where the original wording and evidence are — and is read as
 * merged because the survivor says it absorbed it. An observation shared from
 * a scope below is absorbed the same way; only the survivor is written,
 * because a record is edited where it lives, and the scope below reads that
 * its observation went into one above from the tree (`scopeIndex.absorbedFrom`).
 *
 * ## Archiving is history too
 *
 * An observation that was fixed, addressed or has stopped mattering is
 * **archived**: it stays in the list and in the folder, says so in its dated
 * history, and is no longer live — not drawn, not queued, not offered as a
 * merge target. Restoring it is the same verb the other way. Nothing is
 * deleted to close an observation; deleting is for a record that should
 * never have been one.
 *
 * ## Sharing goes up, and only when said
 *
 * `shared` is the one bit a scope sets to offer an observation to the scopes
 * above it. Every ancestor then reads it, may link it to a cause of its own
 * and may absorb it. Nothing flows down: what the enterprise observes is the
 * enterprise's, and a domain reads its own.
 */
import type { Translate } from '../i18n/strings'
import type {
  Cause, CauseLink, CauseState, CauseStrength, Observation, ObservationEvent, ObservationImpact,
} from '../model/observation'

export type {
  Cause, CauseLink, CauseState, CauseStrength, Observation, ObservationEvent, ObservationEventKind,
  ObservationImpact,
} from '../model/observation'
export { CAUSE_STATES, CAUSE_STRENGTHS, OBSERVATION_IMPACTS } from '../model/observation'

/** A scope's observations and causes together: what every operation that touches both takes. */
export type Analysis = {
  observations: Observation[]
  causes: Cause[]
}

/** One observation a scope below shared (ADR-0021), as this scope reads it. */
export type SharedObservation = {
  /** The scope it lives in; a plain string because this module may not import `projects`. */
  scope: string
  observation: Observation
}

// --- numbers and labels ----------------------------------------------------------

function pad(number: number): string {
  return String(Math.max(0, Math.trunc(number))).padStart(4, '0')
}

/** `OB-0007`, which is what people say out loud. */
export function formatObservationNumber(number: number): string {
  return `OB-${pad(number)}`
}

/** `CA-0003`. */
export function formatCauseNumber(number: number): string {
  return `CA-${pad(number)}`
}

/** The next number for a scope's observations. Sequential, and never reused. */
export function nextObservationNumber(list: readonly Observation[]): number {
  return list.reduce((highest, one) => Math.max(highest, one.number), 0) + 1
}

export function nextCauseNumber(list: readonly Cause[]): number {
  return list.reduce((highest, one) => Math.max(highest, one.number), 0) + 1
}

/** Newest first: the highest number, which is the last thing the team wrote down. */
export function sortObservations(list: readonly Observation[]): Observation[] {
  return [...list].sort((a, b) => b.number - a.number)
}

export function sortCauses(list: readonly Cause[]): Cause[] {
  return [...list].sort((a, b) => b.number - a.number)
}

// --- new records -------------------------------------------------------------------

/** What a new observation's body starts as: the three questions a sighting answers. */
export function observationTemplate(t: Translate): string {
  return `## ${t('observation.tplSaw')}\n\n\n## ${t('observation.tplEvidence')}\n\n\n## ${t('observation.tplThoughts')}\n\n`
}

/** What a new cause's body starts as: why the team thinks so, and what verifying it takes. */
export function causeTemplate(t: Translate): string {
  return `## ${t('observation.tplWhy')}\n\n\n## ${t('observation.tplVerify')}\n\n`
}

export function newObservation(args: {
  id: string
  number: number
  title: string
  /** `yyyy-mm-dd`: the day it was seen, which is also the day it is recorded. */
  date: string
  t: Translate
  where?: string
  /** Who saw it. Free text. */
  by?: string
  impact?: ObservationImpact
  shared?: boolean
  body?: string
}): Observation {
  const { id, number, title, date, t } = args
  const where = args.where?.trim()
  const by = args.by?.trim()
  return {
    id,
    number,
    title: title.trim(),
    date,
    ...(where ? { where } : {}),
    ...(by ? { by } : {}),
    impact: args.impact ?? 'minor',
    seen: 1,
    ...(args.shared ? { shared: true as const } : {}),
    body: args.body?.trim() ? args.body : observationTemplate(t),
    history: [
      { date, kind: 'recorded' },
      ...(args.shared ? [{ date, kind: 'shared' as const }] : []),
    ],
  }
}

export function newCause(args: { id: string; number: number; title: string; t: Translate; body?: string }): Cause {
  return {
    id: args.id,
    number: args.number,
    title: args.title.trim(),
    state: 'assumed',
    body: args.body?.trim() ? args.body : causeTemplate(args.t),
    explains: [],
  }
}

// --- one observation -------------------------------------------------------------------

function replace(list: readonly Observation[], id: string, change: (one: Observation) => Observation): Observation[] {
  return list.map((one) => (one.id === id ? change(one) : one))
}

function withEvent(one: Observation, event: ObservationEvent): Observation {
  return { ...one, history: [...one.history, event] }
}

/** The fields a person edits by hand. The count and the history move only through the verbs below. */
export type ObservationPatch = Partial<Pick<Observation, 'title' | 'body' | 'where' | 'by' | 'impact' | 'date'>>

export function updateObservation(list: readonly Observation[], id: string, patch: ObservationPatch): Observation[] {
  return replace(list, id, (one) => {
    const next = { ...one, ...patch }
    if (patch.where !== undefined && !patch.where.trim()) delete next.where
    if (patch.by !== undefined && !patch.by.trim()) delete next.by
    if (patch.title !== undefined) next.title = patch.title.trim()
    return next
  })
}

/** Seen once more, today: the count goes up by one and the day is kept. */
export function seenAgain(list: readonly Observation[], id: string, date: string, note?: string): Observation[] {
  return replace(list, id, (one) => withEvent(
    { ...one, seen: one.seen + 1 },
    { date, kind: 'seen', ...(note?.trim() ? { note: note.trim() } : {}) },
  ))
}

/**
 * Offer an observation to the scopes above, or take it back. Saying what it
 * already is changes nothing, so the history holds the changes of mind and
 * not the confirmations.
 */
export function setShared(list: readonly Observation[], id: string, shared: boolean, date: string): Observation[] {
  return replace(list, id, (one) => {
    if (Boolean(one.shared) === shared) return one
    const next = { ...one }
    if (shared) next.shared = true
    else delete next.shared
    return withEvent(next, { date, kind: shared ? 'shared' : 'unshared' })
  })
}

/**
 * Close an observation without deleting it — fixed, addressed, no longer
 * relevant — or bring it back. Saying what it already is changes nothing;
 * the note, when given, is kept beside the day.
 */
export function setArchived(
  list: readonly Observation[], id: string, archived: boolean, date: string, note?: string,
): Observation[] {
  return replace(list, id, (one) => {
    if (Boolean(one.archived) === archived) return one
    const next = { ...one }
    if (archived) next.archived = true
    else delete next.archived
    return withEvent(next, { date, kind: archived ? 'archived' : 'restored', ...(note?.trim() ? { note: note.trim() } : {}) })
  })
}

export function isArchived(one: Pick<Observation, 'archived'>): boolean {
  return one.archived === true
}

// --- merging --------------------------------------------------------------------------

/** The observation of this scope that absorbed `id` (from `scope`, or from this scope when absent). */
export function absorbedBy(
  list: readonly Observation[], id: string, scope?: string,
): Observation | undefined {
  return list.find((one) => one.history.some((event) => (
    event.kind === 'absorbed' && event.id === id && event.scope === scope
  )))
}

/** Folded into another observation of this scope: history, read but no longer analysed. */
export function isMerged(list: readonly Observation[], id: string): boolean {
  return absorbedBy(list, id) !== undefined
}

/**
 * The observations still standing: everything this scope holds that has not
 * been folded into another and has not been archived. What is analysed,
 * drawn, queued and offered as a merge target.
 */
export function liveObservations(list: readonly Observation[]): Observation[] {
  return list.filter((one) => !isMerged(list, one.id) && !isArchived(one))
}

/**
 * Every link that named `from` now names `to`, and a cause that had both keeps
 * one: the stronger of the two, because a merge should never weaken what the
 * team had already said.
 */
function relink(causes: readonly Cause[], from: Pick<CauseLink, 'id' | 'scope'>, to: string): Cause[] {
  const rank = (strength: CauseStrength) => ({ strong: 3, normal: 2, weak: 1 })[strength]
  return causes.map((cause) => {
    if (!cause.explains.some((link) => link.id === from.id && link.scope === from.scope)) return cause
    const explains: CauseLink[] = []
    for (const link of cause.explains) {
      const moved = link.id === from.id && link.scope === from.scope
        ? { id: to, strength: link.strength }
        : link
      const held = explains.find((one) => one.id === moved.id && one.scope === moved.scope)
      if (!held) explains.push(moved)
      else if (rank(moved.strength) > rank(held.strength)) held.strength = moved.strength
    }
    return { ...cause, explains }
  })
}

/**
 * Two observations of this scope judged to be the same thing become one.
 *
 * `into` keeps standing with the sightings of both; `from` is absorbed — it
 * stays in the list as history, its links move over, and each record says
 * what happened on which day. Refused, by returning the analysis unchanged,
 * when either is missing, when they are the same, or when one of them was
 * merged before: a record that was folded into another is not there to fold.
 */
export function mergeObservations(analysis: Analysis, from: string, into: string, date: string): Analysis {
  const { observations, causes } = analysis
  if (from === into) return analysis
  const absorbed = observations.find((one) => one.id === from)
  const survivor = observations.find((one) => one.id === into)
  if (!absorbed || !survivor) return analysis
  if (isMerged(observations, from) || isMerged(observations, into)) return analysis
  if (isArchived(absorbed) || isArchived(survivor)) return analysis
  return {
    observations: observations.map((one) => {
      if (one.id === into) {
        return withEvent({ ...one, seen: one.seen + absorbed.seen }, { date, kind: 'absorbed', id: from, seen: absorbed.seen })
      }
      if (one.id === from) return withEvent(one, { date, kind: 'merged', id: into })
      return one
    }),
    causes: relink(causes, { id: from }, into),
  }
}

/**
 * An observation a scope below shared is judged to be the same thing as one
 * here. Only this scope's records change: the survivor absorbs the sightings
 * and says which observation of which scope it stands for now; the links
 * that named the shared one move over. The scope below is not written — it
 * reads the absorption off the tree.
 */
export function absorbShared(
  analysis: Analysis, from: SharedObservation, into: string, date: string,
): Analysis {
  const { observations, causes } = analysis
  const survivor = observations.find((one) => one.id === into)
  if (!survivor || isMerged(observations, into) || isArchived(survivor)) return analysis
  if (isArchived(from.observation)) return analysis
  if (absorbedBy(observations, from.observation.id, from.scope)) return analysis
  return {
    observations: replace(observations, into, (one) => withEvent(
      { ...one, seen: one.seen + from.observation.seen },
      { date, kind: 'absorbed', id: from.observation.id, scope: from.scope, seen: from.observation.seen },
    )),
    causes: relink(causes, { id: from.observation.id, scope: from.scope }, into),
  }
}

/** Gone, and every link to it with it. */
export function removeObservation(analysis: Analysis, id: string): Analysis {
  return {
    observations: analysis.observations.filter((one) => one.id !== id),
    causes: analysis.causes.map((cause) => (
      cause.explains.some((link) => link.id === id && link.scope === undefined)
        ? { ...cause, explains: cause.explains.filter((link) => !(link.id === id && link.scope === undefined)) }
        : cause
    )),
  }
}

// --- causes ------------------------------------------------------------------------------

export type CausePatch = Partial<Pick<Cause, 'title' | 'body' | 'state'>>

export function updateCause(list: readonly Cause[], id: string, patch: CausePatch): Cause[] {
  return list.map((one) => {
    if (one.id !== id) return one
    const next = { ...one, ...patch }
    if (patch.title !== undefined) next.title = patch.title.trim()
    return next
  })
}

export function setCauseState(list: readonly Cause[], id: string, state: CauseState): Cause[] {
  return updateCause(list, id, { state })
}

/** The causes that explain this thing: an observation (of this scope, or of `scope` below) or a cause. */
export function explainedBy(list: readonly Cause[], id: string, scope?: string): Cause[] {
  return list.filter((cause) => cause.explains.some((link) => link.id === id && link.scope === scope))
}

/** Does following `explains` from `start` reach `target`? Guarded against a list that already has a loop. */
function reaches(list: readonly Cause[], start: string, target: string): boolean {
  const seen = new Set<string>()
  const stack = [start]
  while (stack.length) {
    const id = stack.pop()!
    if (id === target) return true
    if (seen.has(id)) continue
    seen.add(id)
    const cause = list.find((one) => one.id === id)
    for (const link of cause?.explains ?? []) if (link.scope === undefined) stack.push(link.id)
  }
  return false
}

/**
 * Say that a cause explains something. Linking it to itself, or to a cause
 * that already leads back to it, is refused by returning the list unchanged —
 * a loop is not an explanation. Linking to what it already explains changes
 * the strength and nothing else.
 */
export function linkCause(list: readonly Cause[], causeId: string, link: CauseLink): Cause[] {
  const cause = list.find((one) => one.id === causeId)
  if (!cause) return [...list]
  if (link.scope === undefined && link.id === causeId) return [...list]
  const toCause = link.scope === undefined && list.some((one) => one.id === link.id)
  if (toCause && reaches(list, link.id, causeId)) return [...list]
  const held = cause.explains.find((one) => one.id === link.id && one.scope === link.scope)
  const explains = held
    ? cause.explains.map((one) => (one === held ? { ...one, strength: link.strength } : one))
    : [...cause.explains, { id: link.id, ...(link.scope !== undefined ? { scope: link.scope } : {}), strength: link.strength }]
  return list.map((one) => (one.id === causeId ? { ...one, explains } : one))
}

export function unlinkCause(list: readonly Cause[], causeId: string, id: string, scope?: string): Cause[] {
  return list.map((one) => (
    one.id === causeId
      ? { ...one, explains: one.explains.filter((link) => !(link.id === id && link.scope === scope)) }
      : one
  ))
}

/** Gone, and every link from the other causes to it. */
export function removeCause(analysis: Analysis, id: string): Analysis {
  return {
    observations: analysis.observations,
    causes: analysis.causes
      .filter((one) => one.id !== id)
      .map((cause) => (
        cause.explains.some((link) => link.id === id && link.scope === undefined)
          ? { ...cause, explains: cause.explains.filter((link) => !(link.id === id && link.scope === undefined)) }
          : cause
      )),
  }
}

/**
 * A root cause explains something and is explained by nothing — derived, so
 * that it stops being one the moment a deeper cause is linked to it. A cause
 * linked to nothing at all is not a root; it is a note the team has not
 * placed yet.
 */
export function isRootCause(cause: Cause, list: readonly Cause[]): boolean {
  return cause.explains.length > 0 && explainedBy(list, cause.id).length === 0
}

export function rootCauses(list: readonly Cause[]): Cause[] {
  return list.filter((one) => isRootCause(one, list))
}

/**
 * How far from the observations a cause stands: one for a cause that explains
 * only observations, one more for each cause between. What the picture lays
 * the lanes out by, and what a report reads as "how deep the analysis went".
 */
export function causeDepth(cause: Cause, list: readonly Cause[]): number {
  const memo = new Map<string, number>()
  const depth = (id: string, trail: Set<string>): number => {
    const held = memo.get(id)
    if (held !== undefined) return held
    if (trail.has(id)) return 1
    const one = list.find((c) => c.id === id)
    if (!one) return 0
    trail.add(id)
    let deepest = 0
    for (const link of one.explains) {
      if (link.scope === undefined && list.some((c) => c.id === link.id)) {
        deepest = Math.max(deepest, depth(link.id, trail))
      }
    }
    trail.delete(id)
    const result = deepest + 1
    memo.set(id, result)
    return result
  }
  return depth(cause.id, new Set())
}

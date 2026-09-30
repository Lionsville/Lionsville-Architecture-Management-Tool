// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The rules for observations and causes (ADR-0021, ADR-0032): numbering, what
 * a new one starts as, seeing one again, folding two into one, the links from
 * a cause to what it explains, and which cause is a root.
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
 * explain something, and an observation knows nothing about why.
 *
 * ## A root cause is said
 *
 * A **root cause** is a cause the team said is one (ADR-0032 §3), `RC-` on
 * the cause's own number. It ends the chain: nothing explains it, and a
 * solution addresses it. Becoming one and going back are steps, each refused
 * while the chain says otherwise — made a root while a cause explains it, or
 * made a cause again while a solution addresses it. The refusals carry the
 * one writer's keys, so the page, the agent and the reducer say one rule in
 * one word; the reducer refuses the same two steps whoever sent them.
 *
 * ## Merging is history, not deletion
 *
 * Two observations judged to be the same thing become one by the second being
 * **absorbed** into the first: its sightings move over, the links to it move
 * over, and both records say so in their dated history. The absorbed record
 * stays — it is where the original wording and evidence are — and is read as
 * merged because the survivor says it absorbed it. An observation of a scope
 * below is absorbed the same way; only the survivor is written, because a
 * record is edited where it lives, and the scope below reads that its
 * observation went into one above from the tree (`scopeIndex.absorbedFrom`).
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
 * ## Local and global are places
 *
 * Every scope's analysis is its own, and a scope reads the analysis of every
 * scope below it (ADR-0032 §1): local to that scope, and nothing is shared
 * to get there — who may read a scope is the source's to say, never a field
 * on a record. A cause may explain a cause of a scope below, never the other
 * way and never sideways, and never an observation below: the scope below
 * explains its own observations, and the scope above explains the scope
 * below's causes (§4). The link lives on the explaining cause, and the scope
 * below reads what explains its causes off the tree.
 */
import type { Translate } from '../i18n/strings'
import { isDay } from '../model/lifecycle'
import type {
  Cause, CauseAbove, CauseLink, CauseState, CauseStrength, Observation, ObservationEvent, ObservationImpact,
  ScopeAnalysis, Solution,
} from '../model/observation'
import { DE } from './strings/de'
import { EN } from './strings/en'
import { NL } from './strings/nl'

export type {
  Cause, CauseAbove, CauseLink, CauseState, CauseStrength, Observation, ObservationEvent, ObservationEventKind,
  ObservationImpact, ScopeAnalysis,
} from '../model/observation'
export { CAUSE_STATES, CAUSE_STRENGTHS, OBSERVATION_IMPACTS } from '../model/observation'

/** A scope's observations and causes together: what every operation that touches both takes. */
export type Analysis = {
  observations: Observation[]
  causes: Cause[]
}

/** One observation of a scope below (ADR-0032 §1), as this scope reads it. */
export type ObservationBelow = {
  /** The scope it lives in; a plain string because this module may not import `projects`. */
  scope: string
  observation: Observation
}

/** The observations of the scopes below, one row each, in the order the tree reads them. */
export function observationsBelow(below: readonly ScopeAnalysis[]): ObservationBelow[] {
  return below.flatMap(({ scope, observations }) => observations.map((observation) => ({ scope, observation })))
}

/** Is `scope` strictly below `here`? Paths as strings, `''` the organisation. */
function isBelow(scope: string, here: string): boolean {
  return here === '' ? scope !== '' : scope.startsWith(`${here}/`)
}

/** Is `scope` this one or one above it? */
function isAboveOrHere(scope: string, here: string): boolean {
  return scope === here || scope === '' || here.startsWith(`${scope}/`)
}

// --- numbers and labels ----------------------------------------------------------

function pad(number: number): string {
  return String(Math.max(0, Math.trunc(number))).padStart(4, '0')
}

/** `OB-0007`, which is what people say out loud. */
export function formatObservationNumber(number: number): string {
  return `OB-${pad(number)}`
}

/** `CA-0003`, or `RC-0003` for a root cause: the kind is a prefix on the one number, never a renumbering. */
export function formatCauseNumber(number: number, root?: boolean): string {
  return `${root ? 'RC' : 'CA'}-${pad(number)}`
}

/** A cause's label as people say it: `CA-0003`, or `RC-0003` once it is a root cause. */
export function causeLabel(cause: Pick<Cause, 'number' | 'root'>): string {
  return formatCauseNumber(cause.number, cause.root === true)
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
  return `## ${t('observation.tplSaw')}\n\n\n## ${t('observation.tplEvidence')}\n\n\n## ${t('observation.tplAffected')}\n\n`
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
    body: args.body?.trim() ? args.body : observationTemplate(t),
    history: [{ date, kind: 'recorded' }],
  }
}

/** A new cause, assumed; a root cause as it is made where `root` says so, since nothing explains a new one yet. */
export function newCause(args: { id: string; number: number; title: string; t: Translate; body?: string; root?: boolean }): Cause {
  return {
    id: args.id,
    number: args.number,
    title: args.title.trim(),
    state: 'assumed',
    ...(args.root ? { root: true as const } : {}),
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

/** Why a day cannot be the day an observation was seen again. */
export type SeenDayProblem =
  /** Not `yyyy-mm-dd`. */
  | 'notADay'
  /** After today: nobody has seen it yet. */
  | 'future'
  /** Before the day it was first seen, which would make that day wrong. */
  | 'beforeFirst'

/**
 * What is wrong with `day` as a sighting of this observation, or nothing:
 * not in the future, and not before it was first seen (ADR-0021, amended 28
 * September 2026). The page's dialog and the agent's `observation.seen` ask
 * the same question.
 */
export function seenDayProblem(
  observation: Pick<Observation, 'date'>, day: string, today: string,
): SeenDayProblem | undefined {
  if (!isDay(day)) return 'notADay'
  if (day > today) return 'future'
  if (isDay(observation.date) && day < observation.date) return 'beforeFirst'
  return undefined
}

/** Seen once more, on `date`: the count goes up by one and the day is kept, with the note when there is one. */
export function seenAgain(list: readonly Observation[], id: string, date: string, note?: string): Observation[] {
  return replace(list, id, (one) => withEvent(
    { ...one, seen: one.seen + 1 },
    { date, kind: 'seen', ...(note?.trim() ? { note: note.trim() } : {}) },
  ))
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
 * An observation of a scope below is judged to be the same thing as one
 * here (ADR-0032 §5): nothing has to be shared first. Only this scope's
 * records change: the survivor absorbs the sightings and says which
 * observation of which scope it stands for now; a link from here that named
 * the one below moves over. The scope below is not written — it reads the
 * absorption off the tree.
 */
export function absorbFromBelow(
  analysis: Analysis, from: ObservationBelow, into: string, date: string,
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

/**
 * Change a cause. Its state goes to verified only where {@link causeEvidence}
 * finds the evidence written down, in the body as it will be after this
 * patch; asked without it, the state stays what it was and the rest of the
 * patch lands. {@link verifyCause} is the way to verified with a sentence of
 * evidence said at the time.
 */
export function updateCause(list: readonly Cause[], id: string, patch: CausePatch): Cause[] {
  return list.map((one) => {
    if (one.id !== id) return one
    const next = { ...one, ...patch }
    if (patch.title !== undefined) next.title = patch.title.trim()
    if (patch.state === 'verified' && one.state !== 'verified' && !causeEvidence(next.body).complete) next.state = one.state
    return next
  })
}

export function setCauseState(list: readonly Cause[], id: string, state: CauseState): Cause[] {
  return updateCause(list, id, { state })
}

/**
 * A heading a new cause started with before its wording was mended, still read
 * in the bodies written then: the heading is in the person's text, and a
 * translation corrected later must not make their evidence unreadable.
 */
const FORMER_HEADINGS: Record<'observation.tplWhy' | 'observation.tplVerify', readonly string[]> = {
  'observation.tplWhy': [],
  'observation.tplVerify': ['wie zu verifizieren'],
}

/**
 * Every spelling a body heading has, in every language the tool speaks — read
 * off this module's own string slices rather than the registry, the way the
 * decision template is, so a rule that runs in the agent's process does not
 * load every screen's words to find two headings.
 */
function headingsFor(key: 'observation.tplWhy' | 'observation.tplVerify'): Set<string> {
  return new Set([...[EN, NL, DE].map((table) => table[key].trim().toLowerCase()), ...FORMER_HEADINGS[key]])
}

/**
 * What a cause's body says of its evidence (ADR-0021, amended 28 September
 * 2026): whether the section under *Why we think so* and the one under *How
 * to verify* — the two headings a new cause starts with, in any language the
 * tool speaks — have something written in them. `complete` is both, and is
 * what verifying asks for: a cause is verified by what the team checked, and
 * a body that says nothing has nothing checked.
 */
export function causeEvidence(body: string): { why: boolean; verify: boolean; complete: boolean } {
  const why = headingsFor('observation.tplWhy')
  const verify = headingsFor('observation.tplVerify')
  let section: 'why' | 'verify' | undefined
  const filled = { why: false, verify: false }
  for (const line of body.split('\n')) {
    const heading = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line)
    if (heading) {
      const text = heading[1].trim().toLowerCase()
      section = why.has(text) ? 'why' : verify.has(text) ? 'verify' : undefined
      continue
    }
    if (section && line.trim()) filled[section] = true
  }
  return { ...filled, complete: filled.why && filled.verify }
}

/**
 * The body with `confirmed` added under *How to verify*, dated: the answer to
 * "what confirmed it?" kept where the next reader looks for it. The section
 * is found in any language and made, in `t`'s, where the body has none.
 */
export function withConfirmation(body: string, confirmed: string, date: string, t: Translate): string {
  return underHeading(body, 'observation.tplVerify', `${date}: ${confirmed.trim()}`, t)
}

/**
 * The body with `why` written under *Why we think so* (ADR-0032 §6): what a
 * cause's form asks in a line of its own, kept where the next reader, and
 * verifying, look for it. Nothing to say leaves the body as it was.
 */
export function withReason(body: string, why: string, t: Translate): string {
  return why.trim() ? underHeading(body, 'observation.tplWhy', why.trim(), t) : body
}

/**
 * `line` after whatever the section under that heading already says — the
 * heading found in any language the tool speaks, and made, in `t`'s, at the
 * end where the body has none.
 */
function underHeading(body: string, key: 'observation.tplWhy' | 'observation.tplVerify', line: string, t: Translate): string {
  const spellings = headingsFor(key)
  const lines = body.split('\n')
  const at = lines.findIndex((one) => {
    const heading = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(one)
    return heading !== null && spellings.has(heading[1].trim().toLowerCase())
  })
  if (at < 0) return `${body.trimEnd()}${body.trim() ? '\n\n' : ''}## ${t(key)}\n\n${line}\n`
  let end = lines.findIndex((one, index) => index > at && /^#{1,6}\s/.test(one))
  if (end < 0) end = lines.length
  // After the last line with anything on it, so the answer follows what is there.
  let last = end - 1
  while (last > at && !lines[last].trim()) last -= 1
  const before = lines.slice(0, last + 1)
  const after = lines.slice(end)
  return [...before, '', line, ...(after.length ? ['', ...after] : [''])].join('\n')
}

/**
 * Mark a cause verified. Where the body already says why the team thinks so
 * and how it was verified, that is the evidence; otherwise `confirmed` — what
 * confirmed it, said now — is added under *How to verify* with the day, and
 * is. Refused, by returning the list unchanged, with neither: verified is a
 * claim about evidence, and the record is where the evidence goes.
 */
export function verifyCause(
  list: readonly Cause[], id: string, args: { date: string; t: Translate; confirmed?: string },
): Cause[] {
  return list.map((one) => {
    if (one.id !== id || one.state === 'verified') return one
    if (causeEvidence(one.body).complete) return { ...one, state: 'verified' }
    if (!args.confirmed?.trim()) return one
    return { ...one, state: 'verified', body: withConfirmation(one.body, args.confirmed, args.date, args.t) }
  })
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
 * Why a cause may not explain this, or nothing where it may:
 *
 * - `self` — a cause does not explain itself;
 * - `loop` — the other cause already leads back to this one, and a loop is
 *   not an explanation;
 * - `root` — the other is a root cause, here or below, and nothing explains a
 *   root cause (ADR-0032 §3). To say something lies behind it, make it a
 *   cause first;
 * - `upward` — the other lives in a scope above this one, or in this one
 *   named as if it were elsewhere: a cause explains down the tree (§4);
 * - `sideways` — the other lives in a scope that is not below this one;
 * - `observationBelow` — the other is an observation of a scope below: that
 *   scope explains its own observations, and this one explains its causes;
 * - `unknown` — the scope below holds no such record, or the tree was not
 *   given to ask.
 *
 * A link the cause already has is only ever a change of strength, so it is
 * not asked again: what was linked before a rule existed stays linked.
 */
export type LinkRefusal = 'self' | 'loop' | 'root' | 'upward' | 'sideways' | 'observationBelow' | 'unknown'

/** Where the cause doing the explaining lives, and what the tree holds below it. */
export type LinkContext = {
  /** The path of the scope the explaining cause lives in. */
  here: string
  below: readonly ScopeAnalysis[]
}

export function linkRefusal(
  list: readonly Cause[], causeId: string, link: Omit<CauseLink, 'strength'>, context?: LinkContext,
): LinkRefusal | undefined {
  const cause = list.find((one) => one.id === causeId)
  if (cause?.explains.some((one) => one.id === link.id && one.scope === link.scope)) return undefined
  if (link.scope !== undefined) return belowRefusal(link as CauseLink, context)
  if (link.id === causeId) return 'self'
  const target = list.find((one) => one.id === link.id)
  if (!target) return undefined
  if (isRootCause(target)) return 'root'
  return reaches(list, link.id, causeId) ? 'loop' : undefined
}

/** A new link to a record of another scope: a non-root cause strictly below, or refused. */
function belowRefusal(link: CauseLink, context: LinkContext | undefined): LinkRefusal | undefined {
  const scope = link.scope!
  if (!context) return 'unknown'
  if (isAboveOrHere(scope, context.here)) return 'upward'
  if (!isBelow(scope, context.here)) return 'sideways'
  const held = context.below.find((one) => one.scope === scope)
  if (held?.observations.some((one) => one.id === link.id)) return 'observationBelow'
  const target = held?.causes.find((one) => one.id === link.id)
  if (!target) return 'unknown'
  return isRootCause(target) ? 'root' : undefined
}

/**
 * Say that a cause explains something. Where {@link linkRefusal} says no,
 * refused by returning the list unchanged. Linking to what it already
 * explains changes the strength and nothing else.
 */
export function linkCause(list: readonly Cause[], causeId: string, link: CauseLink, context?: LinkContext): Cause[] {
  const cause = list.find((one) => one.id === causeId)
  if (!cause || linkRefusal(list, causeId, link, context)) return [...list]
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
 * A root cause is one the team said is (ADR-0032 §3). Read off the record,
 * never off the links: a link that changes does not change who is a root.
 */
export function isRootCause(cause: Pick<Cause, 'root'>): boolean {
  return cause.root === true
}

export function rootCauses(list: readonly Cause[]): Cause[] {
  return list.filter(isRootCause)
}

/** What stands in the way of a cause becoming a root cause, or going back (ADR-0032 §3). */
export type RootChangeRefusal =
  /** Made a root cause while causes explain it: `causes` are this scope's, `above` those of the scopes above. */
  | { refusal: 'command.rootExplained'; causes: Cause[]; above: CauseAbove[] }
  /** Made a cause again while solutions address it: `solutions` are those. */
  | { refusal: 'command.rootAddressed'; solutions: Pick<Solution, 'id' | 'number' | 'title'>[] }

export type RootChange = { ok: true; causes: Cause[] } | ({ ok: false } & RootChangeRefusal)

/**
 * Say that a cause is a root cause. Refused while a cause explains it — of
 * this scope, or of a scope above (`above`, off the tree) — with those
 * causes: unlink them, or make that one the root cause instead. Saying what
 * it already is changes nothing.
 */
export function makeRootCause(list: readonly Cause[], id: string, above: readonly CauseAbove[] = []): RootChange {
  const cause = list.find((one) => one.id === id)
  if (!cause || isRootCause(cause)) return { ok: true, causes: [...list] }
  const by = explainedBy(list, id)
  if (by.length || above.length) return { ok: false, refusal: 'command.rootExplained', causes: by, above: [...above] }
  return { ok: true, causes: list.map((one) => (one.id === id ? { ...one, root: true as const } : one)) }
}

/**
 * Say that a root cause is a cause after all. Refused while a solution
 * addresses it — any solution, a dropped one too, because the link is there
 * and a solution addresses root causes only (ADR-0026): move it to another
 * root cause, or unlink it, first.
 */
export function makeCause(
  list: readonly Cause[], id: string,
  solutions: readonly (Pick<Solution, 'id' | 'number' | 'title'> & { addresses: readonly { id: string }[] })[],
): RootChange {
  const cause = list.find((one) => one.id === id)
  if (!cause || !isRootCause(cause)) return { ok: true, causes: [...list] }
  const by = solutions.filter((one) => one.addresses.some((address) => address.id === id))
  if (by.length) {
    return { ok: false, refusal: 'command.rootAddressed', solutions: by.map(({ id: key, number, title }) => ({ id: key, number, title })) }
  }
  return {
    ok: true,
    causes: list.map((one) => {
      if (one.id !== id) return one
      const { root: _root, ...rest } = one
      void _root
      return rest
    }),
  }
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

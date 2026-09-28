// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Architecture decision records: what one is, where it may go next, and what
 * may still be changed once it has got there.
 *
 * A record follows MADR — the body is markdown in that shape, started from a
 * template — with two additions the format leaves to convention. The **status**
 * is a small state machine rather than a free field: a decision is proposed,
 * then under review, then accepted or rejected, and an accepted one can later
 * be superseded by another. Acceptance and rejection are the point of no
 * return: from there the text is a record of what was decided, and a record
 * that can be edited afterwards is not one. The **signers** are the people the
 * decision was put to, each with a verdict and a date; they are the MADR
 * "decision-makers" made explicit.
 *
 * Three lists carry records: a group's (its profile), a project's landscapes
 * (the model, no `subjectId`) and each application's (the model, with one).
 * The shape is the same in all three; only where the list lives differs.
 *
 * Pure. Dates arrive as `yyyy-mm-dd` strings and ids from outside, so nothing
 * in here reads a clock.
 */
import type { Translate } from '../i18n'

/**
 * The record's shape lives in `model/` — a project's decisions hang off its
 * model, so the model would otherwise have to import this module to say what it
 * holds. Re-exported here because this is where the rules about a record are,
 * and a caller reasoning about decisions should not have to know the split.
 */
import type { Adr, AdrFieldItem, AdrSigner, AdrStatus, AdrVerdict } from '../model/adr'
import { ADR_STATUSES, adrFieldItems, adrMovesFrom, isAdrLocked } from '../model/adr'
import { EN } from './strings/en'
import { NL } from './strings/nl'
import { DE } from './strings/de'
export type { Adr, AdrFieldItem, AdrSigner, AdrStatus, AdrVerdict }
export { ADR_STATUSES, adrFieldItems, isAdrLocked }

export function formatAdrNumber(number: number): string {
  return `ADR-${String(number).padStart(4, '0')}`
}

/** One past the highest number in the list — a deleted record's number is never handed out again. */
export function nextAdrNumber(list: readonly Adr[]): number {
  return list.reduce((max, adr) => Math.max(max, adr.number), 0) + 1
}

/**
 * The MADR template, in the reader's language. Only the body: the header
 * (title, status, date, decision-makers) is fields on the record and is drawn
 * above the body rather than written into it, so it cannot drift from them.
 */
export function madrTemplate(t: Translate): string {
  const h2 = (key: Parameters<Translate>[0]) => `## ${t(key)}\n\n`
  const h3 = (key: Parameters<Translate>[0]) => `### ${t(key)}\n\n`
  const bullets = (...keys: Parameters<Translate>[0][]) => keys.map((key) => `* ${t(key)}`).join('\n') + '\n\n'
  const option = (n: number) => `${t('adr.tplOption', { n })}`
  return [
    h2('adr.tplContext'),
    h2('adr.tplDrivers'), bullets('adr.tplDriver'),
    h2('adr.tplOptions'), `* ${option(1)}\n* ${option(2)}\n\n`,
    h2('adr.tplOutcome'), `${t('adr.tplChosen')}\n\n`,
    h3('adr.tplConsequences'), bullets('adr.tplGood', 'adr.tplBad'),
    h3('adr.tplConfirmation'),
    h2('adr.tplProsCons'),
    h3Text(option(1)), bullets('adr.tplGood', 'adr.tplBad'),
    h3Text(option(2)), bullets('adr.tplGood', 'adr.tplBad'),
    h2('adr.tplMore'),
  ].join('').trimEnd().concat('\n')
}

function h3Text(text: string): string {
  return `### ${text}\n\n`
}

export function newAdr(fields: {
  id: string
  number: number
  title: string
  date: string
  t: Translate
  subjectId?: string
}): Adr {
  const adr: Adr = {
    id: fields.id,
    number: fields.number,
    title: fields.title.trim(),
    status: 'proposed',
    date: fields.date,
    body: madrTemplate(fields.t),
    signers: [],
  }
  if (fields.subjectId) adr.subjectId = fields.subjectId
  return adr
}

// --- the state machine ----------------------------------------------------

/**
 * Where a record may go from here. A proposal can be sent for review or
 * withdrawn; review can be sent back to proposal; the three end states only
 * ever move forward, and only acceptance has anywhere to go — a rejected
 * decision is not superseded, it was never in force. The table itself is
 * `model/adr.ts`'s, beside the lock, so anything that reads a model can ask it.
 */
export function transitionsFrom(status: AdrStatus): readonly AdrStatus[] {
  return adrMovesFrom(status)
}

// --- the gate ---------------------------------------------------------------

/**
 * What a move asks of a record, one line each (ADR-0008, amended 28 September
 * 2026). The page draws them as a checklist beside the move, and the agent is
 * answered with the ones still open.
 */
export type AdrGateItem = 'context' | 'options' | 'outcome' | 'consequence' | AdrFieldItem

export type AdrGate = {
  /** The status the record would move to. */
  to: AdrStatus
  items: { item: AdrGateItem; ok: boolean }[]
}

/**
 * The template's words in every language this build ships, because a record
 * started in Dutch and accepted by somebody reading German still holds the
 * Dutch placeholders. Read from this module's own slices rather than through
 * the registry, which would pull every module's words into the agent.
 */
const TEMPLATES = [EN, NL, DE]

/** Lower case, one space, no markdown emphasis or quotes: text as the gate compares it. */
function plain(text: string): string {
  return text
    .replace(/[*_`"\u201c\u201d\u201e\u00ab\u00bb\u2018\u2019']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

const HEADINGS = {
  context: TEMPLATES.map((words) => plain(words['adr.tplContext'])),
  options: TEMPLATES.map((words) => plain(words['adr.tplOptions'])),
  outcome: TEMPLATES.map((words) => plain(words['adr.tplOutcome'])),
  consequences: TEMPLATES.map((words) => plain(words['adr.tplConsequences'])),
}

/** Text the template writes for a person to replace: a driver, a reason, a consequence. */
const PLACEHOLDERS = new Set(TEMPLATES.flatMap((words) => [
  words['adr.tplDriver'], words['adr.tplChosen'], words['adr.tplGood'], words['adr.tplBad'],
].map(plain)))

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** "Option 1", "Optie 2": the template's options, in any language and any number. */
const OPTION_PLACEHOLDERS = TEMPLATES.map((words) => (
  new RegExp(`^${plain(words['adr.tplOption']).split('{n}').map(escaped).join('\\d+')}$`)
))

function isPlaceholder(text: string): boolean {
  const held = plain(text)
  return held === '' || PLACEHOLDERS.has(held) || OPTION_PLACEHOLDERS.some((pattern) => pattern.test(held))
}

type Section = { heading: string; lines: string[] }

/** The body cut at its headings. A fenced block is text, whatever its lines start with. */
function sectionsOf(body: string): Section[] {
  const out: Section[] = []
  let current: Section | undefined
  let fenced = false
  for (const line of body.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced
    const heading = fenced ? null : /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line)
    if (heading) {
      current = { heading: plain(heading[1]), lines: [] }
      out.push(current)
    } else current?.lines.push(line)
  }
  return out
}

/**
 * The section under one of the template's headings, in any language — or
 * under a shorter heading the template's starts with: "## Context" is the
 * context as much as "## Context and Problem Statement" is.
 */
function sectionFor(sections: readonly Section[], names: readonly string[]): Section | undefined {
  return sections.find((one) => one.heading !== '' && names.some((name) => (
    name === one.heading || name.startsWith(`${one.heading} `) || one.heading.startsWith(`${name} `)
  )))
}

const BULLET = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.*)$/

function bulletsOf(section: Section | undefined): string[] {
  return (section?.lines ?? []).map((line) => BULLET.exec(line)?.[1]).filter((text): text is string => text !== undefined)
}

/** The lines of a section a person wrote, rather than the template. */
function writtenLines(section: Section | undefined): string[] {
  return (section?.lines ?? [])
    .map((line) => BULLET.exec(line)?.[1] ?? line)
    .filter((line) => !isPlaceholder(line))
}

/**
 * What an option is called, for finding it in the outcome: the text up to
 * the first dash, colon or bracket, where its pros and cons usually start.
 */
function optionName(text: string): string {
  return plain(text.split(/\s[\u2014\u2013-]\s|:|\(/)[0] ?? text)
}

/** The lines the body has to answer before a record can be accepted. */
function bodyItems(body: string): { item: AdrGateItem; ok: boolean }[] {
  const sections = sectionsOf(body)
  const options = bulletsOf(sectionFor(sections, HEADINGS.options)).filter((text) => !isPlaceholder(text))
  const outcome = plain(writtenLines(sectionFor(sections, HEADINGS.outcome)).join(' '))
  const named = options.map(optionName).filter((name) => name.length > 0)
  return [
    { item: 'context', ok: writtenLines(sectionFor(sections, HEADINGS.context)).length > 0 },
    { item: 'options', ok: options.length >= 2 },
    { item: 'outcome', ok: outcome !== '' && named.some((name) => outcome.includes(name)) },
    { item: 'consequence', ok: bulletsOf(sectionFor(sections, HEADINGS.consequences)).some((text) => !isPlaceholder(text)) },
  ]
}

/**
 * The gate on moving a record to `to`, as a checklist.
 *
 * **To accepted**, because acceptance is for good: the context is written;
 * at least two options were considered that are not the template's
 * "Option n"; the outcome names one of them; one consequence is written; a
 * signer approved and none rejected; and every record it supersedes is
 * accepted. The template is recognised in every language this build ships.
 * **To rejected**: a reason, or from review a rejecting signer. **To
 * superseded**: a successor in the list, and accepted. Every other move has
 * no lines, which is a gate that is open.
 *
 * `adr` carries what the move brings — the reason, the successor — and the
 * status it is leaving; `list` is the records it sits among.
 */
export function adrGate(adr: Adr, to: AdrStatus, options: { list?: readonly Adr[] } = {}): AdrGate {
  const list = options.list ?? [adr]
  const fields = adrFieldItems(adr, to, list)
  return { to, items: to === 'accepted' ? [...bodyItems(adr.body), ...fields] : fields }
}

/** The lines of a gate still open. Empty when the record may move. */
export function adrOpenItems(gate: AdrGate): AdrGateItem[] {
  return gate.items.filter((one) => !one.ok).map((one) => one.item)
}

/**
 * Whether the only approval came from the person who proposed it.
 *
 * Allowed — the core has no accounts, and a team of one decides alone — and
 * said, because a decision nobody else looked at is a different kind of
 * decision. Names are compared as people type them: trimmed, any case.
 */
export function selfAccepted(adr: Pick<Adr, 'proposedBy' | 'signers'>): boolean {
  const by = adr.proposedBy?.trim().toLowerCase()
  if (!by) return false
  const approving = adr.signers.filter((one) => one.verdict === 'approved').map((one) => one.name.trim().toLowerCase())
  return approving.length > 0 && approving.every((name) => name === by)
}

/**
 * A record marked superseded whose successor is missing or not in force —
 * what a proposal could once do to an accepted record. Said in the reader,
 * never repaired behind anybody's back: both ends are locked.
 */
export function supersededByUnaccepted(adr: Adr, list: readonly Adr[]): boolean {
  if (adr.status !== 'superseded') return false
  const successor = adr.supersededBy === undefined ? undefined : list.find((one) => one.id === adr.supersededBy)
  return !successor || successor.status === 'proposed' || successor.status === 'reviewing' || successor.status === 'rejected'
}

/** A record can be thrown away only while it is still being written. */
export function isAdrDeletable(adr: Pick<Adr, 'status'>): boolean {
  return !isAdrLocked(adr)
}

/**
 * Move a record to another status, or leave it exactly as it is when the move
 * is not one the machine allows. `superseded` needs its successor named; the
 * link is what makes a superseded record still useful to a reader. A reason
 * given with a rejection is kept on the record.
 *
 * The arithmetic of one record, not the gate: {@link setAdrStatus} asks the
 * gate, against the list the record sits in.
 */
export function transitionAdr(
  adr: Adr,
  next: AdrStatus,
  date: string,
  options: { supersededBy?: string; reason?: string } = {},
): Adr {
  if (!transitionsFrom(adr.status).includes(next)) return adr
  if (next === 'superseded') {
    if (!options.supersededBy || options.supersededBy === adr.id) return adr
    return { ...adr, status: next, date, supersededBy: options.supersededBy }
  }
  const reason = options.reason?.trim()
  if (next === 'rejected' && reason) return { ...adr, status: next, date, reason }
  return { ...adr, status: next, date }
}

// --- the list -----------------------------------------------------------------

/** What may still be changed on a record that is being written. */
export type AdrPatch = Partial<Pick<Adr, 'title' | 'body' | 'signers' | 'supersedes' | 'proposedBy'>>

/**
 * Change what may still be changed. A locked record comes back untouched. An
 * emptied `supersedes` or a blank `proposedBy` is removed rather than kept
 * empty, so a record that says nothing about either stays the shape it was.
 */
export function updateAdr(list: readonly Adr[], id: string, patch: AdrPatch): Adr[] {
  return list.map((adr) => {
    if (adr.id !== id || isAdrLocked(adr)) return adr
    const next = { ...adr }
    if (patch.title !== undefined && patch.title.trim()) next.title = patch.title.trim()
    if (patch.body !== undefined) next.body = patch.body
    if (patch.signers !== undefined) next.signers = patch.signers
    if ('supersedes' in patch) {
      const named = [...new Set(patch.supersedes ?? [])].filter((other) => other !== id)
      if (named.length) next.supersedes = named
      else delete next.supersedes
    }
    if ('proposedBy' in patch) {
      const by = patch.proposedBy?.trim()
      if (by) next.proposedBy = by
      else delete next.proposedBy
    }
    return next
  })
}

/**
 * Move a record in its list, or leave the list as it was when the table or
 * the gate refuses.
 *
 * **Accepting a record that supersedes others is one step** (ADR-0008,
 * amended 28 September 2026): each record it names moves from accepted to
 * superseded, pointing at it, on the same day. The two ends of a supersession
 * are written together, the way this repository's own decision records are;
 * rejecting the successor leaves them accepted.
 */
export function setAdrStatus(
  list: readonly Adr[],
  id: string,
  next: AdrStatus,
  date: string,
  options: { supersededBy?: string; reason?: string } = {},
): Adr[] {
  const held = list.find((adr) => adr.id === id)
  if (!held || !transitionsFrom(held.status).includes(next)) return [...list]
  const carrying: Adr = {
    ...held,
    ...(next === 'superseded' && options.supersededBy ? { supersededBy: options.supersededBy } : {}),
    ...(next === 'rejected' && options.reason?.trim() ? { reason: options.reason.trim() } : {}),
  }
  // The successor has to be a record in the same list, and in force: a link
  // to somewhere a reader of this list cannot follow is a dead end dressed up
  // as a reference, and a proposal cannot replace a decision.
  if (adrOpenItems(adrGate(carrying, next, { list })).length) return [...list]
  const moved = transitionAdr(held, next, date, options)
  if (moved === held) return [...list]
  const replaced = new Set(next === 'accepted' ? held.supersedes ?? [] : [])
  return list.map((adr) => {
    if (adr.id === id) return moved
    if (replaced.has(adr.id) && adr.status === 'accepted') return { ...adr, status: 'superseded', date, supersededBy: id }
    return adr
  })
}

/**
 * Remove a record. Locked records stay; a link that pointed at the removed one
 * is dropped along with it, so no record claims to be superseded by nothing.
 */
export function removeAdr(list: readonly Adr[], id: string): Adr[] {
  const target = list.find((adr) => adr.id === id)
  if (!target || !isAdrDeletable(target)) return [...list]
  return list
    .filter((adr) => adr.id !== id)
    .map((adr) => (adr.supersededBy === id ? withoutSuccessor(adr) : adr))
}

function withoutSuccessor(adr: Adr): Adr {
  const rest = { ...adr }
  delete rest.supersededBy
  return rest
}

/** The records of one scope: the landscape level, or one application's. */
export function adrsFor(list: readonly Adr[], subjectId: string | undefined): Adr[] {
  return list.filter((adr) => (adr.subjectId ?? undefined) === subjectId)
}

/** Newest first: what a list of decisions is opened for. */
export function sortAdrs(list: readonly Adr[]): Adr[] {
  return [...list].sort((a, b) => b.number - a.number)
}

// --- reading storage --------------------------------------------------------------

function isSigner(value: unknown): value is AdrSigner {
  if (!value || typeof value !== 'object') return false
  const s = value as AdrSigner
  return typeof s.name === 'string'
    && (s.role === undefined || typeof s.role === 'string')
    && (s.verdict === undefined || s.verdict === 'approved' || s.verdict === 'rejected')
    && (s.signedAt === undefined || typeof s.signedAt === 'string')
}

export function isAdr(value: unknown): value is Adr {
  if (!value || typeof value !== 'object') return false
  const a = value as Adr
  return typeof a.id === 'string' && a.id !== ''
    && typeof a.number === 'number'
    && typeof a.title === 'string'
    && ADR_STATUSES.includes(a.status)
    && typeof a.date === 'string'
    && typeof a.body === 'string'
    && (a.subjectId === undefined || typeof a.subjectId === 'string')
    && (a.supersededBy === undefined || typeof a.supersededBy === 'string')
    && (a.supersedes === undefined || (Array.isArray(a.supersedes) && a.supersedes.every((id) => typeof id === 'string')))
    && (a.proposedBy === undefined || typeof a.proposedBy === 'string')
    && (a.reason === undefined || typeof a.reason === 'string')
    && Array.isArray(a.signers) && a.signers.every(isSigner)
}

export function isAdrList(value: unknown): value is Adr[] {
  return Array.isArray(value) && value.every(isAdr)
}

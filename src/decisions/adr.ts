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
 * (the model, no `applicationId`) and each application's (the model, with one).
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
import type { Adr, AdrSigner, AdrStatus, AdrVerdict } from '../model/adr'
import { ADR_STATUSES } from '../model/adr'
export type { Adr, AdrSigner, AdrStatus, AdrVerdict }
export { ADR_STATUSES }

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
  applicationId?: string
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
  if (fields.applicationId) adr.applicationId = fields.applicationId
  return adr
}

// --- the state machine ----------------------------------------------------

/**
 * Where a record may go from here. Review can be sent back to proposal; the
 * three end states only ever move forward, and only acceptance has anywhere
 * to go — a rejected decision is not superseded, it was never in force.
 */
export function transitionsFrom(status: AdrStatus): readonly AdrStatus[] {
  switch (status) {
    case 'proposed': return ['reviewing']
    case 'reviewing': return ['accepted', 'rejected', 'proposed']
    case 'accepted': return ['superseded']
    case 'rejected':
    case 'superseded':
      return []
  }
}

/** Accepted, rejected and superseded records are history: title, body and signers stay as they were. */
export function isAdrLocked(adr: Pick<Adr, 'status'>): boolean {
  return adr.status === 'accepted' || adr.status === 'rejected' || adr.status === 'superseded'
}

/** A record can be thrown away only while it is still being written. */
export function isAdrDeletable(adr: Pick<Adr, 'status'>): boolean {
  return !isAdrLocked(adr)
}

/**
 * Move a record to another status, or leave it exactly as it is when the move
 * is not one the machine allows. `superseded` needs its successor named; the
 * link is what makes a superseded record still useful to a reader.
 */
export function transitionAdr(
  adr: Adr,
  next: AdrStatus,
  date: string,
  options: { supersededBy?: string } = {},
): Adr {
  if (!transitionsFrom(adr.status).includes(next)) return adr
  if (next === 'superseded') {
    if (!options.supersededBy || options.supersededBy === adr.id) return adr
    return { ...adr, status: next, date, supersededBy: options.supersededBy }
  }
  return { ...adr, status: next, date }
}

// --- the list -----------------------------------------------------------------

/** Change what may still be changed. A locked record comes back untouched. */
export function updateAdr(
  list: readonly Adr[],
  id: string,
  patch: Partial<Pick<Adr, 'title' | 'body' | 'signers'>>,
): Adr[] {
  return list.map((adr) => {
    if (adr.id !== id || isAdrLocked(adr)) return adr
    const next = { ...adr }
    if (patch.title !== undefined && patch.title.trim()) next.title = patch.title.trim()
    if (patch.body !== undefined) next.body = patch.body
    if (patch.signers !== undefined) next.signers = patch.signers
    return next
  })
}

export function setAdrStatus(
  list: readonly Adr[],
  id: string,
  next: AdrStatus,
  date: string,
  options: { supersededBy?: string } = {},
): Adr[] {
  // The successor has to be a record in the same list: a link to somewhere a
  // reader of this list cannot follow is a dead end dressed up as a reference.
  if (next === 'superseded' && !list.some((adr) => adr.id === options.supersededBy)) return [...list]
  return list.map((adr) => (adr.id === id ? transitionAdr(adr, next, date, options) : adr))
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
export function adrsFor(list: readonly Adr[], applicationId: string | undefined): Adr[] {
  return list.filter((adr) => (adr.applicationId ?? undefined) === applicationId)
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
    && (a.applicationId === undefined || typeof a.applicationId === 'string')
    && (a.supersededBy === undefined || typeof a.supersededBy === 'string')
    && Array.isArray(a.signers) && a.signers.every(isSigner)
}

export function isAdrList(value: unknown): value is Adr[] {
  return Array.isArray(value) && value.every(isAdr)
}

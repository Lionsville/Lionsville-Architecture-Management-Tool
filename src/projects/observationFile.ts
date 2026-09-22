// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One observation, and one cause, as one markdown file each (ADR-0021).
 *
 * The third sibling of {@link ./adrFile} and {@link ./transitionFile}, and
 * deliberately the same shape: front matter for the fields that are not
 * prose, a heading that names it the way people say it out loud, and markdown
 * below. The history of an observation — seen again, shared, absorbed, merged,
 * archived — is rows in the front matter, dated, so that `git log` on the file and the
 * file itself tell the same story.
 *
 * Forgiving in one direction, as the other two codecs are: it writes one
 * exact shape and reads several, because a file in the user's folder can be
 * edited by anything and an observation that half-parses is worth more than a
 * refusal.
 *
 * What may happen to an observation — the numbering, the merge, the share —
 * is `observations/observation.ts` and is none of this file's business.
 */
import {
  CAUSE_STATES, CAUSE_STRENGTHS, OBSERVATION_EVENT_KINDS, OBSERVATION_IMPACTS,
} from '../model/observation'
import type {
  Cause, CauseLink, CauseState, CauseStrength, Observation, ObservationEvent, ObservationEventKind,
  ObservationImpact,
} from '../model/observation'
import { slug } from '../model/keys'
import {
  frontMatterNumber, frontMatterRows, frontMatterString, frontMatterText, markdownBody,
  readFrontMatter,
} from './fileText'
import type { FrontMatterScalar } from './fileText'

/** The folder a scope's observations live in; the causes are one folder under it. */
export const OBSERVATIONS_FOLDER = 'observations'
export const CAUSES_SUBFOLDER = 'causes'

function numberPrefix(number: number): string {
  return String(Math.max(0, Math.trunc(number))).padStart(4, '0')
}

/**
 * Where an observation is filed, relative to the scope folder. Flat, numbers
 * per scope; the number leads the name so that it sorts and so that a
 * `README.md` dropped in the folder is not read as one.
 */
export function observationPath(observation: Observation): string {
  const stem = observation.title.trim() ? slug(observation.title) : 'observation'
  return `${OBSERVATIONS_FOLDER}/${numberPrefix(observation.number)}-${stem}.md`
}

/** Where a cause is filed: under the observations, in a folder of their own. */
export function causePath(cause: Cause): string {
  const stem = cause.title.trim() ? slug(cause.title) : 'cause'
  return `${OBSERVATIONS_FOLDER}/${CAUSES_SUBFOLDER}/${numberPrefix(cause.number)}-${stem}.md`
}

/** `0003-a-slug.md` → 3, for a file whose front matter lost its number. */
function numberFromName(path: string): number | undefined {
  const match = /(?:^|\/)(\d{1,6})-[^/]*$/.exec(path)
  return match ? Number(match[1]) : undefined
}

function historyRows(history: readonly ObservationEvent[]): Record<string, FrontMatterScalar>[] {
  return history
    .filter((one) => one.date)
    .map((one) => ({
      date: one.date,
      kind: one.kind,
      ...(one.id !== undefined ? { id: one.id } : {}),
      ...(one.scope !== undefined ? { scope: one.scope } : {}),
      ...(one.seen !== undefined ? { seen: one.seen } : {}),
      ...(one.note !== undefined ? { note: one.note } : {}),
    }))
}

export function observationFileText(observation: Observation): string {
  const fields = frontMatterText({
    id: observation.id,
    number: observation.number,
    date: observation.date,
    where: observation.where,
    by: observation.by,
    impact: observation.impact,
    seen: observation.seen,
    shared: observation.shared,
    archived: observation.archived,
    history: historyRows(observation.history),
  })
  const heading = `# OB-${numberPrefix(observation.number)} — ${observation.title}`
  return `${fields}\n${heading}\n\n${observation.body}\n`
}

function linkRows(links: readonly CauseLink[]): Record<string, FrontMatterScalar>[] {
  return links
    .filter((one) => one.id)
    .map((one) => ({ id: one.id, ...(one.scope !== undefined ? { scope: one.scope } : {}), strength: one.strength }))
}

export function causeFileText(cause: Cause): string {
  const fields = frontMatterText({
    id: cause.id,
    number: cause.number,
    state: cause.state,
    explains: linkRows(cause.explains),
  })
  const heading = `# CA-${numberPrefix(cause.number)} — ${cause.title}`
  return `${fields}\n${heading}\n\n${cause.body}\n`
}

function impactOf(text: string | undefined): ObservationImpact {
  return OBSERVATION_IMPACTS.includes(text as ObservationImpact) ? (text as ObservationImpact) : 'minor'
}

function stateOf(text: string | undefined): CauseState {
  return CAUSE_STATES.includes(text as CauseState) ? (text as CauseState) : 'assumed'
}

function strengthOf(text: string | undefined): CauseStrength {
  return CAUSE_STRENGTHS.includes(text as CauseStrength) ? (text as CauseStrength) : 'normal'
}

function historyFrom(rows: Record<string, FrontMatterScalar>[]): ObservationEvent[] {
  return rows.flatMap((row) => {
    const date = typeof row.date === 'string' ? row.date : ''
    const kind = typeof row.kind === 'string' ? row.kind : ''
    if (!date || !OBSERVATION_EVENT_KINDS.includes(kind as ObservationEventKind)) return []
    return [{
      date,
      kind: kind as ObservationEventKind,
      ...(typeof row.id === 'string' && row.id ? { id: row.id } : {}),
      ...(typeof row.scope === 'string' ? { scope: row.scope } : {}),
      ...(typeof row.seen === 'number' ? { seen: row.seen } : {}),
      ...(typeof row.note === 'string' && row.note ? { note: row.note } : {}),
    }]
  })
}

function linksFrom(rows: Record<string, FrontMatterScalar>[]): CauseLink[] {
  return rows.flatMap((row) => {
    const id = typeof row.id === 'string' ? row.id : ''
    if (!id) return []
    return [{
      id,
      ...(typeof row.scope === 'string' ? { scope: row.scope } : {}),
      strength: strengthOf(typeof row.strength === 'string' ? row.strength : undefined),
    }]
  })
}

/** The heading and the rest, with the `OB-0001 — ` prefix taken back off. */
function headed(text: string, label: RegExp): { title: string; body: string; fields: ReturnType<typeof readFrontMatter>['fields'] } {
  const { fields, body } = readFrontMatter(text)
  const rest = body.replace(/^\n+/, '')
  const headingEnd = rest.startsWith('# ') ? rest.indexOf('\n') : -1
  const heading = headingEnd === -1 ? (rest.startsWith('# ') ? rest.slice(2) : undefined) : rest.slice(2, headingEnd)
  const title = (heading ?? frontMatterString(fields, 'title') ?? '').replace(label, '').trim()
  const remainder = headingEnd === -1
    ? (heading === undefined ? rest : '')
    : rest.slice(headingEnd + 1).replace(/^\n/, '')
  return { title, body: markdownBody(remainder), fields }
}

/**
 * An observation back out of a file, or `undefined` when the file is not one.
 *
 * The number comes from the front matter, or from the file name where a
 * hand-written file has none. A record with no history gets the one event it
 * must have had: recorded on its date.
 */
export function observationFromFile(text: string, path: string): Observation | undefined {
  const { title, body, fields } = headed(text, /^OB-\d+\s+[—-]\s+/)
  const number = frontMatterNumber(fields, 'number') ?? numberFromName(path)
  if (number === undefined) return undefined
  const date = frontMatterString(fields, 'date') ?? ''
  const where = frontMatterString(fields, 'where')
  const by = frontMatterString(fields, 'by')
  const seen = frontMatterNumber(fields, 'seen')
  const history = historyFrom(frontMatterRows(fields, 'history'))
  return {
    id: frontMatterString(fields, 'id') || `ob-${number}`,
    number,
    title,
    date,
    ...(where ? { where } : {}),
    ...(by ? { by } : {}),
    impact: impactOf(frontMatterString(fields, 'impact')),
    seen: seen !== undefined && seen >= 1 ? Math.trunc(seen) : 1,
    ...(frontMatterString(fields, 'shared') === 'true' ? { shared: true as const } : {}),
    ...(frontMatterString(fields, 'archived') === 'true' ? { archived: true as const } : {}),
    body,
    history: history.length ? history : [{ date, kind: 'recorded' }],
  }
}

/** A cause back out of a file, or `undefined` when the file is not one. */
export function causeFromFile(text: string, path: string): Cause | undefined {
  const { title, body, fields } = headed(text, /^CA-\d+\s+[—-]\s+/)
  const number = frontMatterNumber(fields, 'number') ?? numberFromName(path)
  if (number === undefined) return undefined
  return {
    id: frontMatterString(fields, 'id') || `ca-${number}`,
    number,
    title,
    state: stateOf(frontMatterString(fields, 'state')),
    body,
    explains: linksFrom(frontMatterRows(fields, 'explains')),
  }
}

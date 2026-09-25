// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One observation, and one cause, as one markdown file each (ADR-0021) — and
 * one solution and one experiment the same way (ADR-0026).
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
  CAUSE_STATES, CAUSE_STRENGTHS, EXPERIMENT_OUTCOMES, OBSERVATION_EVENT_KINDS, OBSERVATION_IMPACTS,
  SOLUTION_EVENT_KINDS, SOLUTION_SIZES, SOLUTION_STATES,
} from '../model/observation'
import type {
  Cause, CauseLink, CauseState, CauseStrength, EarlierAttempt, Experiment, ExperimentOutcome, Observation,
  ObservationEvent, ObservationEventKind, ObservationImpact, Solution, SolutionEvent, SolutionEventKind,
  SolutionLink, SolutionSize, SolutionState,
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
/** What is being done about the causes, and what was tried to find out (ADR-0026). */
export const SOLUTIONS_SUBFOLDER = 'solutions'
export const EXPERIMENTS_SUBFOLDER = 'experiments'

/** The folders under `observations/` a store walks into, and the only ones. */
export const OBSERVATION_SUBFOLDERS: readonly string[] = [CAUSES_SUBFOLDER, SOLUTIONS_SUBFOLDER, EXPERIMENTS_SUBFOLDER]

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

/** Where a solution is filed. */
export function solutionPath(solution: Solution): string {
  const stem = solution.title.trim() ? slug(solution.title) : 'solution'
  return `${OBSERVATIONS_FOLDER}/${SOLUTIONS_SUBFOLDER}/${numberPrefix(solution.number)}-${stem}.md`
}

/** Where an experiment is filed. */
export function experimentPath(experiment: Experiment): string {
  const stem = experiment.title.trim() ? slug(experiment.title) : 'experiment'
  return `${OBSERVATIONS_FOLDER}/${EXPERIMENTS_SUBFOLDER}/${numberPrefix(experiment.number)}-${stem}.md`
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

// --- solutions and experiments (ADR-0026) -----------------------------------------

export function solutionFileText(solution: Solution): string {
  const fields = frontMatterText({
    id: solution.id,
    number: solution.number,
    state: solution.state,
    benefit: solution.benefit,
    cost: solution.cost,
    noneKnown: solution.noneKnown,
    whyNow: solution.whyNow,
    waived: solution.waived,
    droppedFrom: solution.droppedFrom,
    dropNote: solution.dropNote,
    decision: solution.decision,
    plan: solution.plan,
    addresses: solution.addresses.filter((one) => one.id).map((one) => ({ id: one.id, strength: one.strength })),
    validatedWith: solution.validatedWith.filter(Boolean).map((name) => ({ name })),
    attempts: solution.attempts.map((one) => ({ when: one.when, what: one.what, why: one.why })),
    history: solution.history.filter((one) => one.date).map((one) => ({
      date: one.date, kind: one.kind, to: one.to, id: one.id, note: one.note,
    })),
  })
  const heading = `# SO-${numberPrefix(solution.number)} — ${solution.title}`
  return `${fields}\n${heading}\n\n${solution.body}\n`
}

export function experimentFileText(experiment: Experiment): string {
  const fields = frontMatterText({
    id: experiment.id,
    number: experiment.number,
    outcome: experiment.outcome,
    hypothesis: experiment.hypothesis,
    measure: experiment.measure,
    where: experiment.where,
    by: experiment.by,
    from: experiment.from,
    to: experiment.to,
    result: experiment.result,
    tests: experiment.tests.filter(Boolean).map((id) => ({ id, ...(experiment.strength?.[id] ? { strength: experiment.strength[id] } : {}) })),
  })
  const heading = `# EX-${numberPrefix(experiment.number)} — ${experiment.title}`
  return `${fields}\n${heading}\n\n${experiment.body}\n`
}

function oneOf<T extends string>(allowed: readonly T[], text: string | undefined): T | undefined {
  return allowed.includes(text as T) ? (text as T) : undefined
}

function text(row: Record<string, FrontMatterScalar>, key: string): string | undefined {
  const value = row[key]
  return typeof value === 'string' && value ? value : typeof value === 'number' ? String(value) : undefined
}

/** A solution back out of a file, or `undefined` when the file is not one. */
export function solutionFromFile(fileText: string, path: string): Solution | undefined {
  const { title, body, fields } = headed(fileText, /^SO-\d+\s+[—-]\s+/)
  const number = frontMatterNumber(fields, 'number') ?? numberFromName(path)
  if (number === undefined) return undefined
  const string = (key: string) => frontMatterString(fields, key) || undefined
  const addresses: SolutionLink[] = frontMatterRows(fields, 'addresses').flatMap((row) => {
    const id = text(row, 'id')
    return id ? [{ id, strength: strengthOf(text(row, 'strength')) }] : []
  })
  const attempts: EarlierAttempt[] = frontMatterRows(fields, 'attempts').flatMap((row) => {
    const what = text(row, 'what') ?? ''
    const why = text(row, 'why') ?? ''
    const when = text(row, 'when')
    return what || why ? [{ ...(when ? { when } : {}), what, why }] : []
  })
  const history: SolutionEvent[] = frontMatterRows(fields, 'history').flatMap((row) => {
    const date = text(row, 'date')
    const kind = oneOf<SolutionEventKind>(SOLUTION_EVENT_KINDS, text(row, 'kind'))
    if (!date || !kind) return []
    const to = text(row, 'to')
    const id = text(row, 'id')
    const note = text(row, 'note')
    return [{ date, kind, ...(to ? { to } : {}), ...(id ? { id } : {}), ...(note ? { note } : {}) }]
  })
  const optional = {
    benefit: oneOf<SolutionSize>(SOLUTION_SIZES, string('benefit')),
    cost: oneOf<SolutionSize>(SOLUTION_SIZES, string('cost')),
    whyNow: string('whyNow'),
    waived: string('waived'),
    droppedFrom: oneOf<SolutionState>(SOLUTION_STATES, string('droppedFrom')),
    dropNote: string('dropNote'),
    decision: string('decision'),
    plan: string('plan'),
  }
  return {
    id: string('id') ?? `so-${number}`,
    number,
    title,
    state: oneOf<SolutionState>(SOLUTION_STATES, string('state')) ?? 'idea',
    addresses,
    ...Object.fromEntries(Object.entries(optional).filter(([, value]) => value !== undefined)),
    validatedWith: frontMatterRows(fields, 'validatedWith').flatMap((row) => text(row, 'name') ?? []),
    attempts,
    ...(string('noneKnown') === 'true' ? { noneKnown: true as const } : {}),
    body,
    history,
  }
}

/** An experiment back out of a file, or `undefined` when the file is not one. */
export function experimentFromFile(fileText: string, path: string): Experiment | undefined {
  const { title, body, fields } = headed(fileText, /^EX-\d+\s+[—-]\s+/)
  const number = frontMatterNumber(fields, 'number') ?? numberFromName(path)
  if (number === undefined) return undefined
  const string = (key: string) => frontMatterString(fields, key) || undefined
  const optional = {
    measure: string('measure'), where: string('where'), by: string('by'),
    from: string('from'), to: string('to'), result: string('result'),
  }
  const rows = frontMatterRows(fields, 'tests')
  // A strength is written only where it is not normal, and read the same way.
  const strength = Object.fromEntries(rows.flatMap((row) => {
    const id = text(row, 'id')
    const said = oneOf<CauseStrength>(['strong', 'weak'], text(row, 'strength'))
    return id && said ? [[id, said]] : []
  }))
  return {
    id: string('id') ?? `ex-${number}`,
    number,
    title,
    tests: rows.flatMap((row) => text(row, 'id') ?? []),
    ...(Object.keys(strength).length ? { strength } : {}),
    hypothesis: string('hypothesis') ?? '',
    ...Object.fromEntries(Object.entries(optional).filter(([, value]) => value !== undefined)),
    outcome: oneOf<ExperimentOutcome>(EXPERIMENT_OUTCOMES, string('outcome')) ?? 'planned',
    body,
  }
}

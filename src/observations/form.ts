// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the observation form and the cause form make, as one change to the
 * lists (ADR-0032 §6).
 *
 * **One submit is one step.** An observation, the new causes it names and the
 * links to causes already written down are one answer here, so the caller
 * commits them as one transaction and ⌘Z takes them all back. A new cause and
 * what it explains and what lies behind it are one answer too.
 *
 * **Four facts make an observation**: what was seen, where, by whom and when
 * — the day it was first seen, never after today. The form asks for all four,
 * and a refusal names the one that is missing.
 *
 * Pure, and over lists, like the rules it calls: the numbers are read off the
 * lists handed in, so a change made again over a scope that moved in between
 * numbers after what is there now.
 */
import type { Translate } from '../i18n/strings'
import { isDay } from '../model/lifecycle'
import {
  causeTemplate, linkCause, newCause, newObservation, nextCauseNumber, nextObservationNumber, withReason,
} from './observation'
import type { Analysis, Cause, CauseLink, CauseStrength, ObservationImpact } from './observation'

/** What the form asks of a new observation. */
export type ObservationFields = {
  title: string
  where: string
  by: string
  /** `yyyy-mm-dd`: the day it was first seen. */
  date: string
  impact: ObservationImpact
  body: string
}

/** The four facts an observation needs. */
export type RequiredField = 'title' | 'where' | 'by' | 'date'

export const REQUIRED_FIELDS: readonly RequiredField[] = ['title', 'where', 'by', 'date']

/** Why a fact cannot be recorded as written: not said, or a day after today. */
export type FieldProblem = 'missing' | 'future'

/** What stands in the way of recording, per field; empty where nothing does. */
export function observationProblems(
  fields: Pick<ObservationFields, RequiredField>, today: string,
): Partial<Record<RequiredField, FieldProblem>> {
  const problems: Partial<Record<RequiredField, FieldProblem>> = {}
  for (const key of ['title', 'where', 'by'] as const) if (!fields[key].trim()) problems[key] = 'missing'
  if (!isDay(fields.date)) problems.date = 'missing'
  else if (fields.date > today) problems.date = 'future'
  return problems
}

/**
 * The three questions a sighting answers, asked one field each by the form
 * that records a new observation. Only who or what it affected is required
 * there: an observation that touched nobody is not yet worth recording. Once
 * recorded they are one markdown body, edited as such, so nothing else asks.
 */
export type ObservationSections = { saw: string; evidence: string; affected: string }

/** The body the three answers make: the template's headings, each with its answer under it; all three empty is the template. */
export function observationBody(sections: ObservationSections, t: Translate): string {
  const part = (heading: string, text: string) => `## ${heading}\n\n${text.trim() ? `${text.trim()}\n` : ''}`
  return [
    part(t('observation.tplSaw'), sections.saw),
    part(t('observation.tplEvidence'), sections.evidence),
    part(t('observation.tplAffected'), sections.affected),
  ].join('\n')
}

/** What the new-observation form refuses: the four facts, and who or what it affected. */
export function newObservationProblems(
  fields: Pick<ObservationFields, RequiredField> & Pick<ObservationSections, 'affected'>, today: string,
): Partial<Record<RequiredField | 'affected', FieldProblem>> {
  return { ...observationProblems(fields, today), ...(fields.affected.trim() ? {} : { affected: 'missing' as const }) }
}

/** A cause written in the form: nothing is made of it until the form is recorded. */
export type CauseDraft = {
  title: string
  /** A line for *Why we think so*; empty is nothing said. */
  why: string
  root: boolean
  strength: CauseStrength
  /** The markdown body, where the form had one; the template where it is absent or empty. */
  body?: string
}

/** One row of a form's causes: a cause to make, or one of the scope's to link. */
export type CauseChoice =
  | { kind: 'new'; draft: CauseDraft }
  | { kind: 'existing'; causeId: string; strength: CauseStrength }

/** A new cause from a draft: assumed, a root where the draft says so, and the reason under its heading. */
export function causeFromDraft(draft: CauseDraft, args: { id: string; number: number; t: Translate }): Cause {
  return newCause({
    id: args.id, number: args.number, title: draft.title, t: args.t, root: draft.root,
    body: withReason(draft.body?.trim() ? draft.body : causeTemplate(args.t), draft.why, args.t),
  })
}

/**
 * The observation, the new causes that explain it and the links from the
 * existing ones, over `analysis`. A row naming a cause the scope no longer
 * holds is passed over, as `linkCause` would.
 */
export function recordObservation(analysis: Analysis, args: {
  fields: ObservationFields
  causes: readonly CauseChoice[]
  makeId: (prefix: string) => string
  t: Translate
}): { analysis: Analysis; id: string } {
  const { fields, t } = args
  const observation = newObservation({
    id: args.makeId('ob'), number: nextObservationNumber(analysis.observations), t, ...fields,
  })
  let causes = [...analysis.causes]
  for (const choice of args.causes) {
    const link = { id: observation.id, strength: choice.kind === 'new' ? choice.draft.strength : choice.strength }
    if (choice.kind === 'new') {
      const fresh = causeFromDraft(choice.draft, { id: args.makeId('ca'), number: nextCauseNumber(causes), t })
      causes = [...causes, { ...fresh, explains: [link] }]
    } else {
      causes = linkCause(causes, choice.causeId, link)
    }
  }
  return { analysis: { observations: [...analysis.observations, observation], causes }, id: observation.id }
}

/**
 * A new cause, what it explains, and the causes already written down that
 * lie behind it — each of them explaining the new one. A root cause has
 * nothing behind it (ADR-0032 §3), so a root draft takes none.
 */
export function addCauseLinked(causes: readonly Cause[], args: {
  draft: CauseDraft
  /** What it explains: a record of its own scope, or a cause of a scope below. */
  explains: Omit<CauseLink, 'strength'>
  behind: readonly { causeId: string; strength: CauseStrength }[]
  id: string
  t: Translate
}): Cause[] {
  const fresh = causeFromDraft(args.draft, { id: args.id, number: nextCauseNumber(causes), t: args.t })
  const { id, scope } = args.explains
  const explains: CauseLink = { id, ...(scope !== undefined ? { scope } : {}), strength: args.draft.strength }
  let list = [...causes, { ...fresh, explains: [explains] }]
  if (args.draft.root) return list
  for (const one of args.behind) list = linkCause(list, one.causeId, { id: fresh.id, strength: one.strength })
  return list
}

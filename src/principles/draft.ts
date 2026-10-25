// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A principle as its editor holds it while it is written (ADR-0041): plain
 * fields, its aspects numbered as they are added, and the groups picked —
 * those the scope keeps by id, and those to make by name. Pure: a draft from
 * a principle, and the principle a draft says, so the screen and its test
 * read one rule.
 */
import type { Aspect, Principle, PrincipleRegime, PrincipleStatus } from '../model/principle'
import { sharpens } from '../model/principle'

export type PrincipleDraft = {
  title: string
  statement: string
  regime: PrincipleRegime
  status: PrincipleStatus
  question: string
  aspects: Aspect[]
  /** The highest aspect number given, the principle's own included: an added aspect takes the next. */
  lastAspect: number
  /** The groups picked that the scope keeps, by id. */
  groups: string[]
  /** The groups picked by a name the scope has no group of yet: made with the principle, in one step. */
  newGroups: string[]
  rationale: string
  implications: string
  /** As typed: words separated by commas. */
  keywords: string
}

export function draftOf(principle: Principle | undefined): PrincipleDraft {
  return {
    title: principle?.title ?? '',
    statement: principle?.statement ?? '',
    regime: principle?.regime ?? 'flexible',
    status: principle?.status ?? 'candidate',
    question: principle?.question ?? '',
    aspects: [...(principle?.aspects ?? [])],
    lastAspect: principle?.lastAspect ?? 0,
    groups: [...(principle?.groups ?? [])],
    newGroups: [],
    rationale: principle?.rationale ?? '',
    implications: principle?.implications ?? '',
    keywords: (principle?.keywords ?? []).join(', '),
  }
}

/** A new, empty aspect on the draft: the next number, never one used before. */
export function withNewAspect(draft: PrincipleDraft, id: string): PrincipleDraft {
  const number = draft.lastAspect + 1
  return { ...draft, aspects: [...draft.aspects, { id, number, text: '', nature: 'design' }], lastAspect: number }
}

const trimmed = (text: string) => text.trim()

/**
 * The principle a draft says, over the one it changes where it changes one:
 * the fields as written, empty optional fields left out, aspects with no
 * words dropped, and the day it was accepted where it is accepted now and
 * was not before. `groups` are the ids, the new ones' included.
 */
export function principleOf(
  draft: PrincipleDraft, held: Pick<Principle, 'id' | 'number'> & Partial<Principle>, groups: readonly string[], today: string,
): Principle {
  const keywords = draft.keywords.split(',').map(trimmed).filter(Boolean)
  const accepted = draft.status === 'accepted'
  const {
    question: _question, rationale: _rationale, implications: _implications, keywords: _keywords, acceptedOn: _accepted, ...kept
  } = held
  void _question; void _rationale; void _implications; void _keywords
  return {
    ...kept,
    id: held.id,
    number: held.number,
    title: draft.title.trim(),
    statement: draft.statement.trim(),
    regime: draft.regime,
    status: draft.status,
    ...(draft.status === 'candidate' && draft.question.trim() ? { question: draft.question.trim() } : {}),
    aspects: draft.aspects.filter((one) => one.text.trim()).map((one) => ({ ...one, text: one.text.trim() })),
    lastAspect: draft.lastAspect,
    groups: [...groups],
    ...(draft.rationale.trim() ? { rationale: draft.rationale.trim() } : {}),
    ...(draft.implications.trim() ? { implications: draft.implications.trim() } : {}),
    ...(keywords.length ? { keywords } : {}),
    ...(accepted ? { acceptedOn: _accepted ?? today } : {}),
  }
}

/** Whether saving the draft sharpens the accepted principle it changes, and so asks for a note (ADR-0041 §4). */
export function draftSharpens(draft: PrincipleDraft, held: Principle | undefined, today: string): boolean {
  return held !== undefined && sharpens(held, principleOf(draft, held, held.groups, today))
}

/** Whether the draft can be saved: a title, a statement and at least one aspect with words. */
export function draftReady(draft: PrincipleDraft): boolean {
  return draft.title.trim() !== '' && draft.statement.trim() !== '' && draft.aspects.some((one) => one.text.trim() !== '')
}

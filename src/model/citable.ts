// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Citing a principle (ADR-0041 §7): which kinds of record cite, with which
 * stances — one table, as `commentable.ts` is for comments — and the
 * citation itself, a record of the scope that keeps the citing record, about
 * that record by its key.
 *
 * Each line names the command that deletes a record of the kind, because a
 * record deleted takes its citations with it in the same step and undo brings
 * both back (`commands/table.ts` wraps that command so). A plan is the model's
 * `transition`.
 */
import type { CommandType } from './commands/handler'
import type { Model } from './normalised'
import type { Principle, PrincipleRef } from './principle'
import { isCitable as principleCitable } from './principle'
import { RECORD_LISTS } from './recordKey'
import type { RecordKey, RecordKind } from './recordKey'

export type CitationStance = 'supports' | 'deviates' | 'holds' | 'chafes' | 'missing'

export const CITATION_STANCES: readonly CitationStance[] = ['supports', 'deviates', 'holds', 'chafes', 'missing']

/** Which kinds cite, with which stances, and the command that deletes one. */
export const CITABLE = {
  decision: { stances: ['supports', 'deviates'], deletedBy: 'decision.remove' },
  element: { stances: ['supports'], deletedBy: 'element.delete' },
  transition: { stances: ['supports'], deletedBy: 'transition.remove' },
  solution: { stances: ['supports'], deletedBy: 'solution.remove' },
  observation: { stances: ['holds', 'chafes', 'missing'], deletedBy: 'observation.remove' },
} as const satisfies Partial<Record<keyof typeof RECORD_LISTS, { stances: readonly CitationStance[]; deletedBy: CommandType }>>

export type CitingKind = keyof typeof CITABLE

export const CITING_KINDS = Object.keys(CITABLE) as CitingKind[]

export function isCiting(kind: RecordKind | string): kind is CitingKind {
  return Object.hasOwn(CITABLE, kind)
}

/** The stances a kind may take. */
export function stancesOf(kind: CitingKind): readonly CitationStance[] {
  return CITABLE[kind].stances
}

export type CitationId = string

/** One record citing one principle, or one of its aspects. */
export type Citation = {
  id: CitationId
  /** The citing record, in the scope that keeps this citation. */
  about: RecordKey
  /** The principle: in this scope, above it, or in a topic relevant here. */
  principle: PrincipleRef
  /** The aspect meant, by its number, where one is. */
  aspect?: number
  stance: CitationStance
  /** Why; required on `deviates`. */
  reason?: string
  /** The day it was cited, `yyyy-mm-dd`: a citation older than a sharpening says so. */
  on: string
}

export function isAboutRecord(citation: Pick<Citation, 'about'>, about: RecordKey): boolean {
  return citation.about.kind === about.kind && citation.about.id === about.id
}

/** Whether the scope holds the record a citation is about, of a kind that cites. */
export function holdsCiting(model: Model, about: RecordKey): boolean {
  if (!isCiting(about.kind)) return false
  const list = model[RECORD_LISTS[about.kind]] as Record<string, unknown> | undefined
  return list !== undefined && Object.hasOwn(list, about.id)
}

/** Why a citation cannot be written as it stands, against what the scope holds, or nothing. */
export type CitationShapeRefusal = 'notCitable' | 'unknownRecord' | 'reasonMissing'

/** What the reducer asks of a citation: a kind and stance of the table, a record the scope holds, a reason to depart. */
export function citationShapeRefusal(model: Model, citation: Citation): CitationShapeRefusal | undefined {
  if (!isCiting(citation.about.kind) || !(stancesOf(citation.about.kind) as readonly string[]).includes(citation.stance)) return 'notCitable'
  if (!holdsCiting(model, citation.about)) return 'unknownRecord'
  if (citation.stance === 'deviates' && !citation.reason?.trim()) return 'reasonMissing'
  return undefined
}

/** Why a principle cannot be cited so: departed from while fixed, or cited anew while retired or absorbed. */
export type CitationPrincipleRefusal = 'principleFixed' | 'principleRetired'

/**
 * What the principle cited says about the citation (§7): asked where the
 * principle is read — the page and the agent — since it may be kept in
 * another scope than the step's.
 */
export function citationPrincipleRefusal(
  principle: Pick<Principle, 'regime' | 'status' | 'mergedInto'>, stance: CitationStance,
): CitationPrincipleRefusal | undefined {
  if (!principleCitable(principle)) return 'principleRetired'
  if (stance === 'deviates' && principle.regime === 'fixed') return 'principleFixed'
  return undefined
}

/** One scope's citations as a merge or a move hands them on: what it keeps, and what it now has. */
export type CarriedCitations = { readonly from: Citation[]; readonly to: Citation[]; readonly moved: number }

/** Whether two citations say the same: one record, one principle, one aspect, one stance. */
function sameCitation(one: Citation, other: Citation): boolean {
  return isAboutRecord(one, other.about) && one.principle.scope === other.principle.scope && one.principle.id === other.principle.id
    && one.aspect === other.aspect && one.stance === other.stance
}

/**
 * A record's citations, carried as its thread is (ADR-0041 §7, ADR-0037 §6):
 * by a merge to the survivor (`into`), by a move to the scope it now lives in
 * (`into` is `about`). Each keeps its id, its principle, its stance, its
 * reason and its day; one the survivor already says the same of is said once.
 * `leaving` and `arriving` are the two scopes' lists, the same list where the
 * merge is within one scope.
 */
export function carryCitations(
  leaving: readonly Citation[], arriving: readonly Citation[], about: RecordKey, into: RecordKey, oneScope: boolean,
): CarriedCitations {
  const going = leaving.filter((one) => isAboutRecord(one, about))
  if (going.length === 0) return { from: [...leaving], to: [...arriving], moved: 0 }
  const kept = leaving.filter((one) => !isAboutRecord(one, about))
  const base = oneScope ? kept : [...arriving]
  const to = [...base]
  for (const one of going) {
    const carried = { ...one, about: into }
    if (!to.some((held) => sameCitation(held, carried))) to.push(carried)
  }
  return { from: oneScope ? to : kept, to, moved: going.length }
}

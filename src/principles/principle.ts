// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What an architecture principle is (ADR-0041): a record of any scope,
 * `PR-0001`, read by every scope below as *From <scope>* and by every scope a
 * topic is relevant to. One idea is one principle; its separate claims are
 * its aspects, written `PR-0001.2`. Fixed or flexible, said once in words: a
 * decision may depart only from a flexible one.
 *
 * The model keeps the principle itself (`model/principle.ts`); this is
 * what the screens read beside it: the citations, how a principle is used,
 * and the order a page lists them in. Pure.
 */

export type {
  Aspect, AspectNature, Principle, PrincipleGroup, PrincipleId, PrincipleRef, PrincipleRegime, PrincipleRelation,
  PrincipleRelationKind, PrincipleStatus, Sharpening,
} from '../model/principle'
export {
  ASPECT_NATURES, formatAspectNumber, formatPrincipleNumber, isCitable, isStanding, mergePrinciples, nextPrincipleNumber,
  PRINCIPLE_REGIMES, PRINCIPLE_RELATION_KINDS, PRINCIPLE_STATUSES, sharpens, withAspect,
} from '../model/principle'
import type { Principle, PrincipleGroup, PrincipleRef } from '../model/principle'

export type { CitationStance, CitingKind } from '../model/citable'
export { CITATION_STANCES, CITING_KINDS, stancesOf } from '../model/citable'
import { citationPrincipleRefusal, stancesOf } from '../model/citable'
import type { Citation as KeptCitation, CitationStance, CitingKind } from '../model/citable'

/** A record that may cite a principle, by kind and id: a plan is the model's `transition`. */
export type CitingRecord = { kind: CitingKind; id: string }

/** A citation as a screen reads it: the model's, with the scope that keeps the record that cites. */
export type Citation = KeptCitation & { about: CitingRecord; scope: string }

/** Why a citation is refused, as the screen says it. */
export type CitationRefusal = 'principleFixed' | 'principleRetired' | 'reasonMissing' | 'stanceNotHere'

/**
 * Whether a citation may be written as it stands (ADR-0041 §7): a stance the
 * kind may take, a principle that may be cited anew and, to depart, one that
 * is flexible, with a reason.
 */
export function citationRefusal(
  principle: Pick<Principle, 'regime' | 'status' | 'mergedInto'>, about: CitingKind, stance: CitationStance, reason: string | undefined,
): CitationRefusal | undefined {
  if (!stancesOf(about).includes(stance)) return 'stanceNotHere'
  const said = citationPrincipleRefusal(principle, stance)
  if (said) return said
  if (stance === 'deviates' && !reason?.trim()) return 'reasonMissing'
  return undefined
}

/** The next aspect number: never one used before, removed ones included (ADR-0041 §2). */
export function nextAspectNumber(principle: Pick<Principle, 'lastAspect'>): number {
  return principle.lastAspect + 1
}

/** Whether a principle may be removed: only while nothing cites it; otherwise it is retired. */
export function mayRemove(principle: Pick<Principle, 'id'>, scope: string, citations: readonly Citation[]): boolean {
  return !citations.some((one) => one.principle.id === principle.id && one.principle.scope === scope)
}

/** How a principle is used: cited, departed from, and tested in observations. */
export type PrincipleUse = {
  cited: number
  departed: number
  tested: number
  holds: number
  chafes: number
  missing: number
}

export function principleUse(ref: PrincipleRef, citations: readonly Citation[]): PrincipleUse {
  const of = citations.filter((one) => one.principle.id === ref.id && one.principle.scope === ref.scope)
  const count = (stance: CitationStance) => of.filter((one) => one.stance === stance).length
  return {
    cited: count('supports'),
    departed: count('deviates'),
    tested: of.filter((one) => one.about.kind === 'observation').length,
    holds: count('holds'),
    chafes: count('chafes'),
    missing: count('missing'),
  }
}

/** The principles in the order the page lists them: by group, in the scope's order, then the ungrouped, by number. */
export function groupedPrinciples(
  principles: readonly Principle[], groups: readonly PrincipleGroup[],
): { group: PrincipleGroup | undefined; principles: Principle[] }[] {
  const live = principles.filter((one) => !one.mergedInto)
  const byNumber = (a: Principle, b: Principle) => a.number - b.number
  const sections = groups.map((group) => ({
    group: group as PrincipleGroup | undefined,
    principles: live.filter((one) => one.groups[0] === group.id || (one.groups.includes(group.id) && !groups.some((g) => g.id === one.groups[0]))).sort(byNumber),
  }))
  const ungrouped = live.filter((one) => !one.groups.some((id) => groups.some((group) => group.id === id))).sort(byNumber)
  return [...sections.filter((one) => one.principles.length > 0), ...(ungrouped.length ? [{ group: undefined, principles: ungrouped }] : [])]
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * An architecture principle (ADR-0041): a record of any scope, `PR-0001`,
 * read by every scope below as *From <scope>* and by every scope a topic is
 * relevant to. One idea is one principle; its separate claims are its
 * aspects, written `PR-0001.2`. Fixed or flexible, said once in words: a
 * decision may depart only from a flexible one.
 *
 * Pure: the shapes, the numbering and the rules the reducer, a screen and the
 * agent read alike.
 */

export type PrincipleId = string

export type PrincipleRegime = 'fixed' | 'flexible'
export const PRINCIPLE_REGIMES: readonly PrincipleRegime[] = ['fixed', 'flexible']

export type PrincipleStatus = 'candidate' | 'accepted' | 'retired'
export const PRINCIPLE_STATUSES: readonly PrincipleStatus[] = ['candidate', 'accepted', 'retired']

export type AspectNature = 'design' | 'behaviour'
export const ASPECT_NATURES: readonly AspectNature[] = ['design', 'behaviour']

/** One claim of a principle (§2). Numbers are per principle and never reused. */
export type Aspect = {
  id: string
  number: number
  text: string
  nature: AspectNature
  /** What would show it holds: a measure, a share, a count. */
  signal?: string
  /** What steers it: who or what keeps it true. */
  steering?: string
}

/** A group of a scope's principles (§3): the scope's own ordered list, kept with its principles. */
export type PrincipleGroup = { id: string; name: string; description?: string }

/** A principle somewhere in the tree: the scope it is kept in, and its id. */
export type PrincipleRef = { scope: string; id: PrincipleId }

export type PrincipleRelationKind = 'tension' | 'refines'
export const PRINCIPLE_RELATION_KINDS: readonly PrincipleRelationKind[] = ['tension', 'refines']

/** A relation a principle makes (§5), to a principle here or above. */
export type PrincipleRelation = { kind: PrincipleRelationKind; to: PrincipleRef }

/** A change to an accepted principle's statement or aspects, with its note (§4): a citation older than it predates it. */
export type Sharpening = { on: string; note: string }

export type Principle = {
  id: PrincipleId
  /** Sequential within the scope; `PR-0007` on screen. Never reused. */
  number: number
  title: string
  /** Markdown. */
  statement: string
  rationale?: string
  implications?: string
  keywords?: readonly string[]
  aspects: readonly Aspect[]
  /** The highest aspect number ever given, removed ones included: the next is one more. */
  lastAspect: number
  /** The groups it sits in, by id. */
  groups: readonly string[]
  regime: PrincipleRegime
  status: PrincipleStatus
  /** What a candidate asks: the question its discussion is about. */
  question?: string
  /** The day it was accepted, `yyyy-mm-dd`. */
  acceptedOn?: string
  relations?: readonly PrincipleRelation[]
  sharpened?: readonly Sharpening[]
  /** Absorbed by another in a merge (§6): kept as history, that principle's id. */
  mergedInto?: PrincipleId
}

export function formatPrincipleNumber(number: number): string {
  return `PR-${String(number).padStart(4, '0')}`
}

/** `PR-0001.2`: the principle's number, a dot and the aspect's. */
export function formatAspectNumber(principle: number, aspect: number): string {
  return `${formatPrincipleNumber(principle)}.${aspect}`
}

export function nextPrincipleNumber(list: readonly Pick<Principle, 'number'>[]): number {
  return list.reduce((max, one) => Math.max(max, one.number), 0) + 1
}

/** Whether a principle stands: not absorbed by another. A retired one still stands, and reads. */
export function isStanding(principle: Pick<Principle, 'mergedInto'>): boolean {
  return principle.mergedInto === undefined
}

/** Whether a principle may be cited anew (§7): standing and not retired. */
export function isCitable(principle: Pick<Principle, 'mergedInto' | 'status'>): boolean {
  return isStanding(principle) && principle.status !== 'retired'
}

/** A new aspect on a principle: the next number, never one used before, and `lastAspect` moved on. */
export function withAspect(
  principle: Principle, aspect: Omit<Aspect, 'number'>,
): Principle {
  const number = principle.lastAspect + 1
  return { ...principle, aspects: [...principle.aspects, { ...aspect, number }], lastAspect: number }
}

/** The aspect a number names, on this principle; `undefined` where it has none of it any more. */
export function aspectByNumber(principle: Pick<Principle, 'aspects'>, number: number): Aspect | undefined {
  return principle.aspects.find((one) => one.number === number)
}

/**
 * Why a principle's aspects cannot be as they are (§2), or nothing: none at
 * all, a number used twice, or one past the highest ever given — which would
 * be a number a later aspect is given again.
 */
export function aspectsRefusal(principle: Pick<Principle, 'aspects' | 'lastAspect'>): 'aspectsEmpty' | 'aspectNumber' | undefined {
  if (principle.aspects.length === 0) return 'aspectsEmpty'
  const numbers = principle.aspects.map((one) => one.number)
  if (new Set(numbers).size !== numbers.length) return 'aspectNumber'
  if (numbers.some((one) => !Number.isInteger(one) || one < 1 || one > principle.lastAspect)) return 'aspectNumber'
  return undefined
}

/** What an aspect says, compared: its words and its nature, which a sharpening is about. */
function claims(principle: Pick<Principle, 'aspects'>): string {
  return JSON.stringify(principle.aspects.map((one) => [one.number, one.text.trim(), one.nature]))
}

/**
 * Whether going from `held` to `next` sharpens an accepted principle (§4):
 * its statement or what its aspects claim changed while it was accepted.
 */
export function sharpens(held: Principle, next: Principle): boolean {
  if (held.status !== 'accepted' || next.status !== 'accepted') return false
  return held.statement.trim() !== next.statement.trim() || claims(held) !== claims(next)
}

/**
 * Whether a change may land as it stands (§4): a change that sharpens an
 * accepted principle carries one more note than it had, and an undo that
 * takes a note back takes the change with it.
 */
export function sharpenRefusal(held: Principle, next: Principle): 'sharpenNote' | undefined {
  if (!sharpens(held, next)) return undefined
  const before = held.sharpened?.length ?? 0
  const after = next.sharpened?.length ?? 0
  // A note added with the change, or one taken back with it (an undo): either is the change said.
  return after === before ? 'sharpenNote' : undefined
}

/** The note a change says it sharpened with, added to the principle's list. */
export function sharpenedWith(principle: Principle, note: string, on: string): Principle {
  return { ...principle, sharpened: [...(principle.sharpened ?? []), { on, note: note.trim() }] }
}

/**
 * One principle absorbing others of its scope (§6): their aspects come after
 * its own, renumbered from its next number on, their groups and relations
 * join its own, and each absorbed one is kept as history with `mergedInto`.
 * Answers the survivor and the absorbed as they will be. The citations and
 * comments that follow are the caller's (ADR-0041 §7).
 */
export function mergePrinciples(
  survivor: Principle, absorbed: readonly Principle[],
): { survivor: Principle; absorbed: Principle[]; renumbered: { from: PrincipleId; aspect: number; now: number }[] } {
  let next = survivor
  const renumbered: { from: PrincipleId; aspect: number; now: number }[] = []
  for (const one of absorbed) {
    for (const aspect of one.aspects) {
      const { number: was, ...rest } = aspect
      next = withAspect(next, rest)
      renumbered.push({ from: one.id, aspect: was, now: next.lastAspect })
    }
    const relations = uniqueRelations([...(next.relations ?? []), ...(one.relations ?? [])], survivor.id)
    const keywords = [...new Set([...(next.keywords ?? []), ...(one.keywords ?? [])])]
    const { relations: _relations, keywords: _keywords, ...rest } = next
    void _relations; void _keywords
    next = {
      ...rest,
      groups: [...new Set([...next.groups, ...one.groups])],
      ...(relations.length ? { relations } : {}),
      ...(keywords.length ? { keywords } : {}),
    }
  }
  return { survivor: next, absorbed: absorbed.map((one) => ({ ...one, mergedInto: survivor.id })), renumbered }
}

/** Relations once each, and none from a principle to itself — which a merge of two related ones would leave. */
function uniqueRelations(list: readonly PrincipleRelation[], self: PrincipleId): PrincipleRelation[] {
  const seen = new Set<string>()
  return list.filter((one) => {
    const key = `${one.kind}:${one.to.scope}/${one.to.id}`
    if (one.to.id === self || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

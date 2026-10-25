// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Which principles may apply to what is being written (ADR-0041): the
 * record's title, body and subject matched against each principle's
 * statement, aspects, keywords and group names, with the one folding rule
 * `textSearch` has, plus what other records about the same subject cite.
 * Each suggestion carries its `matched` words and its `why`. The same
 * function answers the screen's *May apply* and the agent's
 * `principles.suggest`.
 *
 * Pure.
 */
import { fold } from '../model/textSearch'
import type { Aspect, Principle, PrincipleGroup, PrincipleRef } from './principle'

/** A principle in force somewhere, with where it comes from. */
export type PrincipleInForce = {
  scope: string
  principle: Principle
  groups: readonly PrincipleGroup[]
}

export type Suggestion = {
  ref: PrincipleRef
  principle: Principle
  /** The aspect that matched best, where one did. */
  aspect?: Aspect
  /** The words of the record that matched, folded. */
  matched: readonly string[]
  /** Why it is suggested: the words, or what others about the same subject cite. */
  why: 'words' | 'subject' | 'both'
  score: number
}

/** Words too common to say anything about what a record is about. */
const STOP = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'are', 'was', 'were', 'has', 'have', 'not', 'but', 'all', 'any',
  'one', 'two', 'its', 'our', 'their', 'who', 'what', 'when', 'where', 'which', 'how', 'why', 'will', 'can', 'may', 'must',
  'een', 'het', 'van', 'voor', 'met', 'die', 'dat', 'wordt', 'worden', 'zijn', 'niet', 'naar', 'ook', 'als', 'bij', 'door',
  'der', 'die', 'das', 'und', 'mit', 'für', 'von', 'ist', 'nicht', 'auf', 'ein', 'eine',
])

/** The words of a text worth matching: folded, four letters or more, no stop words, a plural's -s taken off. */
export function wordsOf(text: string): Set<string> {
  const words = fold(text).split(/[^a-z0-9]+/).filter((word) => word.length >= 4 && !STOP.has(word))
  return new Set(words.map(stem))
}

function stem(word: string): string {
  return word.length > 5 && word.endsWith('s') ? word.slice(0, -1) : word
}

/**
 * The principles that may apply to `text`, best first: at least `minimum`
 * shared words, or cited by another record about the same subject. Retired
 * and merged ones are never suggested, nor the ones already cited.
 */
export function suggestPrinciples(args: {
  text: string
  inForce: readonly PrincipleInForce[]
  /** Principles other records about the same subject cite. */
  citedNearby?: readonly PrincipleRef[]
  alreadyCited?: readonly PrincipleRef[]
  minimum?: number
  limit?: number
}): Suggestion[] {
  const record = wordsOf(args.text)
  const same = (a: PrincipleRef, b: PrincipleRef) => a.id === b.id && a.scope === b.scope
  const out: Suggestion[] = []
  for (const { scope, principle, groups } of args.inForce) {
    if (principle.status === 'retired' || principle.mergedInto) continue
    const ref = { scope, id: principle.id }
    if (args.alreadyCited?.some((one) => same(one, ref))) continue
    const groupNames = groups.filter((group) => principle.groups.includes(group.id)).map((group) => group.name)
    const own = wordsOf([principle.title, principle.statement, ...(principle.keywords ?? []), ...groupNames].join(' '))
    const matched = [...record].filter((word) => own.has(word))
    let best: { aspect: Aspect; count: number } | undefined
    for (const aspect of principle.aspects) {
      const words = wordsOf(aspect.text)
      const count = [...record].filter((word) => words.has(word)).length
      if (count > 0 && (!best || count > best.count)) best = { aspect, count }
      for (const word of record) if (words.has(word) && !matched.includes(word)) matched.push(word)
    }
    const nearby = args.citedNearby?.some((one) => same(one, ref)) ?? false
    const byWords = matched.length >= (args.minimum ?? 2)
    if (!byWords && !nearby) continue
    out.push({
      ref, principle, ...(best ? { aspect: best.aspect } : {}), matched,
      why: byWords && nearby ? 'both' : byWords ? 'words' : 'subject',
      score: matched.length + (nearby ? 2 : 0),
    })
  }
  return out.sort((a, b) => b.score - a.score || a.principle.number - b.principle.number).slice(0, args.limit ?? 5)
}

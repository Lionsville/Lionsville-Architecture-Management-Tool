// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Who might already be in the register (ADR-0036): checked on every way a
 * person comes in — the People page, a CSV row, and every picker that adds
 * someone — before anyone is added, and over the whole register for the pairs
 * a merge could tidy.
 *
 * Four signs, and any one of them is enough to ask:
 *
 * 1. **the same work address**;
 * 2. **the same name**, ignoring case, accents and spacing;
 * 3. **names within two letters of each other** — *Pia Schultz* and
 *    *Pia Schulz*;
 * 4. **the same family name and first initial** — *J. Smit* and *Julia Smit*.
 *
 * A suggestion, never a refusal: two people may share a name, and adding
 * anyway makes a second entry, which a merge can join later. Only entries
 * that still have a name are compared — a forgotten one is nobody to match,
 * and a redirect is the entry it points at.
 */
import type { Person } from './person'
import { isRedirect, normalEmail } from './person'

/** Why two entries may be one person, strongest first. */
export const DUPLICATE_SIGNS = ['sameEmail', 'sameName', 'nearName', 'familyAndInitial'] as const
export type DuplicateSign = (typeof DUPLICATE_SIGNS)[number]

/** Someone already in the register, and the sign that suggests them. */
export type PossibleDuplicate = { person: Person; sign: DuplicateSign }

/** Two entries that may be one person: `keep` is the one a merge would keep. */
export type DuplicatePair = { keep: Person; drop: Person; sign: DuplicateSign }

/** What is compared about a candidate: a name, and an address where there is one. */
export type Candidate = { name?: string; email?: string }

/** A name as the signs compare it: no accents, lower case, letters and single spaces. */
export function comparableName(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

/** How many single-letter edits turn one text into the other. */
export function editDistance(one: string, other: string): number {
  if (one === other) return 0
  let previous = Array.from({ length: other.length + 1 }, (_, at) => at)
  for (let i = 1; i <= one.length; i++) {
    const row = [i]
    for (let j = 1; j <= other.length; j++) {
      row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (one[i - 1] === other[j - 1] ? 0 : 1))
    }
    previous = row
  }
  return previous[other.length]
}

/** Shorter than this, two names two edits apart are two names, not a typing slip. */
const NEAR_FROM = 5

/** A candidate as the signs compare it, folded once. */
type Folded = { mail: string; name: string; parts: string[] }

function folded(candidate: Candidate): Folded {
  const name = comparableName(candidate.name ?? '')
  return { mail: candidate.email ? normalEmail(candidate.email) : '', name, parts: name ? name.split(' ') : [] }
}

/** The strongest sign two candidates share, or none. */
export function signBetween(one: Candidate, other: Candidate): DuplicateSign | undefined {
  return signOf(folded(one), folded(other))
}

function signOf(a: Folded, b: Folded): DuplicateSign | undefined {
  if (a.mail && a.mail === b.mail) return 'sameEmail'
  if (!a.name || !b.name) return undefined
  if (a.name === b.name) return 'sameName'
  if (Math.min(a.name.length, b.name.length) >= NEAR_FROM && Math.abs(a.name.length - b.name.length) <= 2 && editDistance(a.name, b.name) <= 2) {
    return 'nearName'
  }
  if (a.parts.length > 1 && b.parts.length > 1 && a.parts.at(-1) === b.parts.at(-1) && a.parts[0][0] === b.parts[0][0]) {
    return 'familyAndInitial'
  }
  return undefined
}

/** Whether an entry is one a candidate is compared with: named, and not a redirect. */
function comparable(person: Person): boolean {
  return !isRedirect(person) && person.state !== 'forgotten' && (person.name !== undefined || person.email !== undefined)
}

/**
 * Everyone in the register a candidate may be, strongest sign first. `except`
 * leaves an entry out — the one being corrected.
 */
export function possibleDuplicates(candidate: Candidate, people: readonly Person[], except?: string): PossibleDuplicate[] {
  const found: PossibleDuplicate[] = []
  for (const person of people) {
    if (person.id === except || !comparable(person)) continue
    const sign = signBetween(candidate, person)
    if (sign) found.push({ person, sign })
  }
  return found.sort((one, other) => DUPLICATE_SIGNS.indexOf(one.sign) - DUPLICATE_SIGNS.indexOf(other.sign))
}

/**
 * Every pair in the register that may be one person, each pair once. The one
 * kept is the one more is known about — still active over left, an address
 * over none — and the older entry where nothing tells them apart, so a merge
 * suggested twice suggests the same thing.
 */
export function duplicatePairs(people: readonly Person[]): DuplicatePair[] {
  const named = people.filter(comparable)
  const folds = named.map(folded)
  const pairs: DuplicatePair[] = []
  // Only the pairs a sign could join are compared — not every pair, which a
  // register of a few thousand would take seconds over — in the order every
  // pair would be met, so the answer is the one comparing them all gives.
  for (const code of [...candidatePairs(folds)].sort((one, other) => one - other)) {
    const i = Math.floor(code / folds.length)
    const j = code % folds.length
    const sign = signOf(folds[i], folds[j])
    if (!sign) continue
    const [keep, drop] = weight(named[j]) > weight(named[i]) ? [named[j], named[i]] : [named[i], named[j]]
    pairs.push({ keep, drop, sign })
  }
  return pairs.sort((one, other) => DUPLICATE_SIGNS.indexOf(one.sign) - DUPLICATE_SIGNS.indexOf(other.sign))
}

/**
 * Every pair that may share a sign, each as `i * n + j` with `i < j`: the same
 * address, the same name, the same family name and initial — each a key two
 * entries share — and names that may be within two edits of each other. Two
 * texts two edits apart share at least the longer one's length less five of
 * their pairs of letters, counted with repeats (the q-gram lemma, q = 2): only
 * names that do are compared letter by letter.
 */
function candidatePairs(folds: readonly Folded[]): Set<number> {
  const n = folds.length
  const found = new Set<number>()
  const pair = (one: number, other: number) => {
    if (one !== other) found.add(one < other ? one * n + other : other * n + one)
  }
  const sharing = (key: (fold: Folded) => string | undefined) => {
    const groups = new Map<string, number[]>()
    folds.forEach((fold, at) => {
      const held = key(fold)
      if (!held) return
      const group = groups.get(held)
      if (group) group.push(at)
      else groups.set(held, [at])
    })
    for (const group of groups.values()) for (let x = 0; x < group.length; x++) for (let y = x + 1; y < group.length; y++) pair(group[x], group[y])
  }
  sharing((fold) => fold.mail || undefined)
  sharing((fold) => fold.name || undefined)
  sharing((fold) => (fold.parts.length > 1 ? `${fold.parts.at(-1)}\u0000${fold.parts[0][0]}` : undefined))
  // Two names of five letters may be two edits apart and share no pair at all: those are all compared.
  sharing((fold) => (fold.name.length === NEAR_FROM ? 'five' : undefined))
  // Near names: every name long enough, by its pairs of letters.
  const grams = folds.map((fold) => (fold.name.length >= NEAR_FROM ? bigrams(fold.name) : undefined))
  const postings = new Map<string, [number, number][]>()
  grams.forEach((held, at) => {
    for (const [gram, count] of held ?? []) {
      const list = postings.get(gram)
      if (list) list.push([at, count])
      else postings.set(gram, [[at, count]])
    }
  })
  grams.forEach((held, at) => {
    if (!held) return
    const shared = new Map<number, number>()
    for (const [gram, count] of held) {
      for (const [other, theirs] of postings.get(gram) ?? []) {
        if (other > at) shared.set(other, (shared.get(other) ?? 0) + Math.min(count, theirs))
      }
    }
    const length = folds[at].name.length
    for (const [other, common] of shared) {
      const theirs = folds[other].name.length
      if (Math.abs(length - theirs) <= 2 && common >= Math.max(length, theirs) - 5) pair(at, other)
    }
  })
  return found
}

/** A text's pairs of letters, with how often each occurs. */
function bigrams(text: string): Map<string, number> {
  const held = new Map<string, number>()
  for (let at = 0; at + 1 < text.length; at++) {
    const gram = text.slice(at, at + 2)
    held.set(gram, (held.get(gram) ?? 0) + 1)
  }
  return held
}

function weight(person: Person): number {
  return (person.state === 'active' ? 2 : 0) + (person.email ? 1 : 0)
}

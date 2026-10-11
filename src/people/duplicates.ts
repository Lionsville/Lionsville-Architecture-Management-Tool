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

/** The strongest sign two candidates share, or none. */
export function signBetween(one: Candidate, other: Candidate): DuplicateSign | undefined {
  const mail = one.email ? normalEmail(one.email) : ''
  if (mail && other.email && mail === normalEmail(other.email)) return 'sameEmail'
  const a = comparableName(one.name ?? '')
  const b = comparableName(other.name ?? '')
  if (!a || !b) return undefined
  if (a === b) return 'sameName'
  if (Math.min(a.length, b.length) >= NEAR_FROM && editDistance(a, b) <= 2) return 'nearName'
  const partsA = a.split(' ')
  const partsB = b.split(' ')
  if (partsA.length > 1 && partsB.length > 1 && partsA.at(-1) === partsB.at(-1) && partsA[0][0] === partsB[0][0]) {
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
  const pairs: DuplicatePair[] = []
  for (let i = 0; i < named.length; i++) {
    for (let j = i + 1; j < named.length; j++) {
      const sign = signBetween(named[i], named[j])
      if (!sign) continue
      const [keep, drop] = weight(named[j]) > weight(named[i]) ? [named[j], named[i]] : [named[i], named[j]]
      pairs.push({ keep, drop, sign })
    }
  }
  return pairs.sort((one, other) => DUPLICATE_SIGNS.indexOf(one.sign) - DUPLICATE_SIGNS.indexOf(other.sign))
}

function weight(person: Person): number {
  return (person.state === 'active' ? 2 : 0) + (person.email ? 1 : 0)
}

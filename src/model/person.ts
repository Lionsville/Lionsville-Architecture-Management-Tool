// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A person, as the model names one (ADR-0036).
 *
 * The model holds no person. People are kept in a register outside the
 * history (`people/`, `ports/PeopleRepository.ts`), so that a name can be
 * forgotten without rewriting a step, a record, the index or a snapshot. What
 * the model holds is a **reference**: the id of an entry in that register, or
 * — as every name field held before 3.6.0, and still may — plain text.
 *
 * Here rather than in `people/`, because the fields that will hold one are the
 * model's own (`owner`, `by`, `proposedBy`, `signers`), and the model is the
 * bottom of the tree: it may name the shape of a reference and nothing about
 * the register it points into. What a reference reads as on a screen is the
 * register's to say (`people/shown.ts`).
 */

/** An entry in the register: random, never derived from the name, and never reused. */
export type PersonId = string

/** A person picked from the register, by id. */
export type PickedPerson = { readonly person: PersonId }

/**
 * A name field's value: a person picked from the register, or text as typed.
 * Text is what every name field held before the register existed, and what
 * one still holds where nobody picked an entry.
 */
export type PersonRef = PickedPerson | string

/** Whether a reference points into the register. */
export function isPicked(ref: PersonRef | undefined): ref is PickedPerson {
  return typeof ref === 'object' && ref !== null && typeof ref.person === 'string' && ref.person.length > 0
}

/** The register id a reference points at; `undefined` for text and for nothing. */
export function personIdOf(ref: PersonRef | undefined): PersonId | undefined {
  return isPicked(ref) ? ref.person : undefined
}

/** A reference to an entry. */
export function pickedPerson(id: PersonId): PickedPerson {
  return { person: id }
}

/**
 * Whether a value read from a file or a call is a reference: text, or an
 * object with a `person` id and nothing else a reader would have to keep.
 */
export function isPersonRef(value: unknown): value is PersonRef {
  if (typeof value === 'string') return true
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const keys = Object.keys(value)
  return keys.length === 1 && keys[0] === 'person' && typeof (value as PickedPerson).person === 'string'
    && (value as PickedPerson).person.length > 0
}

/**
 * Every register id a value names, wherever in it a reference sits: a model,
 * a record, a step. Read by shape rather than by field, so a field that takes
 * a person later is found without this learning its name — what lets a
 * working file made from part of the tree carry the entries that part names,
 * and a test say that no step holds anything but an id.
 */
export function personIdsIn(value: unknown, into: Set<PersonId> = new Set()): Set<PersonId> {
  if (Array.isArray(value)) {
    for (const item of value) personIdsIn(item, into)
  } else if (typeof value === 'object' && value !== null) {
    if (isPersonRef(value)) into.add((value as PickedPerson).person)
    else for (const item of Object.values(value)) personIdsIn(item, into)
  }
  return into
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A library of the operating model: unit types, roles and responsibilities a
 * framework offers to start from, shipped with the app as read-only data with
 * a version, in English, Dutch and German (ADR-0036 §5).
 *
 * **A library is a starting point, not a standard.** What is brought in
 * belongs to the organisation from then on: renamed, rewritten, cut. Each item
 * keeps `basedOn` — the library, the entry, the version and the language its
 * words were taken in — so a later version can be compared against it, and
 * nothing is merged into it in silence.
 *
 * **The words are this project's own.** A framework's name says where an item
 * came from, and the frameworks' own terms name what they name — a Scrum
 * Master, an Agile Release Train, a stream-aligned team. Every purpose and
 * every description is written here, in this project's words, and nothing is
 * copied from a framework's publications: copied text would bring its licence
 * with it.
 *
 * An entry names the others of its own library by entry id; bringing items in
 * turns those into the ids of the records made (`bringIn.ts`).
 */
import type { Raci } from '../model/operatingModel'

/** The languages a library is written in: the app's three. */
export type LibraryLanguage = 'en' | 'nl' | 'de'

/** One text, in each of the app's languages. */
export type Words = { readonly en: string; readonly nl: string; readonly de: string }

export type LibraryUnitType = {
  readonly entry: string
  readonly name: Words
  readonly purpose: Words
  /** May sit at the top, under the organisation itself. */
  readonly top?: boolean
  /** The unit types of this library it may sit in, by entry. */
  readonly within: readonly string[]
  readonly spans?: boolean
  readonly slots: readonly { readonly role: string; readonly min: number; readonly max?: number }[]
  readonly limit?: number
}

export type LibraryRole = {
  readonly entry: string
  readonly name: Words
  /** A few letters, the same in every language. */
  readonly short: string
  readonly purpose: Words
  readonly manages?: boolean
  readonly duties: readonly { readonly responsibility: string; readonly raci: Raci }[]
}

export type LibraryResponsibility = {
  readonly entry: string
  readonly name: Words
  readonly description: Words
  readonly group: Words
}

export type Library = {
  /** What `basedOn.library` says: stable for as long as the library ships. */
  readonly id: string
  /** Raised whenever an entry's words or shape change, so *compare* can say so. */
  readonly version: string
  /** The framework's name, which is a name in every language. */
  readonly name: string
  /** What it offers, in a sentence. */
  readonly note: Words
  readonly unitTypes: readonly LibraryUnitType[]
  readonly roles: readonly LibraryRole[]
  readonly responsibilities: readonly LibraryResponsibility[]
}

/** Any entry of a library, with which list it is in. */
export type LibraryEntry =
  | { readonly kind: 'unitType'; readonly item: LibraryUnitType }
  | { readonly kind: 'role'; readonly item: LibraryRole }
  | { readonly kind: 'responsibility'; readonly item: LibraryResponsibility }

/** Every entry of a library, unit types first, then roles, then responsibilities. */
export function entriesOf(library: Library): LibraryEntry[] {
  return [
    ...library.unitTypes.map((item) => ({ kind: 'unitType' as const, item })),
    ...library.roles.map((item) => ({ kind: 'role' as const, item })),
    ...library.responsibilities.map((item) => ({ kind: 'responsibility' as const, item })),
  ]
}

/** One entry, by its id, in whichever list it is. */
export function entryOf(library: Library, entry: string): LibraryEntry | undefined {
  return entriesOf(library).find((held) => held.item.entry === entry)
}

/** A text in one language. */
export function wordsIn(words: Words, language: LibraryLanguage): string {
  return words[language]
}

/** A language a library is written in, from whatever language code the screen has. */
export function libraryLanguage(language: string): LibraryLanguage {
  return language === 'nl' || language === 'de' ? language : 'en'
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * How what the organisation brought in differs from the library it came from
 * (ADR-0036 §5) — against the version shipped now, which may be later than the
 * one it was brought in from.
 *
 * **It only reads.** The organisation's wording always wins: a difference is
 * listed for a person to look at, and nothing is ever merged into an item.
 * Each item is compared in the language its words were taken in
 * (`basedOn.language`), so a team that brought Scrum in in Dutch is not told
 * its words differ from the English.
 *
 * What an item names — the roles of a unit type's slots, the types it may sit
 * in, the responsibilities of a role's duties — is compared by entry: the
 * organisation's item for an entry is the one brought in from it, whatever it
 * is called now.
 */
import type { BasedOn, Responsibility, Role, UnitType } from '../model/operatingModel'
import { slotRange } from '../model/operatingModel'
import type { OperatingLists } from './bringIn'
import { entryOf } from './library'
import type { Library, LibraryLanguage, LibraryResponsibility, LibraryRole, LibraryUnitType } from './library'
import { libraryLanguage } from './library'
import { LIBRARIES } from './libraries'

export type ItemKind = 'unitType' | 'role' | 'responsibility'

/** An item of the organisation's operating model, as a difference names it. */
export type ItemRef = { readonly kind: ItemKind; readonly id: string; readonly name: string }

/**
 * What one difference is about.
 *
 * - `own`: the organisation's own item, from no library.
 * - `libraryGone` / `entryGone`: the library, or the entry, is no longer shipped.
 * - `version`: the library is at a later version than the item was brought in from.
 * - a field: the item's value and the library's, as words.
 * - `slot` / `within` / `duty`: one role, one type, one responsibility the item
 *   and the entry name differently, by the library's name for it (`about`).
 */
export type DifferenceKind =
  | 'own' | 'libraryGone' | 'entryGone' | 'version'
  | 'name' | 'short' | 'purpose' | 'description' | 'group' | 'manages' | 'top' | 'spans' | 'limit'
  | 'slot' | 'within' | 'duty'

export type Difference = {
  readonly item: ItemRef
  readonly what: DifferenceKind
  readonly about?: string
  /** The organisation's value; absent where it says nothing. */
  readonly here?: string
  /** The library's value; absent where it says nothing. */
  readonly there?: string
}

/** Every difference between the organisation's operating model and the libraries, item by item. */
export function compareWithLibraries(lists: OperatingLists, libraries: readonly Library[] = LIBRARIES): Difference[] {
  const context = { lists, libraries }
  return [
    ...lists.unitTypes.flatMap((item) => compareItem(context, { kind: 'unitType', id: item.id, name: item.name }, item.basedOn, item)),
    ...lists.roles.flatMap((item) => compareItem(context, { kind: 'role', id: item.id, name: item.name }, item.basedOn, item)),
    ...lists.responsibilities.flatMap((item) => compareItem(context, { kind: 'responsibility', id: item.id, name: item.name }, item.basedOn, item)),
  ]
}

type Context = { readonly lists: OperatingLists; readonly libraries: readonly Library[] }

function compareItem(context: Context, ref: ItemRef, basedOn: BasedOn | undefined, item: UnitType | Role | Responsibility): Difference[] {
  if (!basedOn) return [{ item: ref, what: 'own' }]
  const library = context.libraries.find((held) => held.id === basedOn.library)
  if (!library) return [{ item: ref, what: 'libraryGone', there: basedOn.library }]
  const entry = entryOf(library, basedOn.entry)
  if (!entry || entry.kind !== ref.kind) return [{ item: ref, what: 'entryGone', there: basedOn.entry }]
  const version: Difference[] = library.version !== basedOn.version
    ? [{ item: ref, what: 'version', here: basedOn.version, there: library.version }]
    : []
  const language = libraryLanguage(basedOn.language)
  const at = { ...context, library, language, ref }
  switch (entry.kind) {
    case 'unitType': return [...version, ...unitTypeDifferences(at, item as UnitType, entry.item)]
    case 'role': return [...version, ...roleDifferences(at, item as Role, entry.item)]
    case 'responsibility': return [...version, ...responsibilityDifferences(at, item as Responsibility, entry.item)]
  }
}

type At = Context & { readonly library: Library; readonly language: LibraryLanguage; readonly ref: ItemRef }

/** A field that differs, as words: absent and empty are the same. */
function field(at: At, what: DifferenceKind, here: string | undefined, there: string | undefined): Difference[] {
  const mine = here === '' ? undefined : here
  const theirs = there === '' ? undefined : there
  if (mine === theirs) return []
  return [{ item: at.ref, what, ...(mine !== undefined ? { here: mine } : {}), ...(theirs !== undefined ? { there: theirs } : {}) }]
}

const flag = (value: boolean | undefined) => (value ? 'true' : undefined)

/** The entry an item of the organisation's was brought in from, in this library; nothing for one of its own. */
function entryFor(at: At, id: string): string | undefined {
  const all: readonly { id: string; basedOn?: BasedOn }[] = [...at.lists.unitTypes, ...at.lists.roles, ...at.lists.responsibilities]
  const held = all.find((one) => one.id === id)
  return held?.basedOn?.library === at.library.id ? held.basedOn.entry : undefined
}

/** What the library calls one of its entries, in the item's language. */
function nameOf(at: At, entry: string): string {
  return entryOf(at.library, entry)?.item.name[at.language] ?? entry
}

/** What an item and an entry name, keyed by entry, compared key by key. */
function byEntry(
  at: At, what: 'slot' | 'within' | 'duty',
  here: ReadonlyMap<string, string>, there: ReadonlyMap<string, string>,
): Difference[] {
  const keys = [...new Set([...there.keys(), ...here.keys()])]
  return keys.flatMap((entry) => {
    const mine = here.get(entry)
    const theirs = there.get(entry)
    if (mine === theirs) return []
    return [{ item: at.ref, what, about: nameOf(at, entry), ...(mine !== undefined ? { here: mine } : {}), ...(theirs !== undefined ? { there: theirs } : {}) }]
  })
}

function unitTypeDifferences(at: At, item: UnitType, entry: LibraryUnitType): Difference[] {
  const slotsHere = new Map(item.slots.flatMap((slot) => {
    const named = entryFor(at, slot.role)
    return named ? [[named, slotRange(slot)] as const] : []
  }))
  const slotsThere = new Map(entry.slots.map((slot) => [slot.role, slotRange(slot)] as const))
  const withinHere = new Map(item.within.flatMap((id) => {
    const named = entryFor(at, id)
    return named ? [[named, 'true'] as const] : []
  }))
  const withinThere = new Map(entry.within.map((one) => [one, 'true'] as const))
  return [
    ...field(at, 'name', item.name, entry.name[at.language]),
    ...field(at, 'purpose', item.purpose, entry.purpose[at.language]),
    ...field(at, 'top', flag(item.top), flag(entry.top)),
    ...field(at, 'spans', flag(item.spans), flag(entry.spans)),
    ...field(at, 'limit', item.limit?.toString(), entry.limit?.toString()),
    ...byEntry(at, 'slot', slotsHere, slotsThere),
    ...byEntry(at, 'within', withinHere, withinThere),
  ]
}

function roleDifferences(at: At, item: Role, entry: LibraryRole): Difference[] {
  const dutiesHere = new Map(item.duties.flatMap((duty) => {
    const named = entryFor(at, duty.responsibility)
    return named ? [[named, duty.raci as string] as const] : []
  }))
  const dutiesThere = new Map(entry.duties.map((duty) => [duty.responsibility, duty.raci as string] as const))
  return [
    ...field(at, 'name', item.name, entry.name[at.language]),
    ...field(at, 'short', item.short, entry.short),
    ...field(at, 'purpose', item.purpose, entry.purpose[at.language]),
    ...field(at, 'manages', flag(item.manages), flag(entry.manages)),
    ...byEntry(at, 'duty', dutiesHere, dutiesThere),
  ]
}

function responsibilityDifferences(at: At, item: Responsibility, entry: LibraryResponsibility): Difference[] {
  return [
    ...field(at, 'name', item.name, entry.name[at.language]),
    ...field(at, 'description', item.description, entry.description[at.language]),
    ...field(at, 'group', item.group, entry.group[at.language]),
  ]
}

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
 * organisation's item for an entry is the one brought in from it, or one a
 * bring-in matched to it (`alsoBasedOn`), whatever it is called now. Both are
 * records, so a slot that names the role reused for an entry reads as that
 * entry; nothing is guessed by name.
 *
 * An item's name is read against the one it was given when it came in, where
 * that was not the library's term (`basedOn.name`): a rename chosen on the way
 * in is not a difference, and a rename since is.
 *
 * A unit type's `order` — where it stands in its lane — is the organisation's
 * alone: a library has none, so it is never a difference.
 */
import type { BasedOn, Responsibility, Role, UnitType } from '../model/operatingModel'
import { slotRange } from '../model/operatingModel'
import type { Based, OperatingLists } from './bringIn'
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
  /**
   * A name only: the one given when the item came in, where it was not the
   * library's term. The name is compared with this rather than with `there`,
   * so the difference is a rename since.
   */
  readonly chosen?: string
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
  const at = { ...context, library, language, ref, chosen: basedOn.name || undefined }
  switch (entry.kind) {
    case 'unitType': return [...version, ...unitTypeDifferences(at, item as UnitType, entry.item)]
    case 'role': return [...version, ...roleDifferences(at, item as Role, entry.item)]
    case 'responsibility': return [...version, ...responsibilityDifferences(at, item as Responsibility, entry.item)]
  }
}

type At = Context & {
  readonly library: Library
  readonly language: LibraryLanguage
  readonly ref: ItemRef
  /** The name chosen when the item came in, where it was not the library's term. */
  readonly chosen?: string
}

/** A field that differs, as words: absent and empty are the same. */
function field(at: At, what: DifferenceKind, here: string | undefined, there: string | undefined): Difference[] {
  const mine = here === '' ? undefined : here
  const theirs = there === '' ? undefined : there
  if (mine === theirs) return []
  return [{ item: at.ref, what, ...(mine !== undefined ? { here: mine } : {}), ...(theirs !== undefined ? { there: theirs } : {}) }]
}

const flag = (value: boolean | undefined) => (value ? 'true' : undefined)

/**
 * The entries of this library an item of the organisation's stands for: the
 * one it was brought in from, then those it was matched to. None for one of
 * its own.
 */
function entriesFor(at: At, id: string): string[] {
  const all: readonly Based[] = [...at.lists.unitTypes, ...at.lists.roles, ...at.lists.responsibilities]
  const held = all.find((one) => one.id === id)
  if (!held) return []
  return [held.basedOn, ...held.alsoBasedOn ?? []].flatMap((one) => (one?.library === at.library.id ? [one.entry] : []))
}

/**
 * What an item names, keyed by the entry each stands for. Of an item that
 * stands for several, the first the library names here and no earlier one
 * took — a role matched to two entries may fill two slots. What stands for no
 * entry of this library is the organisation's own, and not compared.
 */
function keyed(at: At, named: readonly (readonly [string, string])[], there: ReadonlyMap<string, string>): Map<string, string> {
  const held = new Map<string, string>()
  for (const [id, value] of named) {
    const entries = entriesFor(at, id).filter((one) => !held.has(one))
    const entry = entries.find((one) => there.has(one)) ?? entries[0]
    if (entry !== undefined) held.set(entry, value)
  }
  return held
}

/** A name, against the one chosen when the item came in where there is one, else the library's term. */
function nameField(at: At, here: string, there: string): Difference[] {
  const chosen = at.chosen
  if (chosen === undefined) return field(at, 'name', here, there)
  return here === chosen ? [] : [{ item: at.ref, what: 'name', here, there, chosen }]
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
  const slotsThere = new Map(entry.slots.map((slot) => [slot.role, slotRange(slot)] as const))
  const slotsHere = keyed(at, item.slots.map((slot) => [slot.role, slotRange(slot)] as const), slotsThere)
  const withinThere = new Map(entry.within.map((one) => [one, 'true'] as const))
  const withinHere = keyed(at, item.within.map((id) => [id, 'true'] as const), withinThere)
  return [
    ...nameField(at, item.name, entry.name[at.language]),
    ...field(at, 'purpose', item.purpose, entry.purpose[at.language]),
    ...field(at, 'top', flag(item.top), flag(entry.top)),
    ...field(at, 'spans', flag(item.spans), flag(entry.spans)),
    ...field(at, 'limit', item.limit?.toString(), entry.limit?.toString()),
    ...byEntry(at, 'slot', slotsHere, slotsThere),
    ...byEntry(at, 'within', withinHere, withinThere),
  ]
}

function roleDifferences(at: At, item: Role, entry: LibraryRole): Difference[] {
  const dutiesThere = new Map(entry.duties.map((duty) => [duty.responsibility, duty.raci as string] as const))
  const dutiesHere = keyed(at, item.duties.map((duty) => [duty.responsibility, duty.raci as string] as const), dutiesThere)
  return [
    ...nameField(at, item.name, entry.name[at.language]),
    ...field(at, 'short', item.short, entry.short),
    ...field(at, 'purpose', item.purpose, entry.purpose[at.language]),
    ...field(at, 'manages', flag(item.manages), flag(entry.manages)),
    ...byEntry(at, 'duty', dutiesHere, dutiesThere),
  ]
}

function responsibilityDifferences(at: At, item: Responsibility, entry: LibraryResponsibility): Difference[] {
  return [
    ...nameField(at, item.name, entry.name[at.language]),
    ...field(at, 'description', item.description, entry.description[at.language]),
    ...field(at, 'group', item.group, entry.group[at.language]),
  ]
}

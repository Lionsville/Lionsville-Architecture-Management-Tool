// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *What came in* (ADR-0036, amended 11 October 2026): per library, what the
 * organisation's model holds of it, read from the records alone.
 *
 * - **Made** from it — every item whose `basedOn` names the library: the
 *   library's term, in the language it came in, beside what it is called
 *   here now, and what *compare* says has changed since.
 * - **Matched** to it — every unit type and role a bring-in chose to stand
 *   for one of its entries (`alsoBasedOn`): the library's term beside the
 *   organisation's own item, "used your X".
 *
 * Nothing is inferred: an item of the organisation's that is named like an
 * entry but was never matched to it is not listed. Pure, and no words.
 */
import type { BasedOn } from '../model/operatingModel'
import type { Based, OperatingLists } from './bringIn'
import { compareWithLibraries } from './compare'
import type { Difference, ItemKind } from './compare'
import { entriesOf, entryOf, libraryLanguage } from './library'
import type { Library } from './library'
import { LIBRARIES } from './libraries'

/** One item made from an entry of a library. */
export type CameInItem = {
  readonly kind: ItemKind
  readonly id: string
  readonly entry: string
  /** The library's term, in the language it came in; absent where the library no longer has the entry. */
  readonly term?: string
  /** What it is called here now. */
  readonly name: string
  /** What *compare* says of it: the name against the one chosen when it came in, each field against the library. */
  readonly changed: readonly Difference[]
}

/** One entry of a library a bring-in matched to an item of the organisation's own. */
export type MatchedItem = {
  readonly kind: 'unitType' | 'role'
  readonly id: string
  readonly entry: string
  /** The library's term, in the language of the match; absent where the library no longer has the entry. */
  readonly term?: string
  /** The organisation's item: "used your …". */
  readonly name: string
}

export type CameIn = {
  readonly library: Library
  /** Unit types, then roles, then responsibilities, each in the library's order; entries it no longer has last. */
  readonly made: readonly CameInItem[]
  /** Unit types, then roles, in the library's order. */
  readonly matched: readonly MatchedItem[]
}

type Held = Based & { readonly kind: ItemKind; readonly name: string }

/** Every library given, in their order, with what came in from each — empty where nothing has. */
export function whatCameIn(lists: OperatingLists, libraries: readonly Library[] = LIBRARIES): CameIn[] {
  const differences = compareWithLibraries(lists, libraries)
  const held: readonly Held[] = [
    ...lists.unitTypes.map((item) => ({ ...item, kind: 'unitType' as const })),
    ...lists.roles.map((item) => ({ ...item, kind: 'role' as const })),
    ...lists.responsibilities.map((item) => ({ ...item, kind: 'responsibility' as const })),
  ]
  return libraries.map((library) => {
    const rank = new Map(entriesOf(library).map((one, index) => [one.item.entry, index]))
    const at = (entry: string) => rank.get(entry) ?? Number.MAX_SAFE_INTEGER
    // A stable sort: items of one entry keep the model's order.
    const byRank = <T extends { kind: ItemKind; entry: string }>(items: T[]) =>
      items.sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || at(a.entry) - at(b.entry))
    const made = byRank(held.flatMap((item): CameInItem[] => {
      if (item.basedOn?.library !== library.id) return []
      const term = termIn(library, item.basedOn)
      const changed = differences.filter((one) => one.item.kind === item.kind && one.item.id === item.id)
      return [{ kind: item.kind, id: item.id, entry: item.basedOn.entry, ...(term !== undefined ? { term } : {}), name: item.name, changed }]
    }))
    const matched = byRank(held.flatMap((item): MatchedItem[] => {
      const { kind } = item
      if (kind === 'responsibility') return []
      return (item.alsoBasedOn ?? []).filter((one) => one.library === library.id).map((one) => {
        const term = termIn(library, one)
        return { kind, id: item.id, entry: one.entry, ...(term !== undefined ? { term } : {}), name: item.name }
      })
    }))
    return { library, made, matched }
  })
}

const KINDS: readonly ItemKind[] = ['unitType', 'role', 'responsibility']

/** What a library calls an entry, in the language it was taken in; nothing where it has no such entry. */
function termIn(library: Library, basedOn: BasedOn): string | undefined {
  return entryOf(library, basedOn.entry)?.item.name[libraryLanguage(basedOn.language)]
}

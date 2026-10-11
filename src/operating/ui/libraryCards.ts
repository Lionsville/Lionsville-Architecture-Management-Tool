// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A library read as the structure it would make (ADR-0036, amended 11
 * October 2026), so the dialog that brings it in draws it with the lanes and
 * the cards the page draws the organisation's own types with: its unit types
 * as `UnitType`s keyed by entry, its roles by entry for the slots to name,
 * what each role answers for, and what of the organisation's already stands
 * for an entry.
 *
 * Pure, and no words beyond the library's own.
 */
import type { Command } from '../../model/commands'
import type { Raci, Role, UnitType } from '../../model/operatingModel'
import { broughtFrom, standsFor } from '../bringIn'
import type { OperatingLists } from '../bringIn'
import type { Library, LibraryLanguage, LibraryRole } from '../library'

/** A library's unit types as the lanes read them: each keyed by its entry, its places and slots naming entries. */
export function libraryTypes(library: Library, language: LibraryLanguage): UnitType[] {
  return library.unitTypes.map((item) => ({
    id: item.entry,
    name: item.name[language],
    purpose: item.purpose[language],
    ...(item.top ? { top: true } : {}),
    within: [...item.within],
    ...(item.spans ? { spans: true } : {}),
    slots: item.slots.map((slot) => ({ role: slot.role, min: slot.min, ...(slot.max !== undefined ? { max: slot.max } : {}) })),
    ...(item.limit !== undefined ? { limit: item.limit } : {}),
  }))
}

/** A role of a library as a card's slot names it. */
export type LibraryRoleCard = Pick<Role, 'id' | 'name' | 'manages'>

/** A library's roles, by entry, as the slots on its cards name them. */
export function libraryRoles(library: Library, language: LibraryLanguage): Map<string, LibraryRoleCard> {
  return new Map(library.roles.map((item) => [item.entry, { id: item.entry, name: item.name[language], ...(item.manages ? { manages: true } : {}) }]))
}

/** The roles of a library none of its unit types holds, in its order: ticked on their own. */
export function looseRoles(library: Library): LibraryRole[] {
  const held = new Set(library.unitTypes.flatMap((item) => item.slots.map((slot) => slot.role)))
  return library.roles.filter((item) => !held.has(item.entry))
}

/** One responsibility a role of a library answers for, and its part in it. */
export type Answer = { readonly entry: string; readonly name: string; readonly raci: Raci }

/** What a role of a library answers for, in the role's order; none for an entry that is no role. */
export function answersOf(library: Library, role: string, language: LibraryLanguage): Answer[] {
  const item = library.roles.find((one) => one.entry === role)
  return (item?.duties ?? []).flatMap((duty) => {
    const responsibility = library.responsibilities.find((one) => one.entry === duty.responsibility)
    return responsibility ? [{ entry: responsibility.entry, name: responsibility.name[language], raci: duty.raci }] : []
  })
}

/**
 * What of the organisation's stands for an entry already: its id and its
 * name now, and whether it was matched to the entry at a bring-in rather
 * than brought in from it. Nothing where nothing stands for it.
 */
export type Standing = { readonly id: string; readonly name: string; readonly matched: boolean }

export function standingFor(lists: OperatingLists, library: Library, entry: string): Standing | undefined {
  const there = broughtFrom(lists, library.id, entry)
  if (!there) return undefined
  const all: readonly { id: string; name: string }[] = [...lists.unitTypes, ...lists.roles, ...lists.responsibilities]
  const name = all.find((item) => item.id === there.id)?.name ?? there.id
  return { id: there.id, name, matched: standsFor(there, library.id, entry) === 'matched' }
}

/** The unit types, roles and responsibilities a step adds, by id, however deep its transactions go. */
export function addedBy(command: Command): Set<string> {
  const ids = new Set<string>()
  const walk = (one: Command) => {
    if (one.type === 'transaction') one.commands.forEach(walk)
    else if (one.type === 'unitType.add') ids.add(one.unitType.id)
    else if (one.type === 'role.add') ids.add(one.role.id)
    else if (one.type === 'responsibility.add') ids.add(one.responsibility.id)
  }
  walk(command)
  return ids
}

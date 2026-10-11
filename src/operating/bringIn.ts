// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Bringing a library's entries into the organisation's operating model, as
 * one step (ADR-0036 §5).
 *
 * **What comes with an entry.** A unit type brings the roles its slots name
 * and the unit types it may sit in; a role brings the responsibilities its
 * duties name. Anything else would arrive with references to nothing. The page
 * shows the whole of what an ask brings before it is written
 * ({@link entriesBrought}).
 *
 * **Nothing twice.** An entry already brought in — an item whose `basedOn`
 * names that library and entry — is not brought again: what is new refers to
 * the item that is there, under whatever name the organisation gave it since.
 *
 * Every item made keeps `basedOn`: the library, the entry, the library's
 * version and the language its words were taken in.
 */
import { transaction } from '../model/commands'
import type { Command } from '../model/commands'
import type { BasedOn, Responsibility, Role, UnitType } from '../model/operatingModel'
import { entryOf } from './library'
import type { Library, LibraryLanguage, LibraryResponsibility, LibraryRole, LibraryUnitType } from './library'

/** The organisation's operating model as lists, as a page or an agent reads it. */
export type OperatingLists = {
  readonly unitTypes: readonly UnitType[]
  readonly roles: readonly Role[]
  readonly responsibilities: readonly Responsibility[]
}

type Based = { readonly id: string; readonly basedOn?: BasedOn }

/** The item brought in from one entry of a library, if any has been. */
export function broughtFrom(lists: OperatingLists, library: string, entry: string): Based | undefined {
  const all: readonly Based[] = [...lists.unitTypes, ...lists.roles, ...lists.responsibilities]
  return all.find((item) => item.basedOn?.library === library && item.basedOn.entry === entry)
}

/** What one entry needs brought with it, by entry id. */
function needs(library: Library, entry: string): string[] {
  const held = entryOf(library, entry)
  if (!held) return []
  switch (held.kind) {
    case 'unitType': return [...held.item.slots.map((slot) => slot.role), ...held.item.within]
    case 'role': return held.item.duties.map((duty) => duty.responsibility)
    case 'responsibility': return []
  }
}

/**
 * Every entry an ask brings in: the entries asked for, what they need, what
 * that needs in turn — less what is already in the organisation's model.
 * In the library's own order.
 */
export function entriesBrought(lists: OperatingLists, library: Library, asked: readonly string[]): string[] {
  const wanted = new Set<string>()
  const visit = (entry: string) => {
    if (wanted.has(entry) || !entryOf(library, entry) || broughtFrom(lists, library.id, entry)) return
    wanted.add(entry)
    for (const next of needs(library, entry)) visit(next)
  }
  for (const entry of asked) visit(entry)
  const order = [...library.unitTypes, ...library.roles, ...library.responsibilities].map((item) => item.entry)
  return order.filter((entry) => wanted.has(entry))
}

/** Entries not brought in yet, in the library's order: what the page offers. */
export function notBroughtIn(lists: OperatingLists, library: Library): string[] {
  const order = [...library.unitTypes, ...library.roles, ...library.responsibilities].map((item) => item.entry)
  return order.filter((entry) => !broughtFrom(lists, library.id, entry))
}

export type BringIn = {
  readonly lists: OperatingLists
  readonly library: Library
  /** The entries asked for; what they need comes with them. */
  readonly entries: readonly string[]
  readonly language: LibraryLanguage
  readonly makeId: (prefix: string) => string
}

/**
 * The step that brings the entries in, or nothing where every one of them is
 * there already. One transaction: one undo takes it all out again.
 */
export function bringIn(ask: BringIn): Command | undefined {
  const { lists, library, language, makeId } = ask
  const entries = entriesBrought(lists, library, ask.entries)
  if (entries.length === 0) return undefined
  const ids = new Map<string, string>()
  const prefix = { unitType: 'ut', role: 'ro', responsibility: 'rs' } as const
  // Several ids of one kind in one step: an id the step or the model already
  // holds is made distinct rather than written over (`command.taken`).
  const taken = new Set([...lists.unitTypes, ...lists.roles, ...lists.responsibilities].map((item) => item.id))
  for (const entry of entries) ids.set(entry, distinct(makeId(prefix[entryOf(library, entry)!.kind]), taken))
  const idOf = (entry: string) => ids.get(entry) ?? broughtFrom(lists, library.id, entry)?.id
  const basedOn = (entry: string): BasedOn => ({ library: library.id, entry, version: library.version, language })
  const made: Made = { language, idOf, basedOn }

  const commands: Command[] = []
  for (const item of library.responsibilities) {
    if (ids.has(item.entry)) commands.push({ type: 'responsibility.add', responsibility: responsibilityFrom(item, made) })
  }
  for (const item of library.roles) {
    if (ids.has(item.entry)) commands.push({ type: 'role.add', role: roleFrom(item, made) })
  }
  for (const item of library.unitTypes) {
    if (ids.has(item.entry)) commands.push({ type: 'unitType.add', unitType: unitTypeFrom(item, made) })
  }
  return transaction(commands)
}

/** An id no item holds yet, kept as taken: the one given, or it with a number after it. */
export function distinct(id: string, taken: Set<string>): string {
  let held = id
  for (let n = 2; taken.has(held); n += 1) held = `${id}-${n}`
  taken.add(held)
  return held
}

type Made = {
  readonly language: LibraryLanguage
  readonly idOf: (entry: string) => string | undefined
  readonly basedOn: (entry: string) => BasedOn
}

function responsibilityFrom(item: LibraryResponsibility, made: Made): Responsibility {
  return {
    id: made.idOf(item.entry)!,
    name: item.name[made.language],
    description: item.description[made.language],
    group: item.group[made.language],
    basedOn: made.basedOn(item.entry),
  }
}

function roleFrom(item: LibraryRole, made: Made): Role {
  return {
    id: made.idOf(item.entry)!,
    name: item.name[made.language],
    short: item.short,
    purpose: item.purpose[made.language],
    duties: item.duties.flatMap((duty) => {
      const responsibility = made.idOf(duty.responsibility)
      return responsibility ? [{ responsibility, raci: duty.raci }] : []
    }),
    ...(item.manages ? { manages: true } : {}),
    basedOn: made.basedOn(item.entry),
  }
}

function unitTypeFrom(item: LibraryUnitType, made: Made): UnitType {
  return {
    id: made.idOf(item.entry)!,
    name: item.name[made.language],
    purpose: item.purpose[made.language],
    ...(item.top ? { top: true } : {}),
    within: item.within.flatMap((entry) => made.idOf(entry) ?? []),
    ...(item.spans ? { spans: true } : {}),
    slots: item.slots.flatMap((slot) => {
      const role = made.idOf(slot.role)
      return role ? [{ role, min: slot.min, ...(slot.max !== undefined ? { max: slot.max } : {}) }] : []
    }),
    ...(item.limit !== undefined ? { limit: item.limit } : {}),
    basedOn: made.basedOn(item.entry),
  }
}

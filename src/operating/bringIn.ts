// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Bringing a library's entries into the organisation's operating model, as
 * one step (ADR-0036 §5, and its amendment of 11 October 2026).
 *
 * **What comes with an entry.** A unit type brings the roles its slots name
 * and the unit types it may sit in; a role brings the responsibilities its
 * duties name. Anything else would arrive with references to nothing. The page
 * shows the whole of what an ask brings before it is written
 * ({@link entriesBrought}, {@link entriesReached}).
 *
 * **Nothing twice.** An entry already brought in — an item whose `basedOn`
 * names that library and entry — is not brought again: what is new refers to
 * the item that is there, under whatever name the organisation gave it since.
 *
 * **The person's choices** ({@link BringInChoices}), each by entry and each
 * optional, so an ask that says none brings the library as it is:
 *
 * - `names` — what an item made is called here, so a rename is not a second
 *   step;
 * - `placements` — where a unit type made sits: at the top, in the
 *   organisation's own unit types, in entries the ask brings. A type placed
 *   so does not bring the types its library would have put it in;
 * - `reuse` — a role or unit type the organisation has that stands for the
 *   entry. Nothing is brought for it, so nothing it would have needed either
 *   (a reused role's responsibilities, a reused type's roles), and every slot
 *   and `within` that named the entry names the item reused.
 *
 * Every item made keeps `basedOn`: the library, the entry, the library's
 * version and the language its words were taken in. An item reused is left as
 * it is, its own `basedOn` with it.
 */
import { transaction } from '../model/commands'
import type { Command } from '../model/commands'
import type { BasedOn, Responsibility, Role, UnitType, UnitTypeId } from '../model/operatingModel'
import { entryOf } from './library'
import type { Library, LibraryEntry, LibraryLanguage, LibraryResponsibility, LibraryRole, LibraryUnitType, Words } from './library'

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

/** A place a unit type may sit: one of the organisation's unit types, or an entry of the library brought in. */
export type Place = { readonly type: UnitTypeId } | { readonly entry: string }

/**
 * Where a unit type brought in may sit: at the top, under the organisation
 * itself, and in each place named. A place that is an entry is brought with
 * the type, as the library's own `within` is; one the ask cannot resolve —
 * a type the organisation does not hold, an entry that is no unit type — is
 * passed over.
 */
export type Placement = { readonly top: boolean; readonly within: readonly Place[] }

/** What the person chose about an ask, by entry. Anything not said is the library's. */
export type BringInChoices = {
  /** What an item made is called here. Absent or blank: the library's term in the step's language. */
  readonly names?: Readonly<Record<string, string>>
  /** Where a unit type made sits. Absent: the library's own `top` and `within`. */
  readonly placements?: Readonly<Record<string, Placement>>
  /**
   * A role or unit type of the organisation's that stands for the entry, by
   * id. One the organisation does not hold, of that kind, is passed over and
   * the entry brought in as usual.
   */
  readonly reuse?: Readonly<Record<string, string>>
}

/** A choice said for an entry, read so that an entry named like `constructor` finds nothing it was not given. */
function said<T>(record: Readonly<Record<string, T>> | undefined, entry: string): T | undefined {
  return record && Object.hasOwn(record, entry) ? record[entry] : undefined
}

/**
 * What becomes of an entry an ask reaches: `made` new; `reused`, the
 * organisation's item chosen to stand for it; `inModel`, the item already
 * brought in from it.
 */
export type Fate =
  | { readonly as: 'made' }
  | { readonly as: 'reused'; readonly id: string }
  | { readonly as: 'inModel'; readonly id: string }

/** The organisation's item chosen to stand for an entry, where the choice holds. */
function reusedFor(lists: OperatingLists, held: LibraryEntry, choices: BringInChoices): string | undefined {
  const id = said(choices.reuse, held.item.entry)
  if (id === undefined) return undefined
  if (held.kind === 'role') return lists.roles.some((role) => role.id === id) ? id : undefined
  if (held.kind === 'unitType') return lists.unitTypes.some((type) => type.id === id) ? id : undefined
  return undefined
}

function fateOf(lists: OperatingLists, library: Library, held: LibraryEntry, choices: BringInChoices): Fate {
  const reused = reusedFor(lists, held, choices)
  if (reused !== undefined) return { as: 'reused', id: reused }
  const there = broughtFrom(lists, library.id, held.item.entry)
  return there ? { as: 'inModel', id: there.id } : { as: 'made' }
}

/** The entries a unit type sits in: its placement's, or the library's own. Unit types of the library only. */
function withinEntries(library: Library, item: LibraryUnitType, choices: BringInChoices): string[] {
  const placement = said(choices.placements, item.entry)
  const entries = placement
    ? placement.within.flatMap((place) => ('entry' in place ? [place.entry] : []))
    : item.within
  return entries.filter((entry) => entryOf(library, entry)?.kind === 'unitType')
}

/** What one entry made needs brought with it, by entry id. */
function needs(library: Library, held: LibraryEntry, choices: BringInChoices): string[] {
  switch (held.kind) {
    case 'unitType': return [...held.item.slots.map((slot) => slot.role), ...withinEntries(library, held.item, choices)]
    case 'role': return held.item.duties.map((duty) => duty.responsibility)
    case 'responsibility': return []
  }
}

/** One entry an ask reaches: which list it is in, what becomes of it, and why it is there. */
export type ReachedEntry = {
  readonly entry: string
  readonly kind: LibraryEntry['kind']
  readonly fate: Fate
  /** Asked for itself, rather than only needed by another. */
  readonly asked: boolean
  /** The entries made that need it, in the order the walk met them. */
  readonly by: readonly string[]
}

/**
 * Every entry an ask reaches, in the library's order: the entries asked for,
 * what each one made needs, what that needs in turn. An entry reused or
 * already in the model is reached and needs nothing more.
 */
export function entriesReached(
  lists: OperatingLists, library: Library, asked: readonly string[], choices: BringInChoices = {},
): ReachedEntry[] {
  const reached = new Map<string, { held: LibraryEntry; fate: Fate; by: string[] }>()
  const visit = (entry: string, from?: string) => {
    const seen = reached.get(entry)
    if (seen) {
      if (from !== undefined && !seen.by.includes(from)) seen.by.push(from)
      return
    }
    const held = entryOf(library, entry)
    if (!held) return
    const fate = fateOf(lists, library, held, choices)
    reached.set(entry, { held, fate, by: from === undefined ? [] : [from] })
    if (fate.as === 'made') for (const next of needs(library, held, choices)) visit(next, entry)
  }
  for (const entry of asked) visit(entry)
  const wanted = new Set(asked)
  return orderOf(library).flatMap((entry) => {
    const one = reached.get(entry)
    return one ? [{ entry, kind: one.held.kind, fate: one.fate, asked: wanted.has(entry), by: one.by }] : []
  })
}

/** Every entry of a library, unit types first, then roles, then responsibilities. */
function orderOf(library: Library): string[] {
  return [...library.unitTypes, ...library.roles, ...library.responsibilities].map((item) => item.entry)
}

/**
 * Every entry an ask brings in: the entries asked for, what they need, what
 * that needs in turn — less what is already in the organisation's model and
 * what the choices reuse. In the library's own order.
 */
export function entriesBrought(
  lists: OperatingLists, library: Library, asked: readonly string[], choices: BringInChoices = {},
): string[] {
  return entriesReached(lists, library, asked, choices).filter((one) => one.fate.as === 'made').map((one) => one.entry)
}

/** Entries not brought in yet, in the library's order: what the page offers. */
export function notBroughtIn(lists: OperatingLists, library: Library): string[] {
  return orderOf(library).filter((entry) => !broughtFrom(lists, library.id, entry))
}

export type BringIn = BringInChoices & {
  readonly lists: OperatingLists
  readonly library: Library
  /** The entries asked for; what they need comes with them. */
  readonly entries: readonly string[]
  readonly language: LibraryLanguage
  readonly makeId: (prefix: string) => string
}

/**
 * The step that brings the entries in, or nothing where every one of them is
 * there already or reused. One transaction: one undo takes it all out again.
 */
export function bringIn(ask: BringIn): Command | undefined {
  const { lists, library, language, makeId } = ask
  const reached = entriesReached(lists, library, ask.entries, ask)
  const entries = reached.filter((one) => one.fate.as === 'made')
  if (entries.length === 0) return undefined
  const ids = new Map<string, string>()
  const prefix = { unitType: 'ut', role: 'ro', responsibility: 'rs' } as const
  // Several ids of one kind in one step: an id the step or the model already
  // holds is made distinct rather than written over (`command.taken`).
  const taken = new Set([...lists.unitTypes, ...lists.roles, ...lists.responsibilities].map((item) => item.id))
  for (const one of entries) ids.set(one.entry, distinct(makeId(prefix[one.kind]), taken))
  const standing = new Map(reached.flatMap((one) => (one.fate.as === 'made' ? [] : [[one.entry, one.fate.id] as const])))
  const made: Made = {
    language,
    idOf: (entry) => ids.get(entry) ?? standing.get(entry) ?? broughtFrom(lists, library.id, entry)?.id,
    basedOn: (entry) => ({ library: library.id, entry, version: library.version, language }),
    nameOf: (entry, name) => said(ask.names, entry)?.trim() || name[language],
    placementOf: (entry) => said(ask.placements, entry),
    holdsType: (id) => lists.unitTypes.some((type) => type.id === id),
    isTypeEntry: (entry) => entryOf(library, entry)?.kind === 'unitType',
  }

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
  /** The id an entry has in the step: made, reused, or there already. */
  readonly idOf: (entry: string) => string | undefined
  readonly basedOn: (entry: string) => BasedOn
  /** What an item made is called: the name chosen, or the library's term. */
  readonly nameOf: (entry: string, name: Words) => string
  readonly placementOf: (entry: string) => Placement | undefined
  /** The organisation holds a unit type of this id. */
  readonly holdsType: (id: UnitTypeId) => boolean
  /** The library has a unit type of this entry. */
  readonly isTypeEntry: (entry: string) => boolean
}

function responsibilityFrom(item: LibraryResponsibility, made: Made): Responsibility {
  return {
    id: made.idOf(item.entry)!,
    name: made.nameOf(item.entry, item.name),
    description: item.description[made.language],
    group: item.group[made.language],
    basedOn: made.basedOn(item.entry),
  }
}

function roleFrom(item: LibraryRole, made: Made): Role {
  return {
    id: made.idOf(item.entry)!,
    name: made.nameOf(item.entry, item.name),
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

/** Where a unit type made sits: its placement, resolved, or the library's own. */
function sitsIn(item: LibraryUnitType, made: Made): { top: boolean; within: UnitTypeId[] } {
  const placement = made.placementOf(item.entry)
  if (!placement) return { top: item.top === true, within: item.within.flatMap((entry) => made.idOf(entry) ?? []) }
  const within = placement.within.flatMap((place) => {
    if ('type' in place) return made.holdsType(place.type) ? [place.type] : []
    // An entry is a place only where it is a unit type of this library, the rule `needs` brought it by.
    return made.isTypeEntry(place.entry) ? made.idOf(place.entry) ?? [] : []
  })
  return { top: placement.top, within: [...new Set(within)] }
}

function unitTypeFrom(item: LibraryUnitType, made: Made): UnitType {
  const { top, within } = sitsIn(item, made)
  return {
    id: made.idOf(item.entry)!,
    name: made.nameOf(item.entry, item.name),
    purpose: item.purpose[made.language],
    ...(top ? { top: true } : {}),
    within,
    ...(item.spans ? { spans: true } : {}),
    slots: item.slots.flatMap((slot) => {
      const role = made.idOf(slot.role)
      return role ? [{ role, min: slot.min, ...(slot.max !== undefined ? { max: slot.max } : {}) }] : []
    }),
    ...(item.limit !== undefined ? { limit: item.limit } : {}),
    basedOn: made.basedOn(item.entry),
  }
}

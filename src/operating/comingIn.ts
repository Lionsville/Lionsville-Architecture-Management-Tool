// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *What will come in*: the step a library dialog is about to write, as rows a
 * person edits before anything is written (ADR-0036, amended 11 October 2026).
 *
 * The dialog keeps what is ticked and what was edited ({@link ComingInEdits});
 * {@link whatWillComeIn} answers the rows, each with its default where the
 * person said nothing; {@link choicesOf} turns the rows back into the choices
 * `bringIn` takes. So the rows are the step, and what the dialog shows is what
 * is written:
 *
 * ```ts
 * const { rows } = whatWillComeIn({ lists, library, entries: ticked, language, edits })
 * const step = bringIn({ lists, library, entries: ticked, language, makeId, ...choicesOf(rows) })
 * ```
 *
 * **The defaults are suggestions, and the person's to change.**
 *
 * - A role is offered as reused where the organisation has one that stands
 *   for it ({@link suggestedReuse}): one brought in from an entry the library
 *   calls `alike`, or one of the same name once case, accents, spaces and
 *   punctuation are set aside. A unit type is offered the same suggestion,
 *   and is brought in unless the person takes it.
 * - A unit type at the top of its library that holds none of its library's
 *   types lands beside the organisation's deepest type that holds nothing
 *   ({@link defaultPlacement}): Team Topologies' teams beside your Team, in
 *   your Cluster, rather than loose at the top.
 *
 * Pure, and no words: the dialog says each choice in the screen's language.
 */
import type { UnitType, UnitTypeId } from '../model/operatingModel'
import { fold } from '../model/textSearch'
import { unitTypeLanes, unitTypeRank } from '../model/unitOrder'
import { broughtFrom, entriesReached } from './bringIn'
import type { BringInChoices, OperatingLists, Placement } from './bringIn'
import { alikeOf, entryOf } from './library'
import type { EntryRef, Library, LibraryLanguage, LibraryUnitType } from './library'

/**
 * A unit type's place as the dialog offers it: as in its library, at the top,
 * beside one of the organisation's types (the same `top` and `within`), or
 * inside one.
 */
export type PlacementChoice =
  | { readonly how: 'library' }
  | { readonly how: 'top' }
  | { readonly how: 'beside'; readonly type: UnitTypeId }
  | { readonly how: 'inside'; readonly type: UnitTypeId }

/** A choice as one string — a select's value, a list's key. */
export function placementKey(choice: PlacementChoice): string {
  return choice.how === 'beside' || choice.how === 'inside' ? `${choice.how}:${choice.type}` : choice.how
}

/**
 * A choice as `bringIn` reads it, for one unit type of the library; nothing
 * where the entry is no unit type, or the type it names is not the
 * organisation's.
 */
export function placementOf(lists: OperatingLists, library: Library, entry: string, choice: PlacementChoice): Placement | undefined {
  const held = entryOf(library, entry)
  if (held?.kind !== 'unitType') return undefined
  switch (choice.how) {
    case 'library': return { top: held.item.top === true, within: held.item.within.map((one) => ({ entry: one })) }
    case 'top': return { top: true, within: [] }
    case 'beside': {
      const type = lists.unitTypes.find((one) => one.id === choice.type)
      const ids = new Set(lists.unitTypes.map((one) => one.id))
      return type && { top: type.top === true, within: type.within.filter((id) => ids.has(id)).map((id) => ({ type: id })) }
    }
    case 'inside':
      return lists.unitTypes.some((one) => one.id === choice.type) ? { top: false, within: [{ type: choice.type }] } : undefined
  }
}

/**
 * Every place the dialog offers a unit type: as in its library, at the top,
 * then beside and inside each of the organisation's types that sits
 * somewhere, in the structure's order. A type that sits nowhere is no place
 * for another.
 */
export function placementChoices(lists: OperatingLists): PlacementChoice[] {
  const placed = unitTypeLanes(lists.unitTypes).lanes.flatMap((lane) => lane.types)
  return [
    { how: 'library' }, { how: 'top' },
    ...placed.map((type) => ({ how: 'beside' as const, type: type.id })),
    ...placed.map((type) => ({ how: 'inside' as const, type: type.id })),
  ]
}

/**
 * Where a unit type of a library lands unless the person says otherwise.
 *
 * One at the top of its library — `top`, and in none of its library's types —
 * that holds none of its library's types lands beside the organisation's
 * deepest type that holds nothing: in its lane, and no other type of the
 * organisation may sit in it; ties go by the lane's order. Anything else, or
 * an organisation with no such type, is as in the library, which `bringIn`
 * maps onto what the ask brings or reuses. Nothing for an entry that is no
 * unit type.
 */
export function defaultPlacement(lists: OperatingLists, library: Library, entry: string): PlacementChoice | undefined {
  const held = entryOf(library, entry)
  if (held?.kind !== 'unitType') return undefined
  if (!atTopOfItsLibrary(library, held.item) || holdsAnyOfItsLibrary(library, entry)) return { how: 'library' }
  const beside = deepestHoldingNothing(lists.unitTypes)
  return beside ? { how: 'beside', type: beside.id } : { how: 'library' }
}

function atTopOfItsLibrary(library: Library, item: LibraryUnitType): boolean {
  return item.top === true && !item.within.some((entry) => library.unitTypes.some((one) => one.entry === entry))
}

function holdsAnyOfItsLibrary(library: Library, entry: string): boolean {
  return library.unitTypes.some((one) => one.entry !== entry && one.within.includes(entry))
}

/** The organisation's deepest type that sits somewhere and that no other of its types may sit in. */
function deepestHoldingNothing(types: readonly UnitType[]): UnitType | undefined {
  const holding = new Set(types.flatMap((type) => type.within.filter((id) => id !== type.id)))
  const { lanes } = unitTypeLanes(types)
  for (const lane of [...lanes].reverse()) {
    const leaf = lane.types.find((type) => !holding.has(type.id))
    if (leaf) return leaf
  }
  return undefined
}

/** A name as a reuse compares it: no case, no accents, and nothing but letters and digits. */
function comparable(name: string): string {
  return fold(name).replace(/[^\p{L}\p{N}]+/gu, '')
}

/**
 * The organisation's role or unit type that stands for an entry, if one does:
 * the item brought in from that entry; else one brought in from an entry the
 * library calls `alike`, in the order the hints are said; else one of the
 * same name, in any of the library's languages, once case, accents, spaces
 * and punctuation are set aside — the first in the structure's order, or the
 * list's for roles. Nothing for a responsibility.
 */
export function suggestedReuse(lists: OperatingLists, library: Library, entry: string): string | undefined {
  const held = entryOf(library, entry)
  if (!held || held.kind === 'responsibility') return undefined
  const candidates: readonly { id: string; name: string; basedOn?: { library: string; entry: string } }[] = held.kind === 'role'
    ? lists.roles
    : inRankOrder(lists.unitTypes)
  const from = (ref: EntryRef) => candidates.find((one) => one.basedOn?.library === ref.library && one.basedOn.entry === ref.entry)
  const alike = [{ library: library.id, entry }, ...alikeOf(held.item)].map(from).find(Boolean)
  if (alike) return alike.id
  const names = new Set(Object.values(held.item.name).map(comparable))
  return candidates.find((one) => names.has(comparable(one.name)))?.id
}

function inRankOrder(types: readonly UnitType[]): UnitType[] {
  const rank = unitTypeRank(types)
  return [...types].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
}

/** What the person changed in *What will come in*, by entry. Anything not said is the default. */
export type ComingInEdits = {
  /** What an item made is to be called. */
  readonly names?: Readonly<Record<string, string>>
  /** Where a unit type made is to sit. */
  readonly places?: Readonly<Record<string, PlacementChoice>>
  /** An item of the organisation's to use for the entry, or `null` to bring it in where a reuse is suggested. */
  readonly reuse?: Readonly<Record<string, string | null>>
}

export type ComingInAsk = {
  readonly lists: OperatingLists
  readonly library: Library
  /** What is ticked. */
  readonly entries: readonly string[]
  /** The language the step takes its words in. */
  readonly language: LibraryLanguage
  readonly edits?: ComingInEdits
}

/** One row of *What will come in*: a unit type or a role the step reaches. */
export type ComingInRow = {
  readonly entry: string
  readonly kind: 'unitType' | 'role'
  /** The library's term, in the step's language. */
  readonly term: string
  /** Ticked for itself; otherwise it comes along, needed by the entries in `by`. */
  readonly asked: boolean
  readonly by: readonly string[]
  /** Made new; the organisation's own used for it (`id`); or brought in before (`id`), and used as it is. */
  readonly fate: 'made' | 'reused' | 'inModel'
  /** Made: the name it will have. Otherwise: the name the organisation's item has now. */
  readonly name: string
  readonly id?: string
  /** Made or reused: what {@link suggestedReuse} offers for it, whatever was chosen. */
  readonly suggested?: string
  /** A unit type made: where it will sit, as chosen and as `bringIn` reads it, and every place offered. */
  readonly place?: PlacementChoice
  readonly placement?: Placement
  readonly places?: readonly PlacementChoice[]
}

export type WhatWillComeIn = {
  /** The unit types, then the roles, in the library's order. */
  readonly rows: readonly ComingInRow[]
  /** The responsibilities made with the roles made, by entry, in the library's order. */
  readonly responsibilities: readonly string[]
  /** How many items the step makes: unit types, roles and responsibilities. */
  readonly made: number
}

/** Each unit type's place, and each entry's reuse, with the defaults where nothing was said. */
type Settled = {
  readonly choices: BringInChoices
  readonly places: ReadonlyMap<string, PlacementChoice>
  readonly suggested: ReadonlyMap<string, string>
}

function settle(ask: ComingInAsk): Settled {
  const { lists, library, edits = {} } = ask
  const places = new Map<string, PlacementChoice>()
  const placements: Record<string, Placement> = {}
  for (const item of library.unitTypes) {
    const edited = said(edits.places, item.entry)
    const resolved = edited && placementOf(lists, library, item.entry, edited)
    const choice = resolved ? edited : defaultPlacement(lists, library, item.entry)!
    places.set(item.entry, choice)
    placements[item.entry] = resolved ?? placementOf(lists, library, item.entry, choice)!
  }
  const suggested = new Map<string, string>()
  const reuse: Record<string, string> = {}
  const entries = [...library.unitTypes.map((item) => ({ item, role: false })), ...library.roles.map((item) => ({ item, role: true }))]
  for (const { item, role } of entries) {
    const offer = suggestedReuse(lists, library, item.entry)
    if (offer !== undefined) suggested.set(item.entry, offer)
    // A role takes the suggestion unless the person said otherwise, and one brought in before is used as it
    // is (`inModel`) rather than reused; a unit type is reused only when the person takes it.
    const edited = said(edits.reuse, item.entry)
    const byDefault = role && !broughtFrom(lists, library.id, item.entry) ? offer : undefined
    const use = edited === undefined ? byDefault : edited ?? undefined
    if (use !== undefined) reuse[item.entry] = use
  }
  return { choices: { names: edits.names, placements, reuse }, places, suggested }
}

/** An edit said for an entry, read so that an entry named like `constructor` finds nothing it was not given. */
function said<T>(record: Readonly<Record<string, T>> | undefined, entry: string): T | undefined {
  return record && Object.hasOwn(record, entry) ? record[entry] : undefined
}

/**
 * The rows of *What will come in* for what is ticked and what was edited:
 * every unit type and role the step reaches, with what becomes of it and the
 * choices it carries, and what the step makes besides.
 */
export function whatWillComeIn(ask: ComingInAsk): WhatWillComeIn {
  const { lists, library, language } = ask
  const settled = settle(ask)
  const reached = entriesReached(lists, library, ask.entries, settled.choices)
  const offered = placementChoices(lists)
  const rows = reached.flatMap((one): ComingInRow[] => {
    if (one.kind === 'responsibility') return []
    const term = entryOf(library, one.entry)!.item.name[language]
    const base = { entry: one.entry, kind: one.kind, term, asked: one.asked, by: one.by }
    if (one.fate.as !== 'made') {
      const id = one.fate.id
      const suggested = one.fate.as === 'reused' ? settled.suggested.get(one.entry) : undefined
      const name = (one.kind === 'role' ? lists.roles : lists.unitTypes).find((item) => item.id === id)?.name ?? term
      return [{ ...base, fate: one.fate.as, name, id, ...(suggested !== undefined ? { suggested } : {}) }]
    }
    const name = said(ask.edits?.names, one.entry)?.trim() || term
    const suggested = settled.suggested.get(one.entry)
    const placed = one.kind === 'unitType'
      ? { place: settled.places.get(one.entry)!, placement: settled.choices.placements![one.entry], places: offered }
      : {}
    return [{ ...base, fate: 'made', name, ...(suggested !== undefined ? { suggested } : {}), ...placed }]
  })
  const made = reached.filter((one) => one.fate.as === 'made')
  return {
    rows,
    responsibilities: made.filter((one) => one.kind === 'responsibility').map((one) => one.entry),
    made: made.length,
  }
}

/**
 * The rows, as edited, as the choices `bringIn` takes: each name made, each
 * unit type's placement, each reuse. With the same ticked entries, the step
 * makes exactly what the rows say.
 */
export function choicesOf(rows: readonly ComingInRow[]): Required<BringInChoices> {
  const names: Record<string, string> = {}
  const placements: Record<string, Placement> = {}
  const reuse: Record<string, string> = {}
  for (const row of rows) {
    if (row.fate === 'made') names[row.entry] = row.name
    if (row.fate === 'made' && row.placement) placements[row.entry] = row.placement
    if (row.fate === 'reused' && row.id !== undefined) reuse[row.entry] = row.id
  }
  return { names, placements, reuse }
}

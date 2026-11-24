// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The operating model: the kinds of unit an organisation has, the roles each
 * kind holds, what each role is responsible for, and the rules the model
 * reads off them (ADR-0036).
 *
 * The organisation designs it and changes it itself, in its own words — so a
 * unit type's name is the organisation's word for that kind of unit, and core
 * has none of its own beyond *unit* and *unit type*. It is kept at the
 * organisation, the root scope, as four lists of records on its model: in the
 * history, under undo, at the agent, in the folder (`_operating/`) and in the
 * working file, exactly as the decisions and the plans are.
 *
 * The **instances** — units, which are actors with a type, and the people
 * assigned to roles in them — are not here: they are in the scopes. This file
 * is what those instances are checked against.
 *
 * **Responsible, accountable, consulted, informed** is said on the role, as
 * its duties: one letter per responsibility it has a part in. The matrix a
 * person edits is the roles' duties side by side, and a responsibility that is
 * not exactly one role's *A* is a finding, never a refusal.
 *
 * Dates and successors (`from`, `until`, `successors`) are declared here for
 * the change over time a later step builds; nothing reads them yet.
 *
 * Pure, and no words: the screen has the tables.
 */

import { isCertainty } from './types'
import type { Certainty } from './types'

/** The four letters of a duty, in the order a cell cycles through them. */
export const RACI_LETTERS = ['R', 'A', 'C', 'I'] as const

/** Responsible, accountable, consulted, informed. */
export type Raci = (typeof RACI_LETTERS)[number]

export function isRaci(value: unknown): value is Raci {
  return typeof value === 'string' && (RACI_LETTERS as readonly string[]).includes(value)
}

export type UnitTypeId = string
export type RoleId = string
export type ResponsibilityId = string

/**
 * Where an item brought in from a library came from (decision 7): the
 * library, its entry, the library's version, and the language its words were
 * taken in — which is the language *compare* reads the library in.
 *
 * Kept for as long as the item lives, whatever the organisation does to it
 * afterwards: renaming it, rewriting it, cutting its slots. It is what lets a
 * later library be compared against the item without anything being merged
 * into it.
 *
 * `name` is the name the item was given when it was brought in, said only
 * where it was not the library's term in `language`: *compare* reads the
 * item's name against it, so a rename chosen on the way in is not reported as
 * a difference for ever after, and a rename since is.
 */
export type BasedOn = {
  library: string
  entry: string
  version: string
  language: string
  name?: string
}

/**
 * Where a unit type was put when it was brought in: at the top or not, and the
 * types it sat in, by id — the organisation's own, or ones the same step made.
 */
export type Placed = {
  top: boolean
  within: UnitTypeId[]
}

/**
 * A unit type's `basedOn`: what every item's says, and `placed`, where the
 * type was put when it was brought in, said only where that was not where its
 * library puts it. *compare* reads the type's `top` and `within` against it,
 * as it reads a name against `name`: a type placed beside the organisation's
 * own on the way in is not reported as sitting elsewhere than its library
 * says for ever after, and a move since is.
 */
export type UnitTypeBasedOn = BasedOn & {
  placed?: Placed
}

/**
 * A change over time, said on the thing that changes (a later step's to read):
 * the day it starts, the day it ends, and what takes its place.
 */
export type Dated = {
  /** `yyyy-mm-dd`, the first day. */
  from?: string
  /** `yyyy-mm-dd`, the last day. */
  until?: string
  /** What takes its place when it ends, by id. */
  successors?: string[]
}

/** A line manager's line, or a functional one (ADR-0039 §1). */
export const LINE_KINDS = ['solid', 'dotted'] as const

export type LineKind = (typeof LINE_KINDS)[number]

export function isLineKind(value: unknown): value is LineKind {
  return typeof value === 'string' && (LINE_KINDS as readonly string[]).includes(value)
}

/**
 * Where the holders of a role report (ADR-0039 §2, amended 17 October 2026):
 * to the holders of `role` — in the **same unit** where `within` says so (a
 * developer to the team's tech lead), else in the nearest unit above that has
 * a slot for the role, else in the one unit of the organisation that has.
 * `solid` decides who manages them; `dotted` is shown and decides nothing.
 * Runs on the days between `from` and `until`.
 *
 * Said on a role for every unit that holds it, on a unit type's slot for the
 * units of that type, or on a unit for itself — the nearest wins, kind by
 * kind. A line with no `role` says the holders report **by nesting** where it
 * is said, whatever a wider place says: the slot's way of taking the role's
 * line away for its type.
 */
export type ReportsTo = {
  role?: RoleId
  kind: LineKind
  /** The target is another role of the same unit. */
  within?: true
  from?: string
  until?: string
}

/** What a role or a slot says about reporting: one line, or one of each kind. Read with {@link linesSaid}. */
export type ReportsToSaid = ReportsTo | readonly ReportsTo[]

/** The lines a role or a slot says, as a list: at most one of each kind, the first of a kind said counting. */
export function linesSaid(said: ReportsToSaid | undefined): ReportsTo[] {
  const all = said === undefined ? [] : Array.isArray(said) ? [...said] : [said as ReportsTo]
  const seen = new Set<LineKind>()
  return all.filter((line) => (seen.has(line.kind) ? false : (seen.add(line.kind), true)))
}

/** One of each kind, with `line` in place of the one of its kind — or taken away where `line` is absent. */
export function linesWith(said: ReportsToSaid | undefined, kind: LineKind, line: ReportsTo | undefined): ReportsTo[] | undefined {
  const kept = linesSaid(said).filter((one) => one.kind !== kind)
  const next = line ? [...kept, { ...line, kind }] : kept
  next.sort((a, b) => LINE_KINDS.indexOf(a.kind) - LINE_KINDS.indexOf(b.kind))
  return next.length ? next : undefined
}

/**
 * One role a unit of a type holds, and how many of it: at least `min`, and
 * at most `max` where one is said. A slot with `min` 0 is a role the type may
 * have and need not. `reportsTo` is what every unit of the type says about
 * where the role's holders report (ADR-0039 §2), in place of what the role
 * says for itself.
 */
export type RoleSlot = {
  role: RoleId
  min: number
  max?: number
  reportsTo?: ReportsToSaid
}

/**
 * A kind of unit, in the organisation's own word for it.
 *
 * `top` and `within` together say where a unit of this type may sit: at the
 * top, under the organisation itself, and under a unit of any of the types
 * named. `spans` says a unit of this type may serve more than one domain.
 * `limit` is how many applications a unit of it should own at most — a check
 * reads it, and nothing refuses it.
 *
 * `order` is where the type stands among the others of its lane, low first
 * (`model/unitOrder.ts`): the organisation's own decision, so a library has
 * none and *compare* never reads it. Absent until somebody moves one, as an
 * element's `order` is, and a type that has none stands after those that do,
 * by name.
 *
 * `alsoBasedOn` is what a bring-in matched to the type: the library entries
 * it was chosen to stand for, so nothing was brought in for them. It is a
 * record, read by whatever asks what stands for an entry — a library opened
 * again, *compare*, *What came in* — and never a guess by name.
 */
export type UnitType = Dated & {
  id: UnitTypeId
  name: string
  purpose?: string
  top?: boolean
  within: UnitTypeId[]
  spans?: boolean
  slots: RoleSlot[]
  limit?: number
  order?: number
  basedOn?: UnitTypeBasedOn
  alsoBasedOn?: BasedOn[]
}

/**
 * One responsibility a role has a part in, and which part (ADR-0052).
 *
 * `raci` is one letter. `alsoResponsible` is said beside an *A* only: the role
 * that is accountable does the work too, a cell read as `A/R`. `certainty` is
 * whether the letter has been checked, absent being nobody having said, and
 * `source` where it was read, in plain words. A duty that says none of the
 * three is every duty from before format 19.
 */
export type Duty = {
  responsibility: ResponsibilityId
  raci: Raci
  alsoResponsible?: true
  certainty?: Certainty
  source?: string
}

/**
 * What may be said of a duty beside its letter: a field left out says nothing
 * about it, and `null` (or a blank source, or `false`) takes it away.
 */
export type DutySaid = {
  readonly alsoResponsible?: boolean | null
  readonly certainty?: Certainty | null
  readonly source?: string | null
}

/**
 * A role, in the organisation's own words.
 *
 * `manages` marks a role whose holder manages the people of the unit and of
 * the units below it. Core holds the flag as model data and grants nothing:
 * the right is a host's to give, from whoever holds the role on the day.
 *
 * `alsoBasedOn`, as a unit type's: the library entries a bring-in matched the
 * role to.
 */
export type Role = Dated & {
  id: RoleId
  name: string
  /** A few letters for a tight column: the matrix's heading. */
  short?: string
  /** What it is for, in one sentence. */
  purpose?: string
  /** What the role is, at length, in markdown: its activities, what it asks of a person (ADR-0052). */
  description?: string
  duties: Duty[]
  manages?: boolean
  /** Where its holders report, wherever the role is held (ADR-0039 §2, amended): a unit type's slot or a unit may say otherwise. */
  reportsTo?: ReportsToSaid
  /** Where it stands among the roles, as a unit type's `order` does in its lane (`inOwnOrder`). */
  order?: number
  basedOn?: BasedOn
  alsoBasedOn?: BasedOn[]
}

/**
 * Something somebody has to do, whoever it turns out to be. `group` gathers
 * responsibilities on the matrix, under a value stream for example. `order` is
 * where it stands among the responsibilities (`inOwnOrder`), which also puts
 * the groups in order: a group stands where its first responsibility does.
 */
export type Responsibility = {
  id: ResponsibilityId
  name: string
  description?: string
  group?: string
  order?: number
  basedOn?: BasedOn
}

/**
 * Roles or responsibilities in the organisation's own order: by `order`, low
 * first, then those without one in the order they were added. As a unit
 * type's `order`, it is the organisation's own decision — absent until
 * somebody moves one, so a library has none and *compare* never reads it.
 */
export function inOwnOrder<T extends { readonly order?: number }>(list: readonly T[]): T[] {
  return list
    .map((item, at) => ({ item, at }))
    .sort((a, b) => (a.item.order ?? Infinity) - (b.item.order ?? Infinity) || a.at - b.at)
    .map(({ item }) => item)
}

/**
 * What a rule works out on the day. `applicationOwner`: an application's owner
 * is whoever holds the role in the unit it belongs to (`partyId`).
 * `domainOwner`: a domain's owner is whoever holds the role in the unit that
 * serves it.
 */
export const OPERATING_RULE_KINDS = ['applicationOwner', 'domainOwner'] as const

export type OperatingRuleKind = (typeof OPERATING_RULE_KINDS)[number]

export function isOperatingRuleKind(value: unknown): value is OperatingRuleKind {
  return typeof value === 'string' && (OPERATING_RULE_KINDS as readonly string[]).includes(value)
}

/**
 * A rule of the operating model: one per kind, so the kind is its id. The
 * role it names is read on the day, so the owner it gives follows whoever
 * holds the role and no name is stored.
 */
export type OperatingRule = {
  id: OperatingRuleKind
  role: RoleId
}

// --- the arithmetic -------------------------------------------------------------

/** A role's duty in a responsibility, whole, or nothing. */
export function dutyOf(role: { readonly duties: readonly Duty[] }, responsibility: ResponsibilityId): Duty | undefined {
  return role.duties.find((duty) => duty.responsibility === responsibility)
}

/** A role's letter in a responsibility, or nothing. */
export function raciOf(role: Pick<Role, 'duties'>, responsibility: ResponsibilityId): Raci | undefined {
  return dutyOf(role, responsibility)?.raci
}

/** Whether two duties in one responsibility say the same, letter and all; two that are absent do. */
export function sameDuty(a: Duty | undefined, b: Duty | undefined): boolean {
  return a?.raci === b?.raci && a?.alsoResponsible === b?.alsoResponsible && a?.certainty === b?.certainty && a?.source === b?.source
}

/** Whether a duty makes its role responsible: an *R*, or an *A* that is responsible too. */
export function isResponsible(duty: Pick<Duty, 'raci' | 'alsoResponsible'>): boolean {
  return duty.raci === 'R' || (duty.raci === 'A' && duty.alsoResponsible === true)
}

/** What a duty's cell shows: its letter, or `A/R`. */
export function raciSaid(duty: Pick<Duty, 'raci' | 'alsoResponsible'>): Raci | 'A/R' {
  return duty.raci === 'A' && isResponsible(duty) ? 'A/R' : duty.raci
}

/** A text with something in it, as it is; blank is absent. */
const filled = (text: unknown): string | undefined => (typeof text === 'string' && text.trim() ? text : undefined)

/**
 * A duty as it is kept: also responsible only beside an *A*, a mark of the two
 * there are, and no blank source. The same duty back where it already is.
 */
export function settledDuty(duty: Duty): Duty {
  const { responsibility, raci, alsoResponsible, certainty, source } = duty
  const also = raci === 'A' && alsoResponsible === true
  const marked = isCertainty(certainty)
  const read = filled(source)
  if (also === 'alsoResponsible' in duty && marked === 'certainty' in duty && (read !== undefined) === 'source' in duty) return duty
  return {
    responsibility, raci, ...(also ? { alsoResponsible: true } : {}), ...(marked ? { certainty } : {}), ...(read !== undefined ? { source: read } : {}),
  }
}

/**
 * The fields of a role as they are kept: each duty settled, and a blank
 * description said as absent. What a role is added or patched with goes
 * through it at the writer, so no caller can leave one behind.
 */
export function settledRole<R extends Partial<Role>>(fields: R): R {
  const { duties, description } = fields
  return {
    ...fields,
    ...(Array.isArray(duties) ? { duties: duties.map(settledDuty) } : {}),
    ...(description !== undefined ? { description: filled(description) } : {}),
  }
}

/**
 * A duty with its letter set and whatever else is said. Another letter keeps
 * where it was read and drops the mark, which was about the letter that was
 * there, unless the same change says one; the same letter keeps both.
 */
function dutyWith(held: Duty | undefined, responsibility: ResponsibilityId, raci: Raci, said: DutySaid): Duty {
  const certainty = said.certainty !== undefined ? said.certainty ?? undefined : held?.raci === raci ? held.certainty : undefined
  const also = said.alsoResponsible === undefined ? held?.alsoResponsible : said.alsoResponsible === true || undefined
  const source = said.source === undefined ? held?.source : said.source ?? undefined
  return settledDuty({
    responsibility, raci, ...(also ? { alsoResponsible: true } : {}), ...(certainty ? { certainty } : {}), ...(source ? { source } : {}),
  })
}

/**
 * A role's duties with its part in one responsibility set, changed or taken
 * away whole (`undefined`), and what `said` says of it beside the letter. A
 * changed duty keeps its place; a new one goes last.
 */
export function dutiesWith(
  duties: readonly Duty[], responsibility: ResponsibilityId, raci: Raci | undefined, said: DutySaid = {},
): Duty[] {
  const at = duties.findIndex((duty) => duty.responsibility === responsibility)
  if (raci === undefined) return at < 0 ? [...duties] : duties.filter((_, index) => index !== at)
  if (at < 0) return [...duties, dutyWith(undefined, responsibility, raci, said)]
  return duties.map((duty, index) => (index === at ? dutyWith(duty, responsibility, raci, said) : duty))
}

/**
 * A role's whole list of duties replaced by the one given, each by the same
 * rules as one cell: a duty that is in both keeps what `given` does not speak
 * of. What a caller that says only letters must use, so a list sent back with
 * one letter added loses nobody's source.
 */
export function dutiesReplaced(
  held: readonly Duty[], given: readonly (Pick<Duty, 'responsibility' | 'raci'> & DutySaid)[],
): Duty[] {
  return given.map((one) => dutyWith(
    held.find((duty) => duty.responsibility === one.responsibility), one.responsibility, one.raci, one,
  ))
}

/** The next letter a cell shows when it is pressed: none, R, A, C, I, and none again. */
export function nextRaci(current: Raci | undefined): Raci | undefined {
  if (current === undefined) return RACI_LETTERS[0]
  const at = RACI_LETTERS.indexOf(current)
  return at === RACI_LETTERS.length - 1 ? undefined : RACI_LETTERS[at + 1]
}

/** The roles accountable for one responsibility, in the order they are listed. */
export function accountableFor(roles: readonly Role[], responsibility: ResponsibilityId): Role[] {
  return roles.filter((role) => raciOf(role, responsibility) === 'A')
}

/** The roles responsible for one responsibility, an accountable one that is responsible too among them. */
export function responsibleFor(roles: readonly Role[], responsibility: ResponsibilityId): Role[] {
  return roles.filter((role) => {
    const duty = dutyOf(role, responsibility)
    return duty !== undefined && isResponsible(duty)
  })
}

/**
 * A responsibility that is not exactly one role's *A*: nobody's, or several
 * roles'. The matrix flags it and the checks list it; nothing refuses it,
 * because a model being worked on passes through both.
 */
export type Accountability = {
  responsibility: Responsibility
  /** The roles that say *A*: none, or more than one. */
  accountable: Role[]
}

export function accountabilityGaps(
  responsibilities: readonly Responsibility[], roles: readonly Role[],
): Accountability[] {
  return responsibilities
    .map((responsibility) => ({ responsibility, accountable: accountableFor(roles, responsibility.id) }))
    .filter((held) => held.accountable.length !== 1)
}

/** The unit types that hold a role in one of their slots. */
export function typesHolding(types: readonly UnitType[], role: RoleId): UnitType[] {
  return types.filter((type) => type.slots.some((slot) => slot.role === role))
}

/**
 * The lines that hold for a slot, kind by kind (ADR-0039 §2, amended): the
 * slot's own where it says anything — a line by nesting counting as said,
 * and drawn as none — else the role's. Each says where it was said.
 */
export function linesHolding(slot: Pick<RoleSlot, 'reportsTo'> | undefined, role: Pick<Role, 'reportsTo'> | undefined): (ReportsTo & { role: RoleId; source: 'role' | 'type' })[] {
  const slotSays = linesSaid(slot?.reportsTo)
  const roleSays = linesSaid(role?.reportsTo)
  return LINE_KINDS.flatMap((kind) => {
    const mine = slotSays.find((line) => line.kind === kind)
    const said = mine ?? roleSays.find((line) => line.kind === kind)
    return said && said.role !== undefined ? [{ ...said, role: said.role, source: mine ? 'type' as const : 'role' as const }] : []
  })
}

/** One line into a role, as the operating model says it: from a role wherever it is held, or from a slot of a unit type. */
export type LineInto = ReportsTo & { role: RoleId; from: RoleId; source: 'role' | 'type'; typeId?: UnitTypeId }

/** The lines that land on a role across the operating model (ADR-0039, amended): who reports to it, as roles and slots say. */
export function linesInto(types: readonly UnitType[], roles: readonly Role[], target: RoleId): LineInto[] {
  const found: LineInto[] = []
  for (const role of roles) {
    for (const line of linesSaid(role.reportsTo)) if (line.role === target) found.push({ ...line, role: target, from: role.id, source: 'role' })
  }
  for (const type of types) {
    for (const slot of type.slots) {
      for (const line of linesSaid(slot.reportsTo)) if (line.role === target) found.push({ ...line, role: target, from: slot.role, source: 'type', typeId: type.id })
    }
  }
  return found
}

/** How a slot's count reads: `1`, `0–1`, `3–9`, `2+`. */
export function slotRange(slot: Pick<RoleSlot, 'min' | 'max'>): string {
  if (slot.max === undefined) return slot.min === 0 ? '0+' : `${slot.min}+`
  return slot.min === slot.max ? String(slot.min) : `${slot.min}–${slot.max}`
}

/**
 * The responsibilities by group, groups in the order they first appear and
 * responsibilities without one last, under the empty string.
 */
export function responsibilityGroups(
  responsibilities: readonly Responsibility[],
): { group: string; responsibilities: Responsibility[] }[] {
  const groups = new Map<string, Responsibility[]>()
  for (const responsibility of responsibilities) {
    const group = responsibility.group?.trim() ?? ''
    if (group === '') continue
    groups.set(group, [...groups.get(group) ?? [], responsibility])
  }
  const loose = responsibilities.filter((responsibility) => !responsibility.group?.trim())
  return [
    ...[...groups].map(([group, held]) => ({ group, responsibilities: held })),
    ...(loose.length ? [{ group: '', responsibilities: loose }] : []),
  ]
}

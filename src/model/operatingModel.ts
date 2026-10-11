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

/**
 * One role a unit of a type holds, and how many of it: at least `min`, and
 * at most `max` where one is said. A slot with `min` 0 is a role the type may
 * have and need not.
 */
export type RoleSlot = {
  role: RoleId
  min: number
  max?: number
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

/** One responsibility a role has a part in, and which part. */
export type Duty = {
  responsibility: ResponsibilityId
  raci: Raci
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
  purpose?: string
  duties: Duty[]
  manages?: boolean
  basedOn?: BasedOn
  alsoBasedOn?: BasedOn[]
}

/**
 * Something somebody has to do, whoever it turns out to be. `group` gathers
 * responsibilities on the matrix, under a value stream for example.
 */
export type Responsibility = {
  id: ResponsibilityId
  name: string
  description?: string
  group?: string
  basedOn?: BasedOn
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

/** A role's part in a responsibility, or nothing. */
export function raciOf(role: Pick<Role, 'duties'>, responsibility: ResponsibilityId): Raci | undefined {
  return role.duties.find((duty) => duty.responsibility === responsibility)?.raci
}

/**
 * A role's duties with its part in one responsibility set, changed or taken
 * away (`undefined`). A changed duty keeps its place; a new one goes last.
 */
export function dutiesWith(duties: readonly Duty[], responsibility: ResponsibilityId, raci: Raci | undefined): Duty[] {
  const at = duties.findIndex((duty) => duty.responsibility === responsibility)
  if (raci === undefined) return at < 0 ? [...duties] : duties.filter((_, index) => index !== at)
  if (at < 0) return [...duties, { responsibility, raci }]
  return duties.map((duty, index) => (index === at ? { responsibility, raci } : duty))
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

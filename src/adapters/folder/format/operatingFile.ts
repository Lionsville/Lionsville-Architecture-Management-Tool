// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The operating model as files (ADR-0036): one JSON file per list, under a
 * folder of the organisation's own.
 *
 * ```
 * _operating/unit-types.json         the kinds of unit, in the organisation's words
 * _operating/roles.json              the roles, with their duties (R, A, C, I)
 * _operating/responsibilities.json   what somebody has to do, grouped
 * _operating/rules.json              what the model works out on the day
 * ```
 *
 * **Why the underscore.** A child scope's folder name is a slug, and a slug
 * cannot hold one (`model/keys.ts`), so no tree can already have a scope where
 * this folder goes: the format turns from 10 to 11 without moving anybody's
 * scope and without a question to ask. The scope's other folders are older
 * than that rule and are refused as names instead (`RESERVED_SCOPE_NAMES`).
 *
 * **Why a file per list, not per record.** The order of each list is the
 * organisation's — the order the matrix shows its roles in, the order the
 * cards stand in — and a list in one file keeps it without a second index.
 * The lists are small: tens of items, not thousands.
 *
 * Forgiving in one direction, as the other codecs are: it writes one exact
 * shape and reads what it can of a hand-edited one. A row without an id is
 * passed over; a file that is not a list at all is said, so the scope opens to
 * be read and not written — a save would have written that list empty.
 *
 * A unit type's `order` came later, as one more optional field of a row, so
 * the format stayed 11: a build from before it reads the file, passes the
 * field over, and its next save writes the list without it — the lanes then
 * fall back to names, and nothing else is lost.
 *
 * `basedOn.name` and a unit type's or role's `alsoBasedOn` came the same way,
 * in 3.6.1, and stayed 11. A 3.6.0 build reads the file and passes both over,
 * and its next save writes the lists without them: *compare* then counts a
 * name chosen when an item came in as a rename, and a library opened again
 * offers an entry that was matched to an item of the organisation's own as
 * not yet brought in. The items, their names and every reference are kept.
 * A unit type's `basedOn.placed`, where it was put when it came in, came the
 * same way in the same release: a 3.6.0 build passes it over and drops it on
 * its next save, after which *compare* reads the type's place against its
 * library again and says a type placed elsewhere on the way in sits
 * elsewhere. Where the type sits, its `top` and `within`, is kept.
 *
 * A role's and a responsibility's `order` came the same way in 3.6.4, and the
 * format stayed 12. A 3.6.3 build passes it over and drops it on its next
 * save; the matrix then lists them in the list's own order, the order they
 * were added in, until somebody moves one again.
 */
import { isOperatingRuleKind, isRaci } from '../../../model/operatingModel'
import type {
  BasedOn, Duty, OperatingRule, Placed, Responsibility, Role, RoleSlot, UnitType, UnitTypeBasedOn,
} from '../../../model/operatingModel'
import type { HostModel } from '../../../model/hostModel'
import { parseJson, stableJson } from '../../../projects/text'

/** The folder the operating model is kept in. Not a slug, so never a scope's name. */
export const OPERATING_FOLDER = '_operating'

export const UNIT_TYPES_FILE = `${OPERATING_FOLDER}/unit-types.json`
export const ROLES_FILE = `${OPERATING_FOLDER}/roles.json`
export const RESPONSIBILITIES_FILE = `${OPERATING_FOLDER}/responsibilities.json`
export const RULES_FILE = `${OPERATING_FOLDER}/rules.json`

/** The four files, and the only ones the format writes under the folder. */
export const OPERATING_FILES: readonly string[] = [UNIT_TYPES_FILE, ROLES_FILE, RESPONSIBILITIES_FILE, RULES_FILE]

type OperatingLists = Pick<HostModel, 'unitTypes' | 'roles' | 'responsibilities' | 'operatingRules'>

/** The operating model's files, for the lists the model carries. An absent or empty list writes no file. */
export function operatingFiles(model: OperatingLists): { path: string; text: string }[] {
  const files: { path: string; text: string }[] = []
  const write = (path: string, list: readonly object[] | undefined) => {
    if (list?.length) files.push({ path, text: stableJson(list) })
  }
  write(UNIT_TYPES_FILE, model.unitTypes)
  write(ROLES_FILE, model.roles)
  write(RESPONSIBILITIES_FILE, model.responsibilities)
  write(RULES_FILE, model.operatingRules)
  return files
}

/** Each row of a file that is a list; `undefined` where it is not one. */
function rowsIn(text: string | undefined): Record<string, unknown>[] | undefined {
  if (text === undefined) return []
  const held = parseJson(text)
  if (!Array.isArray(held)) return undefined
  return held.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && !Array.isArray(row))
}

/** Whether a file is there and is not a list — the files a save must not write over. */
export function operatingFileUnreadable(text: string | undefined): boolean {
  return text !== undefined && rowsIn(text) === undefined
}

const text = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)
const count = (value: unknown): number | undefined => (
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : undefined
)
const ids = (value: unknown): string[] => (Array.isArray(value) ? value.filter((one): one is string => typeof one === 'string') : [])
const number = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined)

function basedOn(value: unknown): BasedOn | undefined {
  if (!value || typeof value !== 'object') return undefined
  const { library, entry, version, language, name } = value as Record<string, unknown>
  if (typeof library !== 'string' || typeof entry !== 'string') return undefined
  const chosen = text(name)
  return { library, entry, version: text(version) ?? '', language: text(language) ?? 'en', ...(chosen ? { name: chosen } : {}) }
}

function basedOnOf(value: unknown): { basedOn?: BasedOn } {
  const held = basedOn(value)
  return held ? { basedOn: held } : {}
}

/** Where a unit type was put when it came in: absent where `placed` is not an object. */
function placedOf(value: Record<string, unknown>): { placed?: Placed } {
  const { placed } = value
  if (!placed || typeof placed !== 'object' || Array.isArray(placed)) return {}
  const { top, within } = placed as Record<string, unknown>
  return { placed: { top: top === true, within: ids(within) } }
}

/** A unit type's `basedOn`: what every item's says, and where it was put when it came in. */
function unitTypeBasedOnOf(value: unknown): { basedOn?: UnitTypeBasedOn } {
  const held = basedOn(value)
  return held ? { basedOn: { ...held, ...placedOf(value as Record<string, unknown>) } } : {}
}

/** The entries a bring-in matched an item to: each that reads, and the field absent where none does. */
function alsoBasedOnOf(value: unknown): { alsoBasedOn?: BasedOn[] } {
  const held = Array.isArray(value) ? value.flatMap((one) => basedOn(one) ?? []) : []
  return held.length ? { alsoBasedOn: held } : {}
}

/** The dates and successors a later step reads, carried as they are. */
function datedOf(row: Record<string, unknown>): Pick<UnitType, 'from' | 'until' | 'successors'> {
  return {
    ...(text(row.from) !== undefined ? { from: text(row.from) } : {}),
    ...(text(row.until) !== undefined ? { until: text(row.until) } : {}),
    ...(Array.isArray(row.successors) ? { successors: ids(row.successors) } : {}),
  }
}

function slotOf(value: unknown): RoleSlot[] {
  if (!value || typeof value !== 'object') return []
  const { role, min, max } = value as Record<string, unknown>
  if (typeof role !== 'string') return []
  const most = count(max)
  return [{ role, min: count(min) ?? 0, ...(most !== undefined ? { max: most } : {}) }]
}

function dutyOf(value: unknown): Duty[] {
  if (!value || typeof value !== 'object') return []
  const { responsibility, raci } = value as Record<string, unknown>
  return typeof responsibility === 'string' && isRaci(raci) ? [{ responsibility, raci }] : []
}

function unitTypeOf(row: Record<string, unknown>): UnitType[] {
  if (typeof row.id !== 'string') return []
  const limit = count(row.limit)
  const order = number(row.order)
  return [{
    id: row.id,
    name: text(row.name) ?? '',
    ...(text(row.purpose) !== undefined ? { purpose: text(row.purpose) } : {}),
    ...(row.top === true ? { top: true } : {}),
    within: ids(row.within),
    ...(row.spans === true ? { spans: true } : {}),
    slots: Array.isArray(row.slots) ? row.slots.flatMap(slotOf) : [],
    ...(limit !== undefined ? { limit } : {}),
    ...(order !== undefined ? { order } : {}),
    ...unitTypeBasedOnOf(row.basedOn),
    ...alsoBasedOnOf(row.alsoBasedOn),
    ...datedOf(row),
  }]
}

function roleOf(row: Record<string, unknown>): Role[] {
  if (typeof row.id !== 'string') return []
  const order = number(row.order)
  return [{
    id: row.id,
    name: text(row.name) ?? '',
    ...(text(row.short) !== undefined ? { short: text(row.short) } : {}),
    ...(text(row.purpose) !== undefined ? { purpose: text(row.purpose) } : {}),
    duties: Array.isArray(row.duties) ? row.duties.flatMap(dutyOf) : [],
    ...(row.manages === true ? { manages: true } : {}),
    ...(order !== undefined ? { order } : {}),
    ...basedOnOf(row.basedOn),
    ...alsoBasedOnOf(row.alsoBasedOn),
    ...datedOf(row),
  }]
}

function responsibilityOf(row: Record<string, unknown>): Responsibility[] {
  if (typeof row.id !== 'string') return []
  const order = number(row.order)
  return [{
    id: row.id,
    name: text(row.name) ?? '',
    ...(text(row.description) !== undefined ? { description: text(row.description) } : {}),
    ...(text(row.group) !== undefined ? { group: text(row.group) } : {}),
    ...(order !== undefined ? { order } : {}),
    ...basedOnOf(row.basedOn),
  }]
}

function ruleOf(row: Record<string, unknown>): OperatingRule[] {
  return isOperatingRuleKind(row.id) && typeof row.role === 'string' ? [{ id: row.id, role: row.role }] : []
}

/**
 * The operating model's lists out of its files' texts, by path. A list with
 * no file, or none that reads, is absent, as a folder with no decisions has
 * no `decisions`.
 */
export function operatingFrom(textAt: (path: string) => string | undefined): OperatingLists {
  const read = <T>(path: string, row: (held: Record<string, unknown>) => T[]): T[] => (rowsIn(textAt(path)) ?? []).flatMap(row)
  const unitTypes = read(UNIT_TYPES_FILE, unitTypeOf)
  const roles = read(ROLES_FILE, roleOf)
  const responsibilities = read(RESPONSIBILITIES_FILE, responsibilityOf)
  const operatingRules = read(RULES_FILE, ruleOf)
  return {
    ...(unitTypes.length ? { unitTypes } : {}),
    ...(roles.length ? { roles } : {}),
    ...(responsibilities.length ? { responsibilities } : {}),
    ...(operatingRules.length ? { operatingRules } : {}),
  }
}

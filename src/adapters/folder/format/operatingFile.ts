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
 */
import { isOperatingRuleKind, isRaci } from '../../../model/operatingModel'
import type {
  BasedOn, Duty, OperatingRule, Responsibility, Role, RoleSlot, UnitType,
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

function basedOnOf(value: unknown): { basedOn?: BasedOn } {
  if (!value || typeof value !== 'object') return {}
  const { library, entry, version, language } = value as Record<string, unknown>
  if (typeof library !== 'string' || typeof entry !== 'string') return {}
  return { basedOn: { library, entry, version: text(version) ?? '', language: text(language) ?? 'en' } }
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
  return [{
    id: row.id,
    name: text(row.name) ?? '',
    ...(text(row.purpose) !== undefined ? { purpose: text(row.purpose) } : {}),
    ...(row.top === true ? { top: true } : {}),
    within: ids(row.within),
    ...(row.spans === true ? { spans: true } : {}),
    slots: Array.isArray(row.slots) ? row.slots.flatMap(slotOf) : [],
    ...(limit !== undefined ? { limit } : {}),
    ...basedOnOf(row.basedOn),
    ...datedOf(row),
  }]
}

function roleOf(row: Record<string, unknown>): Role[] {
  if (typeof row.id !== 'string') return []
  return [{
    id: row.id,
    name: text(row.name) ?? '',
    ...(text(row.short) !== undefined ? { short: text(row.short) } : {}),
    ...(text(row.purpose) !== undefined ? { purpose: text(row.purpose) } : {}),
    duties: Array.isArray(row.duties) ? row.duties.flatMap(dutyOf) : [],
    ...(row.manages === true ? { manages: true } : {}),
    ...basedOnOf(row.basedOn),
    ...datedOf(row),
  }]
}

function responsibilityOf(row: Record<string, unknown>): Responsibility[] {
  if (typeof row.id !== 'string') return []
  return [{
    id: row.id,
    name: text(row.name) ?? '',
    ...(text(row.description) !== undefined ? { description: text(row.description) } : {}),
    ...(text(row.group) !== undefined ? { group: text(row.group) } : {}),
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

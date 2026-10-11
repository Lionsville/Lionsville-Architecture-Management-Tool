// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Who holds which role in which unit, as a file (ADR-0036 §4): one JSON list
 * per scope, in a folder of the scope's own.
 *
 * ```
 * _assignments/assignments.json   the assignments of this scope's units
 * ```
 *
 * **Why the underscore**, as `_operating/` says (`operatingFile.ts`): a child
 * scope's folder name is a slug and cannot hold one, so no tree already has a
 * scope here, and format 11 takes this folder as it took that one — without
 * moving anybody's scope.
 *
 * **Why one file per scope, not one per record.** The list is the scope's own
 * order, which the inspector shows a unit's people in, and a list in one file
 * keeps it without a second index. A scope holds tens of assignments, or a few
 * hundred, not thousands.
 *
 * **What it holds of a person is an id** — `{ "person": "pe-…" }` — and never
 * a name: the name is the register's, which is outside the history.
 *
 * Forgiving in one direction, as the other codecs are: it writes one exact
 * shape and reads what it can of a hand-edited one. A row without an id, a
 * unit, a role or a person is passed over; a file that is not a list at all is
 * said, so the scope opens to be read and not written — a save would have
 * written the list empty.
 */
import type { HostModel } from '../../../model/hostModel'
import type { Assignment } from '../../../model/units'
import { parseJson, stableJson } from '../../../projects/text'

/** The folder the assignments are kept in. Not a slug, so never a scope's name. */
export const ASSIGNMENTS_FOLDER = '_assignments'

export const ASSIGNMENTS_FILE = `${ASSIGNMENTS_FOLDER}/assignments.json`

/** The one file the format writes under the folder. */
export const ASSIGNMENT_FILES: readonly string[] = [ASSIGNMENTS_FILE]

/** The assignments' file, where the model carries any. An absent or empty list writes no file. */
export function assignmentFiles(model: Pick<HostModel, 'assignments'>): { path: string; text: string }[] {
  return model.assignments?.length ? [{ path: ASSIGNMENTS_FILE, text: stableJson(model.assignments) }] : []
}

/** Each row of a file that is a list; `undefined` where it is not one. */
function rowsIn(text: string | undefined): Record<string, unknown>[] | undefined {
  if (text === undefined) return []
  const held = parseJson(text)
  if (!Array.isArray(held)) return undefined
  return held.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && !Array.isArray(row))
}

/** Whether the file is there and is not a list — the file a save must not write over. */
export function assignmentFileUnreadable(text: string | undefined): boolean {
  return text !== undefined && rowsIn(text) === undefined
}

const text = (value: unknown): string | undefined => (typeof value === 'string' && value !== '' ? value : undefined)

/** A share as a fraction above 0 and at most 1; anything else is all of the person's time, said by its absence. */
function shareOf(value: unknown): { share?: number } {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 1 ? { share: value } : {}
}

/** The person a row names, by id: `{ person: id }`, or a bare id a hand wrote. */
function personOf(value: unknown): string | undefined {
  if (typeof value === 'string') return text(value)
  if (value && typeof value === 'object' && !Array.isArray(value)) return text((value as Record<string, unknown>).person)
  return undefined
}

function assignmentOf(row: Record<string, unknown>): Assignment[] {
  const id = text(row.id)
  const unitId = text(row.unitId)
  const roleId = text(row.roleId)
  const person = personOf(row.person)
  if (!id || !unitId || !roleId || !person) return []
  return [{
    id,
    unitId,
    roleId,
    person: { person },
    ...shareOf(row.share),
    ...(text(row.from) !== undefined ? { from: text(row.from) } : {}),
    ...(text(row.until) !== undefined ? { until: text(row.until) } : {}),
    ...(row.acting === true ? { acting: true as const } : {}),
  }]
}

/**
 * The assignments out of their file's text, by path. No file, or none that
 * reads, is no list, as a folder with no decisions has no `decisions`.
 */
export function assignmentsFrom(textAt: (path: string) => string | undefined): Pick<HostModel, 'assignments'> {
  const assignments = (rowsIn(textAt(ASSIGNMENTS_FILE)) ?? []).flatMap(assignmentOf)
  return assignments.length ? { assignments } : {}
}

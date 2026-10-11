// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The findings marked as intended, as a file (ADR-0036, amended 11 October
 * 2026): one JSON list per scope, in a folder of the scope's own.
 *
 * ```
 * _checks/marks.json   the findings about this scope marked as intended
 * ```
 *
 * **Why the underscore**, as `_operating/` and `_assignments/` say: a child
 * scope's folder name is a slug and cannot hold one, so no tree already has a
 * scope here, and format 12 takes this folder without moving anybody's scope.
 * A finding is worked out and never stored; a mark is what a person said
 * about one, so it is kept like any other record.
 *
 * **Why one file per scope.** The list is the order the marks were made in,
 * which a list of what was accepted reads, and a scope holds a handful of
 * marks, or tens.
 *
 * Forgiving in one direction, as the other codecs are: it writes one exact
 * shape and reads what it can of a hand-edited one. A row without a key or a
 * day is passed over, and so is one whose check is not a review or a note of
 * the catalogue: a fix is never marked, so a mark of one means nothing and the
 * model never holds it, which is also what keeps taking a mark back undoable.
 * A build that adds a check whose marks an earlier one must not drop turns the
 * format's number, as every change of meaning does. A file that is not a list
 * at all is said, so the scope opens to be read and not written: a save would
 * have written the list empty.
 */
import { isCheckKey } from '../../../model/checkCatalogue'
import { checkMarkId, isMarkable } from '../../../model/checkMarks'
import type { CheckMark } from '../../../model/checkMarks'
import type { HostModel } from '../../../model/hostModel'
import { isDay } from '../../../model/lifecycle'
import { parseJson, stableJson } from '../../../projects/text'

/** The folder the marks are kept in. Not a slug, so never a scope's name. */
export const CHECKS_FOLDER = '_checks'

export const CHECK_MARKS_FILE = `${CHECKS_FOLDER}/marks.json`

/** The one file the format writes under the folder. */
export const CHECK_MARK_FILES: readonly string[] = [CHECK_MARKS_FILE]

/** The marks' file, where the model carries any. An absent or empty list writes no file. */
export function checkMarkFiles(model: Pick<HostModel, 'checkMarks'>): { path: string; text: string }[] {
  return model.checkMarks?.length ? [{ path: CHECK_MARKS_FILE, text: stableJson(model.checkMarks) }] : []
}

/** Each row of a file that is a list; `undefined` where it is not one. */
function rowsIn(text: string | undefined): Record<string, unknown>[] | undefined {
  if (text === undefined) return []
  const held = parseJson(text)
  if (!Array.isArray(held)) return undefined
  return held.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && !Array.isArray(row))
}

/** Whether the file is there and is not a list — the file a save must not write over. */
export function checkMarkFileUnreadable(text: string | undefined): boolean {
  return text !== undefined && rowsIn(text) === undefined
}

const text = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() !== '' ? value : undefined)

function markOf(row: Record<string, unknown>): CheckMark[] {
  const check = text(row.check)
  const key = text(row.key)
  const on = text(row.on)
  if (!check || !isCheckKey(check) || !isMarkable(check) || !key || !isDay(on)) return []
  const reason = text(row.reason)
  return [{ check, key, ...(reason !== undefined ? { reason } : {}), on }]
}

/**
 * The marks out of their file's text, by path. No file, or none that reads,
 * is no list, as a folder with no decisions has no `decisions`. One instance
 * marked twice is marked once, as the first row says it.
 */
export function checkMarksFrom(textAt: (path: string) => string | undefined): Pick<HostModel, 'checkMarks'> {
  const seen = new Set<string>()
  const checkMarks = (rowsIn(textAt(CHECK_MARKS_FILE)) ?? []).flatMap(markOf).filter((mark) => {
    const id = checkMarkId(mark)
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
  return checkMarks.length ? { checkMarks } : {}
}

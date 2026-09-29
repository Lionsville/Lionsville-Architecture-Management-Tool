// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The step ids a folder's repositories have applied, kept by the app and not
 * in the folder (ADR-0031, as built).
 *
 * A step sent twice lands once, and one sent to another scope is refused; for
 * that the ids a folder applied are remembered for at least a day, through a
 * restart. Not in the folder, where a person would see them and a copy of the
 * folder would carry them to where they mean nothing; beside the machine's
 * other settings about each folder, keyed by its path:
 *
 *   <userData>/applied-steps.json
 *   { "version": 1, "folders": { "<root>": { "<step id>": ["<scope id>", <at>] } } }
 *
 * Pure: text in, text out. The main process finds the file.
 */
import { parseJson, stableJson } from '../../projects/fileText'

export const APPLIED_STEPS_FILE = 'applied-steps.json'

/**
 * One folder's applied steps: each id, the scope it went to, and when, in
 * epoch milliseconds — and, while its write is not known to have landed, what
 * the scope was to be after it.
 */
export type AppliedSteps = Record<string, [string, number] | [string, number, string]>

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

/** The rows of an entry that say a step: a scope and a time. Anything else is let go of. */
export function appliedStepsOf(value: unknown): AppliedSteps {
  const found: AppliedSteps = {}
  for (const [id, row] of Object.entries(record(value) ?? {})) {
    if (!Array.isArray(row) || typeof row[0] !== 'string' || typeof row[1] !== 'number') continue
    found[id] = typeof row[2] === 'string' ? [row[0], row[1], row[2]] : [row[0], row[1]]
  }
  return found
}

/** One folder's steps out of the file, or `undefined` where none were written for it. */
export function readAppliedSteps(text: string | undefined, root: string): AppliedSteps | undefined {
  const folders = record(record(text === undefined ? undefined : parseJson(text))?.['folders'])
  return folders && root in folders ? appliedStepsOf(folders[root]) : undefined
}

/** The file's text with one folder's steps replaced; every other folder's carried through. */
export function appliedStepsText(text: string | undefined, root: string, steps: AppliedSteps): string {
  const top = record(text === undefined ? undefined : parseJson(text)) ?? {}
  const folders = record(top['folders']) ?? {}
  return stableJson({ ...top, version: 1, folders: { ...folders, [root]: appliedStepsOf(steps) } })
}

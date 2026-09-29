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
 * Beside them, where each of a folder's scopes' identities was last found
 * (`places`), so a folder copied by hand leaves an identity where it was
 * through a restart; and what this machine found each of a folder's pictures to
 * be at the stamp it had (`stamps`), so reading a scope reads no picture that
 * has not changed since.
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

/** One folder's scopes' identities, each with the address it was last found at. */
export type ScopePlaces = Record<string, string>

function placesOf(value: unknown): ScopePlaces {
  return Object.fromEntries(Object.entries(record(value) ?? {}).filter((row): row is [string, string] => typeof row[1] === 'string'))
}

/** Where one folder's scopes were last found, out of the same file; `undefined` where none were written for it. */
export function readScopePlaces(text: string | undefined, root: string): ScopePlaces | undefined {
  const places = record(record(text === undefined ? undefined : parseJson(text))?.['places'])
  return places && root in places ? placesOf(places[root]) : undefined
}

/** The file's text with one folder's places replaced; every other folder's, and every step, carried through. */
export function scopePlacesText(text: string | undefined, root: string, places: ScopePlaces): string {
  const top = record(text === undefined ? undefined : parseJson(text)) ?? {}
  const held = record(top['places']) ?? {}
  return stableJson({ ...top, version: 1, places: { ...held, [root]: placesOf(places) } })
}

/** What a machine found each of a folder's pictures to be, by scope folder and file, at the stamp it had. */
export type PictureStamps = Record<string, { size: number; lastModified: number; inode?: number; contentAddress: string; width: number; height: number }>

function stampsOf(value: unknown): PictureStamps {
  const found: PictureStamps = {}
  for (const [key, row] of Object.entries(record(value) ?? {})) {
    const held = record(row)
    if (!held) continue
    const { size, lastModified, inode, contentAddress, width, height } = held
    if ([size, lastModified, width, height].every((one) => typeof one === 'number') && typeof contentAddress === 'string') {
      found[key] = {
        size: size as number, lastModified: lastModified as number, contentAddress, width: width as number, height: height as number,
        ...(typeof inode === 'number' ? { inode } : {}),
      }
    }
  }
  return found
}

/** What was found of one folder's pictures, out of the same file; `undefined` where nothing was written for it. */
export function readPictureStamps(text: string | undefined, root: string): PictureStamps | undefined {
  const stamps = record(record(text === undefined ? undefined : parseJson(text))?.['stamps'])
  return stamps && root in stamps ? stampsOf(stamps[root]) : undefined
}

/** The file's text with what was found of one folder's pictures replaced; everything else carried through. */
export function pictureStampsText(text: string | undefined, root: string, stamps: PictureStamps): string {
  const top = record(text === undefined ? undefined : parseJson(text)) ?? {}
  const held = record(top['stamps']) ?? {}
  return stableJson({ ...top, version: 1, stamps: { ...held, [root]: stampsOf(stamps) } })
}

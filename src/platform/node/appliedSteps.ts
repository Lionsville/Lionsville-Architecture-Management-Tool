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
 * other settings, one file per folder, named by a hash of its path, so what
 * one folder writes never reads or rewrites another's:
 *
 *   <userData>/folders/<sha-256 of the root>.json
 *   { "version": 1, "root": "<root>", "steps": { "<step id>": ["<scope id>", <at>] } }
 *
 * Beside them, where each of the folder's scopes' identities was last found
 * (`places`), so a folder copied by hand leaves an identity where it was
 * through a restart; and what this machine found each of its pictures to be at
 * the stamp it had (`stamps`), so reading a scope reads no picture that has
 * not changed since. The file says whose it is: one that names another root
 * is read as nothing and written over.
 *
 * Pure: text in, text out. The main process finds the file.
 */
import { createHash } from 'node:crypto'
import { parseJson, stableJson } from '../../projects/fileText'

/** Where, under the app's own data folder, one folder's file is. */
export function appliedStepsFile(root: string): string {
  return `folders/${createHash('sha256').update(root, 'utf8').digest('hex')}.json`
}

/**
 * One folder's applied steps: each id, the scope it went to, and when, in
 * epoch milliseconds — and, while its write is not known to have landed, what
 * the scope was to be after it.
 */
export type AppliedSteps = Record<string, [string, number] | [string, number, string]>

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

/** The file, where it is this folder's; nothing where it is missing, unreadable or another's. */
function mine(text: string | undefined, root: string): Record<string, unknown> | undefined {
  const top = record(text === undefined ? undefined : parseJson(text))
  return top?.['root'] === root ? top : undefined
}

/** One part of the folder's file, or `undefined` where it was never written. */
function part(text: string | undefined, root: string, name: string): unknown {
  return mine(text, root)?.[name]
}

/** The file's text with one part replaced and every other part carried through. */
function withPart(text: string | undefined, root: string, name: string, value: unknown): string {
  return stableJson({ ...mine(text, root), version: 1, root, [name]: value })
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

/** The folder's steps out of its file, or `undefined` where none were written. */
export function readAppliedSteps(text: string | undefined, root: string): AppliedSteps | undefined {
  const held = part(text, root, 'steps')
  return held === undefined ? undefined : appliedStepsOf(held)
}

/** The folder's file with its steps replaced. */
export function appliedStepsText(text: string | undefined, root: string, steps: AppliedSteps): string {
  return withPart(text, root, 'steps', appliedStepsOf(steps))
}

/** One folder's scopes' identities, each with the address it was last found at. */
export type ScopePlaces = Record<string, string>

function placesOf(value: unknown): ScopePlaces {
  return Object.fromEntries(Object.entries(record(value) ?? {}).filter((row): row is [string, string] => typeof row[1] === 'string'))
}

/** Where the folder's scopes were last found, out of the same file; `undefined` where none were written. */
export function readScopePlaces(text: string | undefined, root: string): ScopePlaces | undefined {
  const held = part(text, root, 'places')
  return held === undefined ? undefined : placesOf(held)
}

/** The folder's file with its places replaced; its steps and stamps carried through. */
export function scopePlacesText(text: string | undefined, root: string, places: ScopePlaces): string {
  return withPart(text, root, 'places', placesOf(places))
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

/** What was found of the folder's pictures, out of the same file; `undefined` where nothing was written. */
export function readPictureStamps(text: string | undefined, root: string): PictureStamps | undefined {
  const held = part(text, root, 'stamps')
  return held === undefined ? undefined : stampsOf(held)
}

/** The folder's file with what was found of its pictures replaced; everything else carried through. */
export function pictureStampsText(text: string | undefined, root: string, stamps: PictureStamps): string {
  return withPart(text, root, 'stamps', stampsOf(stamps))
}

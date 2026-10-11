// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The people register as a folder keeps it (ADR-0036):
 * `.lionsville-architecture/people.json` at the organisation's root, beside
 * the organisation's settings — and, unlike them, never in the folder's
 * history. Every git the app runs leaves it out, and `.git/info/exclude`
 * keeps a `git add -A` typed in a terminal from taking it
 * (`platform/node/git.ts`), because a name in a commit is a name nothing can
 * forget.
 *
 * The working file carries it at the same path, at the zip's root, where a
 * build from before the register reads past it (`workingFile.ts`).
 *
 * ```json
 * { "version": 1, "people": [ { "id": "pe-…", "name": "…", "pseudonym": "4K7Q", … } ] }
 * ```
 *
 * One entry per person, by id, in id order, so two writes of one register
 * are the same bytes. Read tolerantly — an entry that does not read is left
 * out, a key nobody knows dropped — and a file that will not read at all, or
 * that a later build wrote, is said so rather than read as nobody: a register
 * read as empty and written back would be everyone lost.
 */
import type { Person } from '../../../people/person'
import { personFrom } from '../../../people/person'
import { parseJson, stableJson } from '../../../projects/text'
/** Where the register is, from the organisation's root, in a folder and in a working file alike. */
export { PEOPLE_FILE, PEOPLE_PATH } from './folderSettings'

/** The version of the file this build writes. */
export const PEOPLE_FILE_VERSION = 1

/** A file read: its entries, and whether it may be written over. */
export type PeopleFileRead =
  | { kind: 'absent' }
  | { kind: 'read'; people: Person[] }
  /** It would not read, or a later build wrote it: what could be read, and never written over. */
  | { kind: 'unwritable'; people: Person[]; why: 'unreadable' | 'later' }

export function readPeopleFile(text: string | undefined): PeopleFileRead {
  if (text === undefined) return { kind: 'absent' }
  const parsed = parseJson(text) as { version?: unknown; people?: unknown } | undefined
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.people)) return { kind: 'unwritable', people: [], why: 'unreadable' }
  const people = parsed.people.flatMap((value) => {
    const person = personFrom(value)
    return person ? [person] : []
  })
  const version = typeof parsed.version === 'number' ? parsed.version : PEOPLE_FILE_VERSION
  return version > PEOPLE_FILE_VERSION ? { kind: 'unwritable', people, why: 'later' } : { kind: 'read', people }
}

/** The register as the file holds it. */
export function peopleFileText(people: readonly Person[]): string {
  const ordered = [...people].sort((one, other) => (one.id < other.id ? -1 : one.id > other.id ? 1 : 0))
  return `${stableJson({ version: PEOPLE_FILE_VERSION, people: ordered })}\n`
}

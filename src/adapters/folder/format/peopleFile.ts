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
 * { "version": 1, "people": [ { "id": "pe-…", "name": "…", "pseudonym": "4K7Q", … } ], "removed": [ "pe-…" ],
 *   "distinct": [ { "a": "pe-…", "b": "pe-…", "on": "2026-10-11" } ] }
 * ```
 *
 * One entry per person, by id, in id order, so two writes of one register
 * are the same bytes. `removed` is every id the register took away — the id
 * alone, naming nobody — so that nothing carried in later brings the entry
 * back; written only where there is one, so a register that never removed
 * anybody reads and writes as it did. `distinct` is every pair answered as not
 * the same person (`people/distinct.ts`), in id order, written likewise only
 * where there is one: the version stays 1, because a build from before it —
 * 3.6.0 — reads past the key, and on its next change to the register writes
 * the file without it, so the pairs it held are offered as possible
 * duplicates again; nothing else is lost. Read tolerantly — an entry that
 * does not read is left out, a key nobody knows dropped — and a file that
 * will not read at all, or that a later build wrote, is said so rather than
 * read as nobody: a register read as empty and written back would be
 * everyone lost.
 */
import { distinctFrom, tidyDistinct } from '../../../people/distinct'
import type { DistinctPair } from '../../../people/distinct'
import type { Person, PersonId } from '../../../people/person'
import { personFrom } from '../../../people/person'
import { parseJson, stableJson } from '../../../projects/text'
/** Where the register is, from the organisation's root, in a folder and in a working file alike. */
export { PEOPLE_FILE, PEOPLE_PATH } from './folderSettings'

/** The version of the file this build writes. */
export const PEOPLE_FILE_VERSION = 1

/** A file read: its entries, the ids it removed and the pairs it answered where it says any, and whether it may be written over. */
export type PeopleFileRead =
  | { kind: 'absent' }
  | { kind: 'read'; people: Person[]; removed?: PersonId[]; distinct?: DistinctPair[] }
  /** It would not read, or a later build wrote it: what could be read, and never written over. */
  | { kind: 'unwritable'; people: Person[]; removed?: PersonId[]; distinct?: DistinctPair[]; why: 'unreadable' | 'later' }

export function readPeopleFile(text: string | undefined): PeopleFileRead {
  if (text === undefined) return { kind: 'absent' }
  const parsed = parseJson(text) as { version?: unknown; people?: unknown; removed?: unknown; distinct?: unknown } | undefined
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.people)) return { kind: 'unwritable', people: [], why: 'unreadable' }
  const people = parsed.people.flatMap((value) => {
    const person = personFrom(value)
    return person ? [person] : []
  })
  const ids = Array.isArray(parsed.removed) ? parsed.removed.filter((id): id is string => typeof id === 'string' && id !== '') : []
  const removed = ids.length ? { removed: [...new Set(ids)] } : {}
  // Over the entries the file holds, as the register keeps them: a pair naming nobody here is none.
  const pairs = tidyDistinct((Array.isArray(parsed.distinct) ? parsed.distinct : []).flatMap((value) => {
    const pair = distinctFrom(value)
    return pair ? [pair] : []
  }), people)
  const distinct = pairs.length ? { distinct: pairs } : {}
  const version = typeof parsed.version === 'number' ? parsed.version : PEOPLE_FILE_VERSION
  return version > PEOPLE_FILE_VERSION
    ? { kind: 'unwritable', people, ...removed, ...distinct, why: 'later' }
    : { kind: 'read', people, ...removed, ...distinct }
}

function byId(one: string, other: string): number {
  return one < other ? -1 : one > other ? 1 : 0
}

/** The register as the file holds it: its entries, and the ids it removed and the pairs it answered where there are any. */
export function peopleFileText(people: readonly Person[], removed: readonly PersonId[] = [], distinct: readonly DistinctPair[] = []): string {
  const ordered = [...people].sort((one, other) => byId(one.id, other.id))
  const gone = [...new Set(removed)].sort(byId)
  const pairs = tidyDistinct(distinct, people)
  return `${stableJson({
    version: PEOPLE_FILE_VERSION, people: ordered, ...(gone.length ? { removed: gone } : {}), ...(pairs.length ? { distinct: pairs } : {}),
  })}\n`
}

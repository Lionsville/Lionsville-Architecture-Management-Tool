// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * `HistoryRepository` over a keyed store (ADR-0031 §1; ADR-0008).
 *
 * An entry is kept twice over: what a list shows of it — when, by whom, its
 * subject, its labels and the records its steps changed — and, apart, the
 * scope's whole state when it was made. A page of entries reads the first
 * alone; only `stateAt` reads a state. Both are filed under the scope's
 * identity and the entry's number, so a scope's entries are one range, newest
 * last, and follow the scope through every move.
 *
 * Entries are numbered across the source, never per scope, so entries of
 * several scopes merge newest first by their number, and a number is never
 * given twice — not even to a scope made where a removed one was.
 */
import { labelSlug } from '../../projects/label'
import { sameRecord } from '../../model/recordKey'
import type { RecordKey } from '../../model/recordKey'
import type { ScopeId, ScopeState } from '../../projects/scopeState'
import type {
  EntriesWanted, EntryId, EntryLabelled, HistoryEntry, HistoryPage, HistoryRepository, RecordWanted,
} from '../../ports/HistoryRepository'
import { keyOf, prefix } from './KeyedStore'
import type { Transaction } from './KeyedStore'
import { stateAtEntry } from './entryStates'
import { sweepUnnamed } from './imageNames'
import { allScopes, closeEntry, entryKey, META_KEY, readMeta } from './kept'
import type { KeptEntry } from './kept'
import type { Source } from './source'

/** How many entries a page holds where the caller did not say. */
export const PAGE = 50

/** An entry's number from its id, or `undefined` for an id this source never gave. */
function seqOf(entry: EntryId): number | undefined {
  return /^[1-9]\d*$/.test(String(entry)) ? Number(entry) : undefined
}

function listed({ seq, scope, at, by, subject, labels }: KeptEntry): HistoryEntry {
  return { id: String(seq), scope, at, by, labels, ...(subject !== undefined ? { subject } : {}) }
}

export class KeptHistory implements HistoryRepository {
  readonly id: string

  constructor(private readonly source: Source) {
    this.id = source.id
  }

  /** Closes the open entries asked for, and takes out the pictures' bytes nothing names any more (`imageNames.ts`). */
  record({ scopes, subject }: RecordWanted): Promise<readonly HistoryEntry[]> {
    const now = Date.now()
    return this.source.write(async (tx) => {
      const meta = await readMeta(tx)
      const made: KeptEntry[] = []
      for (const kept of await allScopes(tx)) {
        if (!kept.pending || (scopes && !scopes.includes(kept.id))) continue
        made.push(await closeEntry(tx, meta, kept, this.source.by, subject))
      }
      if (meta.namesCounted) await sweepUnnamed(tx, now)
      tx.put('meta', META_KEY, meta)
      return made.reverse().map(listed)
    })
  }

  entries({ scopes, record, limit = PAGE, after }: EntriesWanted): Promise<HistoryPage> {
    const size = Math.max(1, limit)
    const below = after === undefined ? Number.MAX_SAFE_INTEGER : seqOf(after)
    if (below === undefined) return Promise.resolve({ entries: [] })
    return this.source.read(async (tx) => {
      const found: KeptEntry[] = []
      for (const scope of new Set(scopes)) {
        const range = { from: keyOf(scope, ''), below: entryKey(scope, below), reverse: true }
        const held = await tx.range<KeptEntry>('entries', record ? range : { ...range, limit: size + 1 })
        found.push(...held.map(({ value }) => value).filter((entry) => !record || wrote(entry, record)))
      }
      const matching = found.sort((one, other) => other.seq - one.seq)
      const page = matching.slice(0, size)
      return matching.length > page.length
        ? { entries: page.map(listed), next: String(page[page.length - 1].seq) }
        : { entries: page.map(listed) }
    })
  }

  stateAt(scope: ScopeId, entry: EntryId): Promise<ScopeState | undefined> {
    const seq = seqOf(entry)
    if (seq === undefined) return Promise.resolve(undefined)
    return this.source.read((tx) => stateAtEntry(tx, scope, seq))
  }

  label(scope: ScopeId, entry: EntryId, name: string): Promise<EntryLabelled> {
    const seq = seqOf(entry)
    if (seq === undefined) return Promise.resolve('gone')
    return this.source.write(async (tx) => {
      const found = await tx.get<KeptEntry>('entries', entryKey(scope, seq))
      if (!found) return 'gone'
      const slug = labelSlug(name)
      if (!slug) return 'unnamed'
      if (await labelTaken(tx, scope, slug)) return 'exists'
      found.labels.push(name)
      tx.put('entries', entryKey(scope, seq), found)
      return 'done'
    })
  }
}

function wrote(entry: KeptEntry, record: RecordKey): boolean {
  return entry.records.some((one) => sameRecord(one, record))
}

async function labelTaken(tx: Transaction, scope: ScopeId, slug: string): Promise<boolean> {
  const held = await tx.range<KeptEntry>('entries', prefix(keyOf(scope, '')))
  return held.some(({ value }) => value.labels.some((label) => labelSlug(label) === slug))
}

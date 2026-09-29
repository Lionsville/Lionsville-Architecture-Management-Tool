// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A history a test writes out by hand: its entries, by the address of the
 * scope each is an entry of, what each wrote, and the scope as it was then —
 * and a record of every `record` it was asked for.
 *
 * The memory implementation is the real thing, and the suites hold it to the
 * contract; this is for a screen's test that wants a history with three
 * entries from last week in it, which no amount of stepping through the real
 * one makes without a clock.
 */
import type {
  EntriesWanted, EntryLabelled, HistoryEntry, HistoryPage, HistoryRepository, RecordWanted,
} from '../../ports/HistoryRepository'
import { sameRecord } from '../../model/recordKey'
import type { RecordKey } from '../../model/recordKey'
import { labelSlug } from '../../projects/label'
import type { ScopeSnapshot } from '../../projects/scope'
import { nodesOf } from '../../projects/scopeAccess'
import type { ScopeReader } from '../../projects/scopeAccess'
import type { ScopePath } from '../../projects/scopePath'
import type { ScopeState } from '../../projects/scopeState'

export type FakeEntry = {
  id: string
  /** The scope it is an entry of, by address. */
  address: ScopePath
  subject?: string
  at: number
  by?: string
  labels?: string[]
  /** What its steps wrote; absent, everything the scope holds. */
  records?: readonly RecordKey[]
  /** The scope as it was then; absent where the scope was not there. */
  state?: ScopeSnapshot
}

export type FakeHistory = HistoryRepository & {
  /** Every `record` asked for, in order. */
  readonly recorded: RecordWanted[]
}

/**
 * `made` says what a `record` answers: an entry per scope it was asked about
 * (the default), none — nothing to record — or a failure.
 */
export function fakeHistory(
  scopes: ScopeReader, entries: FakeEntry[] = [], made: 'entries' | 'nothing' | Error = 'entries',
): FakeHistory {
  const recorded: RecordWanted[] = []
  const addresses = async (ids: readonly string[]) => {
    const nodes = nodesOf((await scopes.tree()).root)
    return new Map(nodes.filter((node) => ids.includes(node.id)).map((node) => [node.address, node.id]))
  }
  const asEntry = (held: FakeEntry, scope: string): HistoryEntry => ({
    id: held.id, scope, at: held.at, by: held.by ?? 'W.', labels: [...(held.labels ?? [])],
    ...(held.subject !== undefined ? { subject: held.subject } : {}),
  })
  const wrote = (held: FakeEntry, record: RecordKey | undefined) =>
    record === undefined || held.records === undefined || held.records.some((one) => sameRecord(one, record))
  return {
    id: 'a history written by hand',
    recorded,
    async record(wanted) {
      recorded.push(wanted)
      if (made instanceof Error) throw made
      if (made === 'nothing') return []
      const ids = wanted.scopes ?? nodesOf((await scopes.tree()).root).map((node) => node.id)
      return ids.map((scope, at) => ({ id: `made-${recorded.length}-${at}`, scope, at: Date.now(), by: 'W.', labels: [], ...(wanted.subject ? { subject: wanted.subject } : {}) }))
    },
    async entries(wanted: EntriesWanted): Promise<HistoryPage> {
      const found = await addresses(wanted.scopes)
      const listed = entries
        .filter((held) => found.has(held.address) && wrote(held, wanted.record))
        .sort((one, other) => other.at - one.at)
        .slice(0, wanted.limit ?? entries.length)
        .map((held) => asEntry(held, found.get(held.address)!))
      return { entries: listed }
    },
    async stateAt(scope, entry): Promise<ScopeState | undefined> {
      const held = entries.find((one) => one.id === entry)?.state
      return held && { ...held, id: scope, address: held.path, revision: `at ${entry}`, images: [] }
    },
    async label(_scope, entry, name): Promise<EntryLabelled> {
      const held = entries.find((one) => one.id === entry)
      if (!held) return 'gone'
      const slug = labelSlug(name)
      if (!slug) return 'unnamed'
      const taken = entries.some((one) => one.address === held.address && (one.labels ?? []).some((label) => labelSlug(label) === slug))
      if (taken) return 'exists'
      held.labels = [...(held.labels ?? []), name]
      return 'done'
    },
  }
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * `OrganisationIndex` over a keyed store (ADR-0031 §1).
 *
 * Every change to the scopes writes one line to the index's log, in the same
 * transaction as the change (`kept.ts`, `indexChanged`): which scopes it
 * changed and which it removed. The index's revision is the source's mark and
 * the number of that line, so *what changed since* is the lines after it, read
 * in one range — and a revision from another source, from before the lines
 * kept, or from nowhere is answered with nothing, and the reader reads the
 * whole index again.
 */
import type { ScopeId } from '../../projects/scopeState'
import type { IndexChanges, IndexedScope, IndexRead, OrganisationIndex } from '../../ports/OrganisationIndex'
import type { Transaction } from './KeyedStore'
import { allScopes, indexRevision, readMeta, readModel, sequenceKey } from './kept'
import type { IndexLogged, KeptScope } from './kept'
import type { Source } from './source'

export class KeptIndex implements OrganisationIndex {
  readonly id: string

  private readonly source: Source

  constructor(source: Source) {
    this.source = source
    this.id = source.id
  }

  read(): Promise<IndexRead> {
    return this.source.read(async (tx) => {
      const meta = await readMeta(tx)
      const scopes: IndexedScope[] = []
      for (const kept of await allScopes(tx)) scopes.push(await indexed(tx, kept))
      return { revision: indexRevision(meta), scopes }
    })
  }

  since(revision: string): Promise<IndexChanges | undefined> {
    return this.source.read(async (tx) => {
      const meta = await readMeta(tx)
      const from = sequenceOf(revision, meta.nonce)
      if (from === undefined || from > meta.indexSeq) return undefined
      const lines = await tx.range<IndexLogged>('indexLog', { from: sequenceKey(from + 1) })
      if (lines.length !== meta.indexSeq - from) return undefined
      const changed = new Set<ScopeId>()
      const removed = new Set<ScopeId>()
      for (const { value } of lines) {
        for (const id of value.changed) changed.add(id)
        for (const id of value.removed) removed.add(id)
      }
      const answer: IndexedScope[] = []
      for (const id of changed) {
        const kept = await tx.get<KeptScope>('scopes', id)
        if (kept) answer.push(await indexed(tx, kept))
      }
      const stillThere = new Set(answer.map((scope) => scope.id))
      return { revision: indexRevision(meta), changed: answer, removed: [...removed].filter((id) => !stillThere.has(id)) }
    })
  }
}

/** A revision's line number, where it is this source's; `undefined` for anything else. */
function sequenceOf(revision: string, nonce: string): number | undefined {
  const [mark, line, ...rest] = String(revision).split('.')
  if (mark !== nonce || rest.length > 0 || !/^\d+$/.test(line ?? '')) return undefined
  return Number(line)
}

/** What the index reads of a scope: its records and rows, its analysis, and nothing written in prose. */
async function indexed(tx: Transaction, kept: KeptScope): Promise<IndexedScope> {
  const { elements, relations, transitions, observations, causes, solutions, experiments } = (await readModel(tx, kept)).content.model
  return {
    id: kept.id, address: kept.address,
    model: {
      elements: elements.map(({ description: _prose, ...element }) => element),
      relations,
      ...(transitions ? { transitions } : {}),
      // A scope's analysis, which every scope above reads (ADR-0032 §1).
      ...(observations ? { observations } : {}),
      ...(causes ? { causes } : {}),
      ...(solutions ? { solutions } : {}),
      ...(experiments ? { experiments } : {}),
    },
  }
}

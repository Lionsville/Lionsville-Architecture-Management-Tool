// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One source over a keyed store: made once, then read and written in
 * transactions the five repositories share.
 *
 * **Made on first use.** A store with nothing in it is given the organisation
 * and the source's marks in one transaction, and every read and write waits
 * for that — so a repository answers from the first call, and two pages
 * opening one empty store make one organisation between them, because the
 * second finds what the first made.
 *
 * Every transaction spans every shelf. The repositories cross them freely —
 * a step writes a scope, its library, the index's log and its step ids — and
 * a transaction that forgot one would fail only where that path is taken.
 */
import { ROOT_SCOPE } from '../../projects/scopePath'
import { emptyContent } from '../../projects/scopeState'
import { SHELVES } from './KeyedStore'
import type { KeyedStore, Transaction } from './KeyedStore'
import { META_KEY, makeScope, mintId } from './kept'
import type { Meta } from './kept'

export type SourceOptions = {
  /** Which repositories these are, in plain words: each repository's `id`. */
  id: string
  /** Who made a history entry, in this source's word (`HistoryEntry.by`). */
  by: string
  /**
   * What a store with nothing in it is given besides the organisation, in the
   * same transaction: work kept somewhere else before this source existed.
   */
  seed?(tx: Transaction, meta: Meta): Promise<void>
}

export class Source {
  readonly id: string
  readonly by: string
  private made: Promise<void> | undefined

  constructor(private readonly store: KeyedStore, private readonly options: SourceOptions) {
    this.id = options.id
    this.by = options.by
  }

  read<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.ready().then(() => this.store.transaction(SHELVES, 'read', work))
  }

  write<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.ready().then(() => this.store.transaction(SHELVES, 'write', work))
  }

  /** Made once per instance; a failure is tried again on the next call rather than kept. */
  private ready(): Promise<void> {
    this.made ??= this.store.transaction(SHELVES, 'write', (tx) => this.make(tx)).catch((error: unknown) => {
      this.made = undefined
      throw error
    })
    return this.made
  }

  private async make(tx: Transaction): Promise<void> {
    if (await tx.get<Meta>('meta', META_KEY)) return
    makeScope(tx, ROOT_SCOPE, emptyContent(''))
    const meta: Meta = { nonce: mintId(), indexSeq: 0, treeRevision: mintId(), entrySeq: 0 }
    await this.options.seed?.(tx, meta)
    tx.put('meta', META_KEY, meta)
  }
}

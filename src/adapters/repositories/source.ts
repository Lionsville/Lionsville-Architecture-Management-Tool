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
 * **What a new store starts with** may be more than the organisation: work
 * kept somewhere else before this source existed (`SourceOptions.seed`). It is
 * prepared before the store is written — preparing it waits on digests, which
 * a transaction would not survive — and written in the same transaction as
 * the organisation, so a store is made with all of it or none. Each scope
 * brought over closes its first history entry with the seed's subject, so
 * the state it arrived in is one a person can always go back to.
 *
 * Every transaction spans every shelf. The repositories cross them freely —
 * a step writes a scope, its library, the index's log and its step ids — and
 * a transaction that forgot one would fail only where that path is taken.
 */
import type { ContentAddress } from '../../model/imageName'
import { ROOT_SCOPE } from '../../projects/scopePath'
import { emptyContent } from '../../projects/scopeState'
import type { ScopeAddress, ScopeContent } from '../../projects/scopeState'
import { SHELVES } from './KeyedStore'
import type { KeyedStore, Transaction } from './KeyedStore'
import { bytesKey, closeEntry, makeAncestors, META_KEY, makeScope, mintId } from './kept'
import type { KeptScope, Meta } from './kept'

/** One scope brought into a new store: where, what, and its pictures' bytes. */
export type SeededScope = {
  address: ScopeAddress
  content: ScopeContent
  bytes: readonly { contentAddress: ContentAddress; bytes: Uint8Array }[]
  /** When it was last changed where it was kept, for the entry it arrives as. */
  at?: number
}

/** Work kept somewhere else, ready to write into a new store; every address a safe one, none twice. */
export type Seed = {
  scopes: readonly SeededScope[]
  /** What the entry each scope arrives as says it was. */
  subject: string
}

export type SourceOptions = {
  /** Which repositories these are, in plain words: each repository's `id`. */
  id: string
  /** Who made a history entry, in this source's word (`HistoryEntry.by`). */
  by: string
  /**
   * What a store with nothing in it is given besides the organisation: work
   * kept somewhere else before this source existed. Asked only while the
   * store is empty, and `undefined` for nothing to bring.
   */
  seed?(): Promise<Seed | undefined>
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
    this.made ??= this.make().catch((error: unknown) => {
      this.made = undefined
      throw error
    })
    return this.made
  }

  private async make(): Promise<void> {
    if (await this.store.transaction(SHELVES, 'read', (tx) => tx.get<Meta>('meta', META_KEY))) return
    const seed = await this.options.seed?.()
    await this.store.transaction(SHELVES, 'write', (tx) => this.plant(tx, seed))
  }

  /** The organisation, what the seed brings, and the source's marks — unless another page made them first. */
  private async plant(tx: Transaction, seed: Seed | undefined): Promise<void> {
    if (await tx.get<Meta>('meta', META_KEY)) return
    const meta: Meta = { nonce: mintId(), indexSeq: 0, treeRevision: mintId(), entrySeq: 0 }
    const brought = [...(seed?.scopes ?? [])].sort((one, other) => depth(one.address) - depth(other.address))
    const scopes: KeptScope[] = []
    if (brought[0]?.address !== ROOT_SCOPE) scopes.push(makeScope(tx, ROOT_SCOPE, emptyContent('')))
    for (const one of brought) {
      makeAncestors(tx, scopes, one.address)
      const kept = makeScope(tx, one.address, one.content, one.at)
      for (const { contentAddress, bytes } of one.bytes) tx.put('bytes', bytesKey(kept.id, contentAddress), bytes)
      scopes.push(kept)
      await closeEntry(tx, meta, kept, this.by, seed!.subject)
    }
    tx.put('meta', META_KEY, meta)
  }
}

function depth(address: ScopeAddress): number {
  return address === ROOT_SCOPE ? 0 : address.split('/').length
}

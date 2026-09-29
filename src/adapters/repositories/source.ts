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
 * **Work kept somewhere else is brought in at every start** where the source
 * has a way to bring it (`SourceOptions.bring`, `bring.ts`): what a new store
 * starts with, and later, whatever changed there since. It is prepared before
 * the store is written — preparing it reads and waits on digests, which a
 * transaction would not survive — and written in one transaction with the
 * note it leaves for the next start. A page that finds another page brought
 * the same work first, while it was preparing, brings nothing.
 *
 * Every transaction spans every shelf. The repositories cross them freely —
 * a step writes a scope, its library, the index's log and its step ids — and
 * a transaction that forgot one would fail only where that path is taken.
 */
import { ROOT_SCOPE } from '../../projects/scopePath'
import { emptyContent } from '../../projects/scopeState'
import type { ScopeAddress } from '../../projects/scopeState'
import { landBrought } from './bring'
import type { Brought, Placed } from './bring'
import { SHELVES } from './KeyedStore'
import type { KeyedStore, Transaction } from './KeyedStore'
import { allScopes, indexChanged, META_KEY, makeScope, mintId } from './kept'
import type { Meta } from './kept'

/**
 * What the last bringing noted, the addresses it could not write, and how
 * many bringings there have been: a page that finds the count moved brings
 * nothing.
 */
type BroughtNote = {
  count: number
  note: unknown
  refused: ScopeAddress[]
  /** Where each address was last brought to, and at what revision it was left (`bring.ts`). */
  placed: Placed
  /** Addresses changed in both places since: nothing written, until a person answers. */
  diverged: ScopeAddress[]
}

/** What the bringings left: the last note, the addresses it could not write, and those waiting for a person. */
export type LastBrought = { note: unknown; refused: readonly ScopeAddress[]; diverged: readonly ScopeAddress[] }

const BROUGHT_KEY = 'brought'

/** A way to bring work kept somewhere else into this source. */
export type Bringing = {
  /**
   * What to bring at this start, given the note the last bringing left
   * (`undefined` before the first) and whether the store is new. Asked
   * outside any transaction. `undefined` brings nothing and leaves the note.
   */
  prepare(note: unknown, fresh: boolean): Promise<Brought | undefined>
  /** Told once a start has brought what it prepared, or found nothing to. */
  started?(): void
}

export type SourceOptions = {
  /** Which repositories these are, in plain words: each repository's `id`. */
  id: string
  /** Who made a history entry, in this source's word (`HistoryEntry.by`). */
  by: string
  bring?: Bringing
}

/** A bringing's answer: the addresses it could not write, and those still waiting for a person. */
export type BroughtAnswer = { refused: ScopeAddress[]; diverged: ScopeAddress[] }

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

  /** What the last bringing left, or `undefined` before the first. */
  lastBrought(): Promise<LastBrought | undefined> {
    return this.read(async (tx) => {
      const held = await tx.get<BroughtNote>('meta', BROUGHT_KEY)
      return held && { note: held.note, refused: held.refused, diverged: held.diverged ?? [] }
    })
  }

  /**
   * Bring work in now, prepared from the note as it stands — for a person who
   * has answered what a start could not decide for them.
   */
  async bring(prepare: (last: LastBrought | undefined) => Promise<Brought | undefined>): Promise<BroughtAnswer> {
    const last = await this.lastBrought()
    const brought = await prepare(last)
    if (!brought) return { refused: [], diverged: [...(last?.diverged ?? [])] }
    return this.store.transaction(SHELVES, 'write', (tx) => this.land(tx, brought))
  }

  /** Made once per instance; a failure is tried again on the next call rather than kept. */
  private ready(): Promise<void> {
    this.made ??= this.start().catch((error: unknown) => {
      this.made = undefined
      throw error
    })
    return this.made
  }

  private async start(): Promise<void> {
    const seen = await this.store.transaction(SHELVES, 'read', async (tx) => ({
      meta: await tx.get<Meta>('meta', META_KEY), brought: await tx.get<BroughtNote>('meta', BROUGHT_KEY),
    }))
    const brought = await this.options.bring?.prepare(seen.brought?.note, !seen.meta)
    await this.store.transaction(SHELVES, 'write', async (tx) => {
      const fresh = !await tx.get<Meta>('meta', META_KEY)
      if (fresh) this.plant(tx)
      const now = await tx.get<BroughtNote>('meta', BROUGHT_KEY)
      const moved = fresh !== !seen.meta || now?.count !== seen.brought?.count
      if (brought && !moved) await this.land(tx, brought)
    })
    this.options.bring?.started?.()
  }

  /** The organisation and the source's marks. */
  private plant(tx: Transaction): void {
    makeScope(tx, ROOT_SCOPE, emptyContent(''))
    tx.put('meta', META_KEY, { nonce: mintId(), indexSeq: 0, treeRevision: mintId(), entrySeq: 0 } satisfies Meta)
  }

  private async land(tx: Transaction, brought: Brought): Promise<BroughtAnswer> {
    const meta = (await tx.get<Meta>('meta', META_KEY))!
    const last = await tx.get<BroughtNote>('meta', BROUGHT_KEY)
    const placed: Placed = { ...last?.placed }
    const landed = await landBrought(tx, meta, await allScopes(tx), brought, this.by, placed)
    if (landed.treeMoved) meta.treeRevision = mintId()
    if (landed.changed.length > 0) indexChanged(tx, meta, landed.changed)
    tx.put('meta', META_KEY, meta)
    const answered = new Set([...landed.landed, ...(brought.settle ?? [])])
    const diverged = [...new Set([...(last?.diverged ?? []).filter((address) => !answered.has(address)), ...landed.diverged])].sort()
    tx.put('meta', BROUGHT_KEY, {
      count: (last?.count ?? 0) + 1, note: brought.note, refused: landed.refused, placed, diverged,
    } satisfies BroughtNote)
    return { refused: landed.refused, diverged }
  }
}

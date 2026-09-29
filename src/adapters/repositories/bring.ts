// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Work kept somewhere else before a source existed, brought into it: whole
 * scopes, each arriving as a history entry of its own.
 *
 * A scope brought over is not a step — whatever kept it kept no steps — so it
 * lands as a content written whole, with the records it changed read off the
 * content before and after (`recordsBetween`), exactly as a step's are. It is
 * never written over what a person did here without a way back: where the
 * scope has an open entry, that entry is closed first, with the safeguard's
 * subject, and the arrival is an entry of its own after it.
 */
import type { ContentAddress } from '../../model/imageName'
import { SCOPE_RECORD, sameRecord, sameValue } from '../../model/recordKey'
import { isSafeScopePath, ROOT_SCOPE } from '../../projects/scopePath'
import { emptyContent, recordsBetween } from '../../projects/scopeState'
import type { ScopeAddress, ScopeContent, ScopeId } from '../../projects/scopeState'
import type { Transaction } from './KeyedStore'
import {
  bytesKey, closeEntry, makeAncestors, makeScope, mintId, readContent, says, scopeAt, writeContent,
} from './kept'
import type { KeptScope, Meta } from './kept'

/** One scope brought in: where, what, when it was last changed where it was kept, and its pictures' bytes. */
export type BroughtScope = {
  address: ScopeAddress
  content: ScopeContent
  bytes: readonly { contentAddress: ContentAddress; bytes: Uint8Array }[]
  /** ISO time it was last changed where it was kept; the arrival keeps it. */
  updatedAt?: string
}

/** What a bringing brings, what its entries say, and what it notes for the next one. */
export type Brought = {
  /** Every address a safe one, none twice. */
  scopes: readonly BroughtScope[]
  /** What the entry each scope arrives as says it was. */
  subject: string
  /** What the entry closed before a scope is written over says it was. */
  safeguard: string
  /** Kept with the source for the next bringing to read, as the bringing wrote it. */
  note: unknown
}

/** What was brought: the scopes that changed, and the addresses that could not be written, with why. */
export type Landed = { changed: ScopeId[]; treeMoved: boolean; refused: ScopeAddress[] }

function timeOf(updatedAt: string | undefined): number {
  const at = updatedAt === undefined ? Number.NaN : Date.parse(updatedAt)
  return Number.isFinite(at) ? at : Date.now()
}

function depth(address: ScopeAddress): number {
  return address === ROOT_SCOPE ? 0 : address.split('/').length
}

/** The scopes brought, parents before children, so a parent is never made up for a child that has one coming. */
export function inTreeOrder(scopes: readonly BroughtScope[]): BroughtScope[] {
  return [...scopes].filter((one) => isSafeScopePath(one.address)).sort((one, other) => depth(one.address) - depth(other.address))
}

/**
 * Land brought scopes in a transaction: each over the scope at its address,
 * or as a new scope where there is none. `scopes` is every scope the source
 * holds, and gains the ones made. The caller writes `meta` back, and the
 * index's line for what changed.
 */
export async function landBrought(
  tx: Transaction, meta: Meta, scopes: KeptScope[], brought: Brought, by: string,
): Promise<Landed> {
  const landed: Landed = { changed: [], treeMoved: false, refused: [] }
  for (const one of inTreeOrder(brought.scopes)) {
    const held = scopeAt(scopes, one.address)
    const kept = held ? await over(tx, meta, held, one, brought, by, landed) : made(tx, scopes, one, landed)
    if (!kept) continue
    for (const { contentAddress, bytes } of one.bytes) tx.put('bytes', bytesKey(kept.id, contentAddress), bytes)
    await closeEntry(tx, meta, kept, by, brought.subject)
  }
  return landed
}

function made(tx: Transaction, scopes: KeptScope[], one: BroughtScope, landed: Landed): KeptScope {
  const above = makeAncestors(tx, scopes, one.address)
  const kept = makeScope(tx, one.address, one.content, timeOf(one.updatedAt))
  // Every record it arrives with, so a thing's history finds the arrival.
  const records = recordsBetween(emptyContent(''), one.content).filter((record) => record.kind !== 'scope')
  kept.pending = { records: [SCOPE_RECORD, ...records], at: timeOf(one.updatedAt) }
  if (one.updatedAt !== undefined) kept.updatedAt = one.updatedAt
  tx.put('scopes', kept.id, kept)
  scopes.push(kept)
  landed.changed.push(...above.map(({ id }) => id), kept.id)
  landed.treeMoved = true
  return kept
}

/**
 * A brought scope over the scope at its address: its open entry closed first,
 * then its content written whole. `undefined` where there is nothing to write
 * — the scope holds that content already — or it may not be written: a scope
 * read in part is not written over, as no step is applied to one.
 */
async function over(
  tx: Transaction, meta: Meta, held: KeptScope, one: BroughtScope, brought: Brought, by: string, landed: Landed,
): Promise<KeptScope | undefined> {
  const { content: before, unreadable } = await readContent(tx, held)
  if (unreadable) {
    landed.refused.push(one.address)
    return undefined
  }
  const records = recordsBetween(before, one.content)
  if (records.length === 0) return undefined
  // A scope with nothing in it yet — the organisation of a store just made —
  // has nothing to keep a way back to.
  const empty = recordsBetween(emptyContent(before.model.name), before).length === 0
  if (held.pending && !empty) await closeEntry(tx, meta, held, by, brought.safeguard)
  const open = held.pending && empty ? held.pending.records : []
  const said = says(one.content)
  landed.treeMoved ||= !sameValue(held.says, said)
  writeContent(tx, held.id, before.images, one.content)
  const kept: KeptScope = {
    id: held.id, address: held.address, revision: mintId(), says: said,
    updatedAt: one.updatedAt ?? new Date().toISOString(),
    pending: { records: [...open, ...records.filter((record) => !open.some((known) => sameRecord(known, record)))], at: timeOf(one.updatedAt) },
  }
  tx.put('scopes', kept.id, kept)
  landed.changed.push(kept.id)
  return kept
}

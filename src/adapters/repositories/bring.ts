// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Work kept somewhere else before a source existed, brought into it: whole
 * scopes, each arriving as a history entry of its own.
 *
 * A scope brought over is not a step — whatever kept it kept no steps — so it
 * lands as a content written whole, with the records it changed read off the
 * content before and after (`recordsBetween`), exactly as a step's are.
 *
 * **It never lands over work done here.** Where a scope was brought before,
 * the source keeps which scope it landed as and the revision it was left at
 * (`Placed`). A scope brought again lands only where that scope is still at
 * that address and still at that revision — nothing was done to it here since.
 * A copy whose content is what the last bringing brought to that address —
 * saved again where it was kept, and nothing more — brings nothing new, and
 * is passed over. Anywhere else — a step applied here, the scope moved or
 * removed, another scope at the address — it has changed in both places, and
 * nothing is written: the address is listed (`Landed.diverged`) for a person to answer,
 * one address at a time, by bringing it over anyway (`Brought.force`) or
 * leaving what is here (`Brought.settle`). A scope brought over anyway is
 * never written without a way back: its open entry is closed first, with the
 * safeguard's subject, and the arrival is an entry of its own after it.
 */
import type { ContentAddress } from '../../model/imageName'
import { SCOPE_RECORD, sameRecord, sameValue, stableText } from '../../model/recordKey'
import { fingerprint } from '../../projects/revision'
import { isSafeScopePath, ROOT_SCOPE } from '../../projects/scopePath'
import { emptyContent, recordsBetween } from '../../projects/scopeState'
import type { Revision, ScopeAddress, ScopeContent, ScopeId } from '../../projects/scopeState'
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
  /** A person's answer: land over whatever is at each address, work done here or not. */
  force?: boolean
  /**
   * A person's answer: leave what is at each of these addresses, and bring
   * over it only what changes from now. A scope in `scopes` at one of them is
   * not written: it says what the copy held when it was left.
   */
  settle?: readonly ScopeAddress[]
}

/**
 * Per address, what the last bringing left there: the scope and the revision
 * it left it at — absent where it left nothing here — and a fingerprint of the
 * content brought, so the same content saved again is no change.
 */
export type Placed = Record<ScopeAddress, { scope?: ScopeId; revision?: Revision; content?: string }>

/** A fingerprint of a content, the same for the same content however its text was saved. */
export function contentPrint(content: ScopeContent): string {
  return fingerprint([stableText(content)])
}

/**
 * What a landing came to: the scopes it changed; the addresses it wrote or
 * found already holding what was brought; those changed in both places, and
 * those whose scope here could not be read whole — neither written.
 */
export type Landed = {
  changed: ScopeId[]
  treeMoved: boolean
  landed: ScopeAddress[]
  diverged: ScopeAddress[]
  refused: ScopeAddress[]
}

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

/** A scope with nothing in it yet — the organisation of a store just made — which holds no work to keep. */
async function isEmpty(tx: Transaction, held: KeptScope): Promise<boolean> {
  const { content, unreadable } = await readContent(tx, held)
  return !unreadable && recordsBetween(emptyContent(content.model.name), content).length === 0
}

/**
 * Whether a scope may be brought to its address without a person's answer:
 * nothing was done here since the last bringing left it — or, where none did,
 * there is nothing here but an empty scope.
 */
async function untouched(tx: Transaction, held: KeptScope | undefined, placed: Placed[ScopeAddress] | undefined): Promise<boolean> {
  if (placed?.scope !== undefined) return held?.id === placed.scope && held.revision === placed.revision
  return !held || isEmpty(tx, held)
}

/**
 * Land brought scopes in a transaction: each over the scope at its address,
 * or as a new scope where there is none — where nothing was done here since,
 * or a person said to. `scopes` is every scope the source holds, and gains the
 * ones made; `placed` is what the last bringings left, and is kept up to date.
 * The caller writes `meta` back, and the index's line for what changed.
 */
export async function landBrought(
  tx: Transaction, meta: Meta, scopes: KeptScope[], brought: Brought, by: string, placed: Placed,
): Promise<Landed> {
  const landed: Landed = { changed: [], treeMoved: false, landed: [], diverged: [], refused: [] }
  const settled = new Set(brought.settle ?? [])
  for (const one of inTreeOrder(brought.scopes)) {
    if (settled.has(one.address)) continue
    const print = contentPrint(one.content)
    if (!brought.force && placed[one.address]?.content === print) continue
    const held = scopeAt(scopes, one.address)
    if (!brought.force && !await untouched(tx, held, placed[one.address])) {
      landed.diverged.push(one.address)
      continue
    }
    const kept = held ? await over(tx, meta, held, one, brought, by, landed) : made(tx, scopes, one, landed)
    if (kept === 'refused') continue
    landed.landed.push(one.address)
    const now = kept ?? held!
    placed[one.address] = { scope: now.id, revision: now.revision, content: print }
    if (!kept) continue
    for (const { contentAddress, bytes } of one.bytes) tx.put('bytes', bytesKey(kept.id, contentAddress), bytes)
    await closeEntry(tx, meta, kept, by, brought.subject)
  }
  for (const address of settled) {
    const held = scopeAt(scopes, address)
    const left = brought.scopes.find((one) => one.address === address)
    placed[address] = {
      ...(held ? { scope: held.id, revision: held.revision } : {}),
      ...(left ? { content: contentPrint(left.content) } : {}),
    }
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
 * — the scope holds that content already — and `refused` where it may not be
 * written: a scope read in part is not written over, as no step is applied to
 * one.
 */
async function over(
  tx: Transaction, meta: Meta, held: KeptScope, one: BroughtScope, brought: Brought, by: string, landed: Landed,
): Promise<KeptScope | undefined | 'refused'> {
  const { content: before, unreadable } = await readContent(tx, held)
  if (unreadable) {
    landed.refused.push(one.address)
    return 'refused'
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

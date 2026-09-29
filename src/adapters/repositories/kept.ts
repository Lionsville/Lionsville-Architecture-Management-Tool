// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the repositories keep on a keyed store, and the reads and writes the
 * five of them share.
 *
 * A scope is kept in three parts, so a question about one part reads that
 * part and no other: what the tree says of it (`scopes`), its model and what
 * it says about itself (`contents`), and its image library, one entry per
 * picture (`library`). The tree reads the first alone, a lookup of a picture
 * by name reads one entry, and only a scope's state reads all three.
 */
import type { ImageEntry } from '../../model/imageName'
import { SCOPE_RECORD, sameValue } from '../../model/recordKey'
import type { RecordKey } from '../../model/recordKey'
import type { ScopeKind } from '../../projects/scope'
import type { RecordLink } from '../../projects/links'
import { ancestorScopes, scopePathLabel } from '../../projects/scopePath'
import { emptyContent } from '../../projects/scopeState'
import type {
  Revision, ScopeAddress, ScopeContent, ScopeDescription, ScopeId, ScopeState,
} from '../../projects/scopeState'
import { entryKey, keepEntryState, sequenceKey } from './entryStates'
import { historyNamed, libraryNamed } from './imageNames'
import { keyOf, prefix } from './KeyedStore'
import type { Transaction } from './KeyedStore'

export { entryKey, sequenceKey }

/** What the tree says of a scope, kept so the tree is read without reading a model. */
export type NodeSays = {
  name: string
  kind?: ScopeKind
  client?: string
  description?: string
  links?: RecordLink[]
  diagrams: number
}

/** One scope's identity, address and revision, and what the tree says of it. */
export type KeptScope = {
  id: ScopeId
  address: ScopeAddress
  revision: Revision
  says: NodeSays
  updatedAt?: string
  /** The open entry: the records changed since the last entry closed, and when the last step was made. */
  pending?: { records: RecordKey[]; at: number }
}

/**
 * The version of what `contents` holds. A value written by a later build, or
 * one that does not have the shape this build writes, is a scope read in part:
 * shown, and not stepped on (`ScopeState.unreadable`).
 */
export const CONTENT_FORMAT = 1

export type KeptContent = { format: number; model: ScopeContent['model']; description: ScopeDescription }

/** The source's own marks, under one key of `meta`. */
export type Meta = {
  /** Minted when the source was made: a revision of the index is only ever this source's. */
  nonce: string
  /** How many times the index has changed. */
  indexSeq: number
  treeRevision: Revision
  /** How many history entries have been made; each entry's number. */
  entrySeq: number
  /**
   * Whether every picture's bytes have been counted since the store was made
   * (`imageNames.ts`): only then are bytes nothing names taken out.
   */
  namesCounted?: true
}

export const META_KEY = 'source'

/** A new identity or revision: 128 random bits, nobody else's. */
export function mintId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function readMeta(tx: Transaction): Promise<Meta> {
  const meta = await tx.get<Meta>('meta', META_KEY)
  if (!meta) throw new Error('the source was read before it was made')
  return meta
}

export function says(content: ScopeContent): NodeSays {
  const { model, kind, client, links } = content
  return {
    name: model.name, diagrams: model.diagrams.length,
    ...(kind !== undefined ? { kind } : {}),
    ...(client !== undefined ? { client } : {}),
    ...(model.description !== undefined ? { description: model.description } : {}),
    ...(links !== undefined ? { links } : {}),
  }
}

export async function allScopes(tx: Transaction): Promise<KeptScope[]> {
  return (await tx.range<KeptScope>('scopes', {})).map(({ value }) => value)
}

export function scopeAt(scopes: readonly KeptScope[], address: ScopeAddress): KeptScope | undefined {
  return scopes.find((kept) => kept.address === address)
}

/** The scope a scope is filed under: the nearest address above it that holds one. */
export function parentOf(scopes: readonly KeptScope[], address: ScopeAddress): KeptScope | undefined {
  for (const above of ancestorScopes(address)) {
    const found = scopeAt(scopes, above)
    if (found) return found
  }
  return undefined
}

function libraryRange(scope: ScopeId) {
  return prefix(keyOf(scope, ''))
}

export function libraryKey(scope: ScopeId, name: string): string {
  return keyOf(scope, name)
}

export function bytesKey(scope: ScopeId, contentAddress: string): string {
  return keyOf(scope, contentAddress)
}

function isShaped(content: Partial<KeptContent> | undefined): content is KeptContent {
  return !!content && content.format === CONTENT_FORMAT && !!content.model
    && Array.isArray(content.model.elements) && Array.isArray(content.model.diagrams)
    && typeof content.description === 'object' && content.description !== null
}

/**
 * A scope's content without its library, or what could be read of it and why
 * the rest could not: what the index reads, and whether a step may land.
 */
export async function readModel(
  tx: Transaction, kept: KeptScope,
): Promise<{ content: Omit<ScopeContent, 'images'>; unreadable?: string[] }> {
  const held = await tx.get<Partial<KeptContent>>('contents', kept.id)
  if (isShaped(held)) return { content: { ...held.description, model: held.model } }
  const why = held && typeof held.format === 'number' && held.format > CONTENT_FORMAT
    ? `written by a later version (format ${held.format})`
    : 'its model could not be read'
  const model = held?.model && Array.isArray(held.model.diagrams) ? held.model : emptyContent(kept.says.name).model
  return { content: { model }, unreadable: [why] }
}

/** A scope's content, its library included. */
export async function readContent(
  tx: Transaction, kept: KeptScope,
): Promise<{ content: ScopeContent; unreadable?: string[] }> {
  const { content, unreadable } = await readModel(tx, kept)
  const images = (await tx.range<ImageEntry>('library', libraryRange(kept.id))).map(({ value }) => value)
  return { content: { ...content, images }, ...(unreadable ? { unreadable } : {}) }
}

export async function readState(tx: Transaction, kept: KeptScope): Promise<ScopeState> {
  const { content, unreadable } = await readContent(tx, kept)
  return {
    ...content, id: kept.id, address: kept.address, revision: kept.revision,
    ...(kept.updatedAt ? { updatedAt: kept.updatedAt } : {}),
    ...(unreadable ? { unreadable } : {}),
  }
}

/**
 * Write a scope's content, the library as the difference from what it held:
 * a picture taken out is deleted, one added or changed is written, and the
 * rest are not touched. The names each picture's bytes have are counted again
 * in the same transaction (`imageNames.ts`).
 */
export async function writeContent(tx: Transaction, id: ScopeId, before: readonly ImageEntry[], after: ScopeContent): Promise<void> {
  const { model, images, ...description } = after
  tx.put('contents', id, { format: CONTENT_FORMAT, model, description } satisfies KeptContent)
  const was = new Map(before.map((image) => [image.name, image]))
  const is = new Set(images.map((image) => image.name))
  for (const name of was.keys()) if (!is.has(name)) tx.delete('library', libraryKey(id, name))
  for (const image of images) {
    if (!sameValue(was.get(image.name), image)) tx.put('library', libraryKey(id, image.name), image)
  }
  await libraryNamed(tx, id, before, images)
}

/** Everything kept about one scope, gone: its parts, its pictures, its settings and its history. */
export function forget(tx: Transaction, id: ScopeId): void {
  tx.delete('scopes', id)
  tx.delete('contents', id)
  tx.deleteRange('library', libraryRange(id))
  tx.deleteRange('bytes', libraryRange(id))
  tx.deleteRange('bytesNamed', libraryRange(id))
  tx.deleteRange('bytesUnnamed', libraryRange(id))
  tx.deleteRange('entries', libraryRange(id))
  tx.deleteRange('entryStates', libraryRange(id))
  tx.delete('settings', keyOf('scope', id))
}

/**
 * How many changes of the index are kept to answer *what changed since*. A
 * reader further back than this reads the whole index again, which is what
 * the seam tells it to do with an answer of nothing.
 */
export const INDEX_LOG_KEPT = 1000

export type IndexLogged = { changed: ScopeId[]; removed: ScopeId[] }

/** One change of the index: its next revision, and which scopes it names. */
export function indexChanged(tx: Transaction, meta: Meta, changed: readonly ScopeId[], removed: readonly ScopeId[] = []): void {
  meta.indexSeq += 1
  tx.put('indexLog', sequenceKey(meta.indexSeq), { changed: [...changed], removed: [...removed] } satisfies IndexLogged)
  if (meta.indexSeq > INDEX_LOG_KEPT) tx.deleteRange('indexLog', { below: sequenceKey(meta.indexSeq - INDEX_LOG_KEPT + 1) })
}

export function indexRevision(meta: Meta): Revision {
  return `${meta.nonce}.${meta.indexSeq}`
}

/**
 * Make a scope, at an address, with an empty model: its open entry says the
 * scope was made, so the first record after it is an entry.
 */
export async function makeScope(tx: Transaction, address: ScopeAddress, content: ScopeContent, at = Date.now()): Promise<KeptScope> {
  const kept: KeptScope = {
    id: mintId(), address, revision: mintId(), says: says(content),
    pending: { records: [SCOPE_RECORD], at },
  }
  tx.put('scopes', kept.id, kept)
  await writeContent(tx, kept.id, [], content)
  return kept
}

/** The scopes above an address that are not there, made root side first, each named after its own last segment. */
export async function makeAncestors(tx: Transaction, scopes: KeptScope[], address: ScopeAddress): Promise<KeptScope[]> {
  const made: KeptScope[] = []
  for (const above of ancestorScopes(address).reverse()) {
    if (scopeAt(scopes, above)) continue
    const kept = await makeScope(tx, above, emptyContent(scopePathLabel(above)))
    scopes.push(kept)
    made.push(kept)
  }
  return made
}

/** An entry as it is kept for a list; the state at it is kept apart, under the same key. */
export type KeptEntry = {
  seq: number
  scope: ScopeId
  at: number
  by: string
  subject?: string
  labels: string[]
  records: readonly RecordKey[]
}

/**
 * Close a scope's open entry: the entry, numbered next in the source, and the
 * scope's state as it stands (`entryStates.ts`) — whose pictures' bytes then
 * stay as long as the history does. The scope must have one open; the caller
 * writes `meta` back.
 */
export async function closeEntry(
  tx: Transaction, meta: Meta, kept: KeptScope, by: string, subject?: string,
): Promise<KeptEntry> {
  const { pending, ...closed } = kept
  if (!pending) throw new Error('an entry was closed on a scope with none open')
  meta.entrySeq += 1
  const entry: KeptEntry = {
    seq: meta.entrySeq, scope: kept.id, at: pending.at, by,
    ...(subject !== undefined ? { subject } : {}), labels: [], records: pending.records,
  }
  tx.put('entries', entryKey(kept.id, entry.seq), entry)
  const state = await readState(tx, kept)
  const { imagesMoved } = await keepEntryState(tx, kept.id, entry.seq, state)
  if (imagesMoved) await historyNamed(tx, kept.id, state.images)
  tx.put('scopes', kept.id, closed satisfies KeptScope)
  return entry
}

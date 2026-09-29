// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The state at each history entry, kept as checkpoints and the changes
 * between them, so a history is bounded by what changed rather than by how
 * long it is.
 *
 * **Why not the whole state per entry.** A scope's state holds its marks as
 * data URLs, every view's geometry and every record, and an entry is usually
 * one small edit. Kept whole, ten thousand entries of a modest scope are
 * gigabytes, nearly all of it the same bytes again.
 *
 * **Why changes and not a pointer per unchanged part.** A pointer per part
 * keeps a part again whenever anything in it changed, and a small edit is
 * nearly always a change to the elements or to one view — so every entry
 * would still hold the whole list of elements. Changes hold the records that
 * changed and nothing else, so an entry costs what its edit touched.
 *
 * **The form.** A scope's state is read as parts: each of its own fields, and
 * each field of its model (`partsOf`). A **checkpoint** holds every part —
 * inline, or as a pointer to the earlier checkpoint holding the same value,
 * so marks nobody touched are kept once however many checkpoints there are.
 * Every other entry holds its **changes** from the entry before it: a part
 * set or gone, or, for a list of records with ids, the records set, those
 * gone and — only where it is not what the rest implies — the order. After
 * {@link CHECKPOINT_EVERY} entries in a row a checkpoint is kept again, so the
 * state at any entry is one checkpoint, its pointers, and one range of changes.
 *
 * **Exact by construction, and checked.** Before changes are kept they are
 * applied to the state they start from, and the result is compared with the
 * state they are meant to reach; where the two differ — a list with an id
 * twice, say — a checkpoint is kept instead. So the state at an entry is the
 * state that was read when it closed, whatever shape it had.
 *
 * A state kept whole, by a build before this form, is read as it was, and is
 * a checkpoint to the entries after it.
 */
import { sameValue } from '../../model/recordKey'
import type { ScopeId, ScopeState } from '../../projects/scopeState'
import { keyOf, SEPARATOR } from './KeyedStore'
import type { Transaction } from './KeyedStore'

/** How many entries in a row are kept as changes before one is kept as a checkpoint again. */
export const CHECKPOINT_EVERY = 32

/** A part kept at a checkpoint: its value, or the earlier checkpoint that holds the same value. */
type HeldPart = { value: unknown } | { at: number }

/**
 * A state kept whole. `unread` is what the scope's content was kept as where
 * it could not be read — a later layout's, a damaged one — held as it was, so
 * a put back over it loses nothing (`ScopeState.unreadable`).
 */
type Checkpoint = { form: 'checkpoint'; parts: Record<string, HeldPart>; unread?: unknown }

/** A list of records whose ids are unique: what was set, what went, and the order where it is not implied. */
type ListChange = { by: string; set: unknown[]; gone: string[]; order?: string[] }

type Change = { value: unknown } | { gone: true } | { list: ListChange }

type Changes = { form: 'changes'; base: number; depth: number; changes: Record<string, Change> }

/** How the state at an entry is kept; a build before this form kept the `ScopeState` itself. */
export type KeptEntryState = Checkpoint | Changes

type Parts = Map<string, unknown>

/** A state as it stands at an entry: its parts, which checkpoint holds each part not changed since, and where its chain is. */
type Read = { parts: Parts; holders: Map<string, number>; base: number; depth: number }

/** The fields a list's records are told apart by, in the order they are tried: records, pictures, marks. */
const LIST_KEYS = ['id', 'name', 'key'] as const

const OWN = 's:'
const MODEL = 'm:'

function isKeptForm(value: unknown): value is KeptEntryState {
  const form = (value as { form?: unknown } | undefined)?.form
  return form === 'checkpoint' || form === 'changes'
}

/** A state as parts: each of its own fields but the model, and each field of the model. */
export function partsOf(state: ScopeState): Parts {
  const parts: Parts = new Map()
  const { model, ...own } = state
  for (const [key, value] of Object.entries(own)) parts.set(`${OWN}${key}`, value)
  for (const [key, value] of Object.entries(model)) parts.set(`${MODEL}${key}`, value)
  return parts
}

/** The state the parts are. */
export function stateOf(parts: Parts): ScopeState {
  const own: Record<string, unknown> = {}
  const model: Record<string, unknown> = {}
  for (const [key, value] of parts) {
    if (key.startsWith(MODEL)) model[key.slice(MODEL.length)] = value
    else own[key.slice(OWN.length)] = value
  }
  return { ...own, model } as unknown as ScopeState
}

/** The field a list's records are told apart by, where every record has a different one. */
function listKey(list: readonly unknown[]): string | undefined {
  return LIST_KEYS.find((field) => {
    const seen = new Set<string>()
    for (const item of list) {
      const id = (item as Record<string, unknown> | null)?.[field]
      if (typeof id !== 'string' || seen.has(id)) return false
      seen.add(id)
    }
    return true
  })
}

const idOf = (by: string) => (item: unknown): string => (item as Record<string, string>)[by]

/** A list's change, or `undefined` where its records cannot be told apart the same way on both sides. */
function listChange(before: readonly unknown[], after: readonly unknown[]): ListChange | undefined {
  const by = listKey(after)
  if (by === undefined || listKey(before) !== by) return undefined
  const id = idOf(by)
  const was = new Map(before.map((item) => [id(item), item]))
  const is = new Set(after.map(id))
  const set = after.filter((item) => !was.has(id(item)) || !sameValue(was.get(id(item)), item))
  const gone = [...was.keys()].filter((key) => !is.has(key))
  const order = after.map(id)
  const implied = impliedOrder(before.map(id), gone, set.map(id))
  return { by, set, gone, ...(sameValue(implied, order) ? {} : { order }) }
}

/** The order a change implies: the records kept where they were, then the new ones in the order they were set. */
function impliedOrder(before: readonly string[], gone: readonly string[], set: readonly string[]): string[] {
  const going = new Set(gone)
  const had = new Set(before)
  return [...before.filter((key) => !going.has(key)), ...set.filter((key) => !had.has(key))]
}

function applyList(before: readonly unknown[], { by, set, gone, order }: ListChange): unknown[] {
  const id = idOf(by)
  const held = new Map(before.map((item) => [id(item), item]))
  for (const key of gone) held.delete(key)
  for (const item of set) held.set(id(item), item)
  return (order ?? impliedOrder(before.map(id), gone, set.map(id))).map((key) => held.get(key))
}

function isEmpty({ set, gone, order }: ListChange): boolean {
  return set.length === 0 && gone.length === 0 && order === undefined
}

/**
 * What one part changed by, or `undefined` where it did not. A list of
 * records is compared record by record and never also whole: it is the
 * largest part there is, and every record of it is written down once.
 */
function partChange(was: unknown, value: unknown): Change | undefined {
  const list = Array.isArray(was) && Array.isArray(value) ? listChange(was, value) : undefined
  if (list) return isEmpty(list) ? undefined : { list }
  return sameValue(was, value) ? undefined : { value }
}

/** What changed from one state's parts to another's; empty where nothing did. */
function changesBetween(before: Parts, after: Parts): Record<string, Change> {
  const changes: Record<string, Change> = {}
  for (const [key, value] of after) {
    const change = before.has(key) ? partChange(before.get(key), value) : { value }
    if (change) changes[key] = change
  }
  for (const key of before.keys()) if (!after.has(key)) changes[key] = { gone: true }
  return changes
}

function applyChanges(read: Read, changes: Record<string, Change>): void {
  for (const [key, change] of Object.entries(changes)) {
    read.holders.delete(key)
    if ('gone' in change) read.parts.delete(key)
    else if ('value' in change) read.parts.set(key, change.value)
    else read.parts.set(key, applyList(read.parts.get(key) as unknown[], change.list))
  }
}

/** A number as a key part that sorts as the number does. */
export function sequenceKey(seq: number): string {
  return String(seq).padStart(15, '0')
}

/** An entry's key, for its list line and its state alike: the scope's identity, then the entry's number. */
export function entryKey(scope: ScopeId, seq: number): string {
  return keyOf(scope, sequenceKey(seq))
}

function seqOfKey(key: string): number {
  return Number(key.slice(key.lastIndexOf(SEPARATOR) + 1))
}

/** A checkpoint's parts, each pointer read from the checkpoint it points at; a state kept whole is its own parts. */
async function checkpointAt(tx: Transaction, scope: ScopeId, seq: number, held: unknown): Promise<Read> {
  if (!isKeptForm(held)) {
    const parts = partsOf(held as ScopeState)
    return { parts, holders: new Map([...parts.keys()].map((key) => [key, seq])), base: seq, depth: 0 }
  }
  if (held.form !== 'checkpoint') throw new Error('a chain of changes starts at an entry that is not a checkpoint')
  const parts: Parts = new Map()
  const holders = new Map<string, number>()
  const pointed = new Map<number, Promise<unknown>>()
  for (const [key, part] of Object.entries(held.parts)) {
    if ('value' in part) {
      parts.set(key, part.value)
      holders.set(key, seq)
      continue
    }
    if (!pointed.has(part.at)) pointed.set(part.at, tx.get('entryStates', entryKey(scope, part.at)))
    parts.set(key, partHeld(await pointed.get(part.at), key))
    holders.set(key, part.at)
  }
  return { parts, holders, base: seq, depth: 0 }
}

/** The value a checkpoint holds inline for a part: a pointer always points at one that does. */
function partHeld(held: unknown, key: string): unknown {
  if (!isKeptForm(held)) return partsOf(held as ScopeState).get(key)
  const part = held.form === 'checkpoint' ? held.parts[key] : undefined
  if (!part || !('value' in part)) throw new Error('a pointer to a checkpoint that does not hold the part')
  return part.value
}

/** The state at an entry, as parts, or `undefined` for an entry the scope does not have. */
async function readAt(tx: Transaction, scope: ScopeId, seq: number): Promise<Read | undefined> {
  const held = await tx.get<unknown>('entryStates', entryKey(scope, seq))
  if (held === undefined) return undefined
  if (!isKeptForm(held) || held.form === 'checkpoint') return checkpointAt(tx, scope, seq, held)
  const base = await tx.get<unknown>('entryStates', entryKey(scope, held.base))
  const read = await checkpointAt(tx, scope, held.base, base)
  const between = await tx.range<Changes>('entryStates', {
    from: entryKey(scope, held.base + 1), below: entryKey(scope, seq + 1),
  })
  for (const { value } of between) applyChanges(read, value.changes)
  return { ...read, depth: held.depth }
}

/** The state at an entry, or `undefined` for an entry the scope does not have. */
export async function stateAtEntry(tx: Transaction, scope: ScopeId, seq: number): Promise<ScopeState | undefined> {
  const read = await readAt(tx, scope, seq)
  return read && stateOf(read.parts)
}

function checkpoint(parts: Parts, from: Read | undefined): Checkpoint {
  const held: Record<string, HeldPart> = {}
  for (const [key, value] of parts) {
    const at = from?.holders.get(key)
    held[key] = at !== undefined && from!.parts.has(key) && sameValue(from!.parts.get(key), value) ? { at } : { value }
  }
  return { form: 'checkpoint', parts: held }
}

/** What an entry's state was kept as, and whether its image library differs from the entry before it. */
export type KeptAt = { kept: KeptEntryState; imagesMoved: boolean }

const IMAGES = `${OWN}images`

/**
 * Keep the state at a new entry of a scope, numbered after every entry it
 * has: as changes from the entry before it, or as a checkpoint where the
 * chain is long enough, where there is no entry before it, or where the state
 * could not be read whole and so is kept as it was read.
 */
export async function keepEntryState(
  tx: Transaction, scope: ScopeId, seq: number, state: ScopeState, unread?: unknown,
): Promise<KeptAt> {
  const parts = partsOf(state)
  const [last] = await tx.range('entryStates', { from: keyOf(scope, ''), below: entryKey(scope, seq), reverse: true, limit: 1 })
  const before = last && await readAt(tx, scope, seqOfKey(last.key))
  const imagesMoved = !before || !sameValue(before.parts.get(IMAGES), parts.get(IMAGES))
  const kept = before && !state.unreadable && before.depth + 1 < CHECKPOINT_EVERY
    ? changesFrom(before, parts)
    : undefined
  const form = unread === undefined ? kept ?? checkpoint(parts, before) : { ...checkpoint(parts, before), unread }
  tx.put('entryStates', entryKey(scope, seq), form)
  return { kept: form, imagesMoved }
}

/**
 * Changes from the state before, or `undefined` where applying them would not
 * give the state exactly. A part the changes do not name was found the same,
 * so only the parts they name are compared again.
 */
function changesFrom(before: Read, parts: Parts): Changes | undefined {
  const changes = changesBetween(before.parts, parts)
  const replayed: Read = { ...before, parts: new Map(before.parts), holders: new Map(before.holders) }
  applyChanges(replayed, changes)
  if (replayed.parts.size !== parts.size) return undefined
  for (const key of Object.keys(changes)) {
    if (replayed.parts.has(key) !== parts.has(key) || !sameValue(replayed.parts.get(key), parts.get(key))) return undefined
  }
  return { form: 'changes', base: before.base, depth: before.depth + 1, changes }
}

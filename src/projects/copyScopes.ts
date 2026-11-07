// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Every scope one place keeps, copied into another that keeps what it has
 * (ADR-0031 §1): the work a person did before they chose where work should
 * live, brought along once they have.
 *
 * **Nothing there is written over.** A scope at an address the destination
 * holds work at is kept as it is, and said by name; the copy is for work that
 * has nowhere else to be, and a destination that holds a scope at the same
 * address holds somebody's work. **A scope holding nothing but a name holds no
 * work**, and this is the line that matters: a folder lists its organisation
 * under the folder's own name before anybody has written anything there, and a
 * stopped copy leaves a scope it made, named and empty. Read as work, the first
 * cost a person everything their organisation held, and the second cost the
 * scope for good on every copy after it. A name somebody chose there stays,
 * and is said; the rest of the scope comes in under it.
 *
 * **Nothing is taken from where it was**, and the type says so: `From` can only
 * read. Until somebody has opened the destination and seen their work in it,
 * the old copy is the only one that has certainly survived.
 *
 * **Done means read back.** One scope at a time, each a content that arrives
 * whole, shallowest first so a scope's parent is its own and not one made to
 * hold it. Then all of them read again, through `check` — repositories that were
 * handed none of it, the way the next opening reads the folder — and held to
 * what is here, record by record and picture by picture, before any is counted.
 * What is counted is what was found. A scope that will not land, will not read,
 * or came back different is named with the reason and the rest go on.
 *
 * **It can stop, and run again.** A stop lands between two scopes, each of them
 * whole. Run again, a scope that arrived is found the same and left alone, one
 * made and not filled is filled, what an earlier copy left out of one it brought
 * — the picture of a drawing — is added, and one somebody worked in since is
 * theirs.
 *
 * **One read of the destination's tree**, and not one per scope. A folder's tree
 * is dated off every file of every scope, so a read per scope is the whole
 * folder read once per scope: the wait a person sat through with nothing to
 * read. Each step is told as it is taken.
 *
 * **The people register comes along too** (ADR-0036), where both places keep
 * one: every entry the destination does not hold, by its id. An entry it
 * holds already is its own, and stays as it is — but a forgetting and a
 * removal go with the work, because forgetting travels and un-forgetting does
 * not: a forgotten entry is brought over whether held or not, and every id
 * removed here, which the destination then never brings back. The pairs
 * answered here as not the same person go with them, joining the
 * destination's own over the entries it then holds. **So do the settings** the
 * destination has nothing for: the organisation's, each scope's, and which
 * entry is *you*. **The history does not**: an entry says what was done to the
 * place it was done in, and a place has no way to take in another's. It stays
 * where it is, whole, and the tally says there is one to stay.
 */
import { drawingPictureAddresses } from '../model/drawing'
import { contentAddressOf } from '../model/imageName'
import { ME_KEY } from '../people/me'
import { reasonOf } from '../platform/errors'
import type { HistoryRepository } from '../ports/HistoryRepository'
import type { ImageRepository } from '../ports/ImageRepository'
import type { PeopleRepository } from '../ports/PeopleRepository'
import type { ScopeNode, ScopeRepository } from '../ports/ScopeRepository'
import type { SettingsOf, SettingsRepository } from '../ports/SettingsRepository'
import { copyCountsOf, addCounts, differencesBetween, EMPTY_COUNTS } from './copyCounts'
import type { CopyCounts } from './copyCounts'
import { isScopeMoved } from './revision'
import {
  blank, carriedOf, contentOf, drawingBytesOf, drawingPicturesOf, landAt, landed, nodesOf, picturesOf, snapshotOf,
} from './scopeAccess'
import type { ArrivalPlace, ScopeReader } from './scopeAccess'
import { scopePathLabel } from './scopePath'
import type { ScopeAddress, ScopeState } from './scopeState'
import type { Settings, SettingsPatch } from './settings'

/** Something that did not come along, and why: for the person, and for the trail. */
export type CopyFailure = {
  /** Which scope; absent for what is kept outside any scope. */
  address?: ScopeAddress
  /** `read` is one that would not read where it was; no second try is offered for that. */
  what: 'read' | 'scope' | 'people' | 'settings'
  /** Why, as whoever refused it said. */
  reason: string
  cause: unknown
}

/** What a copy did. Every scope the source holds is in exactly one of these. */
export type CopyTally = {
  /** Scopes brought, and found the same when read back. */
  scopes: number
  /** Scopes the destination already holds exactly as they are here. */
  already: number
  /** Scopes the destination holds other work at: left as they were, and not brought. */
  kept: number
  /** Scopes that would not land. */
  failed: number
  /** Scopes that would not read here, or read only in part. */
  unread: number
  /** Where a scope was left behind, failed or unread: for the person, who is looking for it. */
  missed: ScopeAddress[]
  /** Where somebody worked in the destination's scope while it was being copied, so theirs was left as it was. */
  meanwhile: ScopeAddress[]
  /** Where the destination holds other work: the scopes `kept`, but for those of `meanwhile`. */
  differs: ScopeAddress[]
  /** Scopes that landed and read back otherwise than they read here, with the lists that differ. */
  unlike: { address: ScopeAddress; lists: readonly string[] }[]
  /** Scopes that took this content under the name the destination had already given them. */
  namesKept: ScopeAddress[]
  /** What is in the destination and was found the same, by kind. */
  counts: CopyCounts
  /** Everything that went wrong, with why. */
  failures: CopyFailure[]
  /** Stopped by the person: `left` scopes were not reached. */
  stopped?: { left: number }
  /** There is a history here, which stays here. */
  historyStays: boolean
}

/** Whether a tally is the whole of the work, there and read back: the only one a person may be told is done. */
export function isWhole(tally: CopyTally): boolean {
  return tally.failures.length === 0 && tally.unread === 0 && tally.kept === 0 && tally.unlike.length === 0 && !tally.stopped
}

type FromImages = Pick<ImageRepository, 'bytes' | 'bytesAt'>
export type CopyFrom = {
  scopes: ScopeReader
  images: FromImages
  people?: Pick<PeopleRepository, 'list'>
  settings?: Pick<SettingsRepository, 'read'>
  history?: Pick<HistoryRepository, 'entries'>
}
export type CopyInto = {
  scopes: ScopeReader & Pick<ScopeRepository, 'create' | 'apply' | 'remove'>
  images: Pick<ImageRepository, 'put' | 'bytes' | 'bytesAt'>
  people?: Pick<PeopleRepository, 'list' | 'bringIn'>
  settings?: Pick<SettingsRepository, 'read' | 'write'>
}

/** Where a copy has got to: bringing or checking, the scopes through so far out of all of them, and the one in hand. */
export type CopyProgress = { phase: 'copying' | 'checking'; done: number; total: number; address: ScopeAddress; name: string }

export type CopyOptions = {
  /** Aborted, the copy stops before the next scope. */
  signal?: AbortSignal
  onProgress?: (progress: CopyProgress) => void
  /** What the destination calls itself, which its organisation reads as until somebody names it. */
  ownName?: string
  /** The destination, read as if opened anew: holding nothing of what was written. Where absent, the destination as it was handed in. */
  check?: Pick<CopyInto, 'scopes' | 'images'>
}

/**
 * Everything in a scope but what it is called, what kind it says it is, and
 * pictures this very copy put there: a write that stopped leaves those before
 * the rows that name them, and they are no work of anybody's.
 */
function holdsNothing(scope: ScopeState, ours: ScopeState | undefined): boolean {
  if (scope.unreadable?.length || scope.later) return false
  const own = new Set([...ours?.images.map((image) => image.contentAddress) ?? [], ...drawingPictureAddresses(ours?.model.diagrams ?? [])])
  const images = scope.images.filter((image) => !own.has(image.contentAddress))
  return blank({ ...scope, images, kind: undefined, model: { ...scope.model, name: '' } })
}

/** Whether a name is one nobody chose: the folder's own, the address's, or the one this copy gave a scope it made. */
function nameNobodyChose(name: string, address: ScopeAddress, ours: string, ownName: string | undefined): boolean {
  const held = name.trim()
  return held === '' || held === ours || held === scopePathLabel(address) || (address === '' && held === ownName)
}

/**
 * The scopes in the destination that hold work other than what is here, as a
 * question has to say them before anything is written, and how many there are
 * to bring.
 */
export async function surveyCopy(from: Pick<CopyFrom, 'scopes'>, into: Pick<CopyInto, 'scopes'>): Promise<{ total: number; differs: ScopeAddress[] }> {
  const [source, there] = await Promise.all([from.scopes.tree(), into.scopes.tree()])
  const held = new Map(nodesOf(there.root).map((node) => [node.address, node]))
  const differs: ScopeAddress[] = []
  let total = 0
  for (const node of nodesOf(source.root)) {
    const state = await from.scopes.state(node.id)
    if (state && blank(state)) continue
    total += 1
    const found = held.get(node.address)
    const scope = found && await into.scopes.state(found.id)
    if (scope && !holdsNothing(scope, state) && state && differencesBetween(state, scope).length > 0) differs.push(node.address)
  }
  return { total, differs }
}

/**
 * Whether a place holds any work at all: a scope somebody put something in.
 * The organisation is always there, and with nothing in it is nothing yet. A
 * place that will not answer holds nothing anybody can act on — what hangs on
 * this is whether to ask a question, and one raised by a failed read is one
 * nobody can answer.
 */
export async function holdsWork(from: { scopes: ScopeReader }): Promise<boolean> {
  try {
    for (const node of nodesOf((await from.scopes.tree()).root)) {
      const state = await from.scopes.state(node.id).catch(() => undefined)
      if (state && !blank(state)) return true
    }
  } catch {
    return false
  }
  return false
}

/** What was checked at an address: nothing there, or the revision read — and nothing to say where the read had none. */
function checkedOf(there: ScopeState | undefined): { checked?: { revision?: string } } {
  if (!there) return { checked: {} }
  return there.revision !== undefined ? { checked: { revision: there.revision } } : {}
}

/** The bytes of every picture a scope's library and drawings name, here and there the same, or which are not. */
async function picturesDiffer(from: FromImages, state: ScopeState, into: Pick<CopyInto['images'], 'bytes' | 'bytesAt'>, there: ScopeState): Promise<string[]> {
  const unlike: string[] = []
  for (const image of state.images) {
    const held = await into.bytes(there.id, image.name)
    if (!held || await contentAddressOf(held.bytes) !== image.contentAddress) unlike.push('images')
  }
  for (const picture of await drawingPicturesOf(from, state.id, state.model)) {
    if (!await into.bytesAt(there.id, picture.address)) unlike.push('drawingPictures')
  }
  return [...new Set(unlike)]
}

/** The scope brought to its place: made where there is none, and filled. */
async function bring(
  from: CopyFrom, into: CopyInto, node: ScopeNode, state: ScopeState, held: ScopeNode | undefined, there: ScopeState | undefined, keepName: boolean,
): Promise<ScopeNode['id']> {
  const carried = await carriedOf(from.images, state.id, state.images)
  const drawn = await drawingPicturesOf(from.images, state.id, state.model)
  const snapshot = snapshotOf(state)
  const content = contentOf(keepName && there ? { ...snapshot, model: { ...snapshot.model, name: there.model.name } } : snapshot, [])
  const place = held ? { id: held.id } : await placeFor(into, node, content.model.name, content.kind)
  await landAt(into, [{
    address: node.address, content, pictures: picturesOf(carried), drawings: drawingBytesOf(drawn), ...checkedOf(there),
  }], [place])
  return place.id
}

/** A scope made at an address the tree held nothing at, or — where somebody made one since — theirs, which the landing then refuses. */
async function placeFor(into: CopyInto, node: ScopeNode, name: string, kind: ScopeState['kind']): Promise<ArrivalPlace> {
  const answer = await into.scopes.create(node.address, { name, ...(kind ? { kind } : {}) })
  if ('refused' in answer && answer.refused === 'shell.scopeTaken') {
    const theirs = nodesOf((await into.scopes.tree()).root).find((one) => one.address === node.address)
    if (theirs) return { id: theirs.id }
  }
  const created = landed(answer)
  return { id: created.id, made: created.revision }
}

/** The settings there is nothing for at the destination, read back; a value it holds is its own. */
async function copySetting(from: Pick<SettingsRepository, 'read'>, into: Pick<SettingsRepository, 'read' | 'write'>, read: SettingsOf, write: SettingsOf, keys?: readonly string[]): Promise<void> {
  const [here, there] = await Promise.all([from.read(read), into.read(write)])
  const missing: Record<string, Settings[string]> = {}
  for (const [key, value] of Object.entries(here)) {
    if (there[key] === undefined && (!keys || keys.includes(key))) missing[key] = value
  }
  if (Object.keys(missing).length === 0) return
  await into.write(write, missing as SettingsPatch)
  const after = await into.read(write)
  for (const key of Object.keys(missing)) if (after[key] === undefined) throw new Error(`the setting ${key} did not keep`)
}

/** Every entry of the register the destination does not hold yet, every forgetting and removal, and every answer; how many stand there, read back. */
async function copyPeople(from: CopyFrom, into: CopyInto): Promise<number> {
  if (!from.people || !into.people) return 0
  const held = new Set((await into.people.list()).people.map((person) => person.id))
  const { people, removed, distinct = [] } = await from.people.list()
  const carried = people.filter((person) => !held.has(person.id) || person.state === 'forgotten')
  if (carried.length || removed.length || distinct.length) await into.people.bringIn(carried, removed, distinct)
  const after = new Set((await into.people.list()).people.map((person) => person.id))
  const missing = people.filter((person) => !after.has(person.id)).length
  if (missing > 0) throw new Error(`${missing} of ${people.length} did not keep`)
  return people.length
}

/** A failure said on the tally: where a person reads it and where the trail does. */
function failed(tally: CopyTally, what: CopyFailure['what'], cause: unknown, address?: ScopeAddress): void {
  tally.failures.push({ what, reason: reasonOf(cause), cause, ...(address !== undefined ? { address } : {}) })
}

/** Whether there is a history here, which a person is told stays; where it will not say, the sentence is still true. */
async function hasHistory(from: CopyFrom, nodes: readonly ScopeNode[]): Promise<boolean> {
  if (!from.history) return false
  const page = await from.history.entries({ scopes: nodes.map((node) => node.id), limit: 1 }).catch(() => undefined)
  return page === undefined || page.entries.length > 0
}

/** A scope to read back once they are all in: whether it was brought just now, and under whose name. */
type ToCheck = { node: ScopeNode; brought: boolean; keepName: boolean }

/** One scope looked at and, where there is nothing of anybody's in the way, brought. Answers what to read back, or nothing. */
async function copyOne(from: CopyFrom, into: CopyInto, node: ScopeNode, state: ScopeState, held: ScopeNode | undefined, tally: CopyTally, ownName: string | undefined): Promise<ToCheck | undefined> {
  const there = held && await into.scopes.state(held.id)
  if (there && !holdsNothing(there, state)) {
    if (differencesBetween(state, there).length > 0) { tally.kept += 1; tally.differs.push(node.address); return undefined }
    const pictures = await picturesDiffer(from.images, state, into.images, there)
    if (pictures.length === 0) return { node, brought: false, keepName: false }
    // The same but for a picture an earlier copy never brought: nobody's work is
    // written over by adding it.
    if (pictures.includes('images')) { tally.unlike.push({ address: node.address, lists: pictures }); return undefined }
    await bring(from, into, node, state, held, there, false)
    return { node, brought: true, keepName: false }
  }
  const keepName = there !== undefined && !nameNobodyChose(there.model.name, node.address, state.model.name, ownName)
  const id = await bring(from, into, node, state, held, there, keepName)
  if (keepName) tally.namesKept.push(node.address)
  await copyScopeSettings(from, into, node, id, tally)
  return { node, brought: true, keepName }
}

/** Everything brought, read again as the next opening will read it, and counted only as what was found. */
async function checkAll(from: CopyFrom, check: NonNullable<CopyOptions['check']>, toCheck: readonly ToCheck[], tally: CopyTally, onProgress: CopyOptions['onProgress']): Promise<void> {
  const nodes = new Map(nodesOf((await check.scopes.tree()).root).map((node) => [node.address, node]))
  for (const [at, { node, brought, keepName }] of toCheck.entries()) {
    onProgress?.({ phase: 'checking', done: at, total: toCheck.length, address: node.address, name: node.name })
    try {
      const state = await from.scopes.state(node.id)
      const found = nodes.get(node.address)
      const back = found && await check.scopes.state(found.id)
      if (!state || !back) throw new Error('it did not read back')
      const unlike = [...differencesBetween(state, back, { ignoreName: keepName }), ...await picturesDiffer(from.images, state, check.images, back)]
      if (unlike.length > 0) { tally.unlike.push({ address: node.address, lists: unlike }); continue }
      if (brought) tally.scopes += 1
      else tally.already += 1
      tally.counts = addCounts(tally.counts, copyCountsOf(state))
    } catch (cause) {
      tally.failed += 1
      tally.missed.push(node.address)
      failed(tally, 'scope', cause, node.address)
    }
  }
}

async function copyScopeSettings(from: CopyFrom, into: CopyInto, node: ScopeNode, id: ScopeNode['id'], tally: CopyTally): Promise<void> {
  if (!from.settings || !into.settings) return
  await copySetting(from.settings, into.settings, { of: 'scope', scope: node.id }, { of: 'scope', scope: id })
    .catch((cause: unknown) => failed(tally, 'settings', cause, node.address))
}

/** What is kept outside any scope: the register, and the settings of the organisation and of the person. */
async function copyBeside(from: CopyFrom, into: CopyInto, tally: CopyTally): Promise<void> {
  await copyPeople(from, into)
    .then((people) => { tally.counts = addCounts(tally.counts, { ...EMPTY_COUNTS, people }) })
    .catch((cause: unknown) => failed(tally, 'people', cause))
  if (!from.settings || !into.settings) return
  await copySetting(from.settings, into.settings, { of: 'organisation' }, { of: 'organisation' })
    .catch((cause: unknown) => failed(tally, 'settings', cause))
  // Of what a person keeps about a place, only who they are in it means anything in another.
  await copySetting(from.settings, into.settings, { of: 'person' }, { of: 'person' }, [ME_KEY])
    .catch((cause: unknown) => failed(tally, 'settings', cause))
}

export async function copyScopes(from: CopyFrom, into: CopyInto, options: CopyOptions = {}): Promise<CopyTally> {
  const tally: CopyTally = {
    scopes: 0, already: 0, kept: 0, failed: 0, unread: 0, missed: [], meanwhile: [], differs: [], unlike: [], namesKept: [],
    counts: EMPTY_COUNTS, failures: [], historyStays: false,
  }
  const { signal, onProgress, ownName, check = into } = options
  const tree = await from.scopes.tree()
  tally.unread += tree.unreadable?.length ?? 0
  tally.missed.push(...tree.unreadable ?? [])
  const nodes = nodesOf(tree.root)
  tally.historyStays = await hasHistory(from, nodes)
  const held = new Map(nodesOf((await into.scopes.tree()).root).map((node) => [node.address, node]))
  const toCheck: ToCheck[] = []
  for (const [at, node] of nodes.entries()) {
    if (signal?.aborted) { tally.stopped = { left: nodes.length - at }; break }
    onProgress?.({ phase: 'copying', done: at, total: nodes.length, address: node.address, name: node.name })
    const read = await from.scopes.state(node.id).then((state) => ({ state }), (cause: unknown) => ({ cause, state: undefined }))
    const { state } = read
    if (!state) {
      tally.unread += 1
      tally.missed.push(node.address)
      if ('cause' in read) failed(tally, 'read', read.cause, node.address)
      continue
    }
    if (blank(state)) continue
    // What did not read would be lost by a copy of what did: it stays here, and is said.
    if (state.unreadable?.length || state.later) { tally.unread += 1; tally.missed.push(node.address); continue }
    try {
      const landedHere = await copyOne(from, into, node, state, held.get(node.address), tally, ownName)
      if (landedHere) toCheck.push(landedHere)
    } catch (cause) {
      if (isScopeMoved(cause)) { tally.kept += 1; tally.meanwhile.push(node.address); continue }
      tally.failed += 1
      tally.missed.push(node.address)
      failed(tally, 'scope', cause, node.address)
    }
  }
  await checkAll(from, check, toCheck, tally, onProgress)
  // A stop is a stop: the next run brings what is beside the scopes as well.
  if (!tally.stopped) await copyBeside(from, into, tally)
  return tally
}

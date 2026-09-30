// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The app's questions about scopes, asked of the repositories (ADR-0031 §1)
 * in the words the screens already use.
 *
 * A screen names a scope by its address and draws a tree of summaries; the
 * repository names one by its identity and answers a tree of nodes. This is
 * the fold between the two, written once: the tree as a summary, a scope read
 * by its address, and a change made to one as steps that expect what was
 * read — and made again, over a scope somebody moved in between, from what
 * it holds now.
 *
 * **A refusal is a `ShellError`** with the repository's key, here and nowhere
 * earlier: the repository answers one as a value, and the screens above have
 * always been handed a refusal they can say (`app/messageFor.ts`).
 */
import type { Command, UploadedLogo } from '../model'
import { imageEntryOf } from '../model/imageEntry'
import { isImageName } from '../model/imageName'
import type { ContentAddress, ImageEntry, ImageName } from '../model/imageName'
import type { ImageRepository, Put } from '../ports/ImageRepository'
import { ShellError } from '../platform/errors'
import type { IndexedScope, IndexRead, OrganisationIndex } from '../ports/OrganisationIndex'
import type { Created, Refused, ScopeNode, ScopeRepository, ScopeTree } from '../ports/ScopeRepository'
import { dataUrl, readDataUrl } from './dataUrl'
import { analysisNamesWithin, readdressAnalysis, readdressRef, readdressRefs } from './readdress'
import { SCOPE_MOVED, scopeMoved } from './revision'
import { resolveActive } from './scope'
import { isWithinScope } from './scopePath'
import type { CarriedImage, ScopeModel, ScopeSnapshot, ScopeSummary } from './scope'
import { STEP_ELSEWHERE } from './scopeState'
import type {
  Revision, ScopeAddress, ScopeCommand, ScopeContent, ScopeId, ScopeRefusal, ScopeState, ScopeStep,
} from './scopeState'

/** The tree as the screens draw it: one summary per node, the root first. */
export function summaryOf(tree: ScopeTree): ScopeSummary {
  const summary = summaryOfNode(tree.root)
  return tree.unreadable?.length ? { ...summary, unreadable: [...tree.unreadable] } : summary
}

function summaryOfNode(node: ScopeNode): ScopeSummary {
  return {
    path: node.address,
    id: node.id,
    name: node.name,
    ...(node.kind !== undefined ? { kind: node.kind } : {}),
    ...(node.client !== undefined ? { client: node.client } : {}),
    ...(node.description !== undefined ? { description: node.description } : {}),
    ...(node.links !== undefined ? { links: node.links } : {}),
    diagrams: node.diagrams,
    children: node.children.map(summaryOfNode),
    ...(node.updatedAt !== undefined ? { updatedAt: node.updatedAt } : {}),
  }
}

/** Every node of a tree, the root first, depth first. */
export function nodesOf(node: ScopeNode): ScopeNode[] {
  return [node, ...node.children.flatMap(nodesOf)]
}

/** The node at an address, or nothing. */
export function nodeAt(tree: ScopeTree, address: ScopeAddress): ScopeNode | undefined {
  return nodesOf(tree.root).find((node) => node.address === address)
}

/**
 * A scope's state as the app holds one open: its address as a path, the view
 * it opens on resolved against the views it has, and the marks as a list.
 */
export function snapshotOf(state: ScopeState): ScopeSnapshot {
  const { id, address, model, activeDiagramId, logoLibrary, kind, client, links, updatedAt, unreadable, later, revision, images } = state
  return {
    path: address,
    id,
    model,
    activeDiagramId: resolveActive(model, activeDiagramId),
    logoLibrary: [...(logoLibrary ?? [])] as UploadedLogo[],
    ...(kind !== undefined ? { kind } : {}),
    ...(client !== undefined ? { client } : {}),
    ...(links !== undefined ? { links } : {}),
    ...(updatedAt !== undefined ? { updatedAt } : {}),
    ...(unreadable?.length ? { unreadable } : {}),
    ...(later ? { later } : {}),
    revision,
    images,
  }
}

/** The part of a repository a read by address takes. */
export type ScopeReader = Pick<ScopeRepository, 'tree' | 'state'>

/** One scope, by its address; `undefined` where no scope is there. */
export async function readScope(scopes: ScopeReader, address: ScopeAddress): Promise<ScopeSnapshot | undefined> {
  const node = nodeAt(await scopes.tree(), address)
  const state = node && await scopes.state(node.id)
  return state && snapshotOf(state)
}

/** Several scopes, by their addresses, from one read of the tree; `undefined` for each that is not there. */
export async function readScopes(
  scopes: ScopeReader, addresses: readonly ScopeAddress[],
): Promise<(ScopeSnapshot | undefined)[]> {
  const tree = await scopes.tree()
  return Promise.all(addresses.map(async (address) => {
    const node = nodeAt(tree, address)
    const state = node && await scopes.state(node.id)
    return state && snapshotOf(state)
  }))
}

/** Every scope's records and rows, as the index folds them (`scopeIndex.ts`). */
export function modelsOf(read: IndexRead): ScopeModel[] {
  return read.scopes.map(modelOf)
}

export function modelOf(scope: IndexedScope): ScopeModel {
  return { path: scope.address, model: scope.model }
}

/** A step, minted here: one command, with a name nobody else will give one. */
export function stepOf(command: ScopeCommand, at = Date.now()): ScopeStep {
  return { stepId: crypto.randomUUID(), command, at }
}

/**
 * A refusal, as what the app throws: a `ShellError` with its key — but a step
 * sent to the wrong scope is a fault in whoever sent it, with no sentence for
 * a person, and is thrown as the fault it is.
 */
export function refusedError(refused: ScopeRefusal): Error {
  return refused === STEP_ELSEWHERE ? new Error(`a step was sent to a scope it was not made for (${refused})`) : new ShellError(refused)
}

/** The answer, or the refusal it was, thrown. */
export function landed<T extends object>(answer: T | Refused): T {
  if ('refused' in answer) throw refusedError(answer.refused)
  return answer
}

/** Where a picture's bytes were kept, or the refusal they met, thrown. */
export function keptAt(put: Put): ContentAddress {
  if ('refused' in put) throw new ShellError(put.refused)
  return put.contentAddress
}

/** How many times a change is made again over a scope that moved before it lands. */
export const CHANGE_TRIES = 3

/**
 * Change one scope: read it, work out the commands from what it holds, and
 * apply them expecting what was read.
 *
 * Nothing to do — `change` answers nothing, or no command — is an answer, and
 * nothing is applied. Over a scope somebody changed in between, the change is
 * worked out again from what it holds now, a few times, and then the refusal
 * is said: a change made from a state nobody read is the write this exists to
 * avoid. What comes back is the scope as the change left it.
 */
export async function changeScope(
  scopes: ScopeReader & Pick<ScopeRepository, 'apply'>,
  address: ScopeAddress,
  change: (held: ScopeSnapshot) => readonly ScopeCommand[] | undefined,
): Promise<ScopeSnapshot | undefined> {
  for (let tried = 1; ; tried += 1) {
    const held = await readScope(scopes, address)
    if (!held?.id) return undefined
    const commands = change(held)
    if (!commands?.length) return held
    const answer = await scopes.apply([{ scope: held.id, steps: commands.map((command) => stepOf(command)), expects: held.revision }])
    if (!('refused' in answer)) return readScope(scopes, address)
    if (answer.refused !== SCOPE_MOVED || tried >= CHANGE_TRIES) throw refusedError(answer.refused)
  }
}

/**
 * A scope at an address, made there where there is none: its identity either
 * way. The scopes above it that are not there are made too — the repository's
 * rule, since a scope filed under nothing would be addressed by nothing.
 */
export async function ensureScope(
  scopes: Pick<ScopeRepository, 'tree' | 'create'>,
  address: ScopeAddress,
  scope: { name: string; kind?: ScopeSnapshot['kind'] },
): Promise<ScopeId> {
  return (await madeAt(scopes, address, scope)).id
}

/** The scope at an address, and — where it was made just now — the revision it was made at. */
async function madeAt(
  scopes: Pick<ScopeRepository, 'tree' | 'create'>,
  address: ScopeAddress,
  scope: { name: string; kind?: ScopeSnapshot['kind'] },
): Promise<{ id: ScopeId; made?: Revision }> {
  const held = nodeAt(await scopes.tree(), address)
  if (held) return { id: held.id }
  const answer: Created | Refused = await scopes.create(address, scope)
  // Somebody made one there in between: theirs is the one.
  if ('refused' in answer && answer.refused === 'shell.scopeTaken') {
    const theirs = nodeAt(await scopes.tree(), address)
    if (theirs) return { id: theirs.id }
  }
  const created = landed(answer)
  return { id: created.id, made: created.revision }
}


/**
 * What of a scope the app holds is its content, as a step carries it: the
 * model, and what it says about itself. The pictures' entries are the
 * library's (`images`), handed in by whoever put their bytes.
 */
export function contentOf(scope: ScopeSnapshot, images: ScopeContent['images'] = scope.images ?? []): ScopeContent {
  return {
    model: scope.model,
    ...(scope.activeDiagramId ? { activeDiagramId: scope.activeDiagramId } : {}),
    ...(scope.logoLibrary.length ? { logoLibrary: scope.logoLibrary } : {}),
    ...(scope.kind !== undefined ? { kind: scope.kind } : {}),
    ...(scope.client !== undefined ? { client: scope.client } : {}),
    ...(scope.links !== undefined ? { links: scope.links } : {}),
    images,
  }
}

/**
 * A content that arrives whole, put at an address (`scope.replace`): a scope
 * made there where there is none, and the content landed on it expecting what
 * was read — so a scope somebody changed in between is refused, not written
 * over. Answers the identity it landed on.
 */
export async function placeWhole(
  scopes: ScopeReader & Pick<ScopeRepository, 'create' | 'apply'>,
  address: ScopeAddress,
  content: ScopeContent,
): Promise<ScopeId> {
  const id = await ensureScope(scopes, address, { name: content.model.name, ...(content.kind ? { kind: content.kind } : {}) })
  const read = await scopes.state(id)
  landed(await scopes.apply([{ scope: id, steps: [stepOf({ type: 'scope.replace', content })], ...(read ? { expects: read.revision } : {}) }]))
  return id
}

/**
 * A scope, and everything filed under it, to another address — and the
 * stand-ins elsewhere that named it by its old one, named by its new, and so
 * the causes and observations that name a scope in it (ADR-0032 §4, §5).
 *
 * The repository moves the subtree whole, identities and all; what it cannot
 * know is who else points into it, which the index says. Those stand-ins are
 * written as the refresh they are (`standin.refresh`), and a cause's link to
 * a cause below or an observation's `absorbed` event as a patch of the
 * record — each scope's as one step, worked out from what it holds and
 * expecting what was read of it, once the move has landed: a move refused —
 * the address taken, a scope into itself, a scope gone — leaves every
 * address naming the scope where it still is. The ones inside the subtree
 * are written at their new addresses.
 */
export async function moveScope(
  scopes: ScopeReader & Pick<ScopeRepository, 'apply' | 'move'>,
  index: Pick<OrganisationIndex, 'read'>,
  from: ScopeAddress,
  to: ScopeAddress,
  expects?: Revision,
): Promise<ScopeSnapshot | undefined> {
  const node = nodeAt(await scopes.tree(), from)
  if (!node) return undefined
  const models = modelsOf(await index.read())
  const carried = carriedBy(models, from, to)
  const inside = (address: ScopeAddress) => isWithinScope(address, from)
  const carry = async (address: ScopeAddress, refs: readonly { id: string; ref: string }[]) => {
    await changeScope(scopes, address, (held) => {
      const names = new Map(held.model.elements.map((element) => [element.id, element.name]))
      const entries = refs.filter((one) => names.has(one.id)).map((one) => ({ ...one, name: names.get(one.id)! }))
      const commands: Command[] = [
        ...(entries.length ? [{ type: 'standin.refresh', entries } as const] : []),
        ...readdressAnalysis(held.model, from, to),
      ]
      if (commands.length === 0) return undefined
      return [commands.length === 1 ? commands[0] : { type: 'transaction', commands }]
    })
  }
  landed(await scopes.move(node.id, to, expects))
  for (const [path, refs] of carried) await carry(inside(path) ? readdressRef(path, from, to) : path, refs)
  return readScope(scopes, to)
}

/**
 * Every scope that names an address in the subtree at `from`, by where it is
 * before the move, with the stand-ins it holds there: the scopes outside the
 * subtree first, as `readdressRefs` orders them, then those inside it.
 */
function carriedBy(
  models: readonly ScopeModel[], from: ScopeAddress, to: ScopeAddress,
): Map<ScopeAddress, readonly { id: string; ref: string }[]> {
  const carried = new Map<ScopeAddress, readonly { id: string; ref: string }[]>()
  for (const patch of readdressRefs(models, from, to)) carried.set(patch.path, patch.refs)
  if (from === to) return carried
  for (const one of models) {
    if (!carried.has(one.path) && analysisNamesWithin(one.model, from)) carried.set(one.path, [])
  }
  const inside = (address: ScopeAddress) => Number(isWithinScope(address, from))
  return new Map([...carried].sort(([a], [b]) => inside(a) - inside(b) || a.localeCompare(b)))
}

/** A picture a whole content carries: its name in the library, and its bytes. */
export type CarriedPicture = { name: ImageName; bytes: Uint8Array }

/** A whole content on its way to an address, with the bytes of the pictures it names. */
export type Arriving = {
  address: ScopeAddress
  /** What it holds; its library is made from `pictures`. */
  content: ScopeContent
  pictures?: readonly CarriedPicture[]
  /**
   * What the caller read at the address when it decided to place this there:
   * the revision it saw, or none where nothing was there. Given, the landing
   * expects exactly that, so a write that landed since — or a scope made
   * there since — refuses the whole rather than being replaced. Absent, the
   * landing expects what is read of the scope just before it lands.
   */
  checked?: { revision?: Revision }
  /**
   * The person asked for this content to put back the scope at the address,
   * which could not be read whole (`ScopeState.unreadable`); `subject` is what
   * the entry that keeps it as it stood says. Absent, a scope there that could
   * not be read whole refuses the landing, whole.
   */
  putBack?: { subject: string }
}

/**
 * Several contents that arrive whole, landed together: every content or
 * none (ADR-0023, amendment 2). The scopes that are not there are made first,
 * shallowest first, and the pictures' bytes are put; then one apply lands a
 * `scope.replace` on each, expecting what was read of it — so a scope
 * somebody changed in between refuses the whole, no content is written, and
 * the scopes made to hold them are taken away again, each only where nothing
 * was done to it since. A page that dies between the making and the landing
 * may leave a scope it made there, empty. Answers what a put back set aside
 * first (`Applied.setAside`).
 */
export async function placeTogether(
  repositories: {
    scopes: ScopeReader & Pick<ScopeRepository, 'create' | 'apply' | 'remove'>
    images: Pick<ImageRepository, 'put'>
  },
  arriving: readonly Arriving[],
): Promise<readonly string[]> {
  const { scopes } = repositories
  const ordered = [...arriving].sort((one, other) => depthOf(one.address) - depthOf(other.address))
  const places: { id: ScopeId; made?: Revision }[] = []
  for (const one of ordered) {
    places.push(await madeAt(scopes, one.address, { name: one.content.model.name, ...(one.content.kind ? { kind: one.content.kind } : {}) }))
  }
  try {
    return await landEach(repositories, ordered, places)
  } catch (cause) {
    // Nothing of the contents landed, so the scopes made only to hold them go
    // again — deepest first, and each only where nothing has been done to it
    // since it was made: the revision it was made at is what the removal
    // expects, and a scope somebody has written to since stays.
    for (const { id, made } of [...places].reverse()) {
      if (made !== undefined) await scopes.remove(id, made).catch(() => undefined)
    }
    throw cause
  }
}

/** The pictures' bytes put, then every content landed on its scope in one apply. */
async function landEach(
  repositories: { scopes: ScopeReader & Pick<ScopeRepository, 'apply'>; images: Pick<ImageRepository, 'put'> },
  ordered: readonly Arriving[],
  places: readonly { id: ScopeId; made?: Revision }[],
): Promise<readonly string[]> {
  const { scopes, images } = repositories
  const libraries: ImageEntry[][] = []
  for (const [at, one] of ordered.entries()) {
    const library: ImageEntry[] = []
    for (const picture of one.pictures ?? []) {
      // Kept under the address the repository gave the bytes, which is the
      // one a picture is found by.
      const contentAddress = keptAt(await images.put(places[at].id, picture.name, picture.bytes))
      library.push({ ...await imageEntryOf(picture.name, picture.bytes), contentAddress })
    }
    libraries.push(library)
  }
  const expects = await Promise.all(ordered.map((one, at) => expectedOf(scopes, one, places[at])))
  const applied = landed(await scopes.apply(ordered.map((one, at) => ({
    scope: places[at].id,
    steps: [stepOf({
      type: 'scope.replace', content: { ...one.content, images: libraries[at] }, ...(one.putBack ? { putBack: one.putBack } : {}),
    })],
    ...(expects[at] !== undefined ? { expects: expects[at] } : {}),
  }))))
  return applied.setAside ?? []
}

/**
 * What a landing expects of its scope: what the caller checked, where it
 * did — the scope made to hold it, where nothing was there, and a refusal
 * where somebody made one there since — or else what is read of it now.
 */
async function expectedOf(
  scopes: ScopeReader, one: Arriving, place: { id: ScopeId; made?: Revision },
): Promise<Revision | undefined> {
  if (!one.checked) return (await scopes.state(place.id))?.revision
  if (one.checked.revision !== undefined) return one.checked.revision
  if (place.made !== undefined) return place.made
  throw scopeMoved(one.address)
}

function depthOf(address: ScopeAddress): number {
  return address === '' ? 0 : address.split('/').length
}

/**
 * The pictures a snapshot carries whole, as names and bytes: each whose name
 * is one a library may hold, and whose bytes read. The rest are left out, as
 * a picture no document can name.
 */
export function picturesOf(carried: readonly CarriedImage[] | undefined): CarriedPicture[] {
  return (carried ?? []).flatMap((image) => {
    const read = readDataUrl(image.url)
    return read && isImageName(image.file) ? [{ name: image.file, bytes: read.bytes }] : []
  })
}

/** A scope's pictures, with their bytes, as a snapshot carries them whole. */
export async function carriedOf(
  images: Pick<ImageRepository, 'bytes'>, scope: ScopeId, library: readonly ImageEntry[],
): Promise<CarriedImage[]> {
  const carried: CarriedImage[] = []
  for (const entry of library) {
    const held = await images.bytes(scope, entry.name)
    if (held) carried.push({ file: entry.name, url: dataUrl(held.mediaType, held.bytes) })
  }
  return carried
}

/**
 * Every scope the source holds, in full, pictures and all, and in tree order:
 * what a working set is made of (ADR-0018) — or, `from` an address, the scope
 * there and every scope under it. Refused, naming them, where a scope could
 * not be read — one the tree names as unreadable, or one it lists that then
 * does not read (ADR-0023, amended): a working set without one of its scopes,
 * handed over as the organisation, is the loss this refuses. A `from` that
 * names no scope is refused as a scope gone.
 */
export async function everyScope(
  repositories: { scopes: ScopeReader; images: Pick<ImageRepository, 'bytes'> },
  from: ScopeAddress = '',
): Promise<ScopeSnapshot[]> {
  const tree = await repositories.scopes.tree()
  const top = nodeAt(tree, from)
  if (!top) throw new ShellError('shell.scopeGone')
  const nodes = nodesOf(top)
  const states = await Promise.all(nodes.map((node) => repositories.scopes.state(node.id)))
  const unreadable = [
    ...(tree.unreadable ?? []).filter((address) => isWithinScope(address, from)),
    ...nodes.filter((node, at) => states[at] === undefined).map((node) => node.address),
  ]
  if (unreadable.length) {
    throw new ShellError('shell.exportUnreadable', { paths: unreadable.map((path) => path || '/').join(', ') })
  }
  // The organisation is always there, whether or not anything was ever put
  // in it; one with no name and nothing in it is nothing yet, and a working
  // set does not carry it.
  const held = states.filter((state) => !(state!.address === '' && blank(state!)))
  return Promise.all(held.map((state) => wholeOf(repositories.images, state!)))
}

/** One scope, by its address, with its pictures' bytes: what a landing is read back and held to. */
export async function readWhole(
  repositories: { scopes: ScopeReader; images: Pick<ImageRepository, 'bytes'> },
  address: ScopeAddress,
): Promise<ScopeSnapshot | undefined> {
  const node = nodeAt(await repositories.scopes.tree(), address)
  const state = node && await repositories.scopes.state(node.id)
  return state && wholeOf(repositories.images, state)
}

/** A scope's state as the app holds one, with its pictures carried whole. */
async function wholeOf(images: Pick<ImageRepository, 'bytes'>, state: ScopeState): Promise<ScopeSnapshot> {
  const snapshot = snapshotOf(state)
  const carried = await carriedOf(images, state.id, state.images)
  return carried.length ? { ...snapshot, imageLibrary: carried } : snapshot
}

/**
 * A scope with no name, and nothing in it or said about it: the organisation
 * before anybody put anything there, which is always there all the same.
 */
export function blank(scope: ScopeState | ScopeSnapshot): boolean {
  const { model } = scope
  const said = Object.entries(model).some(([key, value]) => key !== 'name' && (Array.isArray(value) ? value.length > 0 : value !== undefined))
  const described = scope.kind !== undefined || scope.client !== undefined || (scope.links?.length ?? 0) > 0
    || (scope.logoLibrary?.length ?? 0) > 0
  return model.name.trim() === '' && !said && !described && (scope.images?.length ?? 0) === 0
}

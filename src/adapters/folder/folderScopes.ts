// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The scopes of a folder as the repositories read them: which there are, who
 * each is, and each one's state (ADR-0031 §1, §2).
 *
 * **A scope's identity is in its header.** `scope.json` carries `id`, minted
 * when the scope is made and kept by every move. A folder made before scopes
 * had one reads as having one all the same — made from its address, so it is
 * the same one every time the folder is read — and it is written into the
 * header the first time anything writes that scope, a move included, which is
 * how a folder gains its identities without anything touching it only to add
 * them. Two headers claiming one id — a scope's folder copied by hand — are
 * read the first at its address and the other as a folder with none.
 *
 * **A state is what the folder holds, as the domain says it.** Read by the
 * folder store, with the pictures kept apart (`folderPictures.ts`); the
 * documents' `../images/<file>` read as `image:<name>`; what the scope says
 * about itself as its header says it.
 *
 * **A revision is what the state was read from**, fingerprinted: its address,
 * every file of the format it holds, and which pictures there are. Content,
 * so two reads with nothing written between them agree and a write that
 * changed nothing moves nothing; and the address, because it is part of a
 * state.
 */
import { imageMediaType } from '../../model/documentImage'
import type { ImageEntry, ImageName } from '../../model/imageName'
import { parseJson } from '../../projects/fileText'
import type { ScopeSnapshot, ScopeSummary } from '../../projects/scope'
import { scopeSummaryFrom } from '../../projects/folderFormat'
import { fingerprint } from '../../projects/revision'
import { ROOT_SCOPE, scopeFilePath } from '../../projects/scopePath'
import { emptyContent } from '../../projects/scopeState'
import type { Revision, ScopeAddress, ScopeId, ScopeState } from '../../projects/scopeState'
import type { Diagnostics } from '../../ports/Diagnostics'
import type { DirectoryHandleLike } from './DirectoryHandle'
import { FileSystemScopeStore } from './FileSystemScopeStore'
import type { ScopeHeader } from './FileSystemScopeStore'
import { libraryOf, LIBRARY_KEY, pictureFiles, pictureStamps, rowsOf, sameStamp, stampsInMemory } from './folderPictures'
import type { Described, KeptPicture, PictureFile, PictureStamp, StampCache } from './folderPictures'
import { bytesAt, fileAt, filesUnder, folderAt, textAt } from './handles'
import type { FileHandleLike } from './DirectoryHandle'
import { imageEntryOf } from '../../model/imageEntry'
import { namesInDocuments, PICTURES } from './imageLibrary'
import { SCOPE_FILE } from '../../projects/folderFormat'

/** The key `scope.json` keeps a scope's identity under. */
export const ID_KEY = 'id'

/** One scope the walk found: who it is, where, and what its header says. */
export type FolderNode = {
  id: ScopeId
  address: ScopeAddress
  /** Its header, parsed; empty for an organisation with none. */
  header: Record<string, unknown>
  summary: ScopeSummary
  updatedAt?: string
}

/** Every scope there is, and the folders that would not read. */
export type Walked = { nodes: FolderNode[]; unreadable: ScopeAddress[] }

/** One scope read: its state, and what a write of it starts from. */
export type ReadScope = {
  node: FolderNode
  state: ScopeState
  /** As the folder store read it; `undefined` for an organisation that has no header yet. */
  snapshot: ScopeSnapshot | undefined
  library: KeptPicture[]
  /** The files the pictures folder held when it was read. */
  files: PictureFile[]
  /** The format's own revision, which a save by the folder store expects. */
  stored?: string
}

/** What a file is, as its handle says without its bytes being read. */
async function stampOf(handle: FileHandleLike): Promise<PictureStamp | undefined> {
  if (handle.stamp) return handle.stamp()
  const file = await handle.getFile().catch(() => undefined)
  return file ? { size: file.size, lastModified: file.lastModified } : undefined
}

/** A header parsed as the object it is, or nothing. */
export function headerOf(text: string | undefined): Record<string, unknown> | undefined {
  const parsed = text === undefined ? undefined : parseJson(text)
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined
}

/** An id a header may carry: something a tag, a key and a line of text all hold as it is. */
export function isScopeId(value: unknown): value is ScopeId {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(value)
}

/**
 * The identity of a scope whose header carries none: from its address,
 * composed (NFC), the same every time it is read — however the disk spells
 * the folder's name back.
 */
export function identityAt(address: ScopeAddress): ScopeId {
  return `f-${fingerprint(['scope', address.normalize('NFC')])}`
}

/** An address as the domain is answered it: composed (NFC), whatever the disk spells; nothing on the disk is renamed. */
export function composed(address: ScopeAddress): ScopeAddress {
  return address.normalize('NFC')
}

/** A new identity, for a scope being made. */
export function newIdentity(): ScopeId {
  return crypto.randomUUID()
}

/** What a revision is made from: the address, the format's revision, and the pictures the library holds. */
export function revisionOf(address: ScopeAddress, stored: string, library: readonly KeptPicture[]): Revision {
  return fingerprint(['scope', address, stored, ...pictureStamps(library)])
}

/**
 * Where a folder's scopes' identities were last found, kept between one
 * opening of the folder and the next and never in it — so two headers that
 * claim one identity leave it where it was, through a restart
 * (`desktop/desktopStepStore.ts` on the desktop). Where nobody says, for as
 * long as the repositories are open.
 */
export type PlaceStore = {
  read(): Promise<Record<ScopeId, ScopeAddress> | undefined>
  write(places: Record<ScopeId, ScopeAddress>): Promise<void>
}

export function placesInMemory(): PlaceStore {
  let held: Record<ScopeId, ScopeAddress> | undefined
  return {
    read: () => Promise.resolve(held && { ...held }),
    write: (places) => {
      held = { ...places }
      return Promise.resolve()
    },
  }
}

export class FolderScopes {
  readonly store: FileSystemScopeStore
  /** What this machine found each picture to be, by scope folder and file, at the stamp it had: read from `stamps` once. */
  private described: Map<string, Described> | undefined
  /** Whether `described` changed since it was last kept. */
  private unkept = false
  /** Where each identity was last found, so reading one scope does not walk the tree. */
  private readonly found = new Map<ScopeId, ScopeAddress>()
  private queue: Promise<unknown> = Promise.resolve()
  /** The places as they were last kept, to write them only when they moved. */
  private kept: string | undefined

  constructor(
    readonly root: DirectoryHandleLike,
    readonly diagnostics?: Pick<Diagnostics, 'report'>,
    private readonly places: PlaceStore = placesInMemory(),
    private readonly stamps: StampCache = stampsInMemory(),
  ) {
    this.store = new FileSystemScopeStore(root, diagnostics, 'apart')
  }

  /**
   * One write at a time. A folder has no lock of its own to take, and two
   * applies interleaved in one window would each read the other's half-made
   * state; in turn, each reads what the last one wrote.
   */
  serial<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work, work)
    this.queue = next.catch(() => undefined)
    return next
  }

  /**
   * Every scope, with its identity, parent-first; the organisation always,
   * with a header or without. Where two headers claim one identity, the one at
   * the address it was last found at keeps it, and otherwise the first by
   * address; the other reads as a folder with none.
   */
  async walk(dated = false): Promise<Walked> {
    const { headers, unreadable } = await this.store.headers(dated)
    const read: { found: ScopeHeader; summary: ScopeSummary; header: Record<string, unknown>; declared?: ScopeId }[] = []
    for (const found of [...headers].sort((one, other) => (one.path < other.path ? -1 : 1))) {
      const summary = scopeSummaryFrom(found.text, found.path, found.updatedAt)
      if (!summary) {
        if (found.current) unreadable.push(found.path)
        continue
      }
      const header = headerOf(found.text) ?? {}
      const declared = found.current && isScopeId(header[ID_KEY]) ? header[ID_KEY] : undefined
      read.push({ found, summary, header, ...(declared !== undefined ? { declared } : {}) })
    }
    await this.recall()
    const keeper = new Map<ScopeId, string>()
    for (const { found, declared } of read) {
      if (declared === undefined) continue
      if (!keeper.has(declared) || this.found.get(declared) === found.path) keeper.set(declared, found.path)
    }
    const nodes: FolderNode[] = read.map(({ found, summary, header, declared }) => ({
      id: declared !== undefined && keeper.get(declared) === found.path ? declared : identityAt(found.path),
      address: found.path, header, summary, ...(found.updatedAt ? { updatedAt: found.updatedAt } : {}),
    }))
    if (!nodes.some((node) => node.address === ROOT_SCOPE)) nodes.unshift(this.bareRoot())
    for (const node of nodes) this.found.set(node.id, node.address)
    await this.keepPlaces()
    return { nodes, unreadable: [...new Set(unreadable)].sort() }
  }

  /** Where the identities were found when the folder was last open, the first time they are asked for. */
  private async recall(): Promise<void> {
    if (this.kept !== undefined) return
    const held = await this.places.read().catch(() => undefined) ?? {}
    for (const [id, address] of Object.entries(held)) if (!this.found.has(id)) this.found.set(id, address)
    this.kept = JSON.stringify(held)
  }

  /** Where the identities were found, kept where they are kept, when that moved. */
  private async keepPlaces(): Promise<void> {
    const places = Object.fromEntries([...this.found].sort(([one], [other]) => (one < other ? -1 : 1)))
    const text = JSON.stringify(places)
    if (text === this.kept) return
    this.kept = text
    await this.places.write(places).catch((cause: unknown) => {
      this.diagnostics?.report({ level: 'warn', where: 'folder', message: 'where the scopes were found could not be kept', cause })
    })
  }

  /** The organisation of a folder nobody has written a header into: there, empty, and named nothing. */
  private bareRoot(): FolderNode {
    return {
      id: identityAt(ROOT_SCOPE),
      address: ROOT_SCOPE,
      header: {},
      summary: { path: ROOT_SCOPE, name: '', diagrams: 0, children: [] },
    }
  }

  /**
   * The scope with this identity, where it is now: where it was last found,
   * when its header there still says so, and otherwise wherever a walk finds it.
   */
  async resolve(id: ScopeId): Promise<FolderNode | undefined> {
    const address = this.found.get(id)
    if (address !== undefined) {
      const node = await this.nodeAt(address)
      if (node?.id === id) return node
    }
    return (await this.walk()).nodes.find((node) => node.id === id)
  }

  /** The scope at an address, read from its header alone; the organisation is there without one. */
  private async nodeAt(address: ScopeAddress): Promise<FolderNode | undefined> {
    const text = await textAt(this.root, scopeFilePath(address, SCOPE_FILE))
    if (text === undefined) return address === ROOT_SCOPE ? this.bareRoot() : undefined
    const summary = scopeSummaryFrom(text, address)
    if (!summary) return undefined
    const header = headerOf(text) ?? {}
    const id = isScopeId(header[ID_KEY]) ? header[ID_KEY] : identityAt(address)
    return { id, address, header, summary }
  }

  /** The files the pictures folder of a scope holds, by name, and nothing read. */
  async pictureFilesOf(address: ScopeAddress): Promise<PictureFile[]> {
    const folder = await folderAt(this.root, scopeFilePath(address, PICTURES))
    if (!folder) return []
    const files = (await filesUnder(folder, (name) => name.startsWith('.')))
      .filter(({ path }) => !path.split('/').some((segment) => segment.startsWith('.')))
      .filter(({ path }) => imageMediaType(path) !== undefined)
    // What each file is, as the handle says it without its bytes being read:
    // main's look at the file on the desktop, a browser's lazy `File`.
    return Promise.all(files.map(async ({ path, handle }): Promise<PictureFile> => {
      const stamp = await stampOf(handle)
      return { file: path, ...(stamp ? { stamp, size: stamp.size } : {}) }
    }))
  }

  /** The entry for a file no row names, from its bytes — read once, and remembered by where the file is. */
  private async describe(address: ScopeAddress, file: PictureFile, name: ImageName): Promise<ImageEntry | undefined> {
    // One picture that will not read is left out of the library and said; the rest of the scope reads.
    const bytes = await bytesAt(this.root, scopeFilePath(address, `${PICTURES}/${file.file}`)).catch((cause: unknown) => {
      this.diagnostics?.report({ level: 'warn', where: 'folder', message: 'a picture could not be read', cause })
      return undefined
    })
    if (!bytes) return undefined
    const entry = await imageEntryOf(name, bytes)
    if (file.stamp) this.note(address, file.file, file.stamp, entry)
    return entry
  }

  /** What this machine has described, read once from where it is kept. */
  private async stamped(): Promise<Map<string, Described>> {
    this.described ??= new Map(Object.entries(await this.stamps.read().catch(() => undefined) ?? {}))
    return this.described
  }

  /** A picture found to be an entry at a stamp, remembered on this machine. */
  private note(address: ScopeAddress, file: string, stamp: PictureStamp, entry: ImageEntry): void {
    this.described?.set(`${address}\u0000${file}`, {
      ...stamp, contentAddress: entry.contentAddress, width: entry.width, height: entry.height,
    })
    this.unkept = true
  }

  /** What this machine has described, kept where it is kept, where it changed. */
  private async keepStamps(): Promise<void> {
    if (!this.unkept || !this.described) return
    this.unkept = false
    await this.stamps.write(Object.fromEntries(this.described)).catch((cause: unknown) => {
      this.diagnostics?.report({ level: 'warn', where: 'folder', message: 'what was found of the pictures could not be kept', cause })
    })
  }

  /** A scope's library from its rows and the files in its pictures folder, as this machine knows them. */
  private async libraryFrom(address: ScopeAddress, rows: KeptPicture[], files: PictureFile[]): Promise<KeptPicture[]> {
    const described = await this.stamped()
    const library = await libraryOf(rows, {
      files,
      describe: (file, name) => this.describe(address, file, name),
      seen: (file) => {
        const held = described.get(`${address}\u0000${file.file}`)
        if (!held || !file.stamp) return undefined
        return sameStamp(held, file.stamp) ? { unchanged: held } : { changed: true }
      },
      trust: (file, entry) => {
        if (file.stamp) this.note(address, file.file, file.stamp, entry)
      },
    })
    await this.keepStamps()
    return library
  }

  /** A picture just written, remembered at the stamp it has now, so the next read need not read it. */
  async written(address: ScopeAddress, file: string, entry: ImageEntry): Promise<void> {
    const handle = await fileAt(this.root, scopeFilePath(address, `${PICTURES}/${file}`))
    const stamp = handle ? await stampOf(handle) : undefined
    await this.stamped()
    if (stamp) this.note(address, file, stamp, entry)
    await this.keepStamps()
  }

  /** A scope's picture library as its folder holds it now. */
  async libraryOf(address: ScopeAddress, snapshot: ScopeSnapshot | undefined): Promise<{ library: KeptPicture[]; files: PictureFile[] }> {
    const files = await this.pictureFilesOf(address)
    const library = await this.libraryFrom(address, rowsOf(snapshot?.carried?.[LIBRARY_KEY]), files)
    return { library, files }
  }

  /** One scope's picture library, from its header and the names in its pictures folder alone. */
  async libraryAt(id: ScopeId): Promise<{ node: FolderNode; library: KeptPicture[] } | undefined> {
    const node = await this.resolve(id)
    if (!node) return undefined
    const files = await this.pictureFilesOf(node.address)
    const library = await this.libraryFrom(node.address, rowsOf(node.header[LIBRARY_KEY]), files)
    return { node, library }
  }

  /** One scope's state, read now; `undefined` where no scope has this identity. */
  async read(id: ScopeId): Promise<ReadScope | undefined> {
    const node = await this.resolve(id)
    if (!node) return undefined
    const bare = Object.keys(node.header).length === 0
    const snapshot = bare ? undefined : await this.store.load(node.address)
    if (!bare && !snapshot) return undefined
    const { library, files } = await this.libraryOf(node.address, snapshot)
    const stored = snapshot?.revision ?? ''
    const state = stateFrom(node, snapshot, library, revisionOf(node.address, stored, library))
    return { node, state, snapshot, library, files, ...(snapshot?.revision !== undefined ? { stored } : {}) }
  }

  /** Forget what was described of a scope's pictures: its folder has moved or gone. */
  forget(address: ScopeAddress): void {
    for (const key of this.described?.keys() ?? []) {
      if (key.startsWith(`${address}\u0000`) || key.startsWith(`${address}/`)) {
        this.described!.delete(key)
        this.unkept = true
      }
    }
  }
}

/** The state a scope's snapshot, header and library say, in the domain's words. */
export function stateFrom(
  node: FolderNode, snapshot: ScopeSnapshot | undefined, library: readonly KeptPicture[], revision: Revision,
): ScopeState {
  const content = snapshot ?? { ...emptyContent(node.summary.name), activeDiagramId: '', logoLibrary: [] }
  const active = node.header['activeDiagramId']
  return {
    id: node.id,
    address: composed(node.address),
    revision,
    ...(snapshot?.updatedAt ? { updatedAt: snapshot.updatedAt } : {}),
    ...(snapshot?.unreadable?.length ? { unreadable: [...snapshot.unreadable] } : {}),
    model: namesInDocuments(content.model, pictureFiles(library).nameOf),
    images: library.map(({ entry }) => ({ ...entry })),
    ...(content.kind !== undefined ? { kind: content.kind } : {}),
    ...(content.client !== undefined ? { client: content.client } : {}),
    ...(content.links !== undefined ? { links: content.links } : {}),
    ...(typeof active === 'string' && active !== '' ? { activeDiagramId: active } : {}),
    ...(content.logoLibrary.length ? { logoLibrary: content.logoLibrary } : {}),
  }
}

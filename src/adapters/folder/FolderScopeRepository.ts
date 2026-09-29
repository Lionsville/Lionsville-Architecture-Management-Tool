// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The scopes of a folder, as a scope repository (ADR-0031 §1, §2).
 *
 * **A step is a write of the files it changed.** Steps are applied by the one
 * writer (`applySteps`) to the state the folder holds, and the state that
 * comes out is written by the folder store, which writes only the files that
 * differ — so a step that changes nothing writes nothing, and moves no
 * revision.
 *
 * **Several scopes, all or none.** Every scope's steps are applied, and every
 * refusal made, before anything is written; then the folder store writes
 * every scope's files together, staged before any is moved into place where
 * the folder can do that (`FileSystemScopeStore.saveTogether`). What a stop
 * part way can leave is what that write can leave: on the desktop, some of the
 * files moved into place and the rest staged beside them; in a browser, or
 * over a handle that cannot rename, some scopes written and some not. The
 * pictures follow the scopes' files, and a step id is remembered after both:
 * a stop between leaves a picture's entry without its file, which answers no
 * bytes until they are put again, and a step that landed and is sent again is
 * applied again — a create refused as taken, which the sender reads as the
 * state it asked for.
 *
 * **A move moves everything**: the scope's folder and the scopes under it —
 * the format's files, the pictures, the settings and whatever a person keeps
 * there, links and empty folders included. Where the folder can rename one
 * (the desktop's main process), it is one rename, and no byte passes through
 * the page; where it cannot, every file is copied to the new address and then
 * removed from the old, so a stop part way leaves two copies, which a person
 * can see and settle, and never none. Each scope's identity goes with it,
 * written into its header where it was not yet.
 */
import { contentAddressOf, imageName, imageNameKey } from '../../model/imageName'
import type { ImageEntry } from '../../model/imageName'
import { stableJson } from '../../projects/text'
import type { ScopeSnapshot } from '../../projects/scope'
import { fingerprint } from '../../projects/revision'
import { ancestorScopes, isSafeScopePath, isWithinScope, ROOT_SCOPE, scopeFilePath, scopePathLabel } from '../../projects/scopePath'
import { applySteps, emptyContent, putsBackWhole, STEP_ELSEWHERE } from '../../projects/scopeState'
import type { ScopeAddress, ScopeContent, ScopeId, ScopeState, ScopeStep } from '../../projects/scopeState'
import { reasonOf, ShellError } from '../../platform/errors'
import type {
  Applied, Created, Moved, NewScope, Refused, Removed, ScopeNode, ScopeRepository, ScopeTree, StepsFor,
} from '../../ports/ScopeRepository'
import { usablePath } from './FileSystemScopeStore'
import { fileFor, foldersOf, LIBRARY_KEY, pictureFiles, picturePath, rowsFor, rowsOf } from './folderPictures'
import type { KeptPicture, PictureStaging } from './folderPictures'
import { composed, headerOf, ID_KEY, newIdentity } from './folderScopes'
import type { FolderNode, FolderScopes, ReadScope } from './folderScopes'
import { bytesAt, createAt, filesUnder, folderAt, removeAt, textAt, writeAt } from './handles'
import { filesInDocuments } from './format/imageLibrary'
import type { StepMemory } from './stepMemory'
import { SCOPE_FILE } from './format/folderFormat'

/** One scope's new steps; `whole` where it was not read whole and the run puts it back (`ScopeState.unreadable`). */
type Run = { read: ReadScope; steps: ScopeStep[]; whole: boolean }

type Planned = {
  read: ReadScope; content: ScopeContent; library: KeptPicture[]; snapshot: ScopeSnapshot; steps: ScopeStep[]; whole: boolean
}

/** A write of a picture, to be put back: the file as it was, or nothing where there was none. */
type Undo = { path: string; before?: Uint8Array }

/** What a state holds that its steps change. */
function contentOf(state: ScopeState): ScopeContent {
  const { id: _id, address: _address, revision: _revision, updatedAt: _updatedAt, unreadable: _unreadable, ...content } = state
  return content
}

/**
 * What a run starts from: the scope, less a picture no row names that one of
 * the run's steps adds as it is — the very same name, not one that differs
 * only in case, and the same bytes. A write that stopped after a picture's
 * bytes and before the rows naming them leaves one (`write`), and the step
 * sent again adds what is already there.
 */
function startOf(read: ReadScope, steps: readonly ScopeStep[]): ScopeContent {
  const content = contentOf(read.state)
  const keyOf = (entry: ImageEntry) => `${entry.name}\u0000${entry.contentAddress}`
  const added = new Set(steps.flatMap(({ command }) => (command.type === 'image.add' ? [keyOf(command.image)] : [])))
  if (added.size === 0) return content
  const rows = new Set(rowsOf(read.snapshot?.carried?.[LIBRARY_KEY]).map((row) => imageName(row.file)))
  const left = new Set(read.library.filter((kept) => !rows.has(imageName(kept.file)) && added.has(keyOf(kept.entry))).map((kept) => keyOf(kept.entry)))
  return left.size === 0 ? content : { ...content, images: content.images.filter((image) => !left.has(keyOf(image))) }
}

/**
 * The library after a run: each entry kept as the file it was, and a new one
 * filed where a case-blind disk would put it — in the very file of an entry
 * the run took out whose file differs from it only in case. There is no step
 * that renames a picture: a change of case alone is one taken out and one
 * added, and on a disk that does not tell case apart the two are one file,
 * which is kept, and never written as one name and removed as the other.
 */
function nextLibrary(was: readonly KeptPicture[], entries: readonly ImageEntry[]): KeptPicture[] {
  const files = new Map(was.map((kept) => [kept.entry.name, kept.file]))
  const staying = new Set(entries.map((entry) => entry.name))
  const freed = new Map(was.filter((kept) => !staying.has(kept.entry.name)).map((kept) => [imageNameKey(kept.file), kept.file]))
  const folders = foldersOf(was.map((kept) => kept.file))
  return entries.map((entry) => {
    const held = files.get(entry.name)
    if (held !== undefined) return { entry, file: held }
    const filed = fileFor(entry.name, folders)
    return { entry, file: freed.get(imageNameKey(filed)) ?? filed }
  })
}

/**
 * A scope's state as the folder store writes it: the documents' pictures as
 * files, the library and the identity in the header. Put back `whole`, it
 * says nothing of the files a read did not take in: the content is all the
 * scope is to be, and those files are the format's to write over or remove.
 */
function snapshotFor(
  node: FolderNode, content: ScopeContent, was: ReadScope | undefined, library: readonly KeptPicture[], whole = false,
): ScopeSnapshot {
  const model = filesInDocuments(content.model, was?.snapshot?.model, pictureFiles(library, was?.library ?? []))
  const { [LIBRARY_KEY]: _rows, ...carried } = { ...was?.snapshot?.carried }
  return {
    path: node.address,
    model,
    activeDiagramId: content.activeDiagramId ?? '',
    logoLibrary: content.logoLibrary ?? [],
    ...(content.kind !== undefined ? { kind: content.kind } : {}),
    ...(content.client !== undefined ? { client: content.client } : {}),
    ...(content.links !== undefined ? { links: content.links } : {}),
    ...(was?.snapshot?.unread && !whole ? { unread: was.snapshot.unread } : {}),
    carried: { ...carried, [ID_KEY]: node.id, ...(library.length ? { [LIBRARY_KEY]: rowsFor(library) } : {}) },
  }
}

/** A new scope's snapshot: an empty model, named, and what it says about itself. */
function newSnapshot(address: ScopeAddress, id: ScopeId, scope: NewScope): ScopeSnapshot {
  const { name, ...description } = scope
  const node: FolderNode = { id, address, header: {}, summary: { path: address, name, diagrams: 0, children: [] } }
  return snapshotFor(node, emptyContent(name, description), undefined, [])
}

/** Where a refusal the folder store threw is one a caller can do something about, the answer that says so. */
function refusalOf(cause: unknown, scope: ScopeId): Refused | undefined {
  if (!(cause instanceof ShellError)) return undefined
  if (cause.key === 'shell.scopeMoved' || cause.key === 'shell.unreadableNotSaved') return { refused: cause.key, scope }
  return undefined
}

export class FolderScopeRepository implements ScopeRepository {
  readonly id = 'folder'

  private readonly folder: FolderScopes
  private readonly applied: StepMemory
  private readonly staging: PictureStaging

  constructor(
    folder: FolderScopes,
    applied: StepMemory,
    staging: PictureStaging,
  ) {
    this.folder = folder
    this.applied = applied
    this.staging = staging
  }

  async tree(): Promise<ScopeTree> {
    const { nodes, unreadable } = await this.folder.walk(true)
    const byAddress = new Map(nodes.map((node) => [node.address, node]))
    const parentOf = (address: ScopeAddress) => ancestorScopes(address).map((above) => byAddress.get(above)).find(Boolean)
    const told = (node: FolderNode): Omit<ScopeNode, 'children' | 'updatedAt'> => {
      const { summary } = node
      const parent = node.address === ROOT_SCOPE ? undefined : parentOf(node.address)
      return {
        id: node.id, address: composed(node.address), name: summary.name, diagrams: summary.diagrams,
        ...(parent ? { parent: parent.id } : {}),
        ...(summary.kind !== undefined ? { kind: summary.kind } : {}),
        ...(summary.client !== undefined ? { client: summary.client } : {}),
        ...(summary.description !== undefined ? { description: summary.description } : {}),
        ...(summary.links !== undefined ? { links: summary.links } : {}),
      }
    }
    const build = (node: FolderNode): ScopeNode => ({
      ...told(node),
      ...(node.updatedAt ? { updatedAt: node.updatedAt } : {}),
      children: nodes.filter((child) => child !== node && child.address !== ROOT_SCOPE && parentOf(child.address) === node)
        .sort((one, other) => (one.address < other.address ? -1 : 1))
        .map(build),
    })
    const revision = fingerprint(['tree', ...nodes.map((node) => stableJson(told(node))).sort(), ...unreadable])
    return { revision, root: build(byAddress.get(ROOT_SCOPE)!), ...(unreadable.length ? { unreadable } : {}) }
  }

  async state(scope: ScopeId): Promise<ScopeState | undefined> {
    return (await this.folder.read(scope))?.state
  }

  apply(work: readonly StepsFor[]): Promise<Applied | Refused> {
    return this.folder.serial(async () => {
      const runs = await this.runs(work)
      if (!(runs instanceof Map)) return runs
      const planned: Planned[] = []
      for (const { read, steps, whole } of runs.values()) {
        const result = applySteps(startOf(read, steps), steps)
        if (!result.ok) return { refused: result.refused, scope: read.node.id, stepId: result.stepId }
        const missing = this.bytesMissing(read, result.content.images, steps)
        if (missing) return { refused: 'shell.imageBytesGone', scope: read.node.id, ...(missing.stepId ? { stepId: missing.stepId } : {}) }
        if (!result.changed && !whole) continue
        const library = nextLibrary(read.library, result.content.images)
        const snapshot = snapshotFor(read.node, result.content, read, library, whole)
        planned.push({ read, content: result.content, library, snapshot, steps, whole })
      }
      const pending = await this.expectations(planned)
      await this.applied.pend(pending)
      // A write refused wrote nothing: none of its steps was applied. One that
      // threw may have written some scopes, and its steps stay pending for a
      // step sent again to find out which.
      const refused = await this.write(planned)
      if (refused) {
        await this.applied.forget(pending.map((one) => one.stepId))
        return refused
      }
      await this.applied.remember(work.flatMap(({ scope, steps }) => steps.map((one) => ({ stepId: one.stepId, scope }))))
      const revisions = new Map<ScopeId, string>()
      for (const { scope } of work) {
        if (!revisions.has(scope)) revisions.set(scope, (await this.folder.read(scope))?.state.revision ?? '')
      }
      return { revisions: work.map(({ scope }) => revisions.get(scope)!) }
    })
  }

  /**
   * The scope a step landed on, where it did: one remembered as landed, or one
   * whose write was begun and whose scope is now what that write was to leave
   * it at. A step whose write was begun and did not land counts nowhere.
   */
  private async landedWhere(stepId: string): Promise<ScopeId | undefined> {
    const place = await this.applied.where(stepId)
    if (!place) return undefined
    if (place.expected === undefined) return place.scope
    const now = await this.folder.read(place.scope)
    return now?.stored === place.expected ? place.scope : undefined
  }

  /**
   * Each scope's new steps, its runs one after the other, or the refusal met
   * on the way: a scope gone, or not read whole and not put back by the run;
   * a step id this folder applied to another scope; a revision moved on from.
   */
  private async runs(work: readonly StepsFor[]): Promise<Map<ScopeId, Run> | Refused> {
    const runs = new Map<ScopeId, Run>()
    const reads = new Map<ScopeId, ReadScope>()
    const seen = new Map<string, ScopeId>()
    for (const { scope, steps, expects } of work) {
      const read = reads.get(scope) ?? await this.folder.read(scope)
      if (!read) return { refused: 'shell.scopeGone', scope }
      if (!reads.has(scope)) await this.applied.promote(scope, read.stored)
      reads.set(scope, read)
      const fresh: ScopeStep[] = []
      for (const one of steps) {
        const place = seen.has(one.stepId) ? seen.get(one.stepId) : await this.landedWhere(one.stepId)
        if (place !== undefined && place !== scope) return { refused: STEP_ELSEWHERE, scope, stepId: one.stepId }
        if (place === undefined) fresh.push(one)
        seen.set(one.stepId, scope)
      }
      const partly = read.state.unreadable !== undefined
      if (partly && !runs.has(scope) && !putsBackWhole(fresh)) return { refused: 'shell.unreadableNotSaved', scope }
      if (fresh.length === 0) continue
      if (expects !== undefined && expects !== read.state.revision) return { refused: 'shell.scopeMoved', scope }
      const run = runs.get(scope) ?? { read, steps: [], whole: partly }
      run.steps.push(...fresh)
      runs.set(scope, run)
    }
    return runs
  }

  /**
   * The first content address the library newly names whose bytes are not
   * put for the scope, and the step that named it: a step never names bytes
   * that are not here (`shell.imageBytesGone`), so no row ever waits for its
   * bytes. One the library named already is there: its file is (`libraryOf`).
   */
  private bytesMissing(
    read: ReadScope, images: readonly ImageEntry[], steps: readonly ScopeStep[],
  ): { address: string; stepId?: string } | undefined {
    const named = new Set(read.library.map(({ entry }) => entry.contentAddress))
    const address = images.map((image) => image.contentAddress)
      .find((one) => !named.has(one) && !this.staging.get(read.node.id, one))
    if (address === undefined) return undefined
    const naming = steps.find(({ command }) => command.type === 'image.add' && command.image.contentAddress === address)
    return { address, ...(naming ? { stepId: naming.stepId } : {}) }
  }

  /** Each planned step, with what its scope's files are to be fingerprinted as once the write has landed. */
  private async expectations(planned: readonly Planned[]): Promise<{ stepId: string; scope: ScopeId; expected: string }[]> {
    const found: { stepId: string; scope: ScopeId; expected: string }[] = []
    for (const { read, snapshot, steps, whole } of planned) {
      const expected = await this.folder.store.revisionAfter(snapshot, whole)
      for (const one of steps) found.push({ stepId: one.stepId, scope: read.node.id, expected })
    }
    return found
  }

  /**
   * Every planned scope's new pictures, then the scopes written together, then
   * the pictures no entry keeps any more removed; a refusal the folder store
   * met, said as one. Bytes before the rows that name them: a write that
   * stops in between leaves a picture no row names, which the library reads
   * as a file of its own, and never a row whose file is not there, which it
   * would drop without a word. A refused write puts back what it wrote, and so
   * wrote nothing.
   */
  private async write(planned: readonly Planned[]): Promise<Refused | undefined> {
    if (planned.length === 0) return undefined
    const entries = planned.map(({ read, snapshot, whole }) => ({
      scope: snapshot,
      ...(read.stored !== undefined ? { expects: read.stored } : {}),
      ...(whole ? { whole } : {}),
    }))
    const undo: Undo[] = []
    for (const { read, library } of planned) {
      const refused = await this.picturesIn(read, library, undo)
      if (refused) {
        await this.undo(undo)
        return refused
      }
    }
    try {
      await this.folder.store.saveTogether(entries)
    } catch (cause) {
      const refused = refusalOf(cause, planned[0].read.node.id)
      if (!refused) throw cause
      await this.undo(undo)
      return refused
    }
    for (const { read, library } of planned) await this.picturesOut(read, library)
    return undefined
  }

  /**
   * The files of a library about to be written whose bytes are not there yet:
   * each from the bytes put for it, or from another file with the same bytes.
   * One not there is made only where nothing is at its path — a file somebody
   * dropped there meanwhile is never written over: one holding these very
   * bytes is taken as this picture's, and any other refuses the write, as a
   * scope changed meanwhile does. One there, which the run gave other bytes,
   * is written over. What each write did is noted, to be put back.
   */
  private async picturesIn(read: ReadScope, library: readonly KeptPicture[], undo: Undo[]): Promise<Refused | undefined> {
    const { address, id } = read.node
    const there = new Set(read.files.map((file) => file.file))
    const held = new Map(read.library.filter((kept) => there.has(kept.file)).map((kept) => [kept.file, kept.entry.contentAddress]))
    for (const { entry, file } of library) {
      if (held.get(file) === entry.contentAddress) continue
      const same = read.library.find((kept) => kept.entry.contentAddress === entry.contentAddress && there.has(kept.file))
      const bytes = this.staging.get(id, entry.contentAddress)
        ?? (same ? await bytesAt(this.folder.root, picturePath(address, same.file)) : undefined)
      if (!bytes) continue
      const path = picturePath(address, file)
      if (there.has(file)) {
        // Written over only once what it held is in hand to put back: a
        // refused write never takes away a file it cannot give back.
        const before = await bytesAt(this.folder.root, path).catch(() => undefined)
        if (!before) return { refused: 'shell.scopeMoved', scope: id }
        undo.push({ path, before })
        await writeAt(this.folder.root, path, bytes)
      } else if (await createAt(this.folder.root, path, bytes)) {
        undo.push({ path })
      } else if (await contentAddressOf((await bytesAt(this.folder.root, path)) ?? new Uint8Array()) !== entry.contentAddress) {
        return { refused: 'shell.scopeMoved', scope: id }
      }
      await this.folder.written(address, file, entry)
    }
    return undefined
  }

  /** What a refused write wrote, put back: a file it made removed, one it wrote over as it was. */
  private async undo(undo: readonly Undo[]): Promise<void> {
    for (const { path, before } of [...undo].reverse()) {
      await (before ? writeAt(this.folder.root, path, before) : removeAt(this.folder.root, path)).catch(() => undefined)
    }
  }

  /**
   * The files of a library just written that no entry keeps any more,
   * removed — but for one that differs only in case from a file kept where
   * the disk does not tell case apart, which is that file. The folder says
   * which: listed now, it holds both names where they are two files, and one
   * of them where they are one. One that will not go is said, and the
   * scope's files are already right.
   */
  private async picturesOut(read: ReadScope, library: readonly KeptPicture[]): Promise<void> {
    const wanted = new Set(library.map((kept) => kept.file))
    const byKey = new Map(library.map((kept) => [imageNameKey(kept.file), kept.file]))
    const gone = read.files.map(({ file }) => file).filter((file) => !wanted.has(file))
    const listed = gone.some((file) => byKey.has(imageNameKey(file))) ? await this.picturesNow(read.node.address) : new Set<string>()
    try {
      for (const file of gone) {
        const kept = byKey.get(imageNameKey(file))
        if (kept !== undefined && !listed.has(kept)) continue
        await removeAt(this.folder.root, picturePath(read.node.address, file))
      }
    } catch (cause) {
      this.folder.diagnostics?.report({ level: 'warn', where: 'folder', message: `a picture could not be kept: ${reasonOf(cause)}`, cause })
    }
  }

  /** The files a scope's pictures folder holds now, by their paths inside it. */
  private async picturesNow(address: ScopeAddress): Promise<Set<string>> {
    const folder = await folderAt(this.folder.root, picturePath(address, '').replace(/\/$/, ''))
    return new Set(folder ? (await filesUnder(folder)).map(({ path }) => path) : [])
  }

  create(at: ScopeAddress, scope: NewScope): Promise<Created | Refused> {
    return this.folder.serial(async () => {
      if (!isSafeScopePath(at) || !usablePath(at)) return { refused: 'shell.badScopePath' }
      const { nodes, unreadable } = await this.folder.walk()
      const taken = new Set(nodes.map((node) => composed(node.address)))
      if (taken.has(composed(at)) || unreadable.some((held) => isWithinScope(at, held))) return { refused: 'shell.scopeTaken' }
      const made = ancestorScopes(at).reverse().filter((above) => above !== ROOT_SCOPE && !taken.has(above))
        .map((above) => newSnapshot(above, newIdentity(), { name: scopePathLabel(above) }))
      const id = newIdentity()
      await this.folder.store.saveTogether([...made, newSnapshot(at, id, scope)].map((snapshot) => ({ scope: snapshot })))
      const read = await this.folder.read(id)
      return { id, revision: read!.state.revision }
    })
  }

  move(scope: ScopeId, to: ScopeAddress, expects?: string): Promise<Moved | Refused> {
    return this.folder.serial(async () => {
      const node = await this.folder.resolve(scope)
      if (!node) return { refused: 'shell.scopeGone', scope }
      if (node.address === ROOT_SCOPE || !isSafeScopePath(to) || !usablePath(to)) return { refused: 'shell.badScopePath', scope }
      if (isWithinScope(to, node.address)) return { refused: 'shell.scopeIntoItself', scope }
      const { nodes, unreadable } = await this.folder.walk()
      const occupied = await folderAt(this.folder.root, to).catch(() => undefined)
      if (occupied || nodes.some((held) => composed(held.address) === composed(to)) || unreadable.some((held) => isWithinScope(to, held))) {
        return { refused: 'shell.scopeTaken', scope }
      }
      if (expects !== undefined && (await this.folder.read(scope))?.state.revision !== expects) {
        return { refused: 'shell.scopeMoved', scope }
      }
      const taken = new Set(nodes.map((held) => composed(held.address)))
      const made = ancestorScopes(to).reverse().filter((above) => above !== ROOT_SCOPE && !taken.has(above))
        .map((above) => ({ scope: newSnapshot(above, newIdentity(), { name: scopePathLabel(above) }) }))
      if (made.length) await this.folder.store.saveTogether(made)
      await this.carry(node.address, to, nodes.filter((held) => isWithinScope(held.address, node.address)))
      return { revision: (await this.folder.read(scope))!.state.revision }
    })
  }

  /**
   * Every file under one address copied to another, each scope's identity
   * written into its header on the way where it was not, and then the old
   * folder removed.
   */
  private async carry(from: ScopeAddress, to: ScopeAddress, moving: readonly FolderNode[]): Promise<void> {
    const { root } = this.folder
    const renamed = root.moveEntry ? await root.moveEntry(from, to).then(() => true, (cause: unknown) => {
      // A rename the disk will not make — across two volumes — is a copy instead.
      this.folder.diagnostics?.report({ level: 'warn', where: 'folder', message: 'a scope could not be moved as one rename', cause })
      return false
    }) : false
    if (renamed) {
      for (const node of moving) {
        if (node.header[ID_KEY] === node.id) continue
        const path = scopeFilePath(`${to}${node.address.slice(from.length)}`, SCOPE_FILE)
        const header = headerOf(await textAt(root, path))
        if (header) await writeAt(root, path, stableJson({ ...header, [ID_KEY]: node.id }))
      }
      for (const node of moving) this.folder.forget(node.address)
      return
    }
    const source = await folderAt(root, from)
    const files = source ? await filesUnder(source, (name, within) => name === '.git' && within === '') : []
    const headers = new Map(moving.map((node) => [scopeFilePath(node.address.slice(from.length + 1), SCOPE_FILE), node]))
    const writes: { path: string; data: string | Uint8Array }[] = []
    for (const { path, handle } of files) {
      let data: string | Uint8Array = new Uint8Array(await (await handle.getFile()).arrayBuffer())
      const node = headers.get(path)
      if (node && node.header[ID_KEY] !== node.id) {
        const header = headerOf(new TextDecoder().decode(data))
        if (header) data = stableJson({ ...header, [ID_KEY]: node.id })
      }
      writes.push({ path: `${to}/${path}`, data })
    }
    if (root.writeTogether) await root.writeTogether(writes, [])
    else for (const { path, data } of writes) await writeAt(root, path, data)
    await removeAt(root, from, true)
    for (const node of moving) this.folder.forget(node.address)
  }

  remove(scope: ScopeId, expects?: string): Promise<Removed | Refused> {
    return this.folder.serial(async () => {
      const node = await this.folder.resolve(scope)
      if (!node) return { removed: [] }
      if (node.address === ROOT_SCOPE) return { refused: 'shell.badScopePath', scope }
      if (expects !== undefined && (await this.folder.read(scope))?.state.revision !== expects) {
        return { refused: 'shell.scopeMoved', scope }
      }
      const removed = (await this.folder.walk()).nodes
        .filter((held) => isWithinScope(held.address, node.address))
        .map((held) => held.id)
      await this.folder.store.remove(node.address)
      this.staging.drop(removed)
      this.folder.forget(node.address)
      return { removed }
    })
  }
}


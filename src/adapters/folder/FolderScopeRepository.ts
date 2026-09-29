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
 * **A move moves everything**: every file of the scope's folder and of the
 * scopes under it — the format's, the pictures, the settings and whatever a
 * person keeps there — copied to the new address and then removed from the
 * old, so a stop part way leaves two copies, which a person can see and
 * settle, and never none. Each scope's identity goes with it, written into its
 * header where it was not yet.
 */
import type { ImageEntry } from '../../model/imageName'
import { stableJson } from '../../projects/fileText'
import type { ScopeSnapshot } from '../../projects/scope'
import { fingerprint } from '../../projects/revision'
import { ancestorScopes, isSafeScopePath, isWithinScope, ROOT_SCOPE, scopeFilePath, scopePathLabel } from '../../projects/scopePath'
import { applySteps, emptyContent, STEP_ELSEWHERE } from '../../projects/scopeState'
import type { ScopeAddress, ScopeContent, ScopeId, ScopeState, ScopeStep } from '../../projects/scopeState'
import { reasonOf, ShellError } from '../../platform/errors'
import type {
  Applied, Created, Moved, NewScope, Refused, Removed, ScopeNode, ScopeRepository, ScopeTree, StepsFor,
} from '../../ports/ScopeRepository'
import { usablePath } from './FileSystemScopeStore'
import { fileFor, foldersOf, LIBRARY_KEY, pictureFiles, picturePath, rowsFor } from './folderPictures'
import type { KeptPicture, PictureStaging } from './folderPictures'
import { composed, headerOf, ID_KEY, newIdentity } from './folderScopes'
import type { FolderNode, FolderScopes, ReadScope } from './folderScopes'
import { bytesAt, filesUnder, folderAt, removeAt, writeAt } from './handles'
import { filesInDocuments } from './imageLibrary'
import type { StepMemory } from './stepMemory'
import { SCOPE_FILE } from '../../projects/folderFormat'

type Run = { read: ReadScope; steps: ScopeStep[] }

type Planned = { read: ReadScope; content: ScopeContent; library: KeptPicture[]; snapshot: ScopeSnapshot; steps: ScopeStep[] }

/** What a state holds that its steps change. */
function contentOf(state: ScopeState): ScopeContent {
  const { id: _id, address: _address, revision: _revision, updatedAt: _updatedAt, unreadable: _unreadable, ...content } = state
  return content
}

/** The library after a step: each entry kept as the file it was, and a new one filed where a case-blind disk would put it. */
function nextLibrary(was: readonly KeptPicture[], entries: readonly ImageEntry[]): KeptPicture[] {
  const files = new Map(was.map((kept) => [kept.entry.name, kept.file]))
  const folders = foldersOf(was.map((kept) => kept.file))
  return entries.map((entry) => ({ entry, file: files.get(entry.name) ?? fileFor(entry.name, folders) }))
}

/** A scope's state as the folder store writes it: the documents' pictures as files, the library and the identity in the header. */
function snapshotFor(node: FolderNode, content: ScopeContent, was: ReadScope | undefined, library: readonly KeptPicture[]): ScopeSnapshot {
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
    ...(was?.snapshot?.unread ? { unread: was.snapshot.unread } : {}),
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

  constructor(
    private readonly folder: FolderScopes,
    private readonly applied: StepMemory,
    private readonly staging: PictureStaging,
  ) {}

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
      for (const { read, steps } of runs.values()) {
        const result = applySteps(contentOf(read.state), steps)
        if (!result.ok) return { refused: result.refused, scope: read.node.id, stepId: result.stepId }
        if (!result.changed) continue
        const library = nextLibrary(read.library, result.content.images)
        planned.push({ read, content: result.content, library, snapshot: snapshotFor(read.node, result.content, read, library), steps })
      }
      await this.applied.pend(await this.expectations(planned))
      const refused = await this.write(planned)
      if (refused) return refused
      await this.applied.remember(work.flatMap(({ scope, steps }) => steps.map((one) => ({ stepId: one.stepId, scope }))))
      const revisions = new Map<ScopeId, string>()
      for (const { scope } of work) {
        if (!revisions.has(scope)) revisions.set(scope, (await this.folder.read(scope))?.state.revision ?? '')
      }
      return { revisions: work.map(({ scope }) => revisions.get(scope)!) }
    })
  }

  /**
   * Each scope's new steps, its runs one after the other, or the refusal met
   * on the way: a scope gone or not read whole, a step id this folder applied
   * to another scope, a revision moved on from.
   */
  private async runs(work: readonly StepsFor[]): Promise<Map<ScopeId, Run> | Refused> {
    const runs = new Map<ScopeId, Run>()
    const reads = new Map<ScopeId, ReadScope>()
    const seen = new Map<string, ScopeId>()
    for (const { scope, steps, expects } of work) {
      const read = reads.get(scope) ?? await this.folder.read(scope)
      if (!read) return { refused: 'shell.scopeGone', scope }
      reads.set(scope, read)
      if (read.state.unreadable) return { refused: 'shell.unreadableNotSaved', scope }
      const fresh: ScopeStep[] = []
      for (const one of steps) {
        const place = seen.has(one.stepId) ? { scope: seen.get(one.stepId)! } : await this.applied.where(one.stepId)
        if (place !== undefined && place.scope !== scope) return { refused: STEP_ELSEWHERE, scope, stepId: one.stepId }
        // A write begun and not known to have landed landed where the scope is what it was to be.
        const landed = place !== undefined && (place.expected === undefined || place.expected === read.stored)
        if (!landed) fresh.push(one)
        seen.set(one.stepId, scope)
      }
      if (fresh.length === 0) continue
      if (expects !== undefined && expects !== read.state.revision) return { refused: 'shell.scopeMoved', scope }
      const run = runs.get(scope) ?? { read, steps: [] }
      run.steps.push(...fresh)
      runs.set(scope, run)
    }
    return runs
  }

  /** Each planned step, with what its scope's files are to be fingerprinted as once the write has landed. */
  private async expectations(planned: readonly Planned[]): Promise<{ stepId: string; scope: ScopeId; expected: string }[]> {
    const found: { stepId: string; scope: ScopeId; expected: string }[] = []
    for (const { read, snapshot, steps } of planned) {
      const expected = await this.folder.store.revisionAfter(snapshot)
      for (const one of steps) found.push({ stepId: one.stepId, scope: read.node.id, expected })
    }
    return found
  }

  /** Every planned scope written together, then its pictures; a refusal the folder store met, said as one. */
  private async write(planned: readonly Planned[]): Promise<Refused | undefined> {
    if (planned.length === 0) return undefined
    const entries = planned.map(({ read, snapshot }) => ({
      scope: snapshot,
      ...(read.stored !== undefined ? { expects: read.stored } : {}),
    }))
    try {
      await this.folder.store.saveTogether(entries)
    } catch (cause) {
      const refused = refusalOf(cause, planned[0].read.node.id)
      if (refused) return refused
      throw cause
    }
    for (const { read, library } of planned) await this.pictures(read, library)
    return undefined
  }

  /**
   * The pictures of a library just written: a new entry's file from the bytes
   * put for it, or from another file with the same bytes; and a file no entry
   * keeps any more removed. One that will not go is said, and the scope's
   * files are already right.
   */
  private async pictures(read: ReadScope, library: readonly KeptPicture[]): Promise<void> {
    const { address, id } = read.node
    const there = new Set(read.files.map((file) => file.file))
    const wanted = new Set(library.map((kept) => kept.file))
    try {
      for (const { entry, file } of library) {
        if (there.has(file)) continue
        const same = read.library.find((kept) => kept.entry.contentAddress === entry.contentAddress && there.has(kept.file))
        const bytes = this.staging.get(id, entry.contentAddress)
          ?? (same ? await bytesAt(this.folder.root, picturePath(address, same.file)) : undefined)
        if (bytes) await writeAt(this.folder.root, picturePath(address, file), bytes)
      }
      for (const file of there) if (!wanted.has(file)) await removeAt(this.folder.root, picturePath(address, file))
    } catch (cause) {
      this.folder.diagnostics?.report({ level: 'warn', where: 'folder', message: `a picture could not be kept: ${reasonOf(cause)}`, cause })
    }
    this.folder.forget(address)
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


// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Scopes as folders in a working directory the user chose.
 *
 * A scope is a folder of text files (ADR-0003 for why, and
 * `projects/folderFormat.ts` for the format itself): a real thing the person
 * owns, that can sit in OneDrive, be committed, be read by a version of this
 * tool that does not exist yet. That is a different promise from browser
 * storage, which is a per-browser cache the user cannot see and a "clear site
 * data" can wipe without warning.
 *
 * **The layout is the address, literally**: a scope's folder IS its path, and
 * the scopes under it are the folders inside it that hold a `scope.json` of
 * their own (ADR-0012 §1). What a screen shows is what the file manager shows.
 * That is worth more than any index file — there is no second source of truth
 * to fall out of step, and a scope dropped into the working directory by hand
 * is simply there.
 *
 * **Where one scope ends and the next begins.** A scope's own files are its
 * `scope.json`, its `model.json` and the six folders the format writes into;
 * everything else in the folder belongs to somebody — to the user, or to a
 * scope nested inside. So the walk descends into those six and into nothing
 * else, which is what keeps a parent's save from ever seeing a child's files.
 * The six names are refused to a child scope for exactly this reason
 * (`scopePath.ts`).
 *
 * **Everything is by name, nothing is cached.** A directory listing is the
 * index. Listing costs one small `scope.json` per scope, which is what that
 * file is for; the whole landscape is only read when a scope is opened.
 *
 * **The folder belongs to the user, not to this store.** It writes and removes
 * exactly what `isFormatPath` claims and leaves everything else — a README, a
 * `.git`, a spreadsheet somebody keeps beside the landscape — alone. And it
 * writes a file only when its content has actually changed, so an autosave of
 * an untouched diagram touches no mtime, wakes no watcher and shows up in no
 * `git status`.
 *
 * This adapter deliberately does NOT watch for changes or resolve conflicts.
 * That is `documentSession`'s job in the layer above, which is where it can be
 * tested without a filesystem at all.
 */
import {
  DECISIONS_FOLDER, DOCS_FOLDER, folderFormatVersion, isFormatPath, MODEL_FILE, modelListsFrom, modelUnreadable,
  SCOPE_FILE,
  TRANSITIONS_FOLDER, OBSERVATIONS_FOLDER,
  SCOPE_FOLDERS, SCOPE_FORMAT_VERSION, scopeFiles, scopeSummaryFrom,
} from '../../projects/folderFormat'
import type { FolderFile } from '../../projects/folderFormat'
import { markdownBody } from '../../projects/fileText'
import { OBSERVATION_SUBFOLDERS, observationFromFile } from '../../projects/observationFile'
import type { Observation } from '../../model/observation'
import { isSupersededPath, openScopeFolder } from '../../projects/migrate4to5'
import { folderRevision, scopeMoved } from '../../projects/revision'
import { scopeTree, sortScopes } from '../../projects/scope'
import type { ScopeModel, ScopeSnapshot, ScopeSummary } from '../../projects/scope'
import type { Transition } from '../../model/transition'
import { transitionFromFile } from '../../projects/transitionFile'

import {
  isSafeScopePath, parentScope, ROOT_SCOPE, scopePathLabel, scopeSegments,
} from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import { ShellError } from '../../platform/errors'
import type { ScopeStore } from '../../ports/ScopeStore'
import type { Diagnostics } from '../../ports/Diagnostics'
import type { DirectoryHandleLike, FileHandleLike } from '../../ports/DirectoryHandle'

/**
 * The slice of the File System Access API this store works through.
 *
 * It lives in `ports/DirectoryHandle.ts` now — it is the shape a filling has to
 * show, and the compiler holds the browser's handle, the desktop's over IPC and
 * the fake the suites run on to the same one. Re-exported here because every
 * import of these four names already comes through this file, and because only
 * `app/composition.ts` may name an adapter at all.
 */
export type {
  DirectoryHandleLike, FileHandleLike, FileLike, WritableLike,
} from '../../ports/DirectoryHandle'

/** Text unless the extension says otherwise. Only the bitmaps are bytes. */
function isBinary(path: string): boolean {
  return path.endsWith('.png')
}

/**
 * Reject a path before it becomes a folder.
 *
 * `getDirectoryHandle('..')` throws in a real browser, but this store is also
 * the shape the desktop adapter takes, where the same string becomes a path on
 * someone's disk. Refusing here means the rule is stated once, in the layer
 * that knows what an address may look like, rather than relying on each backend
 * to be strict on its own.
 */
function usablePath(path: ScopePath): boolean {
  if (!isSafeScopePath(path)) return false
  return scopeSegments(path).every((part) =>
    part.length > 0 && part !== '.' && part !== '..' && !/[/\\]/.test(part))
}

/**
 * Is this a folder inside a scope that belongs to the scope, rather than to the
 * user or to a scope nested in it?
 *
 * `decisions/` holds one more level, because an application's records are
 * filed in a folder of their own (numbers are per list); `observations/`
 * holds exactly three, `causes/` (ADR-0021) and `solutions/` and
 * `experiments/` (ADR-0026). A folder the walk does not enter is a folder
 * whose files are written and never read back — which is what a cause looked
 * like before this said so.
 */
function ownFolder(name: string, within: string): boolean {
  if (within === '') return SCOPE_FOLDERS.includes(name)
  if (within === DECISIONS_FOLDER) return true
  return within === OBSERVATIONS_FOLDER && OBSERVATION_SUBFOLDERS.includes(name)
}

/**
 * Is this refusal only the thing not being there?
 *
 * A folder the format may write and has not — no `docs/`, no `transitions/` —
 * and a file removed between the listing and the read are ordinary answers,
 * and `undefined` says them. Anything else a handle throws is a failure: a
 * permission withdrawn, a file a sync client holds open, a disk that is gone.
 * The browser says the first with `NotFoundError` (and `TypeMismatchError` for
 * a file where a folder was asked for); the desktop's handle and the suites'
 * double say it in the message, because an `Error` over IPC loses its name.
 */
function isAbsent(cause: unknown): boolean {
  if (typeof cause !== 'object' || cause === null) return false
  const { name, message } = cause as { name?: unknown; message?: unknown }
  const said = (word: string) => name === word || (typeof message === 'string' && message.startsWith(`${word}:`))
  return said('NotFoundError') || said('TypeMismatchError')
}

/** One file in a scope's folder, with enough to read it, replace it or remove it. */
type Entry = { path: string; name: string; parent: DirectoryHandleLike; handle: FileHandleLike }

export class FileSystemScopeStore implements ScopeStore {
  readonly id = 'folder on disk'

  /**
   * `diagnostics` is where a file that is there and will not read is said.
   * The store still answers without it — a scope with the rest of its files, a
   * listing without that date — because one unreadable file is no reason to
   * refuse a folder; but an answer that quietly left something out is how a
   * decision goes missing and nobody can say why.
   */
  constructor(
    private readonly root: DirectoryHandleLike,
    private readonly diagnostics?: Pick<Diagnostics, 'report'>,
  ) {}

  /**
   * The handler for a read that may meet nothing: `undefined` either way, and
   * said on the trail when it was not absence. The message is what was being
   * read, never which file — a path off the user's disk is theirs.
   */
  private orAbsent(what: string): (cause: unknown) => undefined {
    return (cause) => {
      if (!isAbsent(cause)) this.fault(what, cause)
      return undefined
    }
  }

  private fault(what: string, cause: unknown): void {
    this.diagnostics?.report({ level: 'warn', where: 'folder', message: `${what} could not be read`, cause })
  }

  /** A file's text, or `undefined` where there is no file or it will not read — the second said. */
  private async textOf(handle: FileHandleLike | undefined, what: string): Promise<string | undefined> {
    if (!handle) return undefined
    const file = await handle.getFile().catch(this.orAbsent(what))
    return file?.text().catch(this.orAbsent(what))
  }

  /** When a file was last written, or 0 where that cannot be read — which is said. */
  private async stampOf(handle: FileHandleLike): Promise<number> {
    return (await handle.getFile().catch(this.orAbsent('a file\'s date')))?.lastModified ?? 0
  }

  /**
   * Walk down a path of folder names.
   *
   * `create: false` returns undefined rather than throwing for a folder that is
   * not there, because "no such scope" is an ordinary answer to `load` and
   * `remove` — the same reasoning as the port's `load` returning `undefined`.
   */
  private async folderAt(
    segments: readonly string[], create: boolean,
  ): Promise<DirectoryHandleLike | undefined> {
    let folder = this.root
    for (const segment of segments) {
      try {
        folder = await folder.getDirectoryHandle(segment, { create })
      } catch {
        return undefined
      }
    }
    return folder
  }

  private scopeFolder(path: ScopePath, create: boolean): Promise<DirectoryHandleLike | undefined> {
    return this.folderAt(scopeSegments(path), create)
  }

  /**
   * Every file of the format belonging to ONE scope, with its path inside it.
   *
   * Stops at the six folders the format writes into, which is what keeps a
   * child scope's files out of its parent's save.
   */
  private async entries(folder: DirectoryHandleLike, within = ''): Promise<Entry[]> {
    const found: Entry[] = []
    for await (const entry of folder.values()) {
      const path = within ? `${within}/${entry.name}` : entry.name
      if (entry.kind === 'directory') {
        if (ownFolder(entry.name, within)) found.push(...await this.entries(entry, path))
        continue
      }
      // A header an older format wrote is read so it can be folded, and
      // removed on the first save because the format no longer writes it.
      if (isFormatPath(path) || isSupersededPath(path)) {
        found.push({ path, name: entry.name, parent: folder, handle: entry })
      }
    }
    return found
  }

  private async read(entry: Entry): Promise<FolderFile | undefined> {
    try {
      const file = await entry.handle.getFile()
      return isBinary(entry.path)
        ? { path: entry.path, bytes: new Uint8Array(await file.arrayBuffer()) }
        : { path: entry.path, text: await file.text() }
    } catch (cause) {
      // Half a write, a file removed under us, permission withdrawn. The rest
      // of the scope is still worth reading — and all but the second is said.
      return this.orAbsent('a file of the scope')(cause)
    }
  }

  /**
   * Every folder holding a header, and where it is.
   *
   * A header is a `scope.json` or — until the tree has been through the 4 → 5
   * pass — one of the two files it replaced. A folder that still holds one of
   * those is walked and listed, because a scope you cannot see is a scope you
   * cannot ask to be migrated.
   *
   * A dot-folder is never a scope: `.git` is the history and
   * `.lionsville-architecture` is the settings (ADR-0005), and neither is one
   * however it is spelled.
   */
  private async walk(
    folder: DirectoryHandleLike,
    segments: string[],
    visit: (held: { folder: DirectoryHandleLike; path: ScopePath; header: FileHandleLike; current: boolean }) => Promise<void>,
  ): Promise<void> {
    const children: DirectoryHandleLike[] = []
    let header: FileHandleLike | undefined
    let older: FileHandleLike | undefined
    for await (const entry of folder.values()) {
      if (entry.kind === 'directory') {
        if (!entry.name.startsWith('.') && !SCOPE_FOLDERS.includes(entry.name)) children.push(entry)
      } else if (entry.name === SCOPE_FILE) header = entry
      else if (isSupersededPath(entry.name)) older = entry
    }

    const held = header ?? older
    if (held) {
      await visit({ folder, path: segments.join('/'), header: held, current: header !== undefined })
    }
    for (const child of children) await this.walk(child, [...segments, child.name], visit)
  }

  /** See {@link ScopeStore.outdated}. */
  async outdated(): Promise<ScopePath[]> {
    const found: ScopePath[] = []
    try {
      await this.walk(this.root, [], async ({ path, header, current }) => {
        if (!current) { found.push(path); return }
        const text = await this.textOf(header, 'a scope header')
        const version = text === undefined ? undefined : folderFormatVersion(text)
        if (version !== undefined && version < SCOPE_FORMAT_VERSION) found.push(path)
      })
    } catch (cause) {
      // Unreadable is not old: an empty answer leaves the folder alone, which
      // is the safe direction for something that rewrites files.
      this.fault('the folder\'s format', cause)
      return []
    }
    return found
  }

  /**
   * See {@link ScopeStore.models}. One `model.json` per scope, and the plans
   * beside it: the same walk the listing does, reading the documents the
   * index is built from instead of a whole folder each. The plans are a
   * handful of small files per scope, read here so the roadmap of a scope
   * above can show the initiatives below it without a load per domain
   * (ADR-0012 §7).
   *
   * A scope whose model will not read — the file there and not JSON — is left
   * out rather than answered with an empty one. An empty model is a claim —
   * "this scope defines nothing" — and a half-written file is not evidence for
   * it; leaving the scope out says "unknown", which is what a drift check
   * should do nothing about.
   *
   * A walk that fails is a rejection, not an empty tree, for the same reason
   * one level up: an empty answer says the tree defines nothing, and a move
   * reading it would carry none of the refs that point into what it moves.
   * Whoever asked keeps what it read last (`useIndex`), or says the gesture
   * could not be planned.
   */
  async models(): Promise<ScopeModel[]> {
    const found: ScopeModel[] = []
    await this.walk(this.root, [], async ({ folder, path }) => {
      const handle = await folder.getFileHandle(MODEL_FILE).catch(this.orAbsent('a model'))
      const text = await this.textOf(handle, 'a model')
      if (text === undefined) return
      const lists = modelListsFrom(text)
      if (!lists) return
      found.push({ path, model: {
        ...lists,
        transitions: await this.transitionsIn(folder),
        observations: await this.observationsIn(folder),
      } })
    })
    return found
  }

  /**
   * See {@link ScopeStore.descriptions}: the `docs/` folder and the prose an
   * unsafe id keeps in `model.json`, and not one other file of the scope.
   */
  async descriptions(path: ScopePath): Promise<Record<string, string> | undefined> {
    if (!usablePath(path)) return undefined
    const folder = await this.scopeFolder(path, false)
    if (!folder) return undefined
    const found: Record<string, string> = {}
    try {
      const handle = await folder.getFileHandle(MODEL_FILE).catch(this.orAbsent('a model'))
      const text = await this.textOf(handle, 'a model')
      const lists = modelListsFrom(text)
      if (text === undefined || !lists) return undefined
      for (const element of lists.elements) {
        if (element.description !== undefined) found[element.id] = element.description
      }
      const docs = await folder.getDirectoryHandle(DOCS_FOLDER).catch(this.orAbsent('the descriptions folder'))
      if (docs) {
        for await (const entry of docs.values()) {
          if (entry.kind !== 'file' || !entry.name.endsWith('.md')) continue
          const prose = await this.textOf(entry, 'a description')
          if (prose !== undefined) found[entry.name.slice(0, -'.md'.length)] = markdownBody(prose)
        }
      }
    } catch (cause) {
      this.fault('the descriptions', cause)
      return undefined
    }
    return found
  }

  /** The plans filed in one scope's folder, by number. A file that will not read is left out. */
  private async transitionsIn(folder: DirectoryHandleLike): Promise<Transition[]> {
    const plans = await folder.getDirectoryHandle(TRANSITIONS_FOLDER).catch(this.orAbsent('the plans folder'))
    if (!plans) return []
    const found: Transition[] = []
    for await (const entry of plans.values()) {
      if (entry.kind !== 'file' || !entry.name.endsWith('.md')) continue
      const text = await this.textOf(entry, 'a plan')
      if (text === undefined) continue
      const plan = transitionFromFile(text, `${TRANSITIONS_FOLDER}/${entry.name}`)
      if (plan) found.push(plan)
    }
    return found.sort((a, b) => a.number - b.number)
  }

  /** The observations, likewise (ADR-0021): the shared ones are what a scope above reads. */
  private async observationsIn(folder: DirectoryHandleLike): Promise<Observation[]> {
    const held = await folder.getDirectoryHandle(OBSERVATIONS_FOLDER).catch(this.orAbsent('the observations folder'))
    if (!held) return []
    const found: Observation[] = []
    for await (const entry of held.values()) {
      if (entry.kind !== 'file' || !entry.name.endsWith('.md')) continue
      const text = await this.textOf(entry, 'an observation')
      if (text === undefined) continue
      const observation = observationFromFile(text, `${OBSERVATIONS_FOLDER}/${entry.name}`)
      if (observation) found.push(observation)
    }
    return found.sort((a, b) => a.number - b.number)
  }

  async list(): Promise<ScopeSummary> {
    const found: ScopeSummary[] = []
    try {
      await this.walk(this.root, [], async ({ folder, path, header }) => {
        // The date comes off the files and never out of a field: a screen
        // orders by it, and a stored timestamp goes stale the moment anything
        // but this tool touches the folder — which, in a working directory, it
        // will.
        let latest = 0
        for (const entry of await this.entries(folder)) {
          latest = Math.max(latest, await this.stampOf(entry.handle))
        }
        const summary = scopeSummaryFrom(
          await (await header.getFile()).text(),
          path,
          latest ? new Date(latest).toISOString() : undefined,
        )
        if (summary) found.push(summary)
      })
    } catch (cause) {
      // A folder that has become unreadable — permission withdrawn, drive
      // unplugged — is an empty tree rather than a broken screen, and the
      // trail says which of the two it was.
      this.fault('the folder\'s listing', cause)
      return scopeTree([], this.root.name)
    }
    const root = scopeTree(found, this.root.name)
    return { ...root, children: sortScopes(root.children) }
  }

  async load(path: ScopePath): Promise<ScopeSnapshot | undefined> {
    if (!usablePath(path)) return undefined
    const folder = await this.scopeFolder(path, false)
    if (!folder) return undefined
    try {
      const entries = await this.entries(folder)
      const files = await this.readAll(entries)
      const scope = openScopeFolder(files, path)
      if (!scope) return undefined
      // Dated by the files that read: one that did not has been said once already.
      const read = new Set(files.map((file) => file.path))
      const latest = Math.max(0, ...await Promise.all(entries
        .filter((entry) => read.has(entry.path))
        .map((entry) => this.stampOf(entry.handle))))
      const revision = folderRevision(files)
      return latest
        ? { ...scope, updatedAt: new Date(latest).toISOString(), revision }
        : { ...scope, revision }
    } catch (cause) {
      this.fault('a scope', cause)
      return undefined
    }
  }

  private async readAll(entries: readonly Entry[]): Promise<FolderFile[]> {
    return (await Promise.all(entries.map((entry) => this.read(entry))))
      .filter((file): file is FolderFile => !!file)
  }

  /**
   * What `load` would stamp on this scope now, or `undefined` where there is
   * no scope there to stamp — read the same way, so a folder nobody wrote to
   * answers the revision it was read at.
   */
  private async revisionNow(path: ScopePath): Promise<string | undefined> {
    const folder = await this.scopeFolder(path, false)
    if (!folder) return undefined
    const files = await this.readAll(await this.entries(folder))
    return openScopeFolder(files, path) ? folderRevision(files) : undefined
  }

  private async write(folder: DirectoryHandleLike, file: FolderFile): Promise<void> {
    const parts = file.path.split('/')
    const parent = await this.folderInside(folder, parts.slice(0, -1))
    const handle = await parent.getFileHandle(parts[parts.length - 1], { create: true })

    // Written only when it would differ. An autosave of a scope whose model has
    // not changed then touches no mtime: no watcher wakes, no sync client
    // uploads, and `git status` stays empty. It costs a read, which is the
    // cheap half of the pair.
    const existing = await handle.getFile().then(
      async (held) => 'text' in file ? held.text() : new Uint8Array(await held.arrayBuffer()),
      () => undefined,
    )
    if (existing !== undefined && same(existing, file)) return

    const writable = await handle.createWritable()
    try {
      await writable.write('text' in file ? file.text : file.bytes)
    } finally {
      await writable.close()
    }
  }

  private async folderInside(
    folder: DirectoryHandleLike, segments: readonly string[],
  ): Promise<DirectoryHandleLike> {
    let held = folder
    for (const segment of segments) held = await held.getDirectoryHandle(segment, { create: true })
    return held
  }

  /**
   * See {@link ScopeStore.save}. The check reads the scope again, which a
   * folder has no cheaper way to answer; it is paid only by a caller that
   * asked, and the open scope's own autosave never does. A folder has no
   * lock to take, so on a disk shared with somebody else's machine the check
   * narrows the window rather than closing it — which is what a folder can
   * promise, and a store that serialises its writers closes it.
   */
  async save(scope: ScopeSnapshot, expects?: string): Promise<void> {
    if (!usablePath(scope.path)) {
      throw new ShellError('shell.badScopePath', { path: String(scope.path) })
    }
    if (expects !== undefined && await this.revisionNow(scope.path) !== expects) {
      throw scopeMoved(scope.path)
    }
    const folder = await this.scopeFolder(scope.path, true)
    if (!folder) throw new ShellError('shell.folderUnavailable')
    // A model on disk that does not parse was opened as an empty one, and
    // writing what that snapshot holds would make it one for good — and
    // remove every description filed beside it, whose elements it no longer
    // names. Read here, from the disk, rather than off the snapshot, because
    // a snapshot is rebuilt by whoever saves and need not carry the mark.
    if (scope.unreadable?.length || await this.unreadableModel(folder)) {
      throw new ShellError('shell.unreadableNotSaved')
    }

    const files = scopeFiles(scope)
    // Written before anything is removed: an interrupted save then leaves a
    // folder with too much in it, which opens, rather than too little.
    for (const file of files) await this.write(folder, file)

    const wanted = new Set(files.map((file) => file.path))
    for (const entry of await this.entries(folder)) {
      if (wanted.has(entry.path)) continue
      // Only what this format writes — a deleted diagram's two files, a
      // decision that was renamed. Everything else in the folder is somebody's,
      // and a scope filed inside this one is never among these at all.
      //
      // One that will not go is not a failed save — everything wanted is
      // written — but it is a deleted diagram or decision that comes back on
      // the next open, so it is said rather than dropped.
      await entry.parent.removeEntry(entry.name).catch((cause: unknown) => {
        if (!isAbsent(cause)) {
          this.diagnostics?.report({ level: 'warn', where: 'folder', message: 'a file the format no longer writes could not be removed', cause })
        }
      })
    }
  }

  /** Is there a `model.json` in this folder that does not parse? A file that cannot be read at all is not one. */
  private async unreadableModel(folder: DirectoryHandleLike): Promise<boolean> {
    const handle = await folder.getFileHandle(MODEL_FILE).catch(this.orAbsent('a model'))
    return modelUnreadable(await this.textOf(handle, 'a model'))
  }

  async remove(path: ScopePath): Promise<void> {
    // The root is the folder the user chose. Emptying it is not this store's
    // call, and there is no parent to remove it from.
    if (!usablePath(path) || path === ROOT_SCOPE) return
    const parent = await this.folderAt(scopeSegments(parentScope(path) ?? ROOT_SCOPE), false)
    if (!parent) return
    try {
      // The whole folder, including anything the user filed in it and every
      // scope nested inside: this folder IS the scope, and a child left where
      // its parent used to be is addressed by nothing.
      await parent.removeEntry(scopePathLabel(path), { recursive: true })
    } catch {
      // Removing what is not there is not an error, per the port.
    }
  }
}

function same(existing: string | Uint8Array, file: FolderFile): boolean {
  if ('text' in file) return existing === file.text
  if (typeof existing === 'string' || existing.length !== file.bytes.length) return false
  return existing.every((byte, i) => byte === file.bytes[i])
}

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
  DECISIONS_FOLDER, folderFormatVersion, isFormatPath, SCOPE_FILE, SCOPE_FOLDERS,
  SCOPE_FORMAT_VERSION, scopeFiles, scopeSummaryFrom,
} from '../../projects/folderFormat'
import type { FolderFile } from '../../projects/folderFormat'
import { isSupersededPath, openScopeFolder } from '../../projects/migrate4to5'
import { scopeTree, sortScopes } from '../../projects/scope'
import type { ScopeSnapshot, ScopeSummary } from '../../projects/scope'
import {
  isSafeScopePath, parentScope, ROOT_SCOPE, scopePathLabel, scopeSegments,
} from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import { ShellError } from '../../platform/errors'
import type { ScopeStore } from '../../ports/ScopeStore'

/**
 * The slice of the File System Access API this store uses.
 *
 * Declared here rather than taken from the DOM lib, for two reasons that both
 * matter: the ambient types are not present in every TypeScript configuration
 * this repo builds under, and naming exactly what is used makes the store
 * testable against a small in-memory double instead of a browser. The double is
 * then held to the same shape by the compiler — and so is the desktop's IPC
 * handle, which is the same abstraction over a channel instead of a browser.
 */
export type FileLike = {
  text(): Promise<string>
  /** For the marks: a PNG has no honest text form. */
  arrayBuffer(): Promise<ArrayBuffer>
  lastModified: number
  size: number
}
export type WritableLike = { write(data: string | Uint8Array): Promise<void>; close(): Promise<void> }
export type FileHandleLike = {
  kind: 'file'
  name: string
  getFile(): Promise<FileLike>
  createWritable(): Promise<WritableLike>
}
export type DirectoryHandleLike = {
  kind: 'directory'
  name: string
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandleLike>
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandleLike>
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>
  values(): AsyncIterableIterator<FileHandleLike | DirectoryHandleLike>
}

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
 * filed in a folder of their own (numbers are per list).
 */
function ownFolder(name: string, within: string): boolean {
  if (within === '') return SCOPE_FOLDERS.includes(name)
  return within === DECISIONS_FOLDER
}

/** One file in a scope's folder, with enough to read it, replace it or remove it. */
type Entry = { path: string; name: string; parent: DirectoryHandleLike; handle: FileHandleLike }

export class FileSystemScopeStore implements ScopeStore {
  readonly id = 'folder on disk'

  constructor(private readonly root: DirectoryHandleLike) {}

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
    } catch {
      // Half a write, a file removed under us, permission withdrawn. The rest
      // of the scope is still worth reading.
      return undefined
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
        const text = await (await header.getFile().catch(() => undefined))?.text().catch(() => undefined)
        const version = text === undefined ? undefined : folderFormatVersion(text)
        if (version !== undefined && version < SCOPE_FORMAT_VERSION) found.push(path)
      })
    } catch {
      // Unreadable is not old: an empty answer leaves the folder alone, which
      // is the safe direction for something that rewrites files.
      return []
    }
    return found
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
          latest = Math.max(latest, (await entry.handle.getFile().catch(() => undefined))?.lastModified ?? 0)
        }
        const summary = scopeSummaryFrom(
          await (await header.getFile()).text(),
          path,
          latest ? new Date(latest).toISOString() : undefined,
        )
        if (summary) found.push(summary)
      })
    } catch {
      // A folder that has become unreadable — permission withdrawn, drive
      // unplugged — is an empty tree rather than a broken screen.
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
      const files = (await Promise.all(entries.map((entry) => this.read(entry))))
        .filter((file): file is FolderFile => !!file)
      const scope = openScopeFolder(files, path)
      if (!scope) return undefined
      const latest = Math.max(0, ...await Promise.all(entries.map(async (entry) =>
        (await entry.handle.getFile().catch(() => undefined))?.lastModified ?? 0)))
      return latest ? { ...scope, updatedAt: new Date(latest).toISOString() } : scope
    } catch {
      return undefined
    }
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

  async save(scope: ScopeSnapshot): Promise<void> {
    if (!usablePath(scope.path)) {
      throw new ShellError('shell.badScopePath', { path: String(scope.path) })
    }
    const folder = await this.scopeFolder(scope.path, true)
    if (!folder) throw new ShellError('shell.folderUnavailable')

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
      await entry.parent.removeEntry(entry.name).catch(() => undefined)
    }
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

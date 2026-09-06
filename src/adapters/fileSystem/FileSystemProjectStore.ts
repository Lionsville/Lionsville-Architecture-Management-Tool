/**
 * Projects as folders in a working directory the user chose.
 *
 * A project is a folder of text files (ADR-0003, and `projects/folderFormat.ts`
 * is the format itself): a real thing the person owns, that can sit in
 * OneDrive, be committed, be read by a version of this tool that does not exist
 * yet. That is a different promise from browser storage, which is a per-browser
 * cache the user cannot see and a "clear site data" can wipe without warning.
 *
 * The layout is the ref, literally: `<group path>/<project>/`. A group is a
 * path, so a nested group is nested folders, and what the picker shows is what
 * the file manager shows. That is worth more than any index file — there is no
 * second source of truth to fall out of step, and a project dropped into the
 * working directory by hand is simply there.
 *
 * **Everything is by name, nothing is cached.** A directory listing is the
 * index. Listing costs one small `project.json` per project, which is what that
 * file is for; the whole landscape is only read when a project is opened.
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
  isFormatPath, PROJECT_FILE, projectFiles, projectFromFolder, projectSummaryFrom,
} from '../../projects/folderFormat'
import type { FolderFile } from '../../projects/folderFormat'
import type { ProjectSnapshot, ProjectSummary } from '../../projects/project'
import { groupSegments, isProjectRef } from '../../projects/projectRef'
import type { ProjectRef } from '../../projects/projectRef'
import { ShellError } from '../../platform/errors'
import type { ProjectStore } from '../../ports/ProjectStore'

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
 * Reject a ref before it becomes a path.
 *
 * `getDirectoryHandle('..')` throws in a real browser, but this store is also
 * the shape the desktop adapter takes, where the same string becomes a path on
 * someone's disk. Refusing here means the rule is stated once, in the layer
 * that knows what a ref is allowed to look like, rather than relying on each
 * backend to be strict on its own.
 */
function usableRef(ref: ProjectRef): boolean {
  if (!isProjectRef(ref)) return false
  const parts = [...groupSegments(ref.group), ref.project]
  return parts.every((part) =>
    part.length > 0 && part !== '.' && part !== '..' && !/[/\\]/.test(part))
}

/** One file in a project folder, with enough to read it, replace it or remove it. */
type Entry = { path: string; name: string; parent: DirectoryHandleLike; handle: FileHandleLike }

export class FileSystemProjectStore implements ProjectStore {
  readonly id = 'folder on disk'

  constructor(private readonly root: DirectoryHandleLike) {}

  /**
   * Walk down a path of folder names.
   *
   * `create: false` returns undefined rather than throwing for a folder that is
   * not there, because "no such project" is an ordinary answer to `load` and
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

  private projectFolder(ref: ProjectRef, create: boolean): Promise<DirectoryHandleLike | undefined> {
    return this.folderAt([...groupSegments(ref.group), ref.project], create)
  }

  /** Every file of the format under one project folder, with its path inside it. */
  private async entries(folder: DirectoryHandleLike, within = ''): Promise<Entry[]> {
    const found: Entry[] = []
    for await (const entry of folder.values()) {
      const path = within ? `${within}/${entry.name}` : entry.name
      if (entry.kind === 'directory') {
        found.push(...await this.entries(entry, path))
        continue
      }
      if (isFormatPath(path)) found.push({ path, name: entry.name, parent: folder, handle: entry })
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
      // of the project is still worth reading.
      return undefined
    }
  }

  /**
   * A project's own folder is one that holds a `project.json`.
   *
   * Everything above it is a group, so the path down to that file IS the ref —
   * which is why nothing has to be written inside the file to say where it is
   * filed. Walking stops there: what is inside a project is the project's.
   */
  private async walk(
    folder: DirectoryHandleLike, segments: string[], found: ProjectSummary[],
  ): Promise<void> {
    const children: DirectoryHandleLike[] = []
    let header: FileHandleLike | undefined
    let latest = 0
    for await (const entry of folder.values()) {
      if (entry.kind === 'directory') children.push(entry)
      else if (entry.name === PROJECT_FILE) header = entry
    }

    if (header && segments.length >= 2) {
      const ref = { group: segments.slice(0, -1).join('/'), project: segments[segments.length - 1] }
      // The date comes off the files and never out of a field: the picker orders
      // by it, and a stored timestamp goes stale the moment anything but this
      // tool touches the folder — which, in a working directory, it will.
      for (const entry of await this.entries(folder)) {
        latest = Math.max(latest, (await entry.handle.getFile().catch(() => undefined))?.lastModified ?? 0)
      }
      const summary = projectSummaryFrom(
        await (await header.getFile()).text(),
        ref,
        latest ? new Date(latest).toISOString() : undefined,
      )
      if (summary) found.push(summary)
      return
    }

    for (const child of children) await this.walk(child, [...segments, child.name], found)
  }

  async list(): Promise<ProjectSummary[]> {
    const found: ProjectSummary[] = []
    try {
      await this.walk(this.root, [], found)
    } catch {
      // A folder that has become unreadable — permission withdrawn, drive
      // unplugged — is an empty list rather than a broken picker.
      return []
    }
    return found.sort((a, b) => a.name.localeCompare(b.name))
  }

  async load(ref: ProjectRef): Promise<ProjectSnapshot | undefined> {
    if (!usableRef(ref)) return undefined
    const folder = await this.projectFolder(ref, false)
    if (!folder) return undefined
    try {
      const entries = await this.entries(folder)
      const files = (await Promise.all(entries.map((entry) => this.read(entry))))
        .filter((file): file is FolderFile => !!file)
      const project = projectFromFolder(files, ref)
      if (!project) return undefined
      const latest = Math.max(0, ...await Promise.all(entries.map(async (entry) =>
        (await entry.handle.getFile().catch(() => undefined))?.lastModified ?? 0)))
      return latest ? { ...project, updatedAt: new Date(latest).toISOString() } : project
    } catch {
      return undefined
    }
  }

  private async write(folder: DirectoryHandleLike, file: FolderFile): Promise<void> {
    const parts = file.path.split('/')
    const parent = await this.folderInside(folder, parts.slice(0, -1))
    const handle = await parent.getFileHandle(parts[parts.length - 1], { create: true })

    // Written only when it would differ. An autosave of a project whose model
    // has not changed then touches no mtime: no watcher wakes, no sync client
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

  async save(project: ProjectSnapshot): Promise<void> {
    if (!usableRef(project.ref)) {
      throw new ShellError('shell.badProjectRef', { path: `${project.ref.group}/${project.ref.project}` })
    }
    const folder = await this.projectFolder(project.ref, true)
    if (!folder) throw new ShellError('shell.folderUnavailable')

    const files = projectFiles(project)
    // Written before anything is removed: an interrupted save then leaves a
    // folder with too much in it, which opens, rather than too little.
    for (const file of files) await this.write(folder, file)

    const wanted = new Set(files.map((file) => file.path))
    for (const entry of await this.entries(folder)) {
      if (wanted.has(entry.path)) continue
      // Only what this format writes — a deleted diagram's two files, a
      // decision that was renamed. Everything else in the folder is somebody's.
      await entry.parent.removeEntry(entry.name).catch(() => undefined)
    }
  }

  async remove(ref: ProjectRef): Promise<void> {
    if (!usableRef(ref)) return
    const parent = await this.folderAt(groupSegments(ref.group), false)
    if (!parent) return
    try {
      // The whole folder, including anything the user filed in it: this folder
      // IS the project, and deleting a project that leaves half of itself
      // behind is the more surprising answer.
      await parent.removeEntry(ref.project, { recursive: true })
    } catch {
      // Removing what is not there is not an error, per the port. An empty group
      // folder is left behind on purpose: a group exists because projects are
      // filed under it, and deleting a folder the user may have put other things
      // in is not this store's call.
    }
  }
}

function same(existing: string | Uint8Array, file: FolderFile): boolean {
  if ('text' in file) return existing === file.text
  if (typeof existing === 'string' || existing.length !== file.bytes.length) return false
  return existing.every((byte, i) => byte === file.bytes[i])
}

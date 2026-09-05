/**
 * Projects as files in a folder the user chose.
 *
 * The File System Access API, so a project is a real `.lvarch` file that the
 * person owns: it can sit in OneDrive, be mailed to a colleague, be committed,
 * be opened next week by a version of this tool that does not exist yet. That is
 * a different promise from browser storage, which is a per-browser cache the
 * user cannot see and a "clear site data" can wipe without warning.
 *
 * The layout is the ref, literally: `<group path>/<project>.lvarch`. A group is
 * a path, so a nested group is nested folders, and what the picker shows is what
 * the file manager shows. That is worth more than any index file — there is no
 * second source of truth to fall out of step, and a project dropped into the
 * folder by hand is simply there.
 *
 * **Everything is by name, nothing is cached.** A directory listing is the
 * index. It costs a read per project on `list()`, which the port explicitly
 * permits ("one that cannot answer cheaply may load and summarise"), and it buys
 * the property that matters here: another program — a sync client, a colleague,
 * the user — can change the folder underneath us and the next listing is simply
 * right.
 *
 * This adapter deliberately does NOT watch for changes or resolve conflicts.
 * That is `documentSession`'s job in the layer above, which is where it can be
 * tested without a filesystem at all.
 */
import { isUsableProject, summarise } from '../../core/project'
import type { ProjectSnapshot, ProjectSummary } from '../../core/project'
import { WORKING_FILE_EXTENSION } from '../../core/model/hostModel'
import { groupSegments, isProjectRef } from '../../core/projectRef'
import type { ProjectRef } from '../../core/projectRef'
import type { ProjectStore } from '../../ports/ProjectStore'

/**
 * The slice of the File System Access API this store uses.
 *
 * Declared here rather than taken from the DOM lib, for two reasons that both
 * matter: the ambient types are not present in every TypeScript configuration
 * this repo builds under, and naming exactly what is used makes the store
 * testable against a small in-memory double instead of a browser. The double is
 * then held to the same shape by the compiler.
 */
export type FileLike = { text(): Promise<string>; lastModified: number; size: number }
export type WritableLike = { write(data: string): Promise<void>; close(): Promise<void> }
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

/** A file name that is only ever a name — never a path, never a traversal. */
function fileNameFor(ref: ProjectRef): string {
  return `${ref.project}${WORKING_FILE_EXTENSION}`
}

/**
 * Reject a ref before it becomes a path.
 *
 * `getDirectoryHandle('..')` throws in a real browser, but this store is also
 * the shape the desktop adapter will take, where the same string becomes a path
 * on someone's disk. Refusing here means the rule is stated once, in the layer
 * that knows what a ref is allowed to look like, rather than relying on each
 * backend to be strict on its own.
 */
function usableRef(ref: ProjectRef): boolean {
  if (!isProjectRef(ref)) return false
  const parts = [...groupSegments(ref.group), ref.project]
  return parts.every((part) =>
    part.length > 0 && part !== '.' && part !== '..' && !/[/\\]/.test(part))
}

export class FileSystemProjectStore implements ProjectStore {
  readonly id = 'folder on disk'

  constructor(private readonly root: DirectoryHandleLike) {}

  /**
   * Walk down to a group's folder.
   *
   * `create: false` returns undefined rather than throwing for a group that is
   * not there, because "no such group" is an ordinary answer to `load` and
   * `remove` — the same reasoning as the port's `load` returning `undefined`.
   */
  private async groupFolder(
    ref: ProjectRef,
    create: boolean,
  ): Promise<DirectoryHandleLike | undefined> {
    let folder = this.root
    for (const segment of groupSegments(ref.group)) {
      try {
        folder = await folder.getDirectoryHandle(segment, { create })
      } catch {
        return undefined
      }
    }
    return folder
  }

  async list(): Promise<ProjectSummary[]> {
    const found: ProjectSummary[] = []

    // Depth-first over the folder tree: every level of nesting is a group
    // segment, so the path down to a file IS its ref.
    const walk = async (folder: DirectoryHandleLike, group: string[]): Promise<void> => {
      for await (const entry of folder.values()) {
        if (entry.kind === 'directory') {
          await walk(entry, [...group, entry.name])
          continue
        }
        if (!entry.name.endsWith(WORKING_FILE_EXTENSION)) continue
        const project = await this.read(entry, {
          group: group.join('/'),
          project: entry.name.slice(0, -WORKING_FILE_EXTENSION.length),
        })
        if (project) found.push(summarise(project))
      }
    }

    try {
      await walk(this.root, [])
    } catch {
      // A folder that has become unreadable — permission withdrawn, drive
      // unplugged — is an empty list rather than a broken picker.
      return []
    }
    return found.sort((a, b) => a.name.localeCompare(b.name))
  }

  /**
   * One file, or `undefined` when it is missing or unreadable.
   *
   * Corrupt content is skipped rather than thrown, for the same reason the
   * browser store skips it: half-written JSON or a file somebody edited by hand
   * is not something the user can act on, and refusing to show the rest of their
   * projects would be a worse answer.
   */
  private async read(handle: FileHandleLike, ref: ProjectRef): Promise<ProjectSnapshot | undefined> {
    let parsed: unknown
    let lastModified: number
    try {
      const file = await handle.getFile()
      lastModified = file.lastModified
      parsed = JSON.parse(await file.text())
    } catch {
      return undefined
    }
    if (!isUsableProject(parsed)) return undefined
    const held = parsed as ProjectSnapshot

    // The ref comes from where the file IS, not from what it says. A file that
    // was moved or renamed in the file manager is then simply the project at its
    // new address, which is what anybody moving it would expect.
    return {
      ref,
      model: held.model,
      activeDiagramId: held.activeDiagramId ?? held.model.diagrams[0].id,
      logoLibrary: Array.isArray(held.logoLibrary) ? held.logoLibrary : [],
      // The file's own mtime, not a field inside it. The picker orders by this,
      // and a stored timestamp would go stale the moment anything but this tool
      // touched the file.
      updatedAt: new Date(lastModified).toISOString(),
    }
  }

  async load(ref: ProjectRef): Promise<ProjectSnapshot | undefined> {
    if (!usableRef(ref)) return undefined
    const folder = await this.groupFolder(ref, false)
    if (!folder) return undefined
    try {
      const handle = await folder.getFileHandle(fileNameFor(ref))
      return await this.read(handle, ref)
    } catch {
      return undefined
    }
  }

  async save(project: ProjectSnapshot): Promise<void> {
    if (!usableRef(project.ref)) {
      throw new Error(`shell.badProjectRef:${project.ref.group}/${project.ref.project}`)
    }
    const folder = await this.groupFolder(project.ref, true)
    if (!folder) throw new Error('shell.folderUnavailable')

    const handle = await folder.getFileHandle(fileNameFor(project.ref), { create: true })
    const writable = await handle.createWritable()
    // The ref is not written into the file: where a project is filed is this
    // store's business, and a file handed to somebody else should not carry it.
    const contents = { model: project.model, activeDiagramId: project.activeDiagramId,
      ...(project.logoLibrary.length ? { logoLibrary: project.logoLibrary } : {}) }
    try {
      await writable.write(JSON.stringify(contents, null, 2) + '\n')
    } finally {
      await writable.close()
    }
  }

  async remove(ref: ProjectRef): Promise<void> {
    if (!usableRef(ref)) return
    const folder = await this.groupFolder(ref, false)
    if (!folder) return
    try {
      await folder.removeEntry(fileNameFor(ref))
    } catch {
      // Removing what is not there is not an error, per the port. An empty group
      // folder is left behind on purpose: a group exists because projects are
      // filed under it, and deleting a folder the user may have put other things
      // in is not this store's call.
    }
  }
}

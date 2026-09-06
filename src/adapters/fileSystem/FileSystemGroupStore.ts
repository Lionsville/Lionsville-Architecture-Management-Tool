/**
 * Group records as `group.json` in the group's own folder.
 *
 * The sibling of `FileSystemProjectStore` and the same reasoning throughout: the
 * folder tree is the index, the path down to a file is the address, and nothing
 * is written inside a record to say where it was filed. `acme/rail/group.json`
 * is the profile of `acme/rail`, which is what the file manager shows too.
 *
 * A group folder that has projects in it and no `group.json` is still a group —
 * groups are derived from what is filed under them, and a profile only
 * decorates one. So a folder without the file is not a failure, and `list()`
 * simply does not mention it.
 */
import { groupFiles, groupFromFolder, GROUP_FILE, PROJECT_FILE } from '../../projects/folderFormat'
import type { FolderFile } from '../../projects/folderFormat'
import type { GroupProfile } from '../../projects/group'
import { isGroupPath } from '../../projects/projectRef'
import { ShellError } from '../../platform/errors'
import type { GroupStore } from '../../ports/GroupStore'
import type { DirectoryHandleLike, FileHandleLike } from './FileSystemProjectStore'

export class FileSystemGroupStore implements GroupStore {
  readonly id = 'folder on disk'

  constructor(private readonly root: DirectoryHandleLike) {}

  /**
   * Every group folder, depth first, skipping what is a project.
   *
   * A folder holding a `project.json` is a project and its insides are the
   * project's business — the same rule the project store walks by, so the two
   * cannot disagree about where a group stops.
   */
  private async walk(
    folder: DirectoryHandleLike, segments: string[], found: GroupProfile[],
  ): Promise<void> {
    const children: DirectoryHandleLike[] = []
    let isProject = false
    let hasRecord = false
    const files: FolderFile[] = []
    const decisions: FileHandleLike[] = []

    for await (const entry of folder.values()) {
      if (entry.kind === 'directory') {
        if (entry.name === 'decisions') {
          for await (const held of entry.values()) {
            if (held.kind === 'file' && held.name.endsWith('.md')) decisions.push(held)
          }
          continue
        }
        children.push(entry)
        continue
      }
      if (entry.name === PROJECT_FILE) isProject = true
      if (entry.name === GROUP_FILE) hasRecord = true
    }
    if (isProject) return

    if (segments.length > 0 && (hasRecord || decisions.length > 0)) {
      if (hasRecord) {
        const handle = await folder.getFileHandle(GROUP_FILE).catch(() => undefined)
        const text = handle && await (await handle.getFile()).text().catch(() => undefined)
        if (text !== undefined) files.push({ path: GROUP_FILE, text })
      }
      for (const handle of decisions) {
        const text = await (await handle.getFile()).text().catch(() => undefined)
        if (text !== undefined) files.push({ path: `decisions/${handle.name}`, text })
      }
      const profile = groupFromFolder(files, segments.join('/'))
      if (profile) found.push(profile)
    }

    for (const child of children) await this.walk(child, [...segments, child.name], found)
  }

  async list(): Promise<GroupProfile[]> {
    const found: GroupProfile[] = []
    try {
      await this.walk(this.root, [], found)
    } catch {
      // Unreadable folder, withdrawn permission, unplugged drive: an empty list
      // rather than a picker that will not draw.
      return []
    }
    return found.sort((a, b) => a.group.localeCompare(b.group))
  }

  private async folderFor(
    group: string, create: boolean,
  ): Promise<DirectoryHandleLike | undefined> {
    let folder = this.root
    for (const segment of group.split('/').filter(Boolean)) {
      try {
        folder = await folder.getDirectoryHandle(segment, { create })
      } catch {
        return undefined
      }
    }
    return folder
  }

  async save(profile: GroupProfile): Promise<void> {
    if (!isGroupPath(profile.group)) {
      throw new ShellError('shell.badGroupPath', { path: JSON.stringify(profile.group) })
    }
    const folder = await this.folderFor(profile.group, true)
    if (!folder) throw new ShellError('shell.folderUnavailable')

    const files = groupFiles(profile)
    const wanted = new Set(files.map((file) => file.path))
    for (const file of files) await write(folder, file)

    // A renamed decision is a new file name, so the old one has to go. Only the
    // records: `group.json` is always written, and everything else in a group
    // folder belongs to the user or to a project.
    const held = await folder.getDirectoryHandle('decisions').catch(() => undefined)
    if (held) {
      const stale: string[] = []
      for await (const entry of held.values()) {
        if (entry.kind !== 'file') continue
        if (/^\d{1,6}-.*\.md$/.test(entry.name) && !wanted.has(`decisions/${entry.name}`)) {
          stale.push(entry.name)
        }
      }
      for (const name of stale) await held.removeEntry(name).catch(() => undefined)
    }
  }

  async remove(group: string): Promise<void> {
    if (!isGroupPath(group)) return
    const folder = await this.folderFor(group, false)
    if (!folder) return
    // The record, not the folder: the projects filed under it are what make it
    // a group, and they are not this store's to delete.
    await folder.removeEntry(GROUP_FILE).catch(() => undefined)
    const decisions = await folder.getDirectoryHandle('decisions').catch(() => undefined)
    if (!decisions) return
    const names: string[] = []
    for await (const entry of decisions.values()) {
      if (entry.kind === 'file' && /^\d{1,6}-.*\.md$/.test(entry.name)) names.push(entry.name)
    }
    for (const name of names) await decisions.removeEntry(name).catch(() => undefined)
  }
}

async function write(folder: DirectoryHandleLike, file: FolderFile): Promise<void> {
  const parts = file.path.split('/')
  let parent = folder
  for (const segment of parts.slice(0, -1)) {
    parent = await parent.getDirectoryHandle(segment, { create: true })
  }
  const handle = await parent.getFileHandle(parts[parts.length - 1], { create: true })
  const writable = await handle.createWritable()
  try {
    await writable.write('text' in file ? file.text : file.bytes)
  } finally {
    await writable.close()
  }
}

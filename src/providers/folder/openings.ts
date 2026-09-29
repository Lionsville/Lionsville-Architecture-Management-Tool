// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A folder, made ready to open: on the desktop over the file channel, in a
 * tab over the handle the browser gave, and as somewhere new a working file
 * may become. Fetched with what opens a folder, when a folder is chosen or
 * reopened (`folderSource.ts`).
 */
import type { DesktopDirectory, DesktopFiles } from '../../adapters/desktop/channel'
import { desktopHistory, desktopSettings } from '../../adapters/desktop/desktopFiles'
import { rememberingWrites } from '../../adapters/desktop/rememberingWrites'
import { BrowserFolder } from '../../adapters/folder/browser/browserFolder'
import { browserFolderGit } from '../../adapters/folder/browser/browserFolderGit'
import { browserPlaceStore, browserStampCache, browserStepStore } from '../../adapters/folder/browser/browserStepStore'
import { DesktopFolderGit } from '../../adapters/folder/desktop/DesktopFolderGit'
import { desktopPlaceStore, desktopStampCache, desktopStepStore } from '../../adapters/folder/desktop/desktopStepStore'
import { IpcDirectoryHandle } from '../../adapters/folder/desktop/IpcDirectoryHandle'
import type { DirectoryHandleLike } from '../../adapters/folder/DirectoryHandle'
import { FileSystemFolderSettings } from '../../adapters/folder/FileSystemFolderSettings'
import { FileSystemScopeStore } from '../../adapters/folder/FileSystemScopeStore'
import { browserDatabase } from '../../adapters/webStorage/available'
import { IndexedDbStore } from '../../adapters/webStorage/IndexedDbStore'
import type { SourceDestination } from '../../ports/ProviderParts'
import { desktopPerson } from './desktopPerson'
import { desktopSync } from './folderOwn'
import type { FolderOpening } from './openFolder'

/**
 * A folder on the desktop: the handle over the file channel, bound to the
 * folder, and the history, step ids and person's settings the desktop keeps
 * for it. Everything goes through the remembering wrapper, the stores
 * included: a write that went round it would come back from the watcher as
 * somebody else's change, and the app would interrupt itself.
 */
export function desktopOpening(files: DesktopFiles, directory: DesktopDirectory): FolderOpening {
  const channel = rememberingWrites(files)
  const handle = new IpcDirectoryHandle(channel.files, directory.root, directory.name)
  const git = desktopHistory()
  const settings = desktopSettings()
  return {
    channel,
    handle,
    name: directory.name,
    root: directory.root,
    ...(git ? { git: new DesktopFolderGit(git, directory.root), sync: desktopSync(git, directory.root) } : {}),
    historyNoteKey: 'folder.historyNote',
    ...(settings
      ? {
        steps: desktopStepStore(settings, directory.root),
        places: desktopPlaceStore(settings, directory.root),
        stamps: desktopStampCache(settings, directory.root),
        person: desktopPerson(settings, directory.root, new FileSystemFolderSettings(handle)),
      }
      : {}),
  }
}

/**
 * A folder a browser tab was given: its history, the step ids its
 * repositories applied and what it has learnt about the folder, kept in this
 * browser's database under the folder's handle — so they outlive the tab.
 */
export function browserOpening(handle: DirectoryHandleLike): FolderOpening {
  const opening: FolderOpening = { handle, name: handle.name, root: handle.name }
  const database = browserDatabase()
  if (!database) return opening
  const folder = new BrowserFolder(new IndexedDbStore(database), handle)
  return {
    ...opening,
    git: browserFolderGit(folder, handle),
    historyNoteKey: 'folder.historyNoteBrowser',
    steps: browserStepStore(folder),
    places: browserPlaceStore(folder),
    stamps: browserStampCache(folder),
  }
}

/**
 * A folder a working file may become (ADR-0025), looked at before anything is
 * written — a name, a scope or a board in it is "occupied", and the shell asks
 * again before writing over one — and written as one where the folder can take
 * it (ADR-0023, amendments 2 and 3).
 */
export async function destinationIn(opening: FolderOpening): Promise<SourceDestination<FolderOpening>> {
  const store = new FileSystemScopeStore(opening.handle)
  const listed = await store.list()
  // A folder holding a scope the listing could not read is not an empty one.
  // Its root is listed under the folder's own name whether or not anybody
  // named it, so what says the root is something is a document of its own.
  const occupied = listed.children.length > 0 || listed.diagrams > 0 || (listed.unreadable?.length ?? 0) > 0
    || await store.load('') !== undefined
  return {
    name: opening.name,
    opening,
    occupied,
    // As one, the way *Replace here* lands (ADR-0023, amendments 2 and 3).
    place: (scopes) => store.saveTogether(scopes.map((scope) => ({ scope }))),
    read: (path) => store.load(path),
  }
}


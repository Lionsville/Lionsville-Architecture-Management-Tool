// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A folder of text files (ADR-0003), which is what the desktop works from and
 * what a browser tab works from when it has been given one: the folder's
 * repositories (ADR-0031 §2), and the way a person reaches a folder.
 *
 * It brings the scopes, the folder's own settings and nothing else. The
 * preferences stay where they were on purpose: they describe this machine — its
 * language, its theme, which folder it uses — so putting them in the folder
 * would carry one machine's settings to every other machine that opens it.
 */
import type { DesktopDirectory, DesktopFiles } from '../../adapters/desktop/channel'
import { desktopFiles, desktopHistory, desktopSettings } from '../../adapters/desktop/desktopFiles'
import { rememberingWrites } from '../../adapters/desktop/rememberingWrites'
import type { FolderChannel } from '../../adapters/desktop/rememberingWrites'
import {
  canChooseDirectory, chooseDirectory as chooseBrowserDirectory, rememberedDirectory,
} from '../../adapters/folder/browser/workingDirectory'
import { BrowserFolder } from '../../adapters/folder/browser/browserFolder'
import { browserFolderGit } from '../../adapters/folder/browser/browserFolderGit'
import { browserPlaceStore, browserStampCache, browserStepStore } from '../../adapters/folder/browser/browserStepStore'
import { DesktopFolderGit } from '../../adapters/folder/desktop/DesktopFolderGit'
import { desktopPlaceStore, desktopStampCache, desktopStepStore } from '../../adapters/folder/desktop/desktopStepStore'
import { IpcDirectoryHandle } from '../../adapters/folder/desktop/IpcDirectoryHandle'
import type { DirectoryHandleLike } from '../../adapters/folder/DirectoryHandle'
import { FileSystemFolderSettings } from '../../adapters/folder/FileSystemFolderSettings'
import { FileSystemScopeStore } from '../../adapters/folder/FileSystemScopeStore'
import type { FolderGit } from '../../adapters/folder/folderGit'
import { folderRepositories } from '../../adapters/folder/folderRepositories'
import { memoryGit } from '../../adapters/folder/memoryGit'
import type { PersonSettings } from '../../adapters/folder/FolderSettingsRepository'
import type { StampCache } from '../../adapters/folder/folderPictures'
import type { PlaceStore } from '../../adapters/folder/folderScopes'
import type { StepStore } from '../../adapters/folder/stepMemory'
import { browserDatabase } from '../../adapters/webStorage/available'
import { IndexedDbStore } from '../../adapters/webStorage/IndexedDbStore'
import type { SourceProvider } from '../../platform/sourceProvider'
import type { WorkingSource } from '../../platform/workingSource'
import type { Diagnostics } from '../../ports/Diagnostics'
import type { FolderSettingsStore } from '../../ports/FolderSettings'
import type { Repositories } from '../../ports/Repositories'
import type { ScopeStore } from '../../ports/ScopeStore'
import type { ScopeSnapshot } from '../../projects/scope'
import type { ScopePath } from '../../projects/scopePath'
import { desktopPerson } from './desktopPerson'

/**
 * What a folder source needs to be given: the handle to work through, and what
 * the folder is called and where it is — and, where the host keeps them, its
 * history, the step ids its repositories applied, and what this person does
 * about it.
 *
 * A browser's handle has no path to give, so `root` falls back to the name —
 * which is all a tab knows about where it is, and enough to tell two folders
 * apart within one tab. It has no git either: its history, and what it keeps
 * about the folder, are kept in the browser's database beside the folder's
 * handle; where there is no database, for as long as the tab is open.
 */
export type FolderOpening = {
  handle: DirectoryHandleLike
  name: string
  root: string
  git?: FolderGit
  steps?: StepStore
  places?: PlaceStore
  stamps?: StampCache
  person?: PersonSettings
}

export type FolderParts = {
  scopes: ScopeStore
  repositories: Repositories
  folderSettings: FolderSettingsStore
  source: WorkingSource
}

/**
 * A folder on the desktop: the handle over the file channel, bound to the
 * folder, and the history, step ids and person's settings the desktop keeps
 * for it. Everything goes through the remembering wrapper, the stores
 * included: a write that went round it would come back from the watcher as
 * somebody else's change, and the app would interrupt itself.
 */
export function desktopOpening(
  files: DesktopFiles, directory: DesktopDirectory,
): FolderOpening & { channel: FolderChannel } {
  const channel = rememberingWrites(files)
  const handle = new IpcDirectoryHandle(channel.files, directory.root, directory.name)
  const git = desktopHistory()
  const settings = desktopSettings()
  return {
    channel,
    handle,
    name: directory.name,
    root: directory.root,
    ...(git ? { git: new DesktopFolderGit(git, directory.root) } : {}),
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
    steps: browserStepStore(folder),
    places: browserPlaceStore(folder),
    stamps: browserStampCache(folder),
  }
}

/**
 * The folder's own way in: the picker this app has always had.
 *
 * Whichever picker there is — the desktop's dialog through the file channel, or
 * the browser's where the browser has one — and nothing at all where there is
 * neither, which is a tab that cannot be given a folder.
 */
export async function chooseFolderOpening(): Promise<FolderOpening | undefined> {
  const files = desktopFiles()
  if (files) {
    const chosen = await files.chooseDirectory()
    return chosen && desktopOpening(files, chosen)
  }
  if (!canChooseDirectory()) return undefined
  const handle = await chooseBrowserDirectory()
  return handle && browserOpening(handle)
}

/** A folder in a browser tab, where the browser can give one. */
export const browserFolders = {
  possible: canChooseDirectory,
  choose: chooseBrowserDirectory,
  remembered: rememberedDirectory,
}

/**
 * A folder a working file may become (ADR-0025): chosen with the same picker
 * as *Open Folder…*, looked at before anything is written — a name, a scope
 * or a board in it is "occupied", and the shell asks again before writing
 * over one — and written as one where the folder can take it (ADR-0023,
 * amendments 2 and 3). Moving the app there is the boot's, which owns the
 * shell; this only knows the store.
 */
export type FolderDestination = {
  opening: FolderOpening
  occupied: boolean
  place(scopes: readonly ScopeSnapshot[]): Promise<void>
  /** One scope of the folder as it now reads: what the landing is checked against (ADR-0023, amended). */
  read(path: ScopePath): Promise<ScopeSnapshot | undefined>
}

export async function chooseFolderDestination(): Promise<FolderDestination | undefined> {
  const opening = await chooseFolderOpening()
  if (!opening) return undefined
  const store = new FileSystemScopeStore(opening.handle)
  const listed = await store.list()
  // A folder holding a scope the listing could not read is not an empty one.
  const occupied = listed.name.trim() !== '' || listed.children.length > 0 || listed.diagrams > 0
    || (listed.unreadable?.length ?? 0) > 0
  return {
    opening,
    occupied,
    // As one, the way *Replace here* lands (ADR-0023, amendments 2 and 3).
    place: (scopes) => store.saveTogether(scopes.map((scope) => ({ scope }))),
    read: (path) => store.load(path),
  }
}

export const FOLDER_SOURCE: SourceProvider<FolderParts, FolderOpening, { readonly diagnostics: Diagnostics }> = {
  kind: 'folder',
  connect: { labelKey: 'picker.chooseFolder', open: chooseFolderOpening },
  // The trail the app keeps is where a file that will not read is said.
  open: ({ handle, name, root, git, steps, places, stamps, person }, { diagnostics }) => ({
    scopes: new FileSystemScopeStore(handle, diagnostics),
    repositories: folderRepositories({
      root: handle, git: git ?? memoryGit(handle, 'this tab'), diagnostics,
      ...(steps ? { steps } : {}), ...(places ? { places } : {}), ...(stamps ? { stamps } : {}),
      ...(person ? { person } : {}),
    }),
    folderSettings: new FileSystemFolderSettings(handle),
    source: { kind: 'folder', name, root },
  }),
}

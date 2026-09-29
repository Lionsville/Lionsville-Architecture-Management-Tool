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
import { desktopFiles } from '../../adapters/desktop/desktopFiles'
import {
  canChooseDirectory, chooseDirectory as chooseBrowserDirectory, rememberedDirectory,
} from '../../adapters/folder/browser/workingDirectory'
import type { SourceProvider } from '../../platform/sourceProvider'
import type { SourceDestination } from '../../ports/ProviderParts'
import type { FolderBase, FolderOpening, FolderParts } from './openFolder'
import { readWorkingDirectory, withWorkingDirectory } from './remembered'

/**
 * The folder's own way in: the picker this app has always had.
 *
 * Whichever picker there is — the desktop's dialog through the file channel, or
 * the browser's where the browser has one — and nothing at all where there is
 * neither, which is a tab that cannot be given a folder. A folder chosen is one
 * the person just pointed the app at, which is when it may offer to bring the
 * work this browser kept along.
 */
export async function chooseFolderOpening(): Promise<FolderOpening | undefined> {
  const files = desktopFiles()
  if (files) {
    const chosen = await files.chooseDirectory()
    return chosen && { ...(await import('./openings')).desktopOpening(files, chosen), chosen: true }
  }
  if (!canChooseDirectory()) return undefined
  const handle = await chooseBrowserDirectory()
  return handle && { ...(await import('./openings')).browserOpening(handle), chosen: true }
}

/** The last segment of a path: what a folder the host names but never listed is called. */
function nameOf(root: string): string {
  return root.split(/[/\\]/).filter(Boolean).pop() ?? root
}

/**
 * The folder this machine worked in last, where it may still be opened.
 *
 * The preference says which folder; the desktop's main process says which
 * folders the person has actually granted. The intersection is what may be
 * opened, checked this way round on purpose: a path in a preferences blob is a
 * wish, and a blob can be edited by anybody with a text editor. A browser tab
 * reopens its folder only if this browser can give one, gave one before, and
 * the permission still stands — asking again needs a click, and a boot is not
 * one.
 */
async function resumeFolder(preferences: unknown): Promise<FolderOpening | undefined> {
  const files = desktopFiles()
  if (!files) {
    const handle = canChooseDirectory() ? await rememberedDirectory() : undefined
    return handle && (await import('./openings')).browserOpening(handle)
  }
  const wanted = readWorkingDirectory(preferences)
  if (!wanted) return undefined
  const directory = (await files.recentDirectories()).find((held) => held.root === wanted)
  return directory && (await import('./openings')).desktopOpening(files, directory)
}

/**
 * A folder named by the host — the Recent submenu, the first screen's list, the
 * smoke run. Only ever one main has granted, and main checks that on every call
 * it receives. The recents are asked for the folder's NAME and nothing else; a
 * folder not on that list (the smoke run grants one it deliberately does not
 * remember) is opened under the last segment of its path.
 */
async function reopenFolder(root: string): Promise<FolderOpening | undefined> {
  const files = desktopFiles()
  if (!files) return undefined
  const granted = await files.recentDirectories()
  const directory = granted.find((held) => held.root === root) ?? { root, name: nameOf(root) }
  return { ...(await import('./openings')).desktopOpening(files, directory), chosen: true }
}

/**
 * A folder a working file may become (ADR-0025): chosen with the same picker
 * as *Open Folder…*, looked at before anything is written — a name, a scope
 * or a board in it is "occupied", and the shell asks again before writing
 * over one — and written as one where the folder can take it (ADR-0023,
 * amendments 2 and 3). Moving the app there is the boot's, which owns the
 * shell; this only knows the folder.
 */
export async function chooseFolderDestination(): Promise<SourceDestination<FolderOpening> | undefined> {
  const opening = await chooseFolderOpening()
  return opening && (await import('./openings')).destinationIn(opening)
}

export const FOLDER_SOURCE: SourceProvider<FolderParts, FolderOpening, FolderBase> = {
  kind: 'folder',
  labelKey: 'shell.sourceFolder',
  describeKey: 'shell.sourceTipFolder',
  whereKey: 'folder.where',
  removeKey: 'picker.deleteBodyFolder',
  connect: {
    labelKey: 'picker.chooseFolder',
    firstLabelKey: 'folder.choose',
    introKey: 'folder.body',
    failedKey: 'shell.folderNotOpened',
    hostMenu: true,
    open: chooseFolderOpening,
    possible: () => desktopFiles() !== undefined || canChooseDirectory(),
    // The desktop keeps work in a folder or nowhere (ADR-0003); a tab keeps it
    // itself, and merely may be given one.
    required: () => desktopFiles() !== undefined,
    // Where a folder is already the source, what this offers is another one.
    offer: ({ source }) => (source.provider === 'folder' ? { labelKey: 'picker.changeFolder' } : undefined),
    resume: resumeFolder,
    remember: (preferences, opening) => withWorkingDirectory(preferences, opening.root),
    recent: async () => {
      const files = desktopFiles()
      if (!files) return []
      return (await files.recentDirectories()).map((held) => ({ key: held.root, label: held.name }))
    },
    reopen: reopenFolder,
  },
  // What opens a folder is fetched when one is opened: a tab that never is one
  // does not download it, and the desktop fetches it once, at its first folder.
  open: async (opening, base) => (await import('./openFolder')).openFolder(opening, base),
}

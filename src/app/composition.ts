/**
 * The composition: which outside world this shell gets.
 *
 * Deliberately the only file that knows both a seam and a filling. Everything
 * above this line talks to `ProjectStore`, `PreferencesStore` and
 * `DocumentGateway` and does not know what sits underneath; everything below it
 * does not know who calls. The moment somewhere else also decides which store it
 * is, that property is gone — and there is a lint rule for it
 * (`eslint.config.js`), because an agreement that lives only in a comment wears
 * off.
 *
 * Another place to keep things (disk via the File System Access API, Electron
 * over IPC, a server) is: a class under `src/adapters/`, the contract run over
 * it (`ports/ProjectStore.contract.ts`), and one branch here. Not a single file
 * above it changes.
 *
 * It also decides what this build KNOWS, not only where it keeps things. The
 * icon packs are the first of those: a general-purpose architecture tool has no
 * business shipping a railway vocabulary in its model, so the rail marks are a
 * pack and the line below is the whole of their wiring.
 */
import { registerLogoPack } from '../model/logoRegistry'
import { FileSystemGroupStore } from '../adapters/fileSystem/FileSystemGroupStore'
import { FileSystemProjectStore } from '../adapters/fileSystem/FileSystemProjectStore'
import { desktopCommands, desktopFiles } from '../adapters/desktop/desktopFiles'
import { IpcDirectoryHandle } from '../adapters/desktop/IpcDirectoryHandle'
import { rememberingWrites } from '../adapters/desktop/rememberingWrites'
import type { DesktopCommands, DesktopDirectory, DesktopFiles } from '../adapters/desktop/channel'

/**
 * Re-exported, because the boot has to name a folder and the lint rule says
 * only this file may name an adapter. A type is not a filling — but a second
 * import path into `adapters/` is exactly the crack the rule exists to close.
 */
export type { DesktopDirectory }
import { RAIL_PACK } from './iconPacks/rail'
import { BrowserDocumentGateway } from '../adapters/browser/BrowserDocumentGateway'
import { browserHostControls } from '../adapters/browser/browserHostControls'
import { ConsoleDiagnostics } from '../adapters/browser/ConsoleDiagnostics'
import { hostWindowChrome } from '../adapters/browser/hostWindow'
import { InMemoryGroupStore } from '../adapters/memory/InMemoryGroupStore'
import { InMemoryPreferencesStore } from '../adapters/memory/InMemoryPreferencesStore'
import { InMemoryProjectStore } from '../adapters/memory/InMemoryProjectStore'
import { browserStorage } from '../adapters/webStorage/available'
import { WebStorageGroupStore } from '../adapters/webStorage/WebStorageGroupStore'
import { WebStoragePreferencesStore } from '../adapters/webStorage/WebStoragePreferencesStore'
import { WebStorageProjectStore } from '../adapters/webStorage/WebStorageProjectStore'
import { refPath } from '../projects/projectRef'
import type { ProjectRef } from '../projects/projectRef'
import type { WindowChrome } from '../platform/windowChrome'
import type { Diagnostics } from '../ports/Diagnostics'
import type { DocumentGateway } from '../ports/DocumentGateway'
import type { GroupStore } from '../ports/GroupStore'
import type { HostControls } from '../ports/HostControls'
import type { PreferencesStore } from '../ports/PreferencesStore'
import type { ProjectStore } from '../ports/ProjectStore'

/**
 * A subscription to one project's folder. Returns the way to stop it — the
 * workspace is remounted per project, and a listener per project ever opened
 * is a leak with a slow fuse.
 */
export type WatchProject = (ref: ProjectRef, onChanged: () => void) => () => void

/** Everything the shell needs from outside, in one grip. */
export type Shell = {
  projects: ProjectStore
  /** What each group says about itself. Decoration; groups are still derived. */
  groups: GroupStore
  preferences: PreferencesStore
  documents: DocumentGateway
  /**
   * Where a failure goes when there is nobody to tell. Passed down like the
   * other seams, so a boundary or a rejected promise has somewhere to report
   * before it draws a message.
   */
  diagnostics: Diagnostics
  /** What the crash fallback can do about it: reload, and copy the trail. */
  hostControls: HostControls
  /**
   * Which of the two this composition settled on.
   *
   * The memory stores never fail, which is the point of them and also the
   * problem: without this the shell cannot tell "everything is being saved"
   * from "nothing will outlive this tab", and the user is told neither.
   */
  storage: 'browser' | 'memory' | 'folder'
  /**
   * The folder the projects are in, when they are in one. Absent in a browser
   * tab and on a desktop that has not been given a folder yet — the picker says
   * which of the two the user is looking at.
   */
  workingDirectory?: DesktopDirectory
  /**
   * Tell me when this project's folder changed under us, other than by us.
   *
   * Absent when nothing can watch — a browser tab, or a folder the platform
   * will not report on. The shell then simply never hears about a second
   * author, which is what it did before any of this existed.
   */
  watchProject?: WatchProject
  /**
   * What the window around the app is doing, which on the desktop is less than
   * a browser does: no title bar to move it by, and controls drawn over our
   * own top bar.
   */
  windowChrome: WindowChrome
}

/**
 * The shell as it stands in a browser.
 *
 * If storage refuses — private window, strict policy — memory takes its place.
 * The session then works in full and simply leaves nothing behind, which is
 * precisely what the user asked for by opening such a window. Before this layer
 * the answer to that situation was a `try/catch` in four places and an empty
 * editor if one of them was missed.
 */
export function composeShell(): Shell {
  const storage = browserStorage()
  return {
    projects: storage ? new WebStorageProjectStore(storage) : new InMemoryProjectStore(),
    groups: storage ? new WebStorageGroupStore(storage) : new InMemoryGroupStore(),
    preferences: storage ? new WebStoragePreferencesStore(storage) : new InMemoryPreferencesStore(),
    documents: new BrowserDocumentGateway(),
    diagnostics: new ConsoleDiagnostics(),
    hostControls: browserHostControls(),
    storage: storage ? 'browser' : 'memory',
    windowChrome: hostWindowChrome(),
  }
}

/**
 * Is there a desktop under us with a file channel?
 *
 * Re-exported through the composition rather than imported by the boot, so the
 * rule that only this file names both a seam and a filling still holds. The
 * answer is a capability, not a store: what it is used FOR is below.
 */
export function desktopFileChannel(): DesktopFiles | undefined {
  return desktopFiles()
}

/**
 * The menu, and the files the OS opens us with.
 *
 * Subscribed to in two places on purpose — the shell takes the commands about
 * folders, the workspace takes the ones about the open project — so each layer
 * handles what it actually owns instead of routing the others through props.
 */
export function desktopCommandChannel(): DesktopCommands | undefined {
  return desktopCommands()
}

/**
 * The same shell, keeping its projects in a folder the user chose.
 *
 * The whole of the desktop's storage, and it is two lines: the folder store
 * over an IPC handle instead of over a browser's. Nothing above this file
 * changes — not `App`, not a component, not a test — which is what the seam was
 * for and what `ProjectStore.contract.ts` checks on both.
 *
 * Preferences stay where they were. They describe this machine (its language,
 * its theme, which folder it uses), so putting them in the folder would carry
 * one machine's settings to every other machine that opens it.
 */
export function inWorkingDirectory(
  shell: Shell, files: DesktopFiles, directory: DesktopDirectory,
): Shell {
  // Everything goes through the remembering wrapper, including the stores:
  // a write that went round it would come back as somebody else's change.
  const channel = rememberingWrites(files)
  const handle = new IpcDirectoryHandle(channel.files, directory.root, directory.name)

  const watchProject: WatchProject = (ref, onChanged) => {
    // Watching the whole folder rather than one project: it is one watcher for
    // the window, and watching the same root twice is a no-op in main. Nothing
    // unwatches it — another project may be opened a second later, and the
    // watcher costs one handle.
    void channel.files.watch(directory.root).catch(() => undefined)
    const prefix = `${refPath(ref)}/`
    return channel.files.onChanged((change) => {
      if (change.root !== directory.root || !change.path.startsWith(prefix)) return
      if (channel.ours(change)) return
      onChanged()
    })
  }

  return {
    ...shell,
    projects: new FileSystemProjectStore(handle),
    groups: new FileSystemGroupStore(handle),
    storage: 'folder',
    workingDirectory: directory,
    watchProject,
  }
}

/**
 * At module load, which is before the first render and long before an export
 * asks whether an icon key is one this build knows. Registering later would
 * mean a window in which a saved `rail-*` key does not resolve.
 */
registerLogoPack(RAIL_PACK)

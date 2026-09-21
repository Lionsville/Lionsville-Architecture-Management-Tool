/**
 * The composition: which outside world this shell gets.
 *
 * Deliberately the only file that knows both a seam and a filling. Everything
 * above this line talks to `ScopeStore`, `PreferencesStore` and
 * `DocumentGateway` and does not know what sits underneath; everything below it
 * does not know who calls. The moment somewhere else also decides which store it
 * is, that property is gone — and there is a lint rule for it
 * (`eslint.config.js`), because an agreement that lives only in a comment wears
 * off.
 *
 * Another place to keep things (disk via the File System Access API, Electron
 * over IPC, a server) is: a class under `src/adapters/`, the contract run over
 * it (`ports/ScopeStore.contract.ts`), and one branch here. Not a single file
 * above it changes.
 *
 * It also decides what this build KNOWS, not only where it keeps things. The
 * icon packs are the first of those: a general-purpose architecture tool has no
 * business shipping a railway vocabulary in its model, so the rail marks are a
 * pack and the line below is the whole of their wiring.
 *
 * Where work is kept is the second. A folder, this browser's storage and memory
 * are three **registered source providers** rather than three branches, and the
 * registry is here for the same reason the branch was: this is the one file
 * that may name both a seam and a filling. A build composed from this one adds
 * a fourth by registering it, and nothing above this line is edited for it.
 */
import { registerLogoPack } from '../model/logoRegistry'
import { FileSystemFolderSettings } from '../adapters/fileSystem/FileSystemFolderSettings'
import { FileSystemScopeStore } from '../adapters/fileSystem/FileSystemScopeStore'
import type { DirectoryHandleLike } from '../adapters/fileSystem/FileSystemScopeStore'
import {
  canChooseDirectory, chooseDirectory as chooseBrowserDirectory, rememberedDirectory,
} from '../adapters/browser/workingDirectory'
import { DesktopAgentGateway } from '../adapters/desktop/DesktopAgentGateway'
import { DesktopProjectHistory } from '../adapters/desktop/DesktopProjectHistory'
import {
  desktopAgent, desktopCommands, desktopFiles, desktopHistory,
  desktopHookChannel as hookChannel, desktopSettings,
} from '../adapters/desktop/desktopFiles'
import { DesktopUpdateSettings } from '../adapters/desktop/DesktopUpdateSettings'
import { IpcDirectoryHandle } from '../adapters/desktop/IpcDirectoryHandle'
import { DesktopDocumentGateway } from '../adapters/desktop/DesktopDocumentGateway'
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
import { hostWindowChrome, showWindowTitle } from '../adapters/browser/hostWindow'
import { InMemoryPreferencesStore } from '../adapters/memory/InMemoryPreferencesStore'
import { InMemoryScopeStore } from '../adapters/memory/InMemoryScopeStore'
import { browserStorage } from '../adapters/webStorage/available'
import { WebStoragePreferencesStore } from '../adapters/webStorage/WebStoragePreferencesStore'
import { WebStorageScopeStore } from '../adapters/webStorage/WebStorageScopeStore'
import type { ScopePath } from '../projects/scopePath'
import { isFormatPath } from '../projects/folderFormat'
import type { WindowChrome } from '../platform/windowChrome'
import { BROWSER_STORAGE, IN_MEMORY } from '../platform/workingSource'
import type { WorkingSource } from '../platform/workingSource'
import type { HookInvoke } from '../platform/desktopHook'
import type {
  SourceProvider, SourceStatus, SourceWork, SourceWorkChanged,
} from '../platform/sourceProvider'
import type { ScopeSession } from './useModelSession'
import type { KeyValueStorage } from '../adapters/webStorage/KeyValueStorage'
import type { AgentGateway } from '../ports/AgentGateway'
import type { Diagnostics } from '../ports/Diagnostics'
import type { ProjectHistory } from '../ports/ProjectHistory'
import type { DocumentGateway } from '../ports/DocumentGateway'
import type { FolderSettingsStore } from '../ports/FolderSettings'
import type { UpdateSettingsStore } from '../ports/UpdateSettings'
import type { HostControls } from '../ports/HostControls'
import type { PreferencesStore } from '../ports/PreferencesStore'
import type { ScopeStore } from '../ports/ScopeStore'

/**
 * A subscription to one scope's folder. Returns the way to stop it — the
 * workspace is remounted per scope, and a listener per scope ever opened is a
 * leak with a slow fuse.
 */
/**
 * Hear about changes to one scope's own files — or, with `wholeTree`, to
 * anything under it, which is what the index over the tree asks for.
 */
export type WatchProject = (path: ScopePath, onChanged: () => void, wholeTree?: boolean) => () => void

/** Everything the shell needs from outside, in one grip. */
export type Shell = {
  scopes: ScopeStore
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
   * What this composition settled on: a folder, the browser's storage, or
   * memory (ADR-0005).
   *
   * The memory stores never fail, which is the point of them and also the
   * problem: without this the shell cannot tell "everything is being saved"
   * from "nothing will outlive this tab", and the user is told neither. A
   * desktop that has not been given a folder yet is not on a folder, and the
   * first-run screen asks.
   */
  source: WorkingSource
  /**
   * What this source means by the five words the bar says (`dirty`, `saving`,
   * `clean`, `external-changed`, `conflict`).
   *
   * Absent where the document's own machine is the whole answer, which is what
   * a file is and what all three sources that ship are. A source that keeps
   * work somewhere else may mean something else by *dirty* than "a file not
   * yet written", and this is where it says so —
   * `platform/sourceProvider.ts` has the reasoning.
   */
  sourceStatus?: (work: SourceWork) => SourceStatus
  /**
   * The source says its own answer to {@link Shell.sourceStatus} has moved.
   *
   * Without it that function is only ever asked again when the document's own
   * machine moves — which is every answer there is for a file, and half of the
   * answer for anywhere else. Absent with `sourceStatus`, and then the bar
   * behaves exactly as it always has.
   */
  onSourceWork?: SourceWorkChanged
  /**
   * A scope has been opened: the session over it, for whoever answers for the
   * source it is kept in.
   *
   * The one thing a registered provider could not reach. Everything else it
   * brings is a store or a setting, handed over at `open` and read from above;
   * a scope's session is made inside the workspace, remounted with it, and
   * lives a whole level below the boot — so a source that has to carry a change
   * somewhere, or take one from somewhere, had no way in. This is that way in,
   * and the answer is how to stop: the workspace is remounted per scope, and a
   * subscription per scope ever opened is a leak with a slow fuse.
   *
   * Absent for all three sources that ship, because a folder, this browser's
   * storage and memory have nobody to tell.
   */
  onScopeSession?: (session: ScopeSession) => (() => void) | void
  /**
   * Tell me when this project's folder changed under us, other than by us.
   *
   * Absent when nothing can watch — a browser tab, or a folder the platform
   * will not report on. The shell then simply never hears about a second
   * author, which is what it did before any of this existed.
   */
  watchProject?: WatchProject
  /**
   * The snapshots of this working directory. Absent in a browser tab and until
   * a folder is chosen — there is nothing for a history to be a history OF.
   */
  history?: ProjectHistory
  /**
   * The folder's own settings — what everyone who opens it agrees on, and what
   * this machine does about it (ADR-0005). Absent where there is no folder,
   * rather than a null object: a dialog section with nothing to be about is
   * not drawn.
   */
  folderSettings?: FolderSettingsStore
  /**
   * The settings the desktop's main process keeps for itself — whether to
   * check for updates. Absent in a browser tab, which has no host to ask.
   */
  updateSettings?: UpdateSettingsStore
  /**
   * Where an agent's tool calls arrive (ADR-0007). Absent in a browser tab,
   * which has no main process to listen on its behalf.
   */
  agent?: AgentGateway
  /**
   * What the window around the app is doing, which on the desktop is less than
   * a browser does: no title bar to move it by, and controls drawn over our
   * own top bar.
   */
  windowChrome: WindowChrome
  /**
   * Say what this window is about: the scope that is open, and the
   * organisation it sits in. A browser tab shows it in the tab strip and the
   * desktop reads it off the page, so one call serves both.
   */
  showTitle: (organisation: string, scope?: string) => void
}

/**
 * What opening a source gives the shell.
 *
 * The parts of one, not a whole: a folder brings a store and the folder's own
 * settings and deliberately leaves the preferences where they were, while the
 * two fallbacks bring both stores and nothing else. Only `source` is required,
 * because a source that cannot say what it is has nothing to put on the bar.
 */
export type SourceParts = Partial<Omit<Shell, 'source'>> & Pick<Shell, 'source'>

/**
 * Every kind of place this build can work from, by the kind it registered
 * under. A live map rather than a snapshot: registration happens at module
 * load and the lookups below run at the boot, long after.
 */
const SOURCE_PROVIDERS = new Map<string, SourceProvider<SourceParts, never>>()

/**
 * Teach this build a kind of place work can be kept.
 *
 * Call it before anything composes a shell — the three that ship do, at module
 * load, at the foot of this file. A kind registered twice is ignored rather
 * than replaced, the way a logo pack is: a test that registers per case is then
 * safe, and a build cannot quietly take over the folder.
 */
export function registerSourceProvider<Opening>(
  provider: SourceProvider<SourceParts, Opening>,
): void {
  if (SOURCE_PROVIDERS.has(provider.kind)) return
  SOURCE_PROVIDERS.set(provider.kind, provider)
}

/** Who answers for a kind of source, or nobody. */
export function sourceProvider<Opening = void>(
  kind: string,
): SourceProvider<SourceParts, Opening> | undefined {
  return SOURCE_PROVIDERS.get(kind)
}

/**
 * Open a source by its kind, with what it asked to be given.
 *
 * The provider's word about the five statuses travels with its parts, so the
 * shell carries it beside the source itself and nothing downstream has to
 * consult the registry to find out what *dirty* means here.
 */
function openSource<Opening>(kind: string, opening: Opening): SourceParts {
  const provider = sourceProvider<Opening>(kind)
  // The boot, in the one file that chose the kind. A wiring mistake found here
  // is a wiring mistake; found at the first save it is a lost document.
  if (!provider) throw new Error(`no source provider is registered for '${kind}'`)
  return { ...provider.open(opening), sourceStatus: provider.statusOf }
}

/** Somewhere to keep a scope, which is the one part no source may leave out. */
function keeper(kind: string, parts: SourceParts): ScopeStore {
  if (!parts.scopes) throw new Error(`the '${kind}' source brought nowhere to keep a scope`)
  return parts.scopes
}

/**
 * The shell as it stands in a browser.
 *
 * If storage refuses — private window, strict policy — memory takes its place.
 * The session then works in full and simply leaves nothing behind, which is
 * precisely what the user asked for by opening such a window. Before this layer
 * the answer to that situation was a `try/catch` in four places and an empty
 * editor if one of them was missed.
 *
 * Which of the two it is used to be a ternary here; it is a lookup now, and the
 * two fallbacks are registrations like any other.
 */
export function composeShell(): Shell {
  const storage = browserStorage()
  const kind = storage ? 'browserStorage' : 'memory'
  const kept = openSource(kind, storage)
  return {
    ...kept,
    scopes: keeper(kind, kept),
    // Both fallbacks bring one, and the preferences are read before the first
    // render — so a source that brought none is not a shell this boot can use.
    preferences: kept.preferences ?? failNoPreferences(kind),
    documents: new BrowserDocumentGateway(),
    diagnostics: new ConsoleDiagnostics(),
    hostControls: browserHostControls(),
    // The one desktop seam that does not wait for a folder: it is about this
    // install, not about where the projects are.
    updateSettings: desktopSettings() && new DesktopUpdateSettings(desktopSettings()!),
    agent: desktopAgent() && new DesktopAgentGateway(desktopAgent()!),
    windowChrome: hostWindowChrome(),
    showTitle: showWindowTitle,
  }
}

function failNoPreferences(kind: string): never {
  throw new Error(`the '${kind}' source brought nowhere to keep a preference`)
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
 * The way to a hook's main side, where there is a desktop under us
 * (`platform/desktopHook.ts`). Re-exported for the same reason as the file
 * channel: only this file may name an adapter, and a build composed from this
 * one has to be able to ask.
 */
export function desktopHookChannel(): HookInvoke | undefined {
  return hookChannel()
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
 * A folder in a browser tab, where the browser can give one.
 *
 * Re-exported through the composition for the same reason as the file channel:
 * this is the only file that may name an adapter, and the boot needs to know
 * whether the offer can be made.
 */
export const browserFolders = {
  possible: canChooseDirectory,
  choose: chooseBrowserDirectory,
  remembered: rememberedDirectory,
}

/**
 * The same shell, keeping its projects in a folder the user chose.
 *
 * The whole of the desktop's storage, and it is two lines: the folder store
 * over an IPC handle instead of over a browser's. Nothing above this file
 * changes — not `App`, not a component, not a test — which is what the seam was
 * for and what `ScopeStore.contract.ts` checks on both.
 *
 * Preferences stay where they were. They describe this machine (its language,
 * its theme, which folder it uses), so putting them in the folder would carry
 * one machine's settings to every other machine that opens it.
 */
/**
 * The half of a folder shell that has nothing to do with which folder it is:
 * the stores. Shared by the desktop and by a browser tab that has been given a
 * directory handle, which is the whole reason `DirectoryHandleLike` exists.
 */
function overFolder(
  shell: Shell, handle: DirectoryHandleLike, name: string, root = name,
): Shell {
  const kept = openSource('folder', { handle, name, root })
  return { ...shell, ...kept, scopes: keeper('folder', kept) }
}

/**
 * A browser tab, working in a folder the user picked.
 *
 * Everything the desktop gets except the parts a tab cannot have: no save
 * dialog (a download is what a tab does), no watcher (nothing tells a page that
 * a file changed) and no history (there is no git in a tab). Those are absent
 * rather than stubbed, and the app offers what is present.
 */
export function inBrowserFolder(shell: Shell, handle: DirectoryHandleLike, name: string): Shell {
  return overFolder(shell, handle, name)
}

export function inWorkingDirectory(
  shell: Shell, files: DesktopFiles, directory: DesktopDirectory,
): Shell {
  // Everything goes through the remembering wrapper, including the stores:
  // a write that went round it would come back as somebody else's change.
  const channel = rememberingWrites(files)
  const handle = new IpcDirectoryHandle(channel.files, directory.root, directory.name)

  const watchProject: WatchProject = (scope, onChanged, wholeTree = false) => {
    // Watching the whole folder rather than one scope: it is one watcher for
    // the window, and watching the same root twice is a no-op in main. Nothing
    // unwatches it — another scope may be opened a second later, and the
    // watcher costs one handle.
    void channel.files.watch(directory.root).catch(() => undefined)
    // The scope's OWN files: what is on screen is this scope's document, and
    // a landscape filed under a domain being edited elsewhere, a README
    // dropped beside `scope.json`, an export saved into the folder are none of
    // them a change to it. `isFormatPath` is the one rule for which paths a
    // scope's folder holds, and it excludes a nested scope by construction.
    // The index asks for the whole tree instead, because a scope three levels
    // down renaming its ERP is exactly what it exists to notice.
    const prefix = scope === '' ? '' : `${scope}/`
    return channel.files.onChanged((change) => {
      if (change.root !== directory.root || !change.path.startsWith(prefix)) return
      if (!wholeTree && !isFormatPath(change.path.slice(prefix.length))) return
      // Our own writes come back as news, and whether that is news depends on
      // who asks. The open scope must not hear them: it just wrote them, and
      // "changed on disk" would be the app interrupting itself. The tree
      // MUST: the index is derived from every scope's records, this app's
      // own writes included — an example copied in, a scope created, a
      // landscape saved with one more application — and an index that only
      // heard about other people's changes stood empty on the desktop until
      // a restart, while every register, map and stand-in read from it.
      if (!wholeTree && channel.ours(change)) return
      onChanged()
    })
  }

  const folder = overFolder(shell, handle, directory.name, directory.root)
  const settings = folder.folderSettings
  const git = desktopHistory()
  return {
    ...folder,
    // A real save dialog rather than a download. Swapped here rather than in
    // `composeShell` because it is the same decision as the store: this is the
    // desktop, and on the desktop a file goes where the user says.
    documents: new DesktopDocumentGateway(files),
    watchProject,
    history: git && new DesktopProjectHistory(git, directory.root),
    // The machine file is kept out of the folder's history from the moment it
    // first exists: `.git/info/exclude`, so a `git add -A` typed in a terminal
    // does not pick it up either. Best effort — the snapshot excludes it on
    // its own — and this is the one place that knows both the store and the
    // git, which is why the wrapping is here and not in either.
    //
    // Delegated method by method, not spread: the store is a class, and a
    // spread copies an instance's own fields and none of its prototype — which
    // is how `readLocal` went missing from every desktop boot for a day.
    folderSettings: settings && {
      id: settings.id,
      readFolder: () => settings.readFolder(),
      writeFolder: (patch) => settings.writeFolder(patch),
      readLocal: () => settings.readLocal(),
      writeLocal: async (patch) => {
        await settings.writeLocal(patch)
        await git?.excludeLocal(directory.root).catch(() => undefined)
      },
    },
  }
}

/**
 * What a folder source needs to be given: the handle to work through, and what
 * the folder is called and where it is.
 *
 * A browser's handle has no path to give, so `root` falls back to the name —
 * which is all a tab knows about where it is, and enough to tell two folders
 * apart within one tab.
 */
export type FolderOpening = {
  handle: DirectoryHandleLike
  name: string
  root: string
}

/**
 * A folder of text files (ADR-0003), which is what the desktop works from and
 * what a browser tab works from when it has been given one.
 *
 * It brings the store and the folder's own settings and nothing else. The
 * preferences stay where they were on purpose: they describe this machine — its
 * language, its theme, which folder it uses — so putting them in the folder
 * would carry one machine's settings to every other machine that opens it.
 */
const FOLDER_SOURCE: SourceProvider<SourceParts, FolderOpening> = {
  kind: 'folder',
  connect: { labelKey: 'picker.chooseFolder' },
  open: ({ handle, name, root }) => ({
    scopes: new FileSystemScopeStore(handle),
    folderSettings: new FileSystemFolderSettings(handle),
    source: { kind: 'folder', name, root },
  }),
}

/** This browser's own storage: the fallback, and it says so on the bar. */
const BROWSER_STORAGE_SOURCE: SourceProvider<SourceParts, KeyValueStorage> = {
  kind: 'browserStorage',
  open: (storage) => ({
    scopes: new WebStorageScopeStore(storage),
    preferences: new WebStoragePreferencesStore(storage),
    source: BROWSER_STORAGE,
  }),
}

/**
 * Nowhere at all, which is the honest answer when storage refuses. It never
 * fails, so the session works in full and simply leaves nothing behind.
 */
const IN_MEMORY_SOURCE: SourceProvider<SourceParts, unknown> = {
  kind: 'memory',
  open: () => ({
    scopes: new InMemoryScopeStore(),
    preferences: new InMemoryPreferencesStore(),
    source: IN_MEMORY,
  }),
}

/**
 * At module load, which is before the first render and long before an export
 * asks whether an icon key is one this build knows. Registering later would
 * mean a window in which a saved `rail-*` key does not resolve.
 *
 * The three sources go the same way and for the same kind of reason: the boot
 * composes a shell before it draws anything, and a provider registered after
 * that is a provider nothing can be opened from.
 */
registerLogoPack(RAIL_PACK)
registerSourceProvider(FOLDER_SOURCE)
registerSourceProvider(BROWSER_STORAGE_SOURCE)
registerSourceProvider(IN_MEMORY_SOURCE)

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
import type { ScopeSnapshot } from '../projects/scope'
import { filledStore } from '../projects/filledStore'
import type { ScopeStoreFilling } from '../projects/filledStore'
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
import { DesktopFolderSettings } from '../adapters/desktop/DesktopFolderSettings'
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
  SourceChip as ProviderChip,
  SourceConnect, SourceFailure, SourceProvider, SourceStatus, SourceWork, SourceWorkChanged,
} from '../platform/sourceProvider'
import type { StringKey } from '../i18n/strings'
import type {
  RegisteredChrome, RegisteredMenu, SourceAgentPanel, SourceChipPanel, SourceChrome, SourceMenu,
} from './App'
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
import type { DirectoryHandleLike } from '../ports/DirectoryHandle'

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
   * What this source says a refusal where it keeps work means
   * (`platform/sourceProvider.ts`).
   *
   * The sentence a refused save shows is this tree's — *this browser could not
   * save the design* — and it is right for the three that ship and wrong for
   * anywhere else. Absent, and it is said exactly as it always was.
   *
   * Brought with a source's parts rather than declared on the registration,
   * which is where its word about the five statuses is: what the five words mean
   * is a fact about the KIND of place, and what a refusal from it means is a
   * fact about the store this opening just made — which host answered, who is
   * signed in, what it would say about either. A provider answering from the
   * registration would have to keep the last opening in a variable to say it.
   */
  sourceFailure?: SourceFailure
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
   * Every change of the open scope travels as a step through whoever took its
   * session (ADR-0022: *a step is published, not saved*).
   *
   * Then a whole write of the open scope made by this shell after a command
   * is a second copy of what the step already carried — one taken of this
   * window's model, which lands over every step somebody else made to that
   * scope in the meantime. The shell makes none of its own where this is
   * true. Absent for all three sources that ship, whose changes are written.
   */
  publishesSteps?: boolean
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
 * The shell's own side of opening a source: what a provider is handed besides
 * the opening it asked for.
 *
 * Two things, and both of them were reachable from inside this file and from
 * nowhere else. A provider that has to report a failure had the console and
 * nothing better — which is the one place the crash page cannot hand over, so a
 * source that would not open left no trail in the thing the user is invited to
 * copy. And a provider that replaces the store had no way to reuse the seams
 * this shell has already filled, so the honest thing for it to do was compose a
 * second preferences store, a second document gateway and a second browser
 * store — three decisions this file exists to make once.
 *
 * `shell` is the shell as it stands BEFORE this provider's parts are spread
 * over it, which is what makes it safe to read: nothing in it is the provider's
 * own answer coming back at it. It is absent in exactly one place, and
 * {@link composeShell} says why — the first compose has no shell yet, because
 * the shell being built there is the one this source brings the stores for.
 */
export type SourceBase = {
  /** The trail the app already keeps. `diagnostics.report`, and nothing else. */
  readonly diagnostics: Diagnostics
  /** What this source is opening into, where there is one. */
  readonly shell?: Shell
}

/**
 * A provider as this build registers one: what `platform/sourceProvider.ts`
 * says, plus the one thing only a file that may name a screen can carry.
 *
 * `chrome` is a component, and `platform` computes — it may not so much as name
 * React (`eslint.config.js`). So the strip a provider draws is declared here,
 * where `SourceChrome` is already a word this file knows, and everything else
 * about a provider stays where a test with no DOM can read it.
 *
 * It is declared on the REGISTRATION rather than brought with the parts of an
 * opened source, which is the whole of the fix: a chrome that only existed once
 * a source was open was missing at the one moment a provider needs a screen —
 * the first press of its way in, when it has to ask where to connect to and is
 * not the source yet. {@link SourceChrome} says what the shell then owes it, and
 * what being drawn while its provider is nobody's source asks of it in return.
 */
export type RegisteredSourceProvider<Opening = never> =
  SourceProvider<SourceParts, Opening, SourceBase> & {
    readonly chrome?: SourceChrome
    /**
     * What this provider wants in the app's own menu, asked for afresh
     * ({@link SourceMenu}).
     *
     * Here rather than in `platform/` for the same reason `chrome` is, one step
     * further in: what a line IS carries no React and lives down there
     * (`SourceMenuEntry`), but what a provider is TOLD when it decides which
     * lines to offer is the session of the open scope, and a session is a word
     * this layer owns. What a line looks like stays the shell's business either
     * way — a provider hands over lines and never a menu.
     *
     * The alternative for a provider with actions of its own is a strip of its
     * own floating over the app, which is a second place to look for what can be
     * done here. Core's three register none: there is nothing to do to a folder
     * that the File menu does not already offer.
     */
    readonly menu?: SourceMenu
    /**
     * What this provider puts inside *Connect an agent* about reaching its own
     * source ({@link SourceAgentPanel}).
     *
     * Here rather than in `platform/` for the reason `chrome` is: it is a
     * component. Asked for the open source's provider only, unlike those two —
     * that dialog is about reaching the landscape that is open, and a panel from
     * a provider answering for nothing would be a way in to nowhere. Core's
     * three register none: the loopback server is the only way an agent reaches
     * a folder, and this shell already says so.
     */
    readonly agentPanel?: SourceAgentPanel
    /**
     * What pressing the chip that names this provider's source opens
     * ({@link SourceChipPanel}). Here rather than in `platform/` for the
     * reason `chrome` is: it is a component. Core's three register none.
     */
    readonly chipPanel?: SourceChipPanel
  }

/**
 * Every kind of place this build can work from, by the kind it registered
 * under. A live map rather than a snapshot: registration happens at module
 * load and the lookups below run at the boot, long after.
 */
const SOURCE_PROVIDERS = new Map<string, RegisteredSourceProvider>()

/**
 * Teach this build a kind of place work can be kept.
 *
 * Call it before anything composes a shell — the three that ship do, at module
 * load, at the foot of this file. A kind registered twice is ignored rather
 * than replaced, the way a logo pack is: a test that registers per case is then
 * safe, and a build cannot quietly take over the folder.
 */
export function registerSourceProvider<Opening>(
  provider: RegisteredSourceProvider<Opening>,
): void {
  if (SOURCE_PROVIDERS.has(provider.kind)) return
  // The one cast in this registry, and it is where the type is genuinely lost:
  // what a provider needs to be given is its own, the map holds every kind at
  // once, and only the caller that asks for a kind knows which. `sourceProvider`
  // below hands the knowledge back, which is why nothing else has to.
  SOURCE_PROVIDERS.set(provider.kind, provider as RegisteredSourceProvider)
}

/** Who answers for a kind of source, or nobody. */
export function sourceProvider<Opening = void>(
  kind: string,
): RegisteredSourceProvider<Opening> | undefined {
  return SOURCE_PROVIDERS.get(kind) as RegisteredSourceProvider<Opening> | undefined
}

/**
 * What every registered provider draws for itself, in the order they
 * registered: one entry per registration, and none for a provider that draws
 * nothing.
 *
 * Read by the boot, which hands the whole list to `App` — not the open source's
 * one. A provider is at its most talkative before it is the source: its way in
 * has to ask for an address, say that a handshake is in flight, and say that it
 * came to nothing, and a strip that only appeared once the source was open was
 * one that appeared a moment too late to do any of it. Whether a provider
 * happens to answer for the source that is open decides what it is HANDED
 * ({@link SourceChrome}), and never whether it is drawn.
 */
/**
 * The sentence a provider gives for where it keeps work, or nothing.
 *
 * The organisation's home says one about the chip that names the source, and it
 * has a sentence per built-in kind because this tree knows what a folder and a
 * browser's storage are. A registered source's is the provider's own
 * (`describeKey`, in the provider's own table), and it is read here because the
 * registry is here: the screen that draws the chip may not name a filling, and
 * the boot is the one place that can ask.
 *
 * Nothing for the three that ship, whose sentences this tree holds already, and
 * nothing for a registered provider that gives none — which the chip then says
 * by saying nothing, rather than by guessing on its behalf.
 */
export function sourceDescription(
  source: WorkingSource,
): StringKey | (string & {}) | undefined {
  return source.kind === 'registered' ? sourceProvider(source.provider)?.describeKey : undefined
}

export function registeredChrome(): readonly RegisteredChrome[] {
  const found: RegisteredChrome[] = []
  for (const provider of SOURCE_PROVIDERS.values()) {
    if (provider.chrome) found.push({ kind: provider.kind, chrome: provider.chrome })
  }
  return found
}

/**
 * What every registered provider wants in the app's own menu, in the order they
 * registered: one entry per registration, and none for a provider that wants
 * nothing.
 *
 * Read by the boot and handed whole to `App`, for the reason the chromes are:
 * *sign in…* is a line the provider that is nobody's source yet needs most, and
 * a list built from the open source would be a menu that only offers what is
 * already reachable. Which provider answers for the open source decides what it
 * is TOLD when it is asked (`App`'s `SourceMenuContext`), and never whether it
 * is asked.
 *
 * Nothing for the three that ship: what can be done to a folder is the File
 * menu, and this registry is not a second place to say it.
 */
export function registeredMenus(): readonly RegisteredMenu[] {
  const found: RegisteredMenu[] = []
  for (const provider of SOURCE_PROVIDERS.values()) {
    if (provider.menu) found.push({ kind: provider.kind, menu: provider.menu })
  }
  return found
}

/**
 * What a provider calls the chip that names its source, at the moment it is
 * asked, or nothing.
 *
 * Beside {@link sourceDescription} and read the same way: the registry is here,
 * so the screen that draws the chip — which may not name a filling — is handed
 * the answer rather than asking for it. A function and not a word, because the
 * word moves while the window is open: the name a source was opened under is
 * fixed at the handshake, and who is signed in to it is not.
 *
 * Nothing for the three that ship, whose chip this tree has always said, and
 * nothing for a registered provider that gave none — and then the chip says the
 * name the source was opened under.
 */
export function sourceChip(
  source: WorkingSource,
): ((work?: SourceWork) => ProviderChip) | undefined {
  return source.kind === 'registered' ? sourceProvider(source.provider)?.chip : undefined
}

/**
 * What the provider answering for this source puts inside *Connect an agent*,
 * or nothing.
 *
 * Read here for the reason {@link sourceChip} is, and the open source's alone
 * rather than every registration: the chromes and the menu lines are asked of
 * every provider because a provider that answers for nothing still has a way in
 * to offer, and this is the opposite case — the dialog is about reaching the
 * landscape that is open, and nobody else has anything to say about that.
 *
 * Nothing for the three that ship, whose only way in for an agent is the server
 * on this machine that this shell already draws.
 */
export function sourceAgentPanel(source: WorkingSource): SourceAgentPanel | undefined {
  return source.kind === 'registered' ? sourceProvider(source.provider)?.agentPanel : undefined
}

/**
 * What pressing the chip that names this source opens, or nothing.
 *
 * The open source's alone, for the reason {@link sourceChip} is: the chip names
 * that source, so a panel from any other provider would be hanging from
 * somebody else's name. Nothing for the three that ship.
 */
export function sourceChipPanel(source: WorkingSource): SourceChipPanel | undefined {
  return source.kind === 'registered' ? sourceProvider(source.provider)?.chipPanel : undefined
}

/**
 * What the caller opening a source answers for itself, over the parts the
 * source builds (ADR-0022, the ninth amendment).
 *
 * The store only, because the store is what a build composed from this one has
 * had to answer for so far: an index in one round trip where the source's own
 * store would walk the tree for it, and a save that the build's own channel has
 * already carried. Handed at the open rather than laid over the parts after it,
 * so the store a caller gets back is one this file built — with the source's
 * own answers called as the source, which is what a copy made from the live
 * store by its prototype could not promise ({@link filledStore}).
 */
export type SourceFilling = {
  readonly scopes?: ScopeStoreFilling
}

/**
 * Open a source by its kind, with what it asked to be given.
 *
 * The provider's word about the five statuses travels with its parts, so the
 * shell carries it beside the source itself and nothing downstream has to
 * consult the registry to find out what *dirty* means here. That last part is
 * the whole of why this is exported: a build composed from this one opens its
 * own source at its own moment, and writing out
 * `{ ...provider.open(o), sourceStatus: provider.statusOf }` at that moment is
 * restating a rule of this file badly — the day a third thing travels with a
 * provider's parts, every such composer is quietly one field short and the bar
 * says the wrong word about somebody's unsaved work.
 *
 * `base` is not optional, for the same kind of reason: a composer that left it
 * out would be handing a provider a source with nowhere to report and nothing
 * of this shell to reuse, and it would find that out the first time something
 * went wrong there. {@link SourceBase} says what belongs in it.
 *
 * `filling` is the caller's own answers for the store the source brings
 * ({@link SourceFilling}). A filling for a source that brought no store is the
 * same wiring mistake as a source with nowhere to keep a scope, and is said the
 * same way.
 */
export function openSource<Opening>(
  kind: string, opening: Opening, base: SourceBase, filling: SourceFilling = {},
): SourceParts | Promise<SourceParts> {
  const provider = sourceProvider<Opening>(kind)
  // The boot, in the one file that chose the kind. A wiring mistake found here
  // is a wiring mistake; found at the first save it is a lost document.
  if (!provider) throw new Error(`no source provider is registered for '${kind}'`)
  const built = provider.open(opening, base)
  const carrying = (parts: SourceParts): SourceParts => ({
    ...parts,
    ...(filling.scopes ? { scopes: filledStore(keeper(kind, parts), filling.scopes) } : {}),
    sourceStatus: provider.statusOf,
  })
  // Awaited rather than handed on as a promise of parts: what travels with them
  // travels either way, and a caller that had to know which of the two it was
  // holding would be every caller writing the same `await` differently.
  return promised(built) ? built.then(carrying) : carrying(built)
}

/** Told apart the way `await` tells it apart, and for the same reason. */
function promised(parts: SourceParts | Promise<SourceParts>): parts is Promise<SourceParts> {
  return typeof (parts as Partial<Promise<SourceParts>>).then === 'function'
}

/**
 * The same, where there is nowhere to wait.
 *
 * The two shells this file composes itself are composed synchronously —
 * `composeShell` runs before the boot's first line and answers a shell, and a
 * folder is opened in the middle of building one — so the three that ship must
 * open without waiting, and they do. A provider that answered a promise to one
 * of these would be a wiring mistake in this file and never a build's, which is
 * why it is said out loud rather than awaited somewhere a folder would then have
 * to be awaited too.
 */
function openSourceNow<Opening>(
  kind: string, opening: Opening, base: SourceBase,
): SourceParts {
  const parts = openSource(kind, opening, base)
  if (promised(parts)) throw new Error(`the '${kind}' source opens asynchronously, and this composition cannot wait`)
  return parts
}

/**
 * Every registered provider that offers a way in for a person, in the order
 * they registered.
 *
 * The boot draws one button per entry (`platform/sourceProvider.ts`), so what
 * it needs is the label and the provider's own dialog — and `unknown` for what
 * that dialog answers with, because the boot never looks at it: it hands it
 * straight back to {@link openSource} under the same kind, which is the one
 * place that knows what it is.
 */
export type RegisteredConnect = {
  readonly kind: string
  readonly connect: SourceConnect<unknown>
}

export function registeredConnects(): readonly RegisteredConnect[] {
  const found: RegisteredConnect[] = []
  for (const provider of SOURCE_PROVIDERS.values()) {
    if (provider.connect) found.push({ kind: provider.kind, connect: provider.connect })
  }
  return found
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
  const diagnostics = new ConsoleDiagnostics()
  // The one opening with no shell to hand over, and it cannot have one: the
  // shell a provider would be given here is the shell being built out of what
  // it answers. The trail is the half that does exist, and it is the half a
  // fallback source could conceivably have something to say to.
  const kept = openSourceNow(kind, storage, { diagnostics })
  return {
    ...kept,
    scopes: keeper(kind, kept),
    // Both fallbacks bring one, and the preferences are read before the first
    // render — so a source that brought none is not a shell this boot can use.
    preferences: kept.preferences ?? failNoPreferences(kind),
    documents: new BrowserDocumentGateway(),
    diagnostics,
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
  // The shell this folder is opening into, before its own parts are spread over
  // it: the preferences stay where they were (see below), so what a provider in
  // its place would reuse is exactly what this line leaves alone.
  const kept = openSourceNow('folder', { handle, name, root }, { diagnostics: shell.diagnostics, shell })
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
    // watcher costs one handle. One that could not be set up is a folder whose
    // outside changes this window will not hear about, so the trail says so.
    void channel.files.watch(directory.root).catch((cause: unknown) => {
      shell.diagnostics.report({ level: 'warn', where: 'workingDirectory', message: 'the folder cannot be watched', cause })
    })
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
    // What this machine does about the folder is the desktop's to keep, in its
    // own data folder and not in the folder (ADR-0023); the folder's store is
    // read through for what an older build left there. A renderer without the
    // settings channel is a test, and keeps the folder's store as it is.
    folderSettings: settings && (
      desktopSettings() ? new DesktopFolderSettings(desktopSettings()!, directory.root, settings) : settings
    ),
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
 * A folder a working file may become (ADR-0025): chosen with the same picker
 * as *Open Folder…*, looked at before anything is written — a name, a scope
 * or a board in it is "occupied", and the shell asks again before writing
 * over one — and written scope by scope, shallowest first, the way a file's
 * scopes are answered. Moving the app there is the boot's, which owns the
 * shell; this only knows the store.
 */
export type FolderDestination = {
  opening: FolderOpening
  occupied: boolean
  place(scopes: readonly ScopeSnapshot[]): Promise<void>
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
    place: async (scopes) => { for (const scope of scopes) await store.save(scope) },
  }
}

/**
 * The folder's own way in: the picker this app has always had.
 *
 * Whichever picker there is — the desktop's dialog through the file channel, or
 * the browser's where the browser has one — and nothing at all where there is
 * neither, which is a tab that cannot be given a folder. The words on the
 * button are unchanged; this is only the answer to "what does pressing it ask
 * for", said in the shape every other provider says it in.
 *
 * The writes go through the remembering wrapper on the desktop for the reason
 * `inWorkingDirectory` does it: a write that went round it comes back from the
 * watcher as somebody else's change, and the app interrupts itself.
 */
async function chooseFolderOpening(): Promise<FolderOpening | undefined> {
  const files = desktopFiles()
  if (files) {
    const chosen = await files.chooseDirectory()
    if (!chosen) return undefined
    const channel = rememberingWrites(files)
    return {
      handle: new IpcDirectoryHandle(channel.files, chosen.root, chosen.name),
      name: chosen.name,
      root: chosen.root,
    }
  }
  if (!canChooseDirectory()) return undefined
  const handle = await chooseBrowserDirectory()
  // A browser's handle has no path to give, so the name is all there is to tell
  // two folders apart within one tab — which is what `FolderOpening` says.
  return handle && { handle, name: handle.name, root: handle.name }
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
  connect: { labelKey: 'picker.chooseFolder', open: chooseFolderOpening },
  // The trail the app keeps is where a file that will not read is said.
  open: ({ handle, name, root }, { diagnostics }) => ({
    scopes: new FileSystemScopeStore(handle, diagnostics),
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

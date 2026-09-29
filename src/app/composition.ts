// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The composition: which outside world this shell gets.
 *
 * Deliberately the only file that knows both a seam and a filling. Everything
 * above this line talks to the repositories (`ports/Repositories.ts`), the
 * `PreferencesStore` and the `DocumentGateway` and does not know what sits
 * underneath; everything below it does not know who calls. The moment
 * somewhere else also decides where work is kept, that property is gone — and
 * there is a lint rule for it (`eslint.config.js`), because an agreement that
 * lives only in a comment wears off.
 *
 * Another place to keep things (a server, a drive shared by a team) is: its
 * repositories, with core's contract suites run over them
 * (`ports/Repositories.contract.ts`), a provider that opens them and draws
 * what it has to say (`src/providers/`), and one registration here. Not a
 * single file above it changes.
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
import { DesktopAgentGateway } from '../adapters/desktop/DesktopAgentGateway'
import {
  desktopAgent, desktopCommands, desktopFiles,
  desktopHookChannel as hookChannel, desktopSettings,
} from '../adapters/desktop/desktopFiles'
import { DesktopUpdateSettings } from '../adapters/desktop/DesktopUpdateSettings'
import { DesktopDocumentGateway } from '../adapters/desktop/DesktopDocumentGateway'
import type { DesktopCommands, DesktopFiles } from '../adapters/desktop/channel'
import { RAIL_PACK } from './iconPacks/rail'
import { EXAMPLE_CATALOGUE } from '../projects/examples/catalogue'
import type { ExampleOffer } from '../projects/examples/catalogue'
import { SHIPPED_EXAMPLES } from '../adapters/folder/format/shippedExamples'
import { BrowserDocumentGateway } from '../adapters/browser/BrowserDocumentGateway'
import { browserHostControls } from '../adapters/browser/browserHostControls'
import { reloadOnStaleScripts } from '../adapters/browser/staleScripts'
import { ConsoleDiagnostics } from '../adapters/browser/ConsoleDiagnostics'
import { hostWindowChrome, showWindowTitle } from '../adapters/browser/hostWindow'
import { browserDatabase, browserStorage } from '../adapters/webStorage/available'
import type { WindowChrome } from '../platform/windowChrome'
import { sourceProviderKind } from '../platform/workingSource'
import type { WorkingSource } from '../platform/workingSource'
import { BROWSER_STORAGE_SOURCE } from '../providers/browserStorage/browserStorageSource'
import { BrowserChrome } from '../providers/browserStorage/BrowserChrome'
import { chooseFolderDestination, FOLDER_SOURCE } from '../providers/folder/folderSource'
import { FolderChrome } from '../providers/folder/FolderChrome'
import { FolderPreferences } from '../providers/folder/FolderPreferences'
import { MEMORY_SOURCE } from '../providers/memory/memorySource'
import { MemoryNotice } from '../providers/memory/MemoryNotice'
import type { HookInvoke } from '../platform/desktopHook'
import type {
  SourceChip as ProviderChip, SourceConnect, SourceProvider, SourceRecentActivity, SourceWork,
} from '../platform/sourceProvider'
import type { StringKey } from '../i18n/strings'
import type { ComponentType } from 'react'
import type {
  RegisteredChrome, RegisteredMenu, SourceAgentPanel, SourceChipFace, SourceChipPanel, SourceMenu,
  SourcePreferencesPanel,
} from './App'
import type {
  ProviderParts, SourceChipPanelProps, SourceChromeProps, SourceDestination, SourcePreferencesPanelProps,
} from '../ports/ProviderParts'
import type { Repositories } from '../ports/Repositories'
import type { Interchange } from '../ports/Interchange'
import { ShellError } from '../platform/errors'
import { WORKING_FILE_ACCEPTS } from '../adapters/folder/format/workingFileKinds'
import type { Translate } from '../i18n'
import type { AgentGateway } from '../ports/AgentGateway'
import type { Diagnostics } from '../ports/Diagnostics'
import type { DocumentGateway } from '../ports/DocumentGateway'
import type { UpdateSettingsStore } from '../ports/UpdateSettings'
import type { HostControls } from '../ports/HostControls'
import type { PreferencesStore } from '../ports/PreferencesStore'


/**
 * Everything the shell needs from outside, in one grip: the parts the source's
 * provider brought (`ports/ProviderParts.ts`, ADR-0031 §4) — its repositories
 * among them, the app's one way to where work is kept — and the host's own,
 * which are the same whatever the source.
 */
export type Shell = ProviderParts & {
  /**
   * Where this install's preferences go: the source's where it keeps them,
   * the host's otherwise. Required here, because they are read before the
   * first render.
   */
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

/** What opening a source gives the shell: its provider's parts (`ports/ProviderParts.ts`). */
export type SourceParts = ProviderParts

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
  /** The person's language, for what a source records or says before there is an app to say it. */
  readonly s?: Translate
  /**
   * Where this boot kept work before any source was chosen — this browser's
   * own storage, or memory — for a source that may offer to bring it along.
   */
  readonly beneath?: Repositories
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
export type RegisteredSourceProvider<Opening = never, Own = unknown> =
  SourceProvider<ProviderParts<Own>, Opening, SourceBase> & {
    readonly chrome?: ComponentType<SourceChromeProps<Own>>
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
    readonly chipPanel?: ComponentType<SourceChipPanelProps<Own>>
    /**
     * What the chip that names this provider's source looks like, where a
     * word is not enough ({@link SourceChipFace}): drawn inside the chip in
     * place of its label. A component, so here beside `chipPanel`. Core's
     * three register none.
     */
    readonly chipFace?: SourceChipFace
    /**
     * What this provider puts inside *Preferences* about its own source
     * (`App`'s `SourcePreferencesPanel`), handed what it handed with its
     * parts. Asked for the open source's provider only, as `agentPanel` is.
     */
    readonly preferencesPanel?: ComponentType<SourcePreferencesPanelProps<Own>>
    /**
     * Somewhere new a working file may become (ADR-0025), by this provider's
     * way in: asked where, and looked at before anything is written. Asked
     * of the way in the host names (`SourceConnect.hostMenu`); the boot opens
     * the source there once the file has landed.
     */
    readonly destination?: () => Promise<SourceDestination<Opening> | undefined>
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
export function registerSourceProvider<Opening, Own = unknown>(
  provider: RegisteredSourceProvider<Opening, Own>,
): void {
  if (SOURCE_PROVIDERS.has(provider.kind)) return
  // The one cast in this registry, and it is where the type is genuinely lost:
  // what a provider needs to be given is its own, the map holds every kind at
  // once, and only the caller that asks for a kind knows which. `sourceProvider`
  // below hands the knowledge back, which is why nothing else has to.
  // And what it hands its own chrome is its own too: the chrome is only ever
  // handed the parts this same provider built (`App`'s `chromeProps`).
  SOURCE_PROVIDERS.set(provider.kind, provider as unknown as RegisteredSourceProvider)
}

/** Who answers for a kind of source, or nobody. */
export function sourceProvider<Opening = void>(
  kind: string,
): RegisteredSourceProvider<Opening> | undefined {
  return SOURCE_PROVIDERS.get(kind) as RegisteredSourceProvider<Opening> | undefined
}

/**
 * The sentence a provider gives for where it keeps work, or nothing.
 *
 * The chip that names the source says it when it is hovered, in the
 * provider's own words (`describeKey`, in its own table) — the three that ship
 * as surely as any other, because only the provider knows what kind of place
 * it is. Read here because the registry is here: the screen that draws the
 * chip may not name a filling, and the boot is the one place that can ask.
 * Nothing for a provider that gives none — which the chip then says by saying
 * nothing, rather than by guessing on its behalf.
 */
export function sourceDescription(
  source: WorkingSource,
): StringKey | (string & {}) | undefined {
  return sourceProvider(source.provider)?.describeKey
}

/**
 * What the chip calls the source, the organisation's subtitle says of where
 * everything is kept, and removing a scope says it takes: the provider's own
 * sentences, read here for the reason {@link sourceDescription} is.
 */
export function sourceSayings(source: WorkingSource): {
  labelKey?: StringKey | (string & {}); whereKey?: StringKey | (string & {}); removeKey?: StringKey | (string & {})
  unreadableKey?: StringKey | (string & {})
} {
  const provider = sourceProvider(source.provider)
  return {
    ...(provider?.labelKey ? { labelKey: provider.labelKey } : {}),
    ...(provider?.whereKey ? { whereKey: provider.whereKey } : {}),
    ...(provider?.removeKey ? { removeKey: provider.removeKey } : {}),
    ...(provider?.unreadableKey ? { unreadableKey: provider.unreadableKey } : {}),
  }
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
  return sourceProvider(source.provider)?.chip
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
  return sourceProvider(source.provider)?.agentPanel
}

/**
 * What pressing the chip that names this source opens, or nothing.
 *
 * The open source's alone, for the reason {@link sourceChip} is: the chip names
 * that source, so a panel from any other provider would be hanging from
 * somebody else's name. Nothing for the three that ship.
 */
export function sourceChipPanel(source: WorkingSource): SourceChipPanel | undefined {
  return sourceProvider(source.provider)?.chipPanel
}

/**
 * What the open source's provider puts inside *Preferences*, or nothing. The
 * open source's alone, for the reason {@link sourceAgentPanel} is.
 */
export function sourcePreferencesPanel(source: WorkingSource): SourcePreferencesPanel | undefined {
  return sourceProvider(sourceProviderKind(source))?.preferencesPanel
}

/**
 * The open source's log of a scope, where its provider keeps one: the Activity
 * list then shows everybody's steps rather than this window's alone. The open
 * source's only, because the log is of the scopes that source holds. Nothing
 * for the three that ship.
 */
export function sourceRecentActivity(source: WorkingSource): SourceRecentActivity | undefined {
  return sourceProvider(source.provider)?.recentActivity
}

/**
 * Whether the open source's far end can be asked anything now, where its
 * provider says (`SourceProvider.connected`). Nothing for the three that ship,
 * and a read is then never held back.
 */
export function sourceConnected(source: WorkingSource): (() => boolean) | undefined {
  return sourceProvider(source.provider)?.connected
}

/**
 * What the chip that names this source looks like, where its provider drew it
 * a face; nothing otherwise, and then the chip is its label.
 *
 * The open source's alone, for the reason {@link sourceChipPanel} is.
 */
export function sourceChipFace(source: WorkingSource): SourceChipFace | undefined {
  return sourceProvider(source.provider)?.chipFace
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
 */
export function openSource<Opening>(
  kind: string, opening: Opening, base: SourceBase,
): SourceParts | Promise<SourceParts> {
  const provider = sourceProvider<Opening>(kind)
  // The boot, in the one file that chose the kind. A wiring mistake found here
  // is a wiring mistake; found at the first save it is a lost document.
  if (!provider) throw new Error(`no source provider is registered for '${kind}'`)
  const built = provider.open(opening, base)
  const carrying = (parts: SourceParts): SourceParts => ({ ...parts, sourceStatus: provider.statusOf })
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
 * The shell this file composes itself is composed synchronously —
 * `composeShell` runs before the boot's first line and answers a shell — so
 * the two sources it may open there must open without waiting, and they do. A
 * provider that answered a promise here would be a wiring mistake in this file
 * and never a build's, which is why it is said out loud rather than awaited.
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
 * two fallbacks are registrations like any other. `s` is the browser's
 * language, for what they record before a preference has been read.
 */
export function composeShell(s?: Translate): Shell {
  const storage = browserStorage()
  const database = browserDatabase()
  // The key-value storage is where the preferences are kept, and where the
  // scopes were: a browser that has it and no database keeps the one and
  // shows the other in memory (`browserStorageSource.ts`). Without it,
  // nothing here is kept at all — which the bar then says.
  const kind = storage ? 'browserStorage' : 'memory'
  const diagnostics = new ConsoleDiagnostics()
  // The one opening with no shell to hand over, and it cannot have one: the
  // shell a provider would be given here is the shell being built out of what
  // it answers. The trail is the half that does exist, and it is the half a
  // fallback source could conceivably have something to say to.
  const kept = openSourceNow(kind, storage && { storage, ...(database ? { database } : {}) }, { diagnostics, ...(s ? { s } : {}) })
  return {
    ...kept,
    // Both fallbacks bring one, and the preferences are read before the first
    // render — so a source that brought none is not a shell this boot can use.
    preferences: kept.preferences ?? failNoPreferences(kind),
    // On the desktop a file goes where the person says, whatever the source;
    // in a tab a download is what a file does.
    documents: desktopFiles() ? new DesktopDocumentGateway(desktopFiles()!) : new BrowserDocumentGateway(),
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
 * The shell over what a source just opened: its parts spread over the shell it
 * opened into, with everything the source before it said for itself taken off
 * first — its status words, its failure sentence, its session hook, its
 * read-only scopes, its landing, whether it publishes steps, what it hears of
 * changes and its own parts. A folder whose scopes are bound to a server's
 * session, or which reports a server's failure, is the defect this closes.
 */
export function overSource(shell: Shell, parts: SourceParts): Shell {
  const {
    sourceStatus: _status, onSourceWork: _work, sourceFailure: _failure, onScopeSession: _session,
    publishesSteps: _publishes, readOnlyAt: _readOnly, opensAt: _opensAt, changes: _changes,
    own: _own, historyNoteKey: _historyNote, historyKept: _historyKept, sayings: _sayings, settled: _settled, ...rest
  } = shell
  return { ...rest, ...parts, preferences: parts.preferences ?? shell.preferences }
}

/**
 * Where a working file may become somewhere new (ADR-0025), by the way in the
 * host names, or nowhere.
 */
export function sourceDestination(kind: string): (() => Promise<SourceDestination<unknown> | undefined>) | undefined {
  return sourceProvider<unknown>(kind)?.destination
}

/**
 * The working file, as every source carries work out in and takes it in from
 * (ADR-0031 §2): the folder format, zipped, over whichever repositories are
 * open. Loaded the first time a person exports, imports or opens a working
 * file — the codec, the readers of the older formats and the zip are nothing a
 * first screen needs, and the first download is where the room is short.
 */
export const INTERCHANGE = interchangeLoaded(
  () => import('../adapters/folder/format/interchange').then((held) => held.WORKING_FILE_INTERCHANGE),
)

/**
 * The interchange behind a load: fetched once — a load that failed is tried
 * again the next time it is asked for — and a load that fails refused as a
 * `ShellError` the person is shown, never a page reloaded under their work
 * (`reloadWhenScriptsAreGone`). `preload` fetches it before anybody asks: once
 * the app is idle after the boot, so it is there when it is wanted.
 */
export function interchangeLoaded(load: () => Promise<Interchange>): Interchange & { preload(): void } {
  let loading: Promise<Interchange> | undefined
  const codec = (): Promise<Interchange> => {
    // Why it did not load is the trail's (`reloadOnStaleScripts` reports
    // it); the person is told the part did not, and that nothing changed.
    loading ??= load().catch(() => {
      loading = undefined
      throw new ShellError('shell.workingFilePartMissing')
    })
    return loading
  }
  return {
    preload: () => { codec().catch(() => undefined) },
    accepts: WORKING_FILE_ACCEPTS,
    carryOut: async (from, options) => (await codec()).carryOut(from, options),
    open: async (bytes, at) => (await codec()).open(bytes, at),
    bringIn: async (into, opened, options) => (await codec()).bringIn(into, opened, options),
    check: async (opened, read) => (await codec()).check(opened, read),
  }
}

/**
 * The examples that ship, as the organisation's page offers them: what each is
 * called from the app's catalogue, and what each holds fetched, when one is
 * copied, from where the shipped examples are kept — in the folder format,
 * read by its own reader.
 */
export const EXAMPLE_OFFERS: readonly ExampleOffer[] = EXAMPLE_CATALOGUE.flatMap((entry) => {
  const load = SHIPPED_EXAMPLES[entry.key]
  return load ? [{ ...entry, load: () => load(entry.path) }] : []
})

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
registerSourceProvider({
  ...FOLDER_SOURCE, chrome: FolderChrome, preferencesPanel: FolderPreferences, destination: chooseFolderDestination,
})
registerSourceProvider({ ...BROWSER_STORAGE_SOURCE, chrome: BrowserChrome })
registerSourceProvider({ ...MEMORY_SOURCE, chrome: MemoryNotice })

/**
 * A tab left open over a deploy asks for a script that is gone, the first time
 * somebody reaches a part it had not loaded yet; the page again is the answer
 * (`adapters/browser/staleScripts.ts`). Once, and on this shell's own reload.
 */
export function reloadWhenScriptsAreGone(
  shell: Pick<Shell, 'hostControls' | 'diagnostics'>, mayReload?: () => boolean,
): () => void {
  return reloadOnStaleScripts({
    reload: () => shell.hostControls.reload(), diagnostics: shell.diagnostics, ...(mayReload ? { mayReload } : {}),
  })
}

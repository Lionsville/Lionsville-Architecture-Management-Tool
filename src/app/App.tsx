/**
 * The shell. Two states: you are in a project, or you are choosing one.
 *
 * What used to be here — the session, the toolbar, the dialogs — moved to
 * {@link ProjectWorkspace}, because all of it only means something once a
 * project is open. What remains is the part that outlives a project: the theme,
 * the language, the toasts, and which project you are in.
 *
 * Every capability arrives as a prop, typed as the narrowest shape that will do.
 * `App` genuinely needs most of a store — it lists, loads, saves and removes —
 * but the hooks below it do not, and each asks for its own slice. Nothing here
 * knows whether a project lives in browser storage, on disk or on a server.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import { LanguageProvider, translator } from '../i18n'
import type { StringKey } from '../i18n'
import type { Command, ElementId, StepSummary } from '../model'
import { apply, fromArrays, toArrays } from '../model'
import type { HostModel } from '../model/hostModel'
import type { AncestorRecords } from '../decisions/adrScope'
import type { Diagnostic, DiagnosticEntry } from '../platform/diagnostics'
import { reasonOf } from '../platform/errors'
import {
  bareScope, flattenScopes, isProjectOrder, moveScope, namesUnder, renameScope, setScopeDefaults,
} from '../projects/scope'
import type {
  ProjectOrder, ScopeKind, ScopeModel, ScopeSnapshot, ScopeSummary,
} from '../projects/scope'
import { findingsByScope, identityFindings } from '../projects/checks'
import { applyRefPatch } from '../projects/readdress'
import { treeModels, treeScopes } from '../projects/scopeIndex'
import { organisationLabel, scopeClient } from '../projects/scopeLabel'
import type { RecordLink } from '../projects/links'
import {
  ancestorScopes, parentScope, ROOT_SCOPE, scopePathFor, scopePathLabel,
} from '../projects/scopePath'
import type { ScopePath } from '../projects/scopePath'
import { crumbsFor } from './ShellToolbar'
import { NO_WINDOW_CHROME } from '../platform/windowChrome'
import type { ThemeMode } from '../platform/theme'
import { manualUrl } from '../platform/manual'
import type { UpdateSettings, UpdateSettingsPatch } from '../platform/updateSettings'
import type { PullOutcome } from '../platform/sync'
import type { LocalSettings, LocalSettingsPatch } from '../projects/folderSettings'
import type { AgentGateway } from '../ports/AgentGateway'
import type { FolderSettingsStore } from '../ports/FolderSettings'
import type { ProjectHistory } from '../ports/ProjectHistory'
import type { UpdateSettingsStore } from '../ports/UpdateSettings'
import { AGENT_OFF } from '../platform/agentServer'
import type { AgentServerStatus } from '../platform/agentServer'
import { ConnectAgentDialog } from './dialogs/ConnectAgentDialog'
import { PreferencesDialog } from './dialogs/PreferencesDialog'
import { SyncNotice } from './SyncNotice'
import { useSync } from './useSync'
import type { WindowChrome } from '../platform/windowChrome'
import { BROWSER_STORAGE, sourceIsReadOnly, sourceProviderKind } from '../platform/workingSource'
import type { WorkingSource } from '../platform/workingSource'
import type {
  SourceStatus, SourceWayIn, SourceWork, SourceWorkChanged,
} from '../platform/sourceProvider'
import type { ExampleProject } from './examples'
import { ErrorBoundary } from './ErrorBoundary'
import type { HostControls } from '../ports/HostControls'
import { HistoryPage } from './history/HistoryPage'
import { SnapshotDialog } from './history/SnapshotDialog'
import { useProjectHistory } from './history/useProjectHistory'
import { carryRefs } from './carryRefs'
import { ChooseFolder } from './organisation/ChooseFolder'
import { OrganisationScreen } from './organisation/OrganisationScreen'
import { registerRows } from './organisation/register'
import { technologyRows } from '../projects/technologyRegister'
import { useOrganisation } from './organisation/useOrganisation'
import { ProjectWorkspace } from './ProjectWorkspace'
import type { ScopeSession } from './useModelSession'
import type { ProjectSettings } from './ProjectSettingsDialog'
import { ToastBar } from './ToastBar'
import type { MakeId } from './useDiagramActions'
import type { ProjectFileChannel } from './useProjectFiles'
import { useAgentShell } from './useAgentShell'
import type { WorkspaceAgentView } from './useAgentShell'
import { AgentDrivingBanner } from './AgentDrivingBanner'
import type { Destination, Screen } from '../agent/screen'
import type { TreeView } from '../agent/tree'
import { useGlobalErrors } from './useGlobalErrors'
import { useHomeFiles } from './useHomeFiles'
import { useFilePicker } from './useFilePicker'
import { useHostCommands } from './useHostCommands'
import { usePasswordPrompt } from './usePasswordPrompt'
import { useOpenIntoPrompt } from './useOpenIntoPrompt'
import type { ChooseFolderForWorkingFile } from './workingFileFlows'
import type { CommandStream } from './useHostCommands'
import { useIndex } from './useIndex'
import { useShellPreferences } from './useShellPreferences'
import type { PreferencesWriter } from './useShellPreferences'
import { useStorageNotice } from './useStorageNotice'
import type { StorageNotice } from './useStorageNotice'
import { useToasts } from './useToasts'

/**
 * What `App` does to a store.
 *
 * Spelled out rather than named, so the workspace and the picker below can each
 * be handed a smaller slice of it and a reader can see that they were.
 */
/**
 * What the shell does to the diagnostics seam: reports, and — for the crash
 * fallback it hands the trail to — reads back.
 */
export type ShellDiagnostics = {
  report(entry: Diagnostic): void
  recent(): DiagnosticEntry[]
}

/**
 * A screen of the source provider's own, drawn inside this shell.
 *
 * Everything else a provider brings is a store, a setting or a function; some of
 * what it has to do is a *strip*, a badge, a dialog — settle two changes that
 * disagree, say it is reconnecting, ask for an address again. The provider owns
 * what it draws, for the same reason it owns its way in: what has to be said
 * there is its business, and a shell that tried to describe all of it would be a
 * shell edited for the fifth provider.
 *
 * What this shell owes is somewhere to put it. Without one the only place left
 * is a container of the provider's own on `document.body` — outside the theme,
 * outside the language, above or below whatever the app has drawn — which is a
 * second app in the same window wearing the wrong colours. So it renders here:
 * inside the theme and inside the language, beside the app's own notices, on
 * every screen, with the session of the scope that is open while one is.
 *
 * `session` is absent where nothing is open, which is most of the time on the
 * organisation screen and all of the time on the first-run screen. A provider
 * that has nothing to say then draws nothing, which is what `null` is for.
 *
 * **It is drawn for every registered provider, open or not.** A chrome that
 * arrived with the parts of an opened source was a chrome no unopened provider
 * had: the first press of its way in had nowhere to draw the dialog that asks
 * where to connect to, which is the one screen a provider needs BEFORE it is
 * the source. So the boot hands over one per registration
 * (`composition.ts`'s `registeredChrome`) and this shell draws them all, giving
 * `session` to the one whose provider answers for the open source and to no
 * other.
 *
 * **So a chrome must be idempotent about its own state.** It is mounted while
 * its provider is nobody's source, and mounted again — a fresh component, with
 * fresh state — when a source opens, because the app is keyed on the working
 * source. Whatever it has to remember across that (a handshake in flight, a
 * dialog left open, a subscription) belongs where the provider keeps it and not
 * in this component, and being mounted twice over one session must cost nothing
 * but a render.
 */
export type SourceChrome = ComponentType<{ session?: ScopeSession }>

/**
 * One provider's chrome, and which provider's it is.
 *
 * The kind it registered under, because that is what says whether the open
 * source is this provider's: `sourceProviderKind` answers the same question
 * from the other side, and a chrome handed a session belonging to somebody
 * else's source would be a strip describing a document its provider has never
 * seen.
 */
export type RegisteredChrome = {
  readonly kind: string
  readonly chrome: SourceChrome
}

/**
 * Which page the workspace should be showing the moment it appears.
 *
 * The organisation's own pages are reached from the cards on its screen, and
 * the root scope that holds them usually draws nothing at all — its decisions,
 * its plans and its business architecture are what it has, and a canvas is not.
 * Without this, pressing *Open* on a card would land a person on an empty board
 * with the page they asked for still shut.
 *
 * Shell vocabulary rather than either screen's: one screen says it and the
 * other obeys it, and a type that lived in either would make them import each
 * other.
 */
export type InitialPage =
  /** The decisions page, on one record when an id is given (ADR-0019). */
  | { page: 'decisions'; id?: string }
  /** The observations page (ADR-0021), on one observation or cause when an id is given. */
  | { page: 'observations'; id?: string }
  | { page: 'roadmap' }
  /** A platform's report, or a service's (ADR-0013, ADR-0014): derived, opened by id, never made. */
  | { page: 'platform'; id: ElementId }
  | { page: 'service'; id: ElementId }
  /** A sheet by id, or — with none — the one the scope is about to be given. */
  | { page: 'sheet'; id?: string }
  /** The enterprise map, likewise. */
  | { page: 'map'; id?: string }
  /** The technology landscape (ADR-0015), likewise. */
  | { page: 'technology'; id?: string }
  /** One plan, on its page over the roadmap — an initiative opened where it lives (ADR-0012 §7). */
  | { page: 'plan'; id: string }
  /**
   * A record, selected on the board that draws it — a row of the register,
   * opened where it is answered for.
   */
  | { page: 'element'; id: ElementId }
  /**
   * A record's page — the document and the record's fields — opened in the
   * scope that answers for it, which is where the fields may be written.
   */
  | { page: 'document'; id: ElementId }
  /** The documentation page as the bar opens it: on the selected element, or the first. */
  | { page: 'documentation' }
  /** One board, made the active one — a row of the views table on a landscape's home. */
  | { page: 'board'; id: string }
  /**
   * Not a page, and here anyway: *link* (ADR-0012 §10), asked the moment the
   * scope opens.
   *
   * A gesture is applied by the session that holds the scope — one `Command`,
   * one undo step, one Activity line — so the register's *Link…* cannot do it
   * where it stands. What it can do is open the scope that should yield and
   * ask there, which is this.
   */
  | { page: 'link'; id: ElementId; to: ScopePath }

export type ScopeLibrary = {
  list(): Promise<ScopeSummary>
  load(path: ScopePath): Promise<ScopeSnapshot | undefined>
  save(scope: ScopeSnapshot): Promise<void>
  remove(path: ScopePath): Promise<void>
  /**
   * Every scope's records and rows, for the index (ADR-0012 §2). Optional on
   * the seam and optional here; `indexOf` loads each scope where a store
   * cannot answer it.
   */
  models?(): Promise<ScopeModel[]>
  /** One scope's prose, for the stand-ins an overview draws (ADR-0012 §3). Optional the same way. */
  descriptions?(path: ScopePath): Promise<Record<string, string> | undefined>
}

/** What the settings dialogs may change about a scope, whatever level it is. */
export type ScopeSettingsPatch = {
  name: string
  client?: string
  description?: string
  links?: RecordLink[]
  kind?: ScopeKind
  /**
   * Where it is filed, when that is what changed.
   *
   * Absent means "leave the address alone", which is what a rename does and
   * what every field above does. Present and different is a move: save the
   * subtree at its new addresses, then remove the old folder — never the other
   * way round.
   */
  parent?: ScopePath
}

export type AppProps = {
  scopes: ScopeLibrary
  preferences: PreferencesWriter
  documents: ProjectFileChannel
  diagnostics: ShellDiagnostics
  /** What the crash fallback can do about it: reload, and copy the trail. */
  /** The host's three: reload and the clipboard for the crash page, and a way out to the manual. */
  hostControls: HostControls
  /**
   * What you are working from (ADR-0005): a folder by name, the browser's
   * storage, or memory. `memory` means storage refused at boot — a private
   * window, a strict policy — and nothing typed here will be there tomorrow.
   * That is worth a standing notice rather than a toast, because it is true
   * for the whole session and not an event within it; the top bar says it too.
   */
  source?: WorkingSource
  /**
   * What this source means by the five words the bar says (ADR-0005; the
   * source provider says the rest). Absent where the document's own machine is
   * the whole answer, which is what all three built-in sources are, and the
   * bar then says exactly what it has always said.
   */
  sourceStatus?: (work: SourceWork) => SourceStatus
  /**
   * The source says its answer to {@link AppProps.sourceStatus} has moved, so
   * the bar asks again. Absent for all three sources that ship, whose every
   * answer moves with the document's own machine.
   */
  onSourceWork?: SourceWorkChanged
  /**
   * The sentence this source's provider gives for where work is kept, as the key
   * of its own string — what the organisation's home says about the chip that
   * names the source.
   *
   * Absent for the three that ship, whose sentences this tree holds already
   * (`ShellToolbar`'s `sourceTipKey`), and absent for a registered provider that
   * gives none: the chip then says nothing rather than a sentence of ours about
   * somewhere this shell has never heard of. Read from the registration by the
   * boot, which is the one place that may ask (`composition.ts`).
   */
  sourceDescription?: StringKey | (string & {})
  /**
   * A scope has been opened, and here is the session over it: for whoever
   * answers for the source (`composition.ts`). Passed straight through to the
   * workspace, which is where a session exists; absent for all three sources
   * that ship, and then nothing subscribes to anything.
   */
  onScopeSession?: (session: ScopeSession) => (() => void) | void
  /**
   * Whatever the source providers draw for themselves ({@link SourceChrome}),
   * one entry per registration and not per open source.
   *
   * Every registered provider's, because a provider that is not the source yet
   * is exactly the one with something to ask: its way in has to be able to draw
   * a dialog, and before this there was nowhere for it to go. The one whose
   * provider answers for the open source is handed the session; the rest are
   * drawn with nothing.
   *
   * Empty for every build in this repository: a folder, this browser's storage
   * and memory have nothing to say that the bar does not say for them.
   */
  chrome?: readonly RegisteredChrome[]
  /**
   * How to change the folder. Absent in a browser tab whose browser cannot
   * give one: an app that showed the button anyway would be offering what it
   * cannot do.
   */
  onChooseWorkingDirectory?: () => void
  /**
   * The other places this build can work from: what each button says, and what
   * pressing it does (`platform/sourceProvider.ts`).
   *
   * Built at the boot from the providers this build registered, so it is empty
   * for every build in this repository — core registers a folder, this
   * browser's storage and memory, and only the first of those is something a
   * person goes to. Offered on the root's home and on the first-run screen,
   * which are the two screens that ask where work should live; everything
   * below them is about work that already has somewhere to be.
   */
  waysIn?: readonly SourceWayIn[]
  /**
   * Does this host keep projects ONLY in folders?
   *
   * True on the desktop, where keeping them anywhere else means a leveldb
   * inside `userData` (ADR-0003) and the app therefore asks for a folder before
   * it shows anything. A browser tab keeps them itself and merely *may* have a
   * folder, so it is offered one and never made to choose.
   */
  needsFolder?: boolean
  /**
   * Tell me when a project's folder changed under us. Absent where nothing can
   * watch, and the workspace then never leaves the states it can reach alone.
   */
  watchProject?: (path: ScopePath, onChanged: () => void, wholeTree?: boolean) => () => void
  /**
   * Menu items and files the OS opened us with. Subscribed to here for the
   * commands about folders, and handed to the workspace for the ones about the
   * project that is open — each layer taking what it owns.
   */
  commands?: CommandStream
  /**
   * Does the host draw a menu bar of its own? When it does not, the toolbar
   * carries the menu in an overflow (ADR-0005). A browser tab never has one.
   */
  hostMenu?: boolean
  /** Tell the host whether closing the window would lose something. */
  onUnsavedWork?: (unsaved: boolean) => void
  /** Tell the host which theme is on, so its View menu's radio can be right. */
  onThemeMode?: (mode: ThemeMode) => void
  /** Whether a scope is open, for the menu bar's items that act on one (ADR-0005, amended). */
  onScopeOpen?: (open: boolean) => void
  /** Work in a folder the user has already granted. The Recent submenu. */
  onOpenWorkingDirectory?: (root: string) => void
  /**
   * A folder a working file may become (ADR-0025). Absent where no folder
   * can be chosen, and the dialog then offers only to replace what is open.
   */
  onChooseFolderForWorkingFile?: ChooseFolderForWorkingFile
  /** Folders this machine has worked in before, for the first-run screen. */
  recentFolders?: readonly { root: string; name: string }[]
  /** The snapshots of the working directory. Absent where there can be none. */
  history?: ProjectHistory
  /**
   * The two folder scopes of ADR-0005. Absent where there is no folder; the
   * machine section of the preferences dialog needs this AND a history.
   */
  folderSettings?: FolderSettingsStore
  /** The desktop's own update settings. Absent on the web, and the section with it. */
  updateSettings?: UpdateSettingsStore
  /**
   * Where an agent's tool calls arrive (ADR-0007). Absent in a browser tab.
   * The open workspace answers them; with no project open, this shell does,
   * with a refusal.
   */
  agent?: AgentGateway
  /**
   * What the boot's pull answered, when the machine asked for one. Made at
   * the edge of the app, before the project was read and before the watcher
   * started, so a fast-forward's writes are never reported as somebody
   * else's change; what is left for the shell is to say so.
   */
  initialSync?: PullOutcome
  /**
   * A folder that was picked and did not open, from the shell's attempt just
   * before this render. Said once on the toast bar, because the shell has no
   * bar of its own and a pick that ends in nothing looks like a button that
   * does nothing.
   */
  folderFailure?: unknown
  /**
   * The same, for a way in a registered provider offered: pressed, and gone
   * nowhere. Its own prop rather than a second meaning for the one above,
   * because the two say different sentences — this one cannot say *folder*, and
   * the boot cannot say what a provider's own dialog was asking for.
   */
  sourceFailure?: unknown

  /** Today as `yyyy-mm-dd`. Injected so a card's finding is not at the clock's mercy. */
  today?: () => string

  /** Read by the composition root before the first render, so this can be sync. */
  initialProject: ScopeSnapshot | undefined
  initialPreferences: unknown

  examples: readonly ExampleProject[]
  /** Fresh ids. Injected because a clock inside a component cannot be tested. */
  makeId: MakeId
  /** What the browser reports; injected so a test can pin the starting language. */
  browserLanguages?: readonly string[] | string
  /**
   * What the window around the app leaves to us. On the desktop the title bar
   * is hidden, so our own top bar has to keep clear of the window controls and
   * be the thing you drag the window by. A browser tab needs neither.
   */
  windowChrome?: WindowChrome
  /**
   * Say what this window is about. Absent in a test, which has no window to
   * name and would otherwise rename the runner's.
   */
  onTitle?: (organisation: string, scope?: string) => void
}

/** The organisation screen has no command log: the history drafts its default message. */
const NO_STEPS = (): readonly { summary: StepSummary }[] => []
/** …and nothing waiting to be written: the screen writes straight through. */
const SAVED = (): Promise<void> => Promise.resolve()
/**
 * The page a scope opens on for an agent's destination (ADR-0019): the same
 * three words, so the two vocabularies cannot drift. A home page is the
 * shell's own business and never reaches here.
 */
export function initialPageFor(to: Destination): InitialPage | undefined {
  switch (to.page) {
    case 'board': return to.id !== undefined ? { page: 'board', id: to.id } : undefined
    case 'sheet': return { page: 'sheet', ...(to.id !== undefined ? { id: to.id } : {}) }
    case 'map': return { page: 'map', ...(to.id !== undefined ? { id: to.id } : {}) }
    case 'technology': return { page: 'technology', ...(to.id !== undefined ? { id: to.id } : {}) }
    case 'decisions': return { page: 'decisions', ...(to.id !== undefined ? { id: to.id } : {}) }
    case 'observations': return { page: 'observations', ...(to.id !== undefined ? { id: to.id } : {}) }
    case 'roadmap': return { page: 'roadmap' }
    case 'plan': return to.id !== undefined ? { page: 'plan', id: to.id } : { page: 'roadmap' }
    case 'element': return to.id !== undefined ? { page: 'element', id: to.id } : undefined
    case 'document': return to.id !== undefined ? { page: 'document', id: to.id } : { page: 'documentation' }
    case 'documentation': return { page: 'documentation' }
    case 'platform': return to.id !== undefined ? { page: 'platform', id: to.id } : undefined
    case 'service': return to.id !== undefined ? { page: 'service', id: to.id } : undefined
    default: return undefined
  }
}

/** What the history page compares against before the home's document has been read. */
const EMPTY_MODEL: HostModel = { name: '', elements: [], relations: [], diagrams: [] }

function localToday(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function App({
  scopes: projects, preferences, documents, diagnostics, hostControls,
  source = BROWSER_STORAGE, sourceStatus, onSourceWork, sourceDescription,
  onScopeSession, chrome: chromes = [],
  onChooseWorkingDirectory, waysIn, needsFolder = false, watchProject,
  commands, hostMenu = false, onUnsavedWork, onThemeMode, onScopeOpen, onOpenWorkingDirectory, recentFolders,
  onChooseFolderForWorkingFile,
  history, folderSettings, updateSettings, agent, initialSync, folderFailure, sourceFailure,
  today = localToday,
  initialProject, initialPreferences,
  examples, makeId, browserLanguages, windowChrome = NO_WINDOW_CHROME, onTitle,
}: AppProps) {
  const toasts = useToasts()
  // Read once per render rather than per card: a finding re-derived because a
  // millisecond passed is a model walked again for nothing.
  const todayDay = useMemo(() => today(), [today])

  /**
   * Preferences and the storage notice need each other: writing a preference can
   * fail, and saying so needs the language, which is a preference. One late-bound
   * hop breaks the knot — the notice is looked up when it fires, not when the
   * writer is built.
   */
  const noticeRef = useRef<StorageNotice>(() => {})
  const reportStorage = useCallback<StorageNotice>((ok) => noticeRef.current(ok), [])

  const prefs = useShellPreferences({
    store: preferences,
    initial: initialPreferences,
    onWriteFailed: reportStorage,
    browserLanguages,
  })
  const s = useMemo(() => translator(prefs.language), [prefs.language])
  noticeRef.current = useStorageNotice(toasts.notify, s)

  // The half a boundary cannot see: a throw in a listener, a timer or a promise.
  useGlobalErrors({ diagnostics, notify: toasts.notify, s })

  /**
   * What happens when one of the promises below rejects.
   *
   * Two things, in this order: the trail takes the cause, and — when there is
   * something worth saying — the user takes a sentence. Most of these calls used
   * to have neither, so a store that refused mid-session left the screen looking
   * exactly as it does when everything is fine.
   *
   * The key is optional because not every failure is worth interrupting for: a
   * group record that would not load costs a description, and saying so would
   * be noise in front of a list of projects that is perfectly readable.
   */
  const failed = useCallback((where: string, cause: unknown, key?: StringKey) => {
    diagnostics.report({ level: 'error', where, message: key ?? 'rejected', cause })
    if (key) toasts.notify(s(key), 'error')
  }, [diagnostics, toasts, s])

  // Kept in a ref so an effect can report without depending on `failed`'s
  // identity — see the group record effect below for the reason.
  const failedRef = useRef(failed)
  failedRef.current = failed

  // Likewise a ref, and for a plainer reason: the callbacks that re-read the
  // tree are declared above the hook that owns it, and a hook cannot move
  // above the `enter` it is given.
  const refreshTree = useRef<() => void>(() => {})

  const [project, setProject] = useState<ScopeSnapshot | undefined>(initialProject)

  /**
   * The watcher, bound to the project that is open.
   *
   * Bound here because this is where "which project" is known, and memoised on
   * the ref because the workspace subscribes to whatever it is handed: a fresh
   * function every render would be a fresh subscription every render.
   */
  const openPath = project?.path
  const watchOpenProject = useMemo(() => {
    if (!watchProject || openPath === undefined) return undefined
    return (onChanged: () => void) => watchProject(openPath, onChanged)
  }, [watchProject, openPath])

  /**
   * Bumped when the open project has to be read again from disk with nothing
   * carried over — after *take theirs* on the whole folder. Part of the
   * workspace's key, so the session and its undo stack start again from what
   * is now on disk, the way they do when a different project is opened.
   */
  const [reloadKey, setReloadKey] = useState(0)
  const reloadOpenProject = useCallback(() => {
    if (!project) return
    void projects.load(project.path).then(
      (found) => {
        if (!found) { setProject(undefined); refreshTree.current(); return }
        setProject(found)
        setReloadKey((k) => k + 1)
      },
      (cause: unknown) => failedRef.current('reloadOpenProject', cause, 'picker.loadFailed'),
    )
  }, [project, projects])

  const sync = useSync({
    history, folderSettings, initial: initialSync, onTheirs: reloadOpenProject,
    notify: toasts.notify, s, diagnostics,
  })

  /**
   * The organisation's index (ADR-0012 §2), held here rather than in the
   * workspace because both screens read it: the id policy and `mayEdit` below
   * a canvas, and the finding line on every row of the tree above one. It
   * outlives a scope switch, which is right — it is about the folder and not
   * about what is open in it.
   *
   * Watched over the WHOLE tree (`ROOT_SCOPE`), not the open scope: a sibling
   * domain renaming its ERP is exactly the change the drift check exists to
   * notice, and a watcher bound to the open scope would never hear of it.
   * Watching the root is one subscription on the same watcher the workspace
   * uses — main watches a root once, whoever asks.
   */
  const watchTree = useMemo(() => {
    if (!watchProject) return undefined
    return (onChanged: () => void) => watchProject(ROOT_SCOPE, onChanged, true)
  }, [watchProject])
  const tree = useIndex({ scopes: projects, watch: watchTree, onFailure: failed })

  /**
   * An address this app has just moved a project away from.
   *
   * A move is save-here, remove-there, and the workspace showing the project is
   * still mounted in between — with an autosave that could land on the old
   * address a millisecond after it was removed and put the project back. Two
   * copies, and the one the user goes on editing is the one that will disappear
   * next time.
   *
   * A ref and not state: closing this window needs the guard to be true NOW,
   * not after React has rendered. Cleared once the workspace has been given the
   * new address, which remounts it.
   */
  const movedAway = useRef<ScopePath | undefined>(undefined)
  const workspaceStore = useMemo(() => ({
    save: (held: ScopeSnapshot) => (
      movedAway.current === held.path ? Promise.resolve() : projects.save(held)
    ),
    load: (path: ScopePath) => projects.load(path),
    ...(projects.descriptions ? { descriptions: (path: ScopePath) => projects.descriptions!(path) } : {}),
  }), [projects])

  /**
   * The menu bar's commands and the overflow's, on one bus. The ones about
   * where the projects are kept and about this person's preferences are taken
   * here; everything about the open project falls through to the workspace,
   * which subscribes to the same stream.
   */
  const bus = useHostCommands(commands)
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [agentOpen, setAgentOpen] = useState(false)
  /**
   * The folder's history, from the organisation screen (`homeHistory`, below).
   * Through a ref so the subscription does not chase the hook's identity: the
   * commands are only ever answered here while no scope is open, and the
   * workspace answers them itself while one is.
   */
  const homeHistoryRef = useRef<{ openDialog: () => void; openPage: () => void } | undefined>(undefined)
  /**
   * The working file from a home (ADR-0023), through the same ref pattern:
   * answered here only while no scope is open, and by the workspace while one
   * is. The desktop's `openDocument` — a double click on a `.lvarch` — lands
   * here too when the app is on a home, where it used to fall on the floor.
   */
  const homeFilesRef = useRef<{
    exportWorkingFile: () => void; open: () => void; openDocument: (name: string, bytes: Uint8Array) => void
  } | undefined>(undefined)
  useEffect(() => bus.on((command) => {
    if (command.type === 'chooseFolder') onChooseWorkingDirectory?.()
    if (command.type === 'openFolder') onOpenWorkingDirectory?.(command.root)
    if (command.type === 'theme') prefs.chooseTheme(command.mode)
    if (command.type === 'preferences') setPrefsOpen(true)
    if (command.type === 'connectAgent') setAgentOpen(true)
    if (command.type === 'snapshot') homeHistoryRef.current?.openDialog()
    if (command.type === 'history') homeHistoryRef.current?.openPage()
    if (command.type === 'export') homeFilesRef.current?.exportWorkingFile()
    if (command.type === 'open') homeFilesRef.current?.open()
    if (command.type === 'openDocument') homeFilesRef.current?.openDocument(command.name, command.bytes)
    // In the app's language, which is why it is answered here and not by the
    // menu bar: main does not know which one is on.
    if (command.type === 'manual') hostControls.openExternal(manualUrl(prefs.language))
  }), [bus, onChooseWorkingDirectory, onOpenWorkingDirectory, prefs, hostControls])
  /**
   * The third fact main is told (ADR-0005, amended): whether a scope is open,
   * so the File and Edit items about one are enabled only while it is. Said
   * on every change and once at the start, the way the theme is.
   */
  useEffect(() => { onScopeOpen?.(project !== undefined) }, [onScopeOpen, project])

  /**
   * The server's three facts (ADR-0007), asked once and then told. Held here
   * rather than in the workspace because the glyph outlives a project switch
   * and the dialog is reachable from the picker too.
   */
  const [agentStatus, setAgentStatus] = useState<AgentServerStatus>(AGENT_OFF)
  useEffect(() => {
    if (!agent) return
    let live = true
    void agent.status().then(
      (held) => { if (live) setAgentStatus(held) },
      (cause: unknown) => failedRef.current('agent.status', cause),
    )
    const off = agent.onStatus((held) => { if (live) setAgentStatus(held) })
    return () => { live = false; off() }
  }, [agent])

  const agentChangeFailed = useCallback((where: string, cause: unknown) => {
    failedRef.current(where, cause)
    toasts.notify(s('agent.changeFailed', { message: reasonOf(cause) }), 'error')
  }, [toasts, s])
  const changeAgentEnabled = useCallback((enabled: boolean) => {
    if (!agent) return
    void agent.configure({ enabled }).then(setAgentStatus, (cause: unknown) => agentChangeFailed('agent.configure', cause))
  }, [agent, agentChangeFailed])
  const newAgentToken = useCallback(() => {
    if (!agent) return
    void agent.newToken().then(setAgentStatus, (cause: unknown) => agentChangeFailed('agent.newToken', cause))
  }, [agent, agentChangeFailed])
  const agentBar = useMemo(() => ({ status: agentStatus, onOpen: () => setAgentOpen(true) }), [agentStatus])

  /**
   * The two scopes the dialog reads from somewhere other than the blob.
   *
   * Read when the dialog opens, not at boot: the update settings are a round
   * trip to main and the machine file is a read from the folder, and neither
   * is needed until somebody is looking. The machine section also asks the
   * history whether it is available at all — a folder in a browser tab has
   * one seam and not the other, and offering sync there would be offering
   * something that cannot happen.
   */
  const [updates, setUpdates] = useState<UpdateSettings | undefined>(undefined)
  const [local, setLocal] = useState<LocalSettings | undefined>(undefined)
  useEffect(() => {
    if (!prefsOpen) return
    let live = true
    if (updateSettings) {
      void updateSettings.read().then(
        (held) => { if (live) setUpdates(held) },
        (cause: unknown) => failedRef.current('updateSettings', cause),
      )
    }
    if (folderSettings && history) {
      void history.available().then(async (can) => {
        if (!can) return
        const held = await folderSettings.readLocal()
        if (live) setLocal(held)
      }, (cause: unknown) => failedRef.current('folderSettings', cause))
    }
    return () => { live = false }
  }, [prefsOpen, updateSettings, folderSettings, history])

  // Keyed on the failure alone: the toast helpers are fresh each render, and a
  // notice that re-fires on its own consequences never stops.
  const sayFolderFailed = useRef((cause: unknown) => {
    toasts.notify(s('shell.folderNotOpened', { message: reasonOf(cause) }), 'error')
  })
  sayFolderFailed.current = (cause: unknown) => {
    toasts.notify(s('shell.folderNotOpened', { message: reasonOf(cause) }), 'error')
  }
  useEffect(() => {
    if (folderFailure !== undefined) sayFolderFailed.current(folderFailure)
  }, [folderFailure])

  // The same shape for a source that is not a folder, and the same reasoning:
  // keyed on the failure alone, because the toast helpers are fresh each render.
  const saySourceFailed = useRef((cause: unknown) => {
    toasts.notify(s('shell.sourceNotOpened', { message: reasonOf(cause) }), 'error')
  })
  saySourceFailed.current = (cause: unknown) => {
    toasts.notify(s('shell.sourceNotOpened', { message: reasonOf(cause) }), 'error')
  }
  useEffect(() => {
    if (sourceFailure !== undefined) saySourceFailed.current(sourceFailure)
  }, [sourceFailure])

  const settingFailed = useCallback((where: string, cause: unknown) => {
    failedRef.current(where, cause)
    toasts.notify(s('prefs.writeFailed', { message: reasonOf(cause) }), 'error')
  }, [toasts, s])

  const changeUpdates = useCallback((patch: UpdateSettingsPatch) => {
    if (!updateSettings) return
    // Optimistic, and put back from what the host says is now in force.
    setUpdates((held) => held && { ...held, ...patch })
    void updateSettings.write(patch).then(setUpdates, (cause: unknown) => {
      settingFailed('updateSettings.write', cause)
      void updateSettings.read().then(setUpdates, () => undefined)
    })
  }, [updateSettings, settingFailed])

  const changeLocal = useCallback((patch: LocalSettingsPatch) => {
    if (!folderSettings) return
    setLocal((held) => held && { git: { ...held.git, ...patch.git } })
    void folderSettings.writeLocal(patch).then(
      () => folderSettings.readLocal().then(setLocal),
      (cause: unknown) => {
        settingFailed('folderSettings.write', cause)
        void folderSettings.readLocal().then(setLocal, () => undefined)
      },
    )
  }, [folderSettings, settingFailed])

  // The second fact the host is told, after unsaved work: which theme is on.
  useEffect(() => { onThemeMode?.(prefs.themeMode) }, [onThemeMode, prefs.themeMode])

  const [order, setOrder] = useState<ProjectOrder>(() => {
    const stored = (prefs.preferences as Record<string, unknown> | undefined)?.projectOrder
    return isProjectOrder(stored) ? stored : 'name'
  })
  const chooseOrder = useCallback((next: ProjectOrder) => {
    setOrder(next)
    prefs.writePreference({ projectOrder: next })
  }, [prefs])

  /**
   * Opening is what makes a scope "last opened", so both happen here — and, when
   * it was opened for one of the organisation's own pages, which page that was.
   *
   * Held beside the project rather than inside the workspace so that switching
   * scopes clears it: a page asked for on the root is not a page asked for on
   * the landscape opened next.
   */
  const [initialPage, setInitialPage] = useState<InitialPage | undefined>(undefined)
  const enter = useCallback((next: ScopeSnapshot, page?: InitialPage) => {
    // Opened for one board: the session starts on it, the way a tab click
    // would leave it — no step on the stack, and nothing dirty for it.
    const asked = page !== undefined && 'id' in page && page.id !== undefined
      && (page.page === 'board' || page.page === 'sheet' || page.page === 'map' || page.page === 'technology')
      ? page.id : undefined
    setProject(asked !== undefined ? { ...next, activeDiagramId: asked } : next)
    setInitialPage(page)
    prefs.writePreference({ lastScope: next.path })
  }, [prefs])

  /**
   * Whose home is up while nothing is open: the root's, or a scope's beneath
   * it (`OrganisationScreen`). A crumb on the bar and a row's name set it;
   * closing a page over a canvas that draws nothing lands on the open scope's
   * own. Session state and not a preference: `lastScope` says where the work
   * was, and a home is a place you pass through on the way to it.
   */
  const [home, setHome] = useState<ScopePath>(ROOT_SCOPE)

  /**
   * The organisation screen's wiring (`useOrganisation`).
   *
   * Called whatever is on screen, because the tree it holds is what the open
   * workspace's settings dialog offers as a parent to file under — and because
   * a hook cannot be called conditionally. It reads the root's own document
   * only while its screen is up, which is the one read on this path that costs
   * anything.
   */
  const organisation = useOrganisation({
    scopes: projects,
    active: project === undefined,
    at: home,
    onEnter: enter,
    onTreeChanged: tree.refresh,
    notify: toasts.notify,
    onFailure: failed,
    onStorageResult: reportStorage,
    s,
  })
  refreshTree.current = organisation.refresh

  /**
   * Snapshots and the history, while the organisation screen is up.
   *
   * A snapshot is of the FOLDER (ADR-0003), so it means the same thing from
   * here as from inside a landscape: the menu offers it on both, and an item
   * that was offered has to work. What differs is what stands behind the
   * page: the home scope's own document — the organisation's business layer,
   * or a domain's records — which the screen has already read for its cards,
   * and which is written straight through, so there is nothing to save first.
   * A restore is one write of that document, the way the settings dialog
   * writes it. Inert while a scope is open: the workspace has its own, and
   * the seam is withheld from this one so the two never both answer.
   */
  const homeDocument = useCallback(
    () => organisation.root ?? bareScope(home, organisation.tree.name),
    [organisation.root, organisation.tree.name, home],
  )
  const restoreIntoHome = useCallback((command: Command) => {
    const held = organisation.root
    if (!held) return
    const result = apply(fromArrays(held.model), command)
    if (!result.ok) { toasts.notify(s(result.reason), 'error'); return }
    void projects.save({ ...held, model: toArrays(result.model) }).then(
      () => { organisation.refresh(); tree.refresh() },
      (cause: unknown) => failedRef.current('organisation.restore', cause, 'group.saveFailed'),
    )
  }, [organisation, projects, tree, toasts, s])
  const homeHistory = useProjectHistory({
    history: project ? undefined : history,
    index: tree.index,
    project: homeDocument,
    steps: NO_STEPS,
    save: SAVED,
    indexed: () => fromArrays(homeDocument().model),
    dispatch: restoreIntoHome,
    notify: toasts.notify,
    s,
    onTaken: sync.afterSnapshot,
  })
  homeHistoryRef.current = project ? undefined : homeHistory
  const homeModel: HostModel = organisation.root?.model ?? EMPTY_MODEL
  const scopeLabel = useCallback(
    (path: ScopePath) => (path === ROOT_SCOPE ? organisation.tree.name : scopePathLabel(path)),
    [organisation.tree.name],
  )

  /**
   * Open another scope by its path — what *Open …* beside a field another
   * scope answers for does (ADR-0012 §10).
   *
   * Here rather than in the workspace because opening a scope is the shell's
   * act: reading it, making it the one that is open, and remembering it. A
   * path that names nothing is a refreshed tree and nothing else — somebody
   * removed the scope between the index being read and the button being
   * pressed, and there is nothing useful to say about that beyond showing what
   * is there now.
   */
  const openScopeAt = useCallback((path: ScopePath, page?: InitialPage) => {
    void projects.load(path).then(
      (found) => {
        if (found) enter(found, page)
        else refreshTree.current()
      },
      (cause: unknown) => failedRef.current('openScopeAt', cause, 'picker.loadFailed'),
    )
  }, [projects, enter])

  /**
   * What the organisation contradicts about itself, by scope (ADR-0012 §9).
   *
   * One fold over the index for the whole tree, memoised on it — a row that
   * asked for its own would be a fold per row, and there is one row per scope.
   * Only the findings the index alone can answer are in here; the ones that
   * need a scope's own records belong to the scope that is open.
   */
  const identity = useMemo(() => identityFindings(tree.index), [tree.index])
  /** Every plan flagged as an initiative anywhere below the root (ADR-0012 §7), for the roadmap card. */
  const initiatives = useMemo(() => tree.index.initiativesBelow(home).length, [tree.index, home])
  /** Every observation shared from anywhere below this home (ADR-0021), for the observations card. */
  const sharedObservations = useMemo(
    () => tree.index.observationsBelow(home).filter(({ observation }) => !observation.archived).length,
    [tree.index, home],
  )
  const treeFindings = useMemo(() => findingsByScope(identity), [identity])
  /**
   * The tree, for the agent while nothing is open (ADR-0019): the same index
   * the workspace hands it, minus the open document's own findings, which
   * there is no document for. Through a ref, so the shell object the handler
   * keeps reaches the current listing and index.
   */
  const treeRef = useRef({ tree: organisation.tree, index: tree.index, identity })
  treeRef.current = { tree: organisation.tree, index: tree.index, identity }
  const shellTree = useMemo<TreeView>(() => ({
    scopes: () => flattenScopes(treeRef.current.tree).map((held) => ({
      path: held.path, name: held.name, ...(held.kind ? { kind: held.kind } : {}), views: held.diagrams,
    })),
    lookup: (id) => treeRef.current.index.lookup(id),
    register: () => treeRef.current.index.register(),
    technology: () => technologyRows(treeRef.current.index, treeRef.current.identity),
    initiativesBelow: (path) => treeRef.current.index.initiativesBelow(path),
    observationsBelow: (path) => treeRef.current.index.observationsBelow(path),
    rowsTo: (id, types) => treeRef.current.index.rowsTo(id, types).map((row) => row.relation),
    findings: () => treeRef.current.identity,
    read: async (path) => {
      const held = await projects.load(path)
      if (!held) return undefined
      const above = await Promise.all(ancestorScopes(path).map((one) => projects.load(one)))
      return {
        model: held.model,
        activeDiagramId: held.activeDiagramId,
        ancestorDecisions: above.flatMap((one) => one?.model.decisions ?? []),
      }
    },
  }), [projects])

  /**
   * The register, derived over the same index and in the same one pass
   * (ADR-0012 §2). The card on the organisation screen and the page behind it
   * read this; nothing commits it, and nothing loads for it.
   */
  const register = useMemo(() => registerRows(tree.index, identity), [tree.index, identity])
  /** The technology register (ADR-0014 §2.6), the same fold over the same index. */
  const technology = useMemo(() => technologyRows(tree.index, identity), [tree.index, identity])

  /**
   * The tree's records, read when a gesture asks (ADR-0012 §10), and the two
   * things to do again once one has landed: the listing this screen shows, and
   * the index everything below it decides ownership by.
   */
  const readTreeModels = useCallback(() => treeModels(projects), [projects])
  /** Every scope in full, for the working file (ADR-0018). Read on the gesture, never held. */
  const readWorkingSet = useCallback(() => treeScopes(projects), [projects])
  /**
   * The scopes an opened working file brought with it, written where they say
   * they belong (ADR-0018).
   *
   * Shallowest first, which is the order `openDocumentBytes` answers in: a
   * child written before its parent would be filed under a folder that is not a
   * scope yet.
   */
  const adoptScopes = useCallback(async (held: readonly ScopeSnapshot[]) => {
    for (const scope of held) await projects.save(scope)
  }, [projects])
  const treeChanged = useCallback(() => {
    refreshTree.current()
    tree.refresh()
  }, [tree])

  /**
   * The one password dialog (ADR-0023), drawn here and lent to whichever of
   * the two file flows is asking: the workspace's, with a scope open, or the
   * home's below, with nothing open.
   */
  const password = usePasswordPrompt(s)
  const openInto = useOpenIntoPrompt(s)
  const homeFiles = useHomeFiles({
    documents,
    workingSet: readWorkingSet,
    into: homeDocument,
    adopt: async (held) => {
      await adoptScopes(held)
      treeChanged()
    },
    askPassword: password.askPassword,
    landing: openInto.prompts,
    chooseFolder: onChooseFolderForWorkingFile,
    notify: toasts.notify,
    s,
  })
  const homePicker = useFilePicker({
    accept: '.lvarch,.json,application/json,application/zip,application/octet-stream',
    onPick: homeFiles.openFile,
    testId: 'home-document-input',
  })
  homeFilesRef.current = project ? undefined : {
    exportWorkingFile: homeFiles.exportWorkingFile,
    open: homePicker.open,
    openDocument: homeFiles.openDocument,
  }

  const goHome = useCallback((to: ScopePath) => {
    setHome(to)
    setProject(undefined)
    setInitialPage(undefined)
    // Deliberately keeps `lastScope`: closing a scope is not the same as saying
    // you never want to see it again, and a refresh should still land you back
    // in your work.
    organisation.refresh()
  }, [organisation])

  /**
   * A home the listing no longer has — the scope was removed, from its own
   * page or by somebody else's hand — falls back to the root's rather than
   * showing a heading over nothing.
   */
  const homeListed = home === ROOT_SCOPE
    || flattenScopes(organisation.tree).some((scope) => scope.path === home)
  useEffect(() => { if (!homeListed) setHome(ROOT_SCOPE) }, [homeListed])

  /**
   * Change a scope's name, where it is filed, or both.
   *
   * A rename edits the model in place. A move changes the address, so the store
   * has to take the new one before it forgets the old — that order matters:
   * removing first and then failing to save would lose the scope outright.
   *
   * The edit is made on `current` — the scope as the open session has it, not
   * as this component last saw it. Those two drift apart with every stroke of
   * editing, and applying settings to the stale one would write a model without
   * this afternoon's work over the model with it.
   *
   * What comes back is the saved scope when the workspace stays mounted, so the
   * session can take it on: without that, the session keeps a model that knows
   * nothing of the new defaults and the next autosave puts it back. Nothing
   * comes back from a move, because a move changes the address and the
   * workspace remounts on it anyway.
   */
  const applyProjectSettings = useCallback((
    settings: ProjectSettings,
    current: ScopeSnapshot,
  ): Promise<ScopeSnapshot | undefined> => {
    return projects.list().then(async (held) => {
      const targetGroup = settings.group
      const moving = targetGroup !== (parentScope(current.path) ?? ROOT_SCOPE)
      const named = setScopeDefaults(renameScope(current, settings.name), {
        author: settings.defaultAuthor,
        aspectConfig: settings.defaultAspectConfig,
      })
      let next = named

      if (moving) {
        // A name free under the old parent can be taken under the new one.
        const parent = flattenScopes(held).find((scope) => scope.path === targetGroup)
        const taken = namesUnder(parent)
        next = moveScope(named, taken.includes(scopePathLabel(current.path))
          ? scopePathFor(targetGroup, settings.name, taken)
          : scopePathFor(targetGroup, scopePathLabel(current.path)))
      }

      const moved = moving && current.path !== next.path
      // A ref is an address, and a move carries the ones pointing into this
      // scope (ADR-0012 §3) — the same pass the organisation screen's move
      // makes, because it is the same act from a different dialog.
      if (moved) {
        try {
          const carried = await carryRefs({ scopes: projects, from: current.path, to: next.path })
          next = applyRefPatch(next, carried.get(current.path))
        } catch (cause) {
          failed('applyProjectSettings.readdress', cause)
          reportStorage(false)
          return undefined
        }
      }

      // Before the save, so nothing can write to the old address from the
      // moment this app stops considering it ours.
      if (moving) movedAway.current = current.path
      try {
        await projects.save(next)
      } catch (cause) {
        failed('applyProjectSettings.save', cause)
        reportStorage(false)
        movedAway.current = undefined
        return undefined
      }
      if (moved) {
        // Inside the guard, not after it. The save has landed, so the project
        // exists at both addresses; a remove that throws here used to do so
        // silently and leave a duplicate for the user to find in the picker
        // weeks later. The move itself still counts as done.
        try {
          await projects.remove(current.path)
        } catch (cause) {
          failed('applyProjectSettings.remove', cause)
          toasts.notify(s('shell.moveLeftCopy', { message: reasonOf(cause) }), 'warning')
        }
      }
      enter(next)
      movedAway.current = undefined
      toasts.notify(
        moving
          ? s('settings.moved', { name: settings.name })
          : s('settings.renamed', { name: settings.name }),
        'success',
      )
      return moved ? undefined : next
    }, (cause: unknown) => {
      failed('applyProjectSettings.list', cause)
      reportStorage(false)
      return undefined
    })
  }, [projects, enter, toasts, failed, reportStorage, s])

  /**
   * The scopes above the open one, for the decisions and the client they carry.
   *
   * Read when a scope is entered and after every write, not on every render.
   * ADR-0012 §7 reads a decision up the tree as well as at the scope, so the
   * page beside the landscape still shows the domain's records — which is where
   * a group's used to live, filed one level up and under another name.
   *
   * Loaded rather than listed, because a listing carries names and not
   * decisions. There are at most a handful of ancestors, and a domain's model
   * is small; the root's is the one that is not, and reading it once on opening
   * a scope is the price of the records being reachable at all.
   */
  const [ancestors, setAncestors] = useState<readonly ScopeSnapshot[]>([])
  const openPathForAncestors = project?.path
  // How a failure is reported is not an input to reading a scope. `failed` is
  // read through the ref so it cannot re-trigger the read: a dependency that
  // changes identity on render is not a needless read but an endless one.
  const readAncestors = useCallback(async (of: ScopePath): Promise<ScopeSnapshot[]> => {
    const held = await Promise.all(ancestorScopes(of).map((path) => projects.load(path)))
    return held.filter((scope): scope is ScopeSnapshot => !!scope)
  }, [projects])
  useEffect(() => {
    if (openPathForAncestors === undefined) return
    let live = true
    void readAncestors(openPathForAncestors).then(
      (held) => { if (live) setAncestors(held) },
      (cause: unknown) => {
        if (live) setAncestors([])
        // No message: what an ancestor says is decoration here, and a decisions
        // page that is empty is visible on its own. The trail still gets it.
        failedRef.current('ancestors', cause)
      },
    )
    return () => { live = false }
  }, [openPathForAncestors, readAncestors])

  /**
   * The records of every scope above this one, nearest first (ADR-0012 §7).
   *
   * One list, read up the tree: the decisions page shows this scope's own and
   * a *From …* section per ancestor that has any. Read-only there — a record
   * is edited where it lives, which is the same rule `mayEdit` applies to an
   * element — so nothing here writes them back any more.
   */
  const ancestorDecisions = useMemo<readonly AncestorRecords[]>(
    () => ancestors.map((scope) => ({
      path: scope.path,
      name: scope.model.name,
      decisions: scope.model.decisions ?? [],
    })),
    [ancestors],
  )

  /**
   * The name and the client, walked up the tree over what has been read.
   *
   * The summaries the ancestors were loaded as, plus the open scope's own — so
   * a scope that says nothing yields to the one above it, and a title block is
   * never blank (`projects/scopeLabel.ts`).
   */
  const chain = useMemo<ScopeSummary[]>(() => {
    if (!project) return []
    return [project, ...ancestors].map((scope) => ({
      path: scope.path,
      name: scope.model.name,
      ...(scope.client !== undefined ? { client: scope.client } : {}),
      diagrams: scope.model.diagrams.length,
      children: [],
    }))
  }, [project, ancestors])
  const groupName = project ? organisationLabel(project.path, chain) : ''
  const groupClient = project ? scopeClient(project.path, chain) : undefined
  /** Every scope above the open one, root first, named from the listing. */
  const crumbs = useMemo(
    () => (project ? crumbsFor(project.path, flattenScopes(organisation.tree), s) : []),
    [project, organisation.tree, s],
  )

  /**
   * What the window is called, which is the two names the bar already shows.
   *
   * With nothing open it is the organisation on its own — or the product on its
   * own, before there is one — because the picker is not a scope and pretending
   * it is would name a window after nothing.
   */
  const homeName = useMemo(
    () => flattenScopes(organisation.tree).find((scope) => scope.path === home)?.name,
    [organisation.tree, home],
  )
  /**
   * The agent at the shell (ADR-0019): where the app is, moving it, and the
   * driving session with its Stop. Which of the organisation screen's two
   * pages is up is the one fact about that screen the shell has to hold,
   * because an agent may ask for either and may ask where it stands.
   */
  const [orgPage, setOrgPage] = useState<'register' | 'technologyRegister' | undefined>(undefined)
  const [orgPageRequest, setOrgPageRequest] = useState<{ page: 'register' | 'technologyRegister'; nonce: number } | undefined>(undefined)
  const agentSessionRef = useRef<WorkspaceAgentView | undefined>(undefined)
  const screenNow = useCallback((): Screen => {
    const held = agentSessionRef.current
    if (project && held) {
      const model = held.current()
      const active = model.diagrams.find((diagram) => diagram.id === held.activeDiagramId())
      const page = held.page()
      return {
        open: { path: project.path, name: model.name, ...(active ? { view: { id: active.id, name: active.name, kind: active.kind } } : {}) },
        ...(page ? { page } : {}),
      }
    }
    if (project) return { open: { path: project.path, name: project.model.name } }
    return {
      home: { path: home, name: home === ROOT_SCOPE ? organisation.tree.name : (homeName ?? scopePathLabel(home)) },
      ...(orgPage ? { page: { page: orgPage } } : {}),
    }
  }, [project, home, homeName, organisation.tree.name, orgPage])
  const openFor = useCallback((to: Destination & { scope: string }) => {
    if (to.page === 'home' || to.page === 'register' || to.page === 'technologyRegister') {
      const page = to.page
      goHome(to.scope)
      setOrgPageRequest((prev) => (page === 'home' ? undefined : { page, nonce: (prev?.nonce ?? 0) + 1 }))
      return
    }
    const held = agentSessionRef.current
    if (project && project.path === to.scope && held) {
      held.show(to)
      return
    }
    openScopeAt(to.scope, initialPageFor(to))
  }, [goHome, project, openScopeAt])
  const agentStopped = useCallback((client: string | undefined) => {
    toasts.notify(s('agent.stoppedToast', { name: client ?? s('agent.someone') }), 'info')
  }, [toasts, s])
  const agentShell = useAgentShell({
    gateway: agent,
    status: agentStatus,
    tree: shellTree,
    screen: screenNow,
    open: openFor,
    onStopped: agentStopped,
  })
  const registerAgent = agentShell.register
  const registerAgentSession = useCallback((view: WorkspaceAgentView | undefined) => {
    agentSessionRef.current = view
    registerAgent(view)
  }, [registerAgent])

  useEffect(() => {
    if (project) onTitle?.(groupName, project.model.name)
    else if (home === ROOT_SCOPE) onTitle?.(organisation.tree.name)
    else onTitle?.(organisation.tree.name, homeName)
  }, [onTitle, project, groupName, organisation.tree.name, home, homeName])


  /**
   * The scope that is open, as whoever answers for the source sees it — held
   * here only so the provider's own chrome can be handed it.
   *
   * The session is made inside the workspace and handed out through
   * `onScopeSession`, which is a subscription and not a render: a strip that has
   * to say something about the open scope cannot reach it any other way. Taken
   * back the moment the workspace lets go, which is every scope switch, so
   * nothing here can name a session whose model has been unmounted.
   *
   * Left undefined where neither the provider nor its chrome asked, so the
   * workspace is handed nothing at all and behaves as it always has.
   */
  const [openScope, setOpenScope] = useState<ScopeSession>()
  const holdScopeSession = useCallback((session: ScopeSession) => {
    setOpenScope(session)
    const stop = onScopeSession?.(session)
    return () => { setOpenScope(undefined); stop?.() }
  }, [onScopeSession])
  const takeScopeSession = chromes.length > 0 || onScopeSession ? holdScopeSession : undefined
  /**
   * Which registration answers for the source that is open, so that one chrome
   * is handed the session and the others are not. A built-in source is its own
   * provider's kind, and a registered one names it.
   */
  const openProvider = sourceProviderKind(source)

  return (
    /* The theme lives here and not at module level: it hangs off state (light /
       dark / system) and must be able to change with it. CssBaseline sits inside
       it, because that is what paints the page background. */
    <ThemeProvider theme={prefs.theme}>
      <CssBaseline />
      <Box sx={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column' }}>
        {/* Inside the theme, so the fallback is painted in the user's colours,
            and around the two screens rather than around everything: a crash
            must not take the toast bar with it. */}
        <ErrorBoundary where="app" diagnostics={diagnostics} controls={hostControls} s={s}>
        {needsFolder && onChooseWorkingDirectory
          && source.kind !== 'folder' && source.kind !== 'registered' ? (
          /* The desktop, with nowhere to keep anything yet. Not the picker:
             there is nowhere for a project to be until this is answered, and
             offering a list of projects kept inside the app is offering the
             thing ADR-0003 removed. A source a provider answers for is an
             answer to the same question — this screen asks where work should
             live, not which folder it is in, and a build that has connected to
             one and is still being asked has been asked twice. */
          <ChooseFolder
            recent={recentFolders}
            onChoose={onChooseWorkingDirectory}
            onOpen={onOpenWorkingDirectory ?? (() => {})}
            waysIn={waysIn}
            s={s}
            windowChrome={windowChrome}
          />
        ) : project ? (
          <ProjectWorkspace
            // Remounting on a project switch is the mechanism, not an accident:
            // the session's undo stack, aliases and pending batches belong to
            // one project and must not survive into another.
            key={`${project.path}#${reloadKey}`}
            project={project}
            projects={workspaceStore}
            index={tree.index}
            watch={watchOpenProject}
            // Two facts about where work is kept that the workspace reads as
            // its own: whether it may be written at all, and what this source
            // means by the words on the bar.
            readOnly={sourceIsReadOnly(source)}
            sourceStatus={sourceStatus}
            onSourceWork={onSourceWork}
            onScopeSession={takeScopeSession}
            commands={bus.on}
            hostMenu={hostMenu}
            overflow={hostMenu ? undefined : {
              themeMode: prefs.themeMode,
              can: { folders: Boolean(onChooseWorkingDirectory), scope: true },
              onCommand: bus.send,
            }}
            onUnsavedWork={onUnsavedWork}
            history={history}
            onSnapshotTaken={sync.afterSnapshot}
            onAgentSession={registerAgentSession}
            agentBar={agentBar}
            documents={documents}
            askPassword={password.askPassword}
            landing={openInto.prompts}
            chooseFolder={onChooseFolderForWorkingFile}
            notify={toasts.notify}
            onStorageResult={reportStorage}
            s={s}
            language={prefs.language}
            editorPreferences={prefs.preferences}
            onEditorPreferencesChange={prefs.savePreferences}
            onGoHome={goHome}
            crumbs={crumbs}
            onOpenScope={openScopeAt}
            scopes={organisation.tree}
            models={readTreeModels}
            workingSet={readWorkingSet}
            onAdoptScopes={adoptScopes}
            onOpenSettings={organisation.refresh}
            onTreeChanged={treeChanged}
            onApplySettings={applyProjectSettings}
            makeId={makeId}
            ancestorDecisions={ancestorDecisions}
            groupName={groupName}
            groupClient={groupClient}
            diagnostics={diagnostics}
            hostControls={hostControls}
            initialPage={initialPage}
            windowChrome={windowChrome}
          />
        ) : (
          <OrganisationScreen
            organisation={organisation}
            examples={examples}
            order={order}
            onOrderChange={chooseOrder}
            source={source}
            sourceDescription={sourceDescription}
            onChooseWorkingDirectory={onChooseWorkingDirectory}
            waysIn={waysIn}
            // The same two the workspace's bar carries: the menu on a host
            // that has none of its own, and the agent glyph, which has to be
            // reachable with nothing open (ADR-0007).
            overflow={hostMenu ? undefined : {
              themeMode: prefs.themeMode,
              // The folder's history, from its front door too (`homeHistory`).
              can: { folders: Boolean(onChooseWorkingDirectory), history: homeHistory.available, scope: false },
              onCommand: bus.send,
            }}
            agent={agentBar}
            onGoHome={goHome}
            findings={treeFindings}
            register={register}
            technology={technology}
            initiatives={initiatives}
            sharedObservations={sharedObservations}
            onOpenRegisterRow={(path, id) => openScopeAt(path, { page: 'element', id })}
            onOpenRegisterPage={(path, id) => openScopeAt(path, { page: 'document', id })}
            onLinkFromRegister={(path, id, to) => openScopeAt(path, { page: 'link', id, to })}
            pageRequest={orgPageRequest}
            onPageChange={setOrgPage}
            today={todayDay}
            language={prefs.language}
            s={s}
            windowChrome={windowChrome}
          />
        )}
        </ErrorBoundary>
        {!project && (
          <>
            <SnapshotDialog
              open={homeHistory.dialogOpen}
              keeping={homeHistory.keeping}
              draft={homeHistory.draft}
              onCancel={homeHistory.closeDialog}
              onTake={homeHistory.take}
              s={s}
            />
            <HistoryPage
              open={homeHistory.pageOpen}
              onClose={homeHistory.closePage}
              entries={homeHistory.entries}
              chosen={homeHistory.chosen}
              onChoose={homeHistory.choose}
              current={homeModel}
              subject={homeHistory.subject}
              onSubjectChange={homeHistory.setSubject}
              scopes={homeHistory.places.map((place) => scopeLabel(place.path))}
              onRestore={homeHistory.restore}
              onLabel={homeHistory.label}
              language={prefs.language}
              s={s}
              windowChrome={windowChrome}
            />
          </>
        )}
        <SyncNotice
          open={sync.diverged}
          onTakeTheirs={() => sync.resolve('theirs')}
          onKeepOurs={() => sync.resolve('ours')}
          s={s}
        />
        <AgentDrivingBanner driving={agentShell.driving} onStop={agentShell.stop} s={s} />
        {source.kind === 'memory' && (
          /* Along the bottom rather than above the toolbar: on the desktop that
             bar is the title bar, and anything pushed above it lands under the
             traffic lights. A standing strip is as visible and owes the window
             nothing. */
          <Alert
            severity="warning"
            square
            data-testid="storage-notice"
            sx={{ flex: '0 0 auto', borderRadius: 0, py: 0, fontSize: 12 }}
          >
            {s('shell.storageFailed')}
          </Alert>
        )}
        {chromes.map(({ kind, chrome: Chrome }) => (
          /* Inside the theme and inside the language, so a provider's strip is
             in this person's dark mode and this person's Frisian; beside the
             app's own notices rather than around the screens, because it is one
             of them. In a boundary of its own for the reason the canvas has
             one: a strip somebody else wrote falling over must cost the strip
             and not the window — and one boundary EACH, so it does not cost the
             next provider's strip either.

             Every registration, open or not: the provider whose way in has just
             been pressed is by definition not the source yet, and its dialog has
             to be somewhere. The session goes to the one that answers for the
             source that is open, and to nobody else. */
          <ErrorBoundary
            key={kind}
            where="sourceChrome"
            diagnostics={diagnostics}
            controls={hostControls}
            s={s}
          >
            <LanguageProvider language={prefs.language}>
              <Chrome session={kind === openProvider ? openScope : undefined} />
            </LanguageProvider>
          </ErrorBoundary>
        ))}
        {password.dialog}
        {openInto.dialogs}
        {/* Invisible; the home's Open… clicks it. Beside the dialog rather than on
            the screen, because the home does not own the working file either. */}
        {project ? null : homePicker.input}
        <PreferencesDialog
          open={prefsOpen}
          onClose={() => setPrefsOpen(false)}
          language={prefs.language}
          onLanguageChange={prefs.chooseLanguage}
          themeMode={prefs.themeMode}
          onThemeChange={prefs.chooseTheme}
          order={order}
          onOrderChange={chooseOrder}
          updates={updateSettings && updates && {
            checkAutomatically: updates.checkAutomatically, channel: updates.channel, onChange: changeUpdates,
          }}
          machine={folderSettings && history && local && { ...local.git, onChange: changeLocal }}
          s={s}
        />
        <ConnectAgentDialog
          open={agentOpen}
          onClose={() => setAgentOpen(false)}
          status={agent ? agentStatus : undefined}
          onEnabledChange={changeAgentEnabled}
          onNewToken={newAgentToken}
          copyText={hostControls.copyText}
          s={s}
        />
        <ToastBar
          toast={toasts.toast}
          open={toasts.open}
          onClose={toasts.close}
          onExited={toasts.exited}
        />
      </Box>
    </ThemeProvider>
  )
}

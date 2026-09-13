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
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import { translator } from '../i18n'
import type { StringKey } from '../i18n'
import type { ElementId } from '../model'
import type { AncestorRecords } from '../decisions/adrScope'
import type { Diagnostic, DiagnosticEntry } from '../platform/diagnostics'
import { reasonOf } from '../platform/errors'
import {
  flattenScopes, isProjectOrder, moveScope, namesUnder, renameScope, setScopeDefaults,
} from '../projects/scope'
import type {
  ProjectOrder, ScopeKind, ScopeModel, ScopeSnapshot, ScopeSummary,
} from '../projects/scope'
import { findingsByScope, identityFindings } from '../projects/checks'
import { applyRefPatch } from '../projects/readdress'
import { treeModels } from '../projects/scopeIndex'
import { organisationLabel, scopeClient } from '../projects/scopeLabel'
import type { RecordLink } from '../projects/links'
import {
  ancestorScopes, parentScope, ROOT_SCOPE, scopePathFor, scopePathLabel,
} from '../projects/scopePath'
import type { ScopePath } from '../projects/scopePath'
import { crumbsFor } from './ShellToolbar'
import { NO_WINDOW_CHROME } from '../platform/windowChrome'
import type { ThemeMode } from '../platform/theme'
import type { UpdateSettings, UpdateSettingsPatch } from '../platform/updateSettings'
import type { PullOutcome } from '../platform/sync'
import { LOCAL_SETTINGS_PATH } from '../projects/folderSettings'
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
import { BROWSER_STORAGE } from '../platform/workingSource'
import type { WorkingSource } from '../platform/workingSource'
import type { ExampleProject } from './examples'
import { ErrorBoundary } from './ErrorBoundary'
import type { CrashControls } from './ErrorBoundary'
import { carryRefs } from './carryRefs'
import { ChooseFolder } from './organisation/ChooseFolder'
import { OrganisationScreen } from './organisation/OrganisationScreen'
import { registerRows } from './organisation/register'
import { useOrganisation } from './organisation/useOrganisation'
import { ProjectWorkspace } from './ProjectWorkspace'
import type { ProjectSettings } from './ProjectSettingsDialog'
import { ToastBar } from './ToastBar'
import type { MakeId } from './useDiagramActions'
import type { ProjectFileChannel } from './useProjectFiles'
import { useAgentGateway } from './useAgentGateway'
import { useGlobalErrors } from './useGlobalErrors'
import { useHostCommands } from './useHostCommands'
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
  | { page: 'decisions' }
  | { page: 'roadmap' }
  /** A sheet by id, or — with none — the one the scope is about to be given. */
  | { page: 'sheet'; id?: string }
  /** The enterprise map, likewise. */
  | { page: 'map'; id?: string }
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
  hostControls: CrashControls
  /**
   * What you are working from (ADR-0005): a folder by name, the browser's
   * storage, or memory. `memory` means storage refused at boot — a private
   * window, a strict policy — and nothing typed here will be there tomorrow.
   * That is worth a standing notice rather than a toast, because it is true
   * for the whole session and not an event within it; the top bar says it too.
   */
  source?: WorkingSource
  /**
   * How to change the folder. Absent in a browser tab whose browser cannot
   * give one: an app that showed the button anyway would be offering what it
   * cannot do.
   */
  onChooseWorkingDirectory?: () => void
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
  /** Work in a folder the user has already granted. The Recent submenu. */
  onOpenWorkingDirectory?: (root: string) => void
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

function localToday(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function App({
  scopes: projects, preferences, documents, diagnostics, hostControls,
  source = BROWSER_STORAGE, onChooseWorkingDirectory, needsFolder = false, watchProject,
  commands, hostMenu = false, onUnsavedWork, onThemeMode, onOpenWorkingDirectory, recentFolders,
  history, folderSettings, updateSettings, agent, initialSync, folderFailure, today = localToday,
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
  useEffect(() => bus.on((command) => {
    if (command.type === 'chooseFolder') onChooseWorkingDirectory?.()
    if (command.type === 'openFolder') onOpenWorkingDirectory?.(command.root)
    if (command.type === 'theme') prefs.chooseTheme(command.mode)
    if (command.type === 'preferences') setPrefsOpen(true)
    if (command.type === 'connectAgent') setAgentOpen(true)
  }), [bus, onChooseWorkingDirectory, onOpenWorkingDirectory, prefs])

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

  // An agent asking while no project is open is told so. The workspace binds
  // the same seam to its session while one is; the two never overlap.
  useAgentGateway(project ? undefined : agent, undefined)

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
    setProject(next)
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
    notify: toasts.notify,
    onFailure: failed,
    onStorageResult: reportStorage,
    s,
  })
  refreshTree.current = organisation.refresh

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
  const treeFindings = useMemo(() => findingsByScope(identity), [identity])

  /**
   * The register, derived over the same index and in the same one pass
   * (ADR-0012 §2). The card on the organisation screen and the page behind it
   * read this; nothing commits it, and nothing loads for it.
   */
  const register = useMemo(() => registerRows(tree.index, identity), [tree.index, identity])

  /**
   * The tree's records, read when a gesture asks (ADR-0012 §10), and the two
   * things to do again once one has landed: the listing this screen shows, and
   * the index everything below it decides ownership by.
   */
  const readTreeModels = useCallback(() => treeModels(projects), [projects])
  const treeChanged = useCallback(() => {
    refreshTree.current()
    tree.refresh()
  }, [tree])

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
  useEffect(() => {
    if (project) onTitle?.(groupName, project.model.name)
    else if (home === ROOT_SCOPE) onTitle?.(organisation.tree.name)
    else onTitle?.(organisation.tree.name, homeName)
  }, [onTitle, project, groupName, organisation.tree.name, home, homeName])


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
        {needsFolder && onChooseWorkingDirectory && source.kind !== 'folder' ? (
          /* The desktop, with no folder yet. Not the picker: there is nowhere
             for a project to be until this is answered, and offering a list of
             projects kept inside the app is offering the thing ADR-0003
             removed. */
          <ChooseFolder
            recent={recentFolders}
            onChoose={onChooseWorkingDirectory}
            onOpen={onOpenWorkingDirectory ?? (() => {})}
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
            commands={bus.on}
            overflow={hostMenu ? undefined : {
              themeMode: prefs.themeMode,
              can: { folders: Boolean(onChooseWorkingDirectory) },
              onCommand: bus.send,
            }}
            onUnsavedWork={onUnsavedWork}
            history={history}
            onSnapshotTaken={sync.afterSnapshot}
            agent={agent}
            agentBar={agentBar}
            documents={documents}
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
            onChooseWorkingDirectory={onChooseWorkingDirectory}
            // The same two the workspace's bar carries: the menu on a host
            // that has none of its own, and the agent glyph, which has to be
            // reachable with nothing open (ADR-0007).
            overflow={hostMenu ? undefined : {
              themeMode: prefs.themeMode,
              // No history: snapshots and the history page are about the scope
              // that is open, and none is.
              can: { folders: Boolean(onChooseWorkingDirectory), history: false },
              onCommand: bus.send,
            }}
            agent={agentBar}
            onGoHome={goHome}
            findings={treeFindings}
            register={register}
            initiatives={initiatives}
            onOpenRegisterRow={(path, id) => openScopeAt(path, { page: 'element', id })}
            onOpenRegisterPage={(path, id) => openScopeAt(path, { page: 'document', id })}
            onLinkFromRegister={(path, id, to) => openScopeAt(path, { page: 'link', id, to })}
            today={todayDay}
            language={prefs.language}
            s={s}
            windowChrome={windowChrome}
          />
        )}
        </ErrorBoundary>
        <SyncNotice
          open={sync.diverged}
          onTakeTheirs={() => sync.resolve('theirs')}
          onKeepOurs={() => sync.resolve('ours')}
          s={s}
        />
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
          machine={folderSettings && history && local && {
            ...local.git, path: LOCAL_SETTINGS_PATH, onChange: changeLocal,
          }}
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

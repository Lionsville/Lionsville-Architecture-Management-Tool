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
import type { Adr } from '../decisions/adr'
import type { Diagnostic, DiagnosticEntry } from '../platform/diagnostics'
import { reasonOf } from '../platform/errors'
import { groupProfileFor, normaliseGroupProfile } from '../projects/group'
import type { GroupProfile } from '../projects/group'
import {
  emptyProject, groupNameOf, groupsOf, isProjectOrder, keysInGroup, moveToGroup,
  relabelGroup, renameProject, setProjectDefaults,
} from '../projects/project'
import type {
  ProjectGroup, ProjectOrder, ProjectSnapshot, ProjectSummary,
} from '../projects/project'
import { parentScope, ROOT_SCOPE, scopePathFor, scopePathLabel } from '../projects/scopePath'
import type { ScopePath } from '../projects/scopePath'
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
import { exampleProject } from './examples'
import type { ExampleProject } from './examples'
import { ErrorBoundary } from './ErrorBoundary'
import type { CrashControls } from './ErrorBoundary'
import { ChooseFolder } from './picker/ChooseFolder'
import { ProjectPicker } from './picker/ProjectPicker'
import { ProjectWorkspace } from './ProjectWorkspace'
import type { ProjectSettings } from './ProjectSettingsDialog'
import { ToastBar } from './ToastBar'
import type { MakeId } from './useDiagramActions'
import type { ProjectFileChannel } from './useProjectFiles'
import { useAgentGateway } from './useAgentGateway'
import { useGlobalErrors } from './useGlobalErrors'
import { useHostCommands } from './useHostCommands'
import type { CommandStream } from './useHostCommands'
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
 * What the app needs from the group store. `remove` is deliberately absent: a
 * group's record outliving its last project is harmless — re-create the group
 * and its description is waiting — and nothing here should be able to erase one
 * as a side effect of something else.
 */
export type GroupRecords = {
  list(): Promise<GroupProfile[]>
  save(profile: GroupProfile): Promise<void>
}

/**
 * What the shell does to the diagnostics seam: reports, and — for the crash
 * fallback it hands the trail to — reads back.
 */
export type ShellDiagnostics = {
  report(entry: Diagnostic): void
  recent(): DiagnosticEntry[]
}

export type ProjectLibrary = {
  list(): Promise<ProjectSummary[]>
  load(path: ScopePath): Promise<ProjectSnapshot | undefined>
  save(project: ProjectSnapshot): Promise<void>
  remove(path: ScopePath): Promise<void>
}

export type AppProps = {
  projects: ProjectLibrary
  groupRecords: GroupRecords
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
  watchProject?: (path: ScopePath, onChanged: () => void) => () => void
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

  /** Read by the composition root before the first render, so this can be sync. */
  initialProject: ProjectSnapshot | undefined
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
}

export function App({
  projects, groupRecords, preferences, documents, diagnostics, hostControls,
  source = BROWSER_STORAGE, onChooseWorkingDirectory, needsFolder = false, watchProject,
  commands, hostMenu = false, onUnsavedWork, onThemeMode, onOpenWorkingDirectory, recentFolders,
  history, folderSettings, updateSettings, agent, initialSync, initialProject, initialPreferences,
  examples, makeId, browserLanguages, windowChrome = NO_WINDOW_CHROME,
}: AppProps) {
  const toasts = useToasts()

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

  const [project, setProject] = useState<ProjectSnapshot | undefined>(initialProject)

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

  /** Bumped whenever the set of projects changed, so the picker re-reads it. */
  const [revision, setRevision] = useState(0)

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
        if (!found) { setProject(undefined); setRevision((r) => r + 1); return }
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
    save: (held: ProjectSnapshot) => (
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

  /** Opening is what makes a project "last opened", so both happen here. */
  const enter = useCallback((next: ProjectSnapshot) => {
    setProject(next)
    prefs.writePreference({ lastScope: next.path })
  }, [prefs])

  const openProject = useCallback((path: ScopePath) => {
    void projects.load(path).then(
      (found) => {
        if (!found) { toasts.notify(s('picker.loadFailed'), 'error'); setRevision((r) => r + 1); return }
        enter(found)
      },
      (cause: unknown) => failed('openProject', cause, 'picker.loadFailed'),
    )
  }, [projects, enter, toasts, failed, s])

  const leaveProject = useCallback(() => {
    setProject(undefined)
    // Deliberately keeps `lastProject`: closing a project is not the same as
    // saying you never want to see it again, and a refresh should still land
    // you back in your work.
    setRevision((r) => r + 1)
  }, [])

  /** A new project exists as soon as it is saved; otherwise a refresh loses it. */
  const createAndEnter = useCallback((fresh: ProjectSnapshot, message: string) => {
    void projects.save(fresh).then(
      () => {
        enter(fresh)
        setRevision((r) => r + 1)
        toasts.notify(message, 'success')
      },
      (cause: unknown) => { failed('createAndEnter', cause); reportStorage(false) },
    )
  }, [projects, enter, toasts, failed, reportStorage])

  /**
   * Create a project, in a group that exists or in a new one.
   *
   * `group` arrives as a slug when the picker had one to offer, so adding to a
   * group you already work in files it under exactly that group rather than
   * under whatever the name happens to slug to this time.
   */
  const createProject = useCallback((wanted: {
    group?: string; groupName: string; projectName: string
  }) => {
    void projects.list().then((existing) => {
      const group = wanted.group ?? scopePathFor(ROOT_SCOPE, wanted.groupName)
      const path = scopePathFor(group, wanted.projectName, keysInGroup(existing, group))
      createAndEnter(
        emptyProject(
          path,
          wanted.groupName,
          { design: wanted.projectName, diagram: s('shell.newDiagram') },
        ),
        s('shell.projectCreated', { name: wanted.projectName }),
      )
    }, (cause: unknown) => {
      // A list that will not read is a store that is refusing, so the standing
      // storage notice is the honest message — and it is latched, so a burst of
      // these says it once.
      failed('createProject', cause)
      reportStorage(false)
    })
  }, [projects, createAndEnter, failed, reportStorage, s])

  /** The groups that exist, for the pickers in both dialogs. */
  const [groups, setGroups] = useState<ProjectGroup[]>([])
  const refreshGroups = useCallback(() => {
    void projects.list().then((all) => setGroups(groupsOf(all)), (cause: unknown) => {
      setGroups([])
      failed('refreshGroups', cause)
      reportStorage(false)
    })
  }, [projects, failed, reportStorage])

  /**
   * Change a project's name, its group, or both.
   *
   * A rename edits the model in place. A move changes the ref, so the store has
   * to take the new address before it forgets the old one — that order matters:
   * removing first and then failing to save would lose the project outright.
   *
   * The edit is made on `current` — the project as the open session has it, not
   * as this component last saw it. Those two drift apart with every stroke of
   * editing, and applying settings to the stale one would write a model without
   * this afternoon's work over the model with it.
   *
   * What comes back is the saved project when the workspace stays mounted, so
   * the session can take it on: without that, the session keeps a model that
   * knows nothing of the new defaults and the next autosave puts it back.
   * Nothing comes back from a move, because a move changes the ref and the
   * workspace remounts on it anyway.
   */
  const applyProjectSettings = useCallback((
    settings: ProjectSettings,
    current: ProjectSnapshot,
  ): Promise<ProjectSnapshot | undefined> => {
    return projects.list().then(async (existing) => {
      const targetGroup = settings.group
      const moving = targetGroup !== (parentScope(current.path) ?? ROOT_SCOPE)
      const named = setProjectDefaults(renameProject(current, settings.name), {
        author: settings.defaultAuthor,
        aspectConfig: settings.defaultAspectConfig,
      })
      let next = moving
        ? moveToGroup(named, targetGroup, settings.groupName)
        : { ...named, model: { ...named.model, customerName: settings.groupName } }

      if (moving) {
        // A key free in the old group can be taken in the new one.
        const taken = keysInGroup(existing, targetGroup)
        if (taken.includes(scopePathLabel(next.path))) {
          next = { ...next, path: scopePathFor(targetGroup, settings.name, taken) }
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
      const moved = moving && current.path !== next.path
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
      setRevision((r) => r + 1)
      toasts.notify(
        moving
          ? s('settings.moved', { name: settings.groupName })
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
   * Apply a group's edited record: what it is called, what it is, where the rest
   * of its material lives.
   *
   * The record is one write. The **name** is not, because the editor reads a
   * group's name off each project (`model.customerName`) — so a rename has to
   * sweep the group's projects too, and it is the sweep, not the record, that
   * the toast is about. The record goes first: if the sweep then fails halfway,
   * the group still knows its own name and reopening any project shows the old
   * label rather than the group losing its identity outright.
   *
   * No ref changes. A group path is an address; renaming relabels.
   */
  const applyGroupSettings = useCallback((profile: GroupProfile) => {
    void (async () => {
      try {
        await groupRecords.save(profile)
      } catch (cause) {
        failed('applyGroupSettings.record', cause, 'group.saveFailed')
        return
      }

      let inGroup: ProjectSummary[]
      try {
        inGroup = (await projects.list())
          .filter((it) => (parentScope(it.path) ?? ROOT_SCOPE) === profile.group)
      } catch (cause) {
        failed('applyGroupSettings.list', cause)
        reportStorage(false)
        return
      }

      const renaming = inGroup.some((it) => it.groupName !== profile.name)
      // What the sweep could not relabel. Collected rather than thrown, because
      // abandoning the loop at the first failure left the group half renamed
      // AND said nothing — the projects it never reached looked identical to
      // the ones it had deliberately skipped.
      const missed: string[] = []
      for (const summary of inGroup) {
        try {
          const held = await projects.load(summary.path)
          if (!held) continue
          const relabelled = relabelGroup(held, profile.name)
          if (relabelled === held) continue
          await projects.save(relabelled)
        } catch (cause) {
          failed('applyGroupSettings.relabel', cause)
          missed.push(summary.name)
        }
      }

      // The open project holds its own copy of the model, so it has to be told
      // rather than left to notice.
      if (project && (parentScope(project.path) ?? ROOT_SCOPE) === profile.group) {
        enter(relabelGroup(project, profile.name))
      }
      setRevision((r) => r + 1)
      if (missed.length) {
        reportStorage(false)
        toasts.notify(s('shell.groupRenameIncomplete', { names: missed.join(', ') }), 'warning')
        return
      }
      toasts.notify(
        renaming ? s('group.renamed', { name: profile.name }) : s('group.saved', { name: profile.name }),
        'success',
      )
    })().catch((cause: unknown) => {
      // A backstop, not a handler: everything above is caught where it can be
      // answered. A throw that reaches here happened in the synchronous tail,
      // which no boundary can see from inside an async function.
      failed('applyGroupSettings', cause, 'group.saveFailed')
    })
  }, [groupRecords, projects, project, enter, toasts, failed, reportStorage, s])

  /**
   * The open project's group record, for the decisions kept at group level.
   *
   * Read when a project is entered and after every write, not on every render:
   * the record is small and rarely changes, and the workspace only needs the
   * decisions off it. A group without a record has none — `groupProfileFor`
   * supplies the plain profile, so the write path below never has to ask
   * whether one existed.
   */
  const [groupProfiles, setGroupProfiles] = useState<GroupProfile[]>([])
  const groupKey = project && (parentScope(project.path) ?? ROOT_SCOPE)
  // How a failure is reported is not an input to reading the record. `failed`
  // is read through the ref so it cannot re-trigger the read: `list()` answers
  // with a new array every time, so a dependency that changes identity on
  // render is not a needless read but an endless one.
  useEffect(() => {
    if (!groupKey) return
    let live = true
    void groupRecords.list().then(
      (all) => { if (live) setGroupProfiles(all) },
      (cause: unknown) => {
        if (live) setGroupProfiles([])
        // No message: a group's record is decoration, and its decisions page
        // being empty is visible on its own. The trail still gets it.
        failedRef.current('groupProfiles', cause)
      },
    )
    return () => { live = false }
  }, [groupKey, groupRecords])

  const groupDecisions = useMemo<readonly Adr[]>(
    () => (groupKey ? groupProfiles.find((p) => p.group === groupKey)?.decisions ?? [] : []),
    [groupProfiles, groupKey],
  )
  const groupClient = groupKey
    ? groupProfiles.find((p) => p.group === groupKey)?.client
    : undefined

  const saveGroupDecisions = useCallback((next: Adr[]) => {
    if (!project) return
    const held = groupProfileFor(
      parentScope(project.path) ?? ROOT_SCOPE, groupNameOf(project.model), groupProfiles)
    const profile = normaliseGroupProfile({ ...held, decisions: next })
    // Optimistic: the page shows the change at once, and a failed write puts
    // the old record back along with the message.
    setGroupProfiles((all) => [...all.filter((p) => p.group !== profile.group), profile])
    void groupRecords.save(profile).then(
      undefined,
      (cause: unknown) => {
        failed('saveGroupDecisions', cause, 'group.saveFailed')
        setGroupProfiles((all) => [...all.filter((p) => p.group !== held.group), held])
      },
    )
  }, [project, groupProfiles, groupRecords, failed])

  /**
   * An example is a starting point, not a document you keep opening. Copying it
   * into a project of your own is what makes it editable and savable; opening it
   * again later opens *your* copy, which is why an existing one wins here.
   */
  const copyExample = useCallback((example: ExampleProject) => {
    void projects.load(example.path).then((existing) => {
      if (existing) { enter(existing); return }
      const copy = exampleProject(example)
      // A shipped example this build cannot read is a bug the example tests
      // exist to prevent, so it reaches here as nothing rather than as a crash.
      if (!copy) { failed('copyExample', new Error('the example did not read')); return }
      createAndEnter(copy, s('shell.exampleCopied', { name: example.label }))
    }, (cause: unknown) => {
      failed('copyExample', cause)
      reportStorage(false)
    })
  }, [projects, enter, createAndEnter, failed, reportStorage, s])

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
            watch={watchOpenProject}
            source={source}
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
            onLeave={leaveProject}
            groups={groups}
            onOpenSettings={refreshGroups}
            onApplySettings={applyProjectSettings}
            makeId={makeId}
            groupDecisions={groupDecisions}
            onGroupDecisionsChange={saveGroupDecisions}
            groupClient={groupClient}
            diagnostics={diagnostics}
            hostControls={hostControls}
            windowChrome={windowChrome}
          />
        ) : (
          <ProjectPicker
            projects={projects}
            groups={groupRecords}
            onApplyGroupSettings={applyGroupSettings}
            examples={examples}
            order={order}
            onOrderChange={chooseOrder}
            onOpen={openProject}
            onCreate={createProject}
            onCopyExample={copyExample}
            onFailure={failed}
            revision={revision}
            workingDirectory={source.kind === 'folder' ? source : undefined}
            onChooseWorkingDirectory={onChooseWorkingDirectory}
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

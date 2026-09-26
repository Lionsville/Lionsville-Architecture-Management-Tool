// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The menu bar's commands and the overflow's, on one bus, and the facts the
 * host is told back (ADR-0005, amended).
 *
 * The ones about where the projects are kept and about this person's
 * preferences are taken here; everything about the open project falls through
 * to the workspace, which subscribes to the same stream. The folder's history
 * and the working file are answered here only while no scope is open — the
 * workspace answers them itself while one is — and they are reached through
 * refs, so the subscription does not chase the identity of the hooks that
 * hold them.
 */
import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { manualUrl } from '../platform/manual'
import type { ThemeMode } from '../platform/theme'
import type { ScopeSnapshot } from '../projects/scope'
import { ROOT_SCOPE } from '../projects/scopePath'
import type { ScopePath } from '../projects/scopePath'
import type { HostControls } from '../ports/HostControls'
import { useHostCommands } from './useHostCommands'
import type { CommandBus, CommandStream } from './useHostCommands'
import type { ShellPreferences } from './useShellPreferences'

/** The home's snapshot and history, while the organisation screen is up. */
export type HomeHistoryDoors = { openDialog: () => void; openPage: () => void }
/** The working file from a home (ADR-0023), while the organisation screen is up. */
export type HomeFileDoors = {
  exportWorkingFile: () => void; open: () => void; openDocument: (name: string, bytes: Uint8Array) => void
}

export type ShellCommands = {
  bus: CommandBus
  homeHistory: RefObject<HomeHistoryDoors | undefined>
  homeFiles: RefObject<HomeFileDoors | undefined>
}

export function useShellCommands(deps: {
  commands: CommandStream | undefined
  onChooseFolder: (() => void) | undefined
  onOpenFolder: ((root: string) => void) | undefined
  prefs: ShellPreferences
  openPreferences: (open: true) => void
  openAgent: () => void
  hostControls: HostControls
}): ShellCommands {
  const { commands, onChooseFolder, onOpenFolder, prefs, openPreferences, openAgent, hostControls } = deps
  const bus = useHostCommands(commands)
  const homeHistory = useRef<HomeHistoryDoors | undefined>(undefined)
  /**
   * The desktop's `openDocument` — a double click on a `.lvarch` — lands here
   * too when the app is on a home, where it used to fall on the floor.
   */
  const homeFiles = useRef<HomeFileDoors | undefined>(undefined)
  useEffect(() => bus.on((command) => {
    if (command.type === 'chooseFolder') onChooseFolder?.()
    if (command.type === 'openFolder') onOpenFolder?.(command.root)
    if (command.type === 'theme') prefs.chooseTheme(command.mode)
    if (command.type === 'preferences') openPreferences(true)
    if (command.type === 'connectAgent') openAgent()
    if (command.type === 'snapshot') homeHistory.current?.openDialog()
    if (command.type === 'history') homeHistory.current?.openPage()
    if (command.type === 'export') homeFiles.current?.exportWorkingFile()
    if (command.type === 'open') homeFiles.current?.open()
    if (command.type === 'openDocument') homeFiles.current?.openDocument(command.name, command.bytes)
    // In the app's language, which is why it is answered here and not by the
    // menu bar: main does not know which one is on.
    if (command.type === 'manual') hostControls.openExternal(manualUrl(prefs.language))
  }), [bus, onChooseFolder, onOpenFolder, prefs, openPreferences, openAgent, hostControls])
  return { bus, homeHistory, homeFiles }
}

/**
 * The two facts the host is told besides unsaved work: whether a scope is
 * open, so the File and Edit items about one are enabled only while it is,
 * and which theme is on, so the View menu's radio can be right. Said on every
 * change and once at the start.
 */
export function useHostFacts(deps: {
  /** The scope that is open: said again when another opens, as it always was. */
  project: ScopeSnapshot | undefined
  onScopeOpen: ((open: boolean) => void) | undefined
  themeMode: ThemeMode
  onThemeMode: ((mode: ThemeMode) => void) | undefined
}): void {
  const { project, onScopeOpen, themeMode, onThemeMode } = deps
  useEffect(() => { onScopeOpen?.(project !== undefined) }, [onScopeOpen, project])
  useEffect(() => { onThemeMode?.(themeMode) }, [onThemeMode, themeMode])
}

/**
 * What the window is called, which is the two names the bar already shows.
 *
 * With nothing open it is the organisation on its own — or the product on its
 * own, before there is one — because the picker is not a scope and pretending
 * it is would name a window after nothing.
 */
export function useWindowTitle(deps: {
  onTitle: ((organisation: string, scope?: string) => void) | undefined
  project: ScopeSnapshot | undefined
  groupName: string
  organisationName: string
  home: ScopePath
  homeName: string | undefined
}): void {
  const { onTitle, project, groupName, organisationName, home, homeName } = deps
  useEffect(() => {
    if (project) onTitle?.(groupName, project.model.name)
    else if (home === ROOT_SCOPE) onTitle?.(organisationName)
    else onTitle?.(organisationName, homeName)
  }, [onTitle, project, groupName, organisationName, home, homeName])
}

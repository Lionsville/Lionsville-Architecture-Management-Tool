// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The doors the host comes in by: the menu's commands, and the page a scope
 * was opened for.
 */
import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { EditorHandle } from '../editor'
import type { HostCommand } from '../platform/hostCommands'
import type { HostControls } from '../ports/HostControls'
import type { InitialPage } from './App'
import type { ProjectHistoryState } from './history/useProjectHistory'
import type { FilePicker } from './useFilePicker'
import type { Gestures } from './useGestures'
import type { ModelSession } from './useModelSession'
import type { ProjectFiles } from './useProjectFiles'
import type { Sheets } from './useSheet'
import type { WorkspacePages } from './useWorkspacePages'

/**
 * What the File menu asks for, what the web's overflow asks for, and what
 * the OS opens us with.
 *
 * The menu is the only way to reach most of these now (ADR-0005), so this is
 * not a second route but the route. It is deliberately not a switch over
 * every command — the ones this workspace does not own fall through to
 * whoever does. A history item on a machine that cannot keep one is
 * answered by the hook with a word about why (`useProjectHistory`).
 */
export function useWorkspaceCommands(deps: {
  commands: ((listener: (command: HostCommand) => void) => () => void) | undefined
  forceSave: () => Promise<void>
  files: ProjectFiles
  documentPicker: FilePicker
  snapshots: ProjectHistoryState
  session: ModelSession
  hostControls: HostControls
  editorHandle: RefObject<EditorHandle | undefined>
}): void {
  const { commands, forceSave, files, documentPicker, snapshots, session, hostControls, editorHandle } = deps
  useEffect(() => commands?.((command) => {
    switch (command.type) {
      // A save answers its own failure — the bar's status and the refusal's
      // notice — so the menu's press has nothing left to wait for.
      case 'save': void forceSave(); break
      case 'export': files.saveWorkingFile(); break
      case 'open': documentPicker.open(); break
      case 'openDocument': files.openDocument(command.name, command.bytes); break
      case 'snapshot': snapshots.openDialog(); break
      case 'history': snapshots.openPage(); break
      // The Edit menu's four (ADR-0005, amended): the app's one undo stack,
      // and the canvas's selection through the editor's handle. A key the
      // canvas handles never reaches the menu, so these fire from the menu
      // item and from the key with nothing focused, and never twice.
      // A text field that has focus keeps its own undo, as the role gave it.
      case 'undo': if (!hostControls.editInField('undo')) session.undo(); break
      case 'redo': if (!hostControls.editInField('redo')) session.redo(); break
      case 'deleteSelection': editorHandle.current?.deleteSelection(); break
      case 'selectAll': editorHandle.current?.selectAll(); break
      case 'shortcuts': editorHandle.current?.showShortcuts(); break
    }
  }), [commands, forceSave, files, documentPicker, snapshots, session, hostControls, editorHandle])
}

/**
 * The page this was opened for, shown once.
 *
 * An effect and not a seeded `useState`, because two of the three are owned
 * by hooks of their own and one of them has to make a diagram first. Keyed on
 * nothing: the workspace remounts on a project switch, so "once" is once per
 * project, which is what was asked for.
 *
 * A view's page names its view by id by now (`useShellNavigation`'s
 * `enter`), and opening it writes nothing; `make` is the one page that makes
 * a view, and only the person's own *Make…* asks for it.
 */
export function useInitialPage(deps: {
  initialPage: InitialPage | undefined
  pages: WorkspacePages
  createSheet: Sheets['create']
  showElement: (id: string) => void
  openDocumentation: (elementId?: string, diagramId?: string) => void
  gestures: Gestures
}): void {
  const { initialPage, pages, createSheet, showElement, openDocumentation, gestures } = deps
  const openedFor = useRef(false)
  // Read through a ref: what each page opens with is the pages' own, and a
  // page is shown once whatever they become.
  const latest = useRef({ pages, createSheet, showElement, openDocumentation, gestures })
  latest.current = { pages, createSheet, showElement, openDocumentation, gestures }
  useEffect(() => {
    if (!initialPage || openedFor.current) return
    openedFor.current = true
    showInitialPage(initialPage, latest.current)
  }, [initialPage])
}

/** One page, shown the way its door shows it. */
function showInitialPage(page: InitialPage, by: {
  pages: WorkspacePages
  createSheet: Sheets['create']
  showElement: (id: string) => void
  openDocumentation: (elementId?: string, diagramId?: string) => void
  gestures: Gestures
}): void {
  const { pages } = by
  switch (page.page) {
    case 'decisions': pages.openDecisions(page.id); break
    case 'observations': pages.openObservations(page.id, page.tab); break
    case 'roadmap': pages.openRoadmap(); break
    case 'board': case 'sheet': case 'map': case 'technology':
      if (page.id === undefined) break
      if (page.page === 'technology') pages.openTechnology(page.id)
      else pages.openView(page.id)
      if (page.select !== undefined) pages.selectOn(page.id, page.select)
      break
    case 'make':
      if (page.kind === 'sheet') by.createSheet()
      else if (page.kind === 'map') pages.createMap()
      else pages.createTechnology()
      break
    // Over the roadmap, so closing the plan lands on the roadmap and closing
    // that leaves a scope that draws nothing, rather than on an empty board.
    case 'plan': pages.openRoadmap(); pages.plans.openPlan(page.id); break
    // A row of the register, opened where it is answered for.
    case 'element': by.showElement(page.id); break
    // A report, reached by an agent or a link (ADR-0019): derived, so opening it is the whole of it.
    case 'platform': pages.openPlatformReport(page.id); break
    case 'service': pages.openServiceReport(page.id); break
    case 'document': by.openDocumentation(page.id); break
    case 'documentation': by.openDocumentation(); break
    // Not a page: the register's *Link…*, which can only be done by the
    // session that holds this scope (ADR-0012 §10).
    case 'link': by.gestures.ask({ gesture: 'link', id: page.id, to: page.to }); break
  }
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One project, open: the toolbar, the editor, and the dialogs around them.
 *
 * Mounted with a concrete project and remounted when you switch — which is not a
 * detail but the mechanism. A workspace's session holds the undo stack, the
 * id aliases and the pending batches, and none of those mean anything in a
 * different project. Remounting is what guarantees they cannot leak across.
 *
 * Everything it needs arrives as a prop, one object per concern
 * (`workspaceProps.ts`), each typed as the narrowest shape that will do:
 * `source.store` is "something that can save", not a `ProjectStore`. Its state
 * is the hooks beside it, one per concern (`workspaceParts.ts`), and what it
 * draws is the bar, the editor, the pages beside it and the dialogs, each a
 * component of its own over those parts.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useShownDays } from '../editor'
import { useProjectHistory } from './history/useProjectHistory'
import { HistoryDialogs, useWorkspaceDialogs, WorkspaceDialogs } from './WorkspaceDialogs'
import { usePageChrome, WorkspaceBar } from './WorkspaceBar'
import { WorkspaceEditor } from './WorkspaceEditor'
import { WorkspacePages } from './WorkspacePages'
import { useAnalysisActions } from './useAnalysisActions'
import { useDiagramActions } from './useDiagramActions'
import { useDocumentPictures } from './useDocumentPictures'
import { useGestures } from './useGestures'
import { useLibrary } from './useLibrary'
import { useMap } from './useMap'
import { useModelSession } from './useModelSession'
import { useRendererView } from './useRendererView'
import { useSheet } from './useSheet'
import { useShowElement } from './useShowElement'
import { useTechnologyLandscape } from './useTechnologyLandscape'
import { useTreeReadings } from './useTreeReadings'
import { useWorkspaceAgentView } from './useWorkspaceAgentView'
import { useInitialPage, useWorkspaceCommands } from './useWorkspaceCommands'
import { useScopeSessionSeam, useWorkspaceDocument } from './useWorkspaceDocument'
import { useWorkspaceFiles } from './useWorkspaceFiles'
import { useWorkspaceOwnership } from './useWorkspaceOwnership'
import { useWorkspacePages } from './useWorkspacePages'
import { useWorkspaceRequests } from './useWorkspaceRequests'
import type { WorkspaceParts } from './workspaceParts'
import type { ProjectWorkspaceProps } from './workspaceProps'

export function ProjectWorkspace(props: ProjectWorkspaceProps) {
  const { parts, toolbarRef } = useWorkspaceParts(props)
  return (
    <>
      <WorkspaceBar parts={parts} toolbarRef={toolbarRef} />
      {parts.pickers.document.input}
      {parts.pickers.logo.input}
      <WorkspaceEditor parts={parts} />
      <HistoryDialogs parts={parts} />
      <WorkspacePages parts={parts} />
      <WorkspaceDialogs parts={parts} />
    </>
  )
}

function localToday(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** A tree nobody said changes: a test, and a shell with nothing to read again. */
const NOTHING_TO_READ = (): void => {}

/**
 * Every piece of the workspace's state, one hook per concern, composed in the
 * order they read each other: the session, what edits through it and what
 * saves it first; the tree's readings and who answers for a record next; the
 * snapshots, the menu and the pages beside the canvas, and the doors the agent
 * and the host come in by last.
 */
function useWorkspaceParts(props: ProjectWorkspaceProps) {
  const base = useSessionParts(props)
  const tree = useTreeParts(props, base)
  const screen = useScreenParts(props, base, tree)
  const { indexRef: _indexRef, safeguardRef: _safeguardRef, maps: _maps, ...fromBase } = base
  const { toolbarRef, ...fromScreen } = screen
  const parts: WorkspaceParts = { props, ...fromBase, ...tree, ...fromScreen }
  return { parts, toolbarRef }
}

/** The session over this scope, what edits through it, and what saves it. */
function useSessionParts(props: ProjectWorkspaceProps) {
  const { project, source, tree, navigation, host, shell } = props
  const { onChanged: onTreeChanged = NOTHING_TO_READ } = tree
  const { onOpenScope } = navigation
  const { s, notify, makeId } = shell
  const unreadable = project.unreadable ?? []
  const readOnly = (source.readOnly ?? false) || unreadable.length > 0
  /**
   * Every ancestor's records as one list — what the search and the agent read.
   *
   * Flat, because neither of them asks WHICH scope above: the search says a
   * record is from a scope above this one, and the agent answers for the
   * session (its `scope` on a record is step 13's). The page beside them keeps
   * the sections, because a person needs to know where to go to edit one.
   */
  const ancestorRecords = useMemo(
    () => tree.ancestorDecisions.flatMap((one) => one.decisions),
    [tree.ancestorDecisions],
  )
  // The index by reference, for the callbacks that must not be rebuilt when it
  // is: the id policy is minted once for the life of the session.
  const indexRef = useRef(tree.index)
  indexRef.current = tree.index
  const session = useModelSession({
    initialProject: project,
    notify,
    s,
    // Read per ask, not captured: the index is rebuilt under a live session
    // whenever the folder changes (ADR-0012 §2).
    takenInTree: useCallback(() => indexRef.current.takenIds(), []),
  })
  const diagrams = useDiagramActions({ session, notify, s, makeId })
  const { files, pickers, safeguardRef } = useWorkspaceFiles({
    session, seams: props.files, workingSet: tree.workingSet, onAdoptScopes: tree.onAdoptScopes, onTreeChanged, notify, s,
  })
  const requests = useWorkspaceRequests({ session, scope: project.path, indexRef, onOpenScope, notify, s })
  /**
   * Where a link to an element lands: a board here, a choice, its page, or
   * the scope that answers for it. The sheet, the register and a row of the
   * organisation's own list all end here.
   */
  const showElement = useShowElement({
    session, scope: project.path, notify, s,
    focus: requests.focusElement,
    toDocumentation: requests.openDocumentation,
    masterOf: useCallback((id: string) => indexRef.current.lookup(id)?.master, []),
    ...(onOpenScope ? { onOpenScope } : {}),
  })
  const sheets = useSheet({
    session, makeId, s, showElement: showElement.show,
  })
  // The map's inspector edits a capability with the sheet's own actions: a
  // rename from either page is the same command.
  const maps = useMap({ session, makeId, s })
  // The technology landscape (ADR-0015): read only, so it needs nobody's actions either.
  const landscapes = useTechnologyLandscape({ session, makeId, s })
  const pictures = useDocumentPictures(session)
  const document = useWorkspaceDocument({
    session, projects: source.store, watch: source.watch, sourceStatus: source.status, onSourceWork: source.onWork,
    onUnsavedWork: host.onUnsavedWork, onStorageResult: source.onResult, onTreeChanged, notify, s,
  })
  const alsoHere = useScopeSessionSeam(project, session, source.onSession)
  const renderer = useRendererView(session, requests.focusElement)
  return {
    readOnly, unreadable, ancestorRecords, indexRef, session, diagrams, files, pickers, safeguardRef, requests,
    showElement, sheets, maps, landscapes, pictures, document, alsoHere, renderer,
  }
}

/** What the rest of the organisation says about this scope, and who answers for each record. */
function useTreeParts(props: ProjectWorkspaceProps, base: ReturnType<typeof useSessionParts>) {
  const { project, source, tree, navigation, host, shell } = props
  const { index, models, onChanged: onTreeChanged = NOTHING_TO_READ } = tree
  const { onOpenScope } = navigation
  const { s, notify } = shell
  const { session, requests } = base
  const readings = useTreeReadings({ index, scope: project.path, elements: session.model.elements, groupName: tree.groupName, s })
  /**
   * The four gestures that cross scopes (ADR-0012 §10).
   *
   * Here rather than in `App` because a gesture ends in a `Command` at THIS
   * session: the other scope is written through the store, and then this
   * scope's record becomes a stand-in as one undo step with a barrier on it.
   */
  const gestures = useGestures({
    scope: project.path,
    scopes: source.store,
    ...(models ? { models } : {}),
    index,
    session,
    onTreeChanged,
    ...(onOpenScope ? { onOpenScope } : {}),
    scopeLabel: readings.scopeLabel,
    notify,
    onFailure: useCallback((where: string, cause: unknown) => {
      host.diagnostics.report({ level: 'error', where, message: 'rejected', cause })
    }, [host.diagnostics]),
    s,
    published: source.publishesSteps ?? false,
  })
  /**
   * The register as a library (ADR-0012 §2): an application the organisation
   * already has, drawn on this board without a claim on it. After the label,
   * because the toast names the scope that answers for it.
   */
  const library = useLibrary({
    session, scope: project.path, index, notify, s, focus: requests.focusElement, scopeLabel: readings.scopeLabel,
  })
  // The gestures are read off the hook so the editor's ownership seam is not
  // rebuilt every time a dialog opens: both are `useCallback`s over the tree
  // and the session, and neither moves when the choice does.
  const ownership = useWorkspaceOwnership({
    session, scope: project.path, index, projects: source.store, onOpenScope,
    rowsThrough: readings.rowsThrough, scopeLabel: readings.scopeLabel,
    gestureOffers: gestures.offers, gestureChoose: gestures.choose, addExisting: library.open, s,
  })
  return { readings, gestures, library, ownership }
}

/** The snapshots, the menu, the pages beside the canvas and the doors in. */
function useScreenParts(
  props: ProjectWorkspaceProps,
  base: ReturnType<typeof useSessionParts>,
  tree: ReturnType<typeof useTreeParts>,
) {
  const { project, source, navigation, host, shell } = props
  const { s, notify, makeId, today = localToday } = shell
  const { session, files, pickers, requests, showElement, renderer } = base
  const forceSave = base.document.document.forceSave
  const snapshots = useProjectHistory({
    history: props.snapshots.history,
    index: props.tree.index,
    project: session.snapshot,
    steps: session.history,
    save: forceSave,
    indexed: session.indexed,
    dispatch: session.dispatch,
    notify,
    s,
    onTaken: props.snapshots.onTaken,
  })
  const { safeguardRef } = base
  useEffect(() => { safeguardRef.current = snapshots.safeguard }, [safeguardRef, snapshots.safeguard])
  useWorkspaceCommands({
    commands: host.commands, forceSave, files, documentPicker: pickers.document, snapshots, session,
    hostControls: host.controls, editorHandle: renderer.editorHandle,
  })
  const { toolbarRef, pageChrome } = usePageChrome(host.windowChrome)
  // The clock, read once per render of the workspace rather than per component:
  // a roadmap re-deriving because a millisecond passed is a landscape re-laid.
  const todayDay = useMemo(() => today(), [today])
  // The day each board is being looked at, which is nobody's write
  // (ADR-0027): the bar's date control and the roadmap's scrubber move this,
  // and only *Save* on the bar puts a day on the board.
  const viewing = useShownDays(useCallback(
    (id: string) => session.current().diagrams.find((d) => d.id === id)?.asOf,
    [session],
  ))
  const pages = useWorkspacePages({
    session, scope: project.path, makeId, s, viewing, focusElement: requests.focusElement,
    maps: base.maps, landscapes: base.landscapes, onGoHome: navigation.onGoHome,
  })
  useWorkspaceAgentView({
    session, scope: project.path, indexRef: base.indexRef, rowsElsewhereRef: tree.readings.rowsElsewhereRef,
    scopes: props.tree.scopes, projects: source.store, ancestorRecords: base.ancestorRecords, readOnly: base.readOnly,
    documentStatus: base.document.document.state.status, renderer: renderer.renderer, save: forceSave, pages,
    showElement: showElement.show, openDocumentation: requests.openDocumentation, makeId, today, s,
    onAgentSession: props.agent.onSession,
  })
  useInitialPage({
    initialPage: navigation.initialPage, pages, createSheet: base.sheets.create, showElement: showElement.show,
    openDocumentation: requests.openDocumentation, gestures: tree.gestures,
  })
  const dialogs = useWorkspaceDialogs({
    session, settings: props.settings, diagnostics: host.diagnostics, notify, s,
    focusElement: requests.focusElement, openDocumentation: requests.openDocumentation, openDecisions: pages.openDecisions,
  })
  const analysis = useAnalysisActions({ session, makeId, today, s })
  return { snapshots, toolbarRef, pageChrome, todayDay, today, viewing, pages, dialogs, analysis }
}

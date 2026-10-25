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
import { ScopeReferences } from './references/ScopeReferences'
import { ScopeBlockFacts } from './blocks/ScopeBlockFacts'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import Box from '@mui/material/Box'
import type { ReactNode } from 'react'
import { dayShown, useShownDays } from '../editor'
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
import { showOn, useWorkspaceAgentView } from './useWorkspaceAgentView'
import { useInitialPage, useWorkspaceCommands } from './useWorkspaceCommands'
import { useScopeSessionSeam, useScopeWriter, useWorkspaceDocument } from './useWorkspaceDocument'
import { useWorkspaceFiles } from './useWorkspaceFiles'
import { useChangeAcross } from './useChangeAcross'
import { useChangeBelow } from './useChangeBelow'
import { useWorkspaceOwnership } from './useWorkspaceOwnership'
import { useLandPeopleMoves } from './units/landPeopleMoves'
import { DELETE_BARRIER } from './units/unitDeletionSlot'
import type { LandSteps } from '../agent/handle'
import { useWriteIn } from './units/writeIn'
import { checkMarking, CheckMarkingContext } from './checkMarking'
import { useWorkspacePages } from './useWorkspacePages'
import { useWorkspaceRequests } from './useWorkspaceRequests'
import type { WorkspaceParts } from './workspaceParts'
import { PicturesProvider } from '../documentation/ui/Pictures'
import { ViewEmbedsProvider } from '../documentation/ui/ViewEmbed'
import { useLiveViews } from './LiveViews'
import { CommentsProvider } from '../comments/ui/CommentsContext'
import { RecordChangesProvider } from '../comments/ui/RecordChanges'
import { useRecordChangesAccess } from './history/useRecordChangesAccess'
import { ScopePrinciples } from './principles/PrinciplesPages'
import type { CommentsAccess } from '../comments/ui/CommentsContext'
import type { SourceComments } from '../ports/ProviderParts'
import type { ProjectWorkspaceProps } from './workspaceProps'
import { flattenScopes } from '../projects/scope'
import { onlyPeopleIn } from '../model/managing'
import type { Command } from '../model/commands'
import type { Model } from '../model/normalised'

export function ProjectWorkspace(props: ProjectWorkspaceProps) {
  const { parts, toolbarRef } = useWorkspaceParts(props)
  const { diagnostics } = props.host
  const pictureFailed = useCallback((cause: unknown) => {
    diagnostics.report({ level: 'warn', where: 'pictures', message: 'a picture was not read', cause })
  }, [diagnostics])
  // Every page and panel here that shows a document shows this scope's
  // pictures: laid out from the library's entries at once, their bytes asked
  // for where the scope is kept when they come into view (ADR-0031 §3).
  return (
    <PicturesProvider
      source={props.source.repositories.images}
      scope={props.project.id ?? ''}
      library={parts.session.imageLibrary}
      onFailure={pictureFailed}
    >
      <ScopeViews parts={parts}>
        <CheckMarkingContext.Provider value={parts.marking}>
          <WorkspaceBar parts={parts} toolbarRef={toolbarRef} />
          {parts.pickers.document.input}
          {parts.pickers.logo.input}
          {/* Inert under a page: what a page covers takes no focus and says nothing to a reader, rather than the whole board staying in the tree under every page. The pages are portals, so this reaches the board alone. */}
          <Box inert={parts.pages.page() !== undefined || parts.requests.documentationShown !== undefined} sx={{ display: 'contents' }}>
            <WorkspaceEditor parts={parts} />
          </Box>
          <HistoryDialogs parts={parts} />
          <WorkspacePages parts={parts} />
          <WorkspaceDialogs parts={parts} />
        </CheckMarkingContext.Provider>
      </ScopeViews>
    </PicturesProvider>
  )
}

/**
 * The views a document in this scope may show (`view:<id>`), and the door a
 * shape's button opens: the same destination `app.open` takes for an element.
 */
function ScopeViews({ parts, children }: { parts: WorkspaceParts; children: ReactNode }) {
  const { session, pages, showElement, requests, props } = parts
  const scope = props.project.id ?? ''
  const images = props.source.repositories.images
  const latest = useRef({ pages, showElement, requests, path: props.project.path })
  latest.current = { pages, showElement, requests, path: props.project.path }
  const bytesAt = useCallback(
    (address: string) => images.bytesAt(scope, address),
    [images, scope],
  )
  const openElement = useCallback((id: string) => {
    const now = latest.current
    showOn(now.pages, now.showElement.show, now.requests.openDocumentation, now.requests.leaveDocumentation)({
      scope: now.path, page: 'element', id,
    })
  }, [])
  const nameOf = useCallback(
    (id: string) => session.model.elements.find((element) => element.id === id)?.name ?? id,
    [session.model.elements],
  )
  // The view itself, from the caption under it in a document: the page the document was on steps out of the way.
  const openView = useCallback((id: string) => {
    const now = latest.current
    showOn(now.pages, now.showElement.show, now.requests.openDocumentation, now.requests.leaveDocumentation)({ scope: now.path, page: 'board', id })
    now.pages.closePages()
  }, [])
  const live = useLiveViews(parts)
  return (
    <ViewEmbedsProvider diagrams={session.model.diagrams} bytesAt={bytesAt} openElement={openElement} nameOf={nameOf} live={live} openView={openView}>
      <ScopeComments parts={parts}><ScopeChanges parts={parts}><ScopePrinciples parts={parts}><ScopeBlockFacts parts={parts}><ScopeReferences parts={parts}>{children}</ScopeReferences></ScopeBlockFacts></ScopePrinciples></ScopeChanges></ScopeComments>
    </ViewEmbedsProvider>
  )
}

/**
 * The open scope's comments for every thread under the workspace (ADR-0037):
 * read from the session, each step dispatched to it. A person comments where
 * the scope may be written, or where the source lets a reader comment
 * (`ProviderParts.comments`), and removes anybody's comment where they may
 * write it unless the source says otherwise — on the desktop, whoever keeps
 * the work is its administrator (ADR-0036 §10).
 */
function ScopeComments({ parts, children }: { parts: WorkspaceParts; children: ReactNode }) {
  const { session, readOnly, props } = parts
  const { makeId } = props.shell
  const { dispatch } = session
  const comments = session.model.comments
  const path = props.project.path
  const said = props.source.comments
  const mayComment = !readOnly || (parts.unreadable.length === 0 && said?.mayComment?.(path) === true)
  const mayModerate = mayComment && (said?.mayModerate?.(path) ?? !readOnly)
  const pointed = parts.requests.pointedComment
  const value = useMemo<CommentsAccess>(() => ({
    scope: path,
    comments: comments ?? [],
    dispatch: (command) => dispatch(command) !== undefined,
    mayComment,
    mayModerate,
    makeId: () => makeId('cm'),
    now: () => new Date().toISOString(),
    ...(pointed ? { pointed } : {}),
  }), [path, comments, dispatch, mayComment, mayModerate, makeId, pointed])
  return <CommentsProvider value={value}>{children}</CommentsProvider>
}

/**
 * What every reader's *Changes* reads (ADR-0038, amended §11): the source's
 * history, by record, of the open scope or the one a reader names.
 */
function ScopeChanges({ parts, children }: { parts: WorkspaceParts; children: ReactNode }) {
  const { props } = parts
  const path = useRef(props.project.path)
  path.current = props.project.path
  const here = useCallback(() => path.current, [])
  const value = useRecordChangesAccess({ history: props.snapshots.history, scopes: props.source.repositories.scopes, here })
  return <RecordChangesProvider value={value}>{children}</RecordChangesProvider>
}

function localToday(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Whether a step is comments and nothing else (ADR-0037 §5): what a person who may only read may still send, where the source says. */
function onlyComments(command: Command): boolean {
  return command.type === 'transaction' ? command.commands.every(onlyComments) : command.type.startsWith('comment.')
}

/** The comment steps the session lets through a scope this person may only read, as the source says; read per ask. */
function useCommentsThrough(said: SourceComments | undefined, path: string, whole: boolean): (command: Command) => boolean {
  const ref = useRef({ said, path, whole })
  ref.current = { said, path, whole }
  return useCallback((command: Command) => {
    const now = ref.current
    return now.whole && now.said?.mayComment?.(now.path) === true && onlyComments(command)
  }, [])
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
   * A scope that could not be read whole, where the source may be written: it
   * takes no change, but it may be put back whole (`ScopeState.unreadable`) —
   * from the history, or from a working file brought in — and is read again
   * once it has been. Not one a later version wrote, which only a version
   * that reads it may change (`ScopeState.later`).
   */
  const recovering = unreadable.length > 0 && !project.later && !(source.readOnly ?? false)
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
  // Whose people this person may change by a managing role (ADR-0036 §12), read per ask.
  const peopleRef = useRef(shell.people)
  peopleRef.current = shell.people
  const commentsThrough = useCommentsThrough(source.comments, project.path, unreadable.length === 0)
  const session = useModelSession({
    initialProject: project,
    notify,
    s,
    // The open source's provider's action on a problem, on the notice of a refusal.
    problem: shell.problem,
    // Read per ask, not captured: the index is rebuilt under a live session
    // whenever the folder changes (ADR-0012 §2).
    takenInTree: useCallback(() => indexRef.current.takenIds(), []),
    // The one place it is decided: every change from here on is refused at
    // the session, and what is handed `readOnly` below only hides what would be.
    readOnly,
    // But for the people of a unit the person manages, where the source grants
    // that right: those steps go through, and the source's door decides them.
    letThrough: useCallback((command: Command, model: Model) => {
      const manages = peopleRef.current?.manages
      // And comments, where the source lets a person who only reads comment (ADR-0037 §5).
      return (manages !== undefined && onlyPeopleIn(model, [command], manages, manages.managing)) || commentsThrough(command)
    }, [commentsThrough]),
    // What is done here is written as the steps it was, where nothing else
    // carries them (`Shell.publishesSteps`).
    journaling: !readOnly && !(source.publishesSteps ?? false),
  })
  const diagrams = useDiagramActions({ session, notify, s, makeId })
  const writer = useScopeWriter(source.repositories.scopes, source.repositories.images, project)
  const { files, pickers, safeguardRef } = useWorkspaceFiles({
    session, putPicture: writer.put, seams: props.files, carryOut: tree.carryOut, onAdoptScopes: tree.onAdoptScopes, readScope: tree.readScope, onTreeChanged,
    ...(recovering && navigation.onReload ? { onPutBack: navigation.onReload } : {}),
    onGoHome: navigation.onGoHome,
    notify, s,
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
    session, writer, watch: source.watch, sourceStatus: source.status, onSourceWork: source.onWork,
    onUnsavedWork: host.onUnsavedWork, onKeptResult: source.onResult, onTreeChanged,
  })
  const alsoHere = useScopeSessionSeam(project, session, source.onSession, document.document.flush)
  const renderer = useRendererView(session, requests.focusElement)
  return {
    readOnly, unreadable, recovering, ancestorRecords, indexRef, session, writer, diagrams, files, pickers, safeguardRef, requests,
    showElement, sheets, maps, landscapes, pictures, document, alsoHere, renderer,
  }
}

/** Every scope as writable as this one, where the source says nothing per scope. Made once per answer, so the hook over it is stable. */
const WRITABLE = () => true
const READ_ONLY = () => false
const writableLikeHere = (readOnly: boolean) => (readOnly ? READ_ONLY : WRITABLE)

/** What the rest of the organisation says about this scope, and who answers for each record. */
function useTreeParts(props: ProjectWorkspaceProps, base: ReturnType<typeof useSessionParts>) {
  const { project, source, tree, navigation, host, shell } = props
  const { index, models, onChanged: onTreeChanged = NOTHING_TO_READ } = tree
  const { onOpenScope } = navigation
  const { s, notify } = shell
  const { session, requests } = base
  const readings = useTreeReadings({ index, scope: project.path, elements: session.model.elements, groupName: tree.groupName, scopes: tree.scopes, s })
  /**
   * The four gestures that cross scopes (ADR-0012 §10).
   *
   * Here rather than in `App` because a gesture ends in a `Command` at THIS
   * session: the other scope is written through the store, and then this
   * scope's record becomes a stand-in as one undo step with a barrier on it.
   */
  const gestures = useGestures({
    scope: project.path,
    scopes: source.repositories.scopes,
    save: base.document.document.flush,
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
  // The day each board is being looked at, which is nobody's write
  // (ADR-0027): the bar's date control and the roadmap's scrubber move this,
  // and only *Save* on the bar puts a day on the board. The organisation
  // beside the board — a unit's section — is read on the same day (ADR-0036 §6).
  const viewing = useShownDays(useCallback(
    (id: string) => session.current().diagrams.find((d) => d.id === id)?.asOf,
    [session],
  ))
  const today = (shell.today ?? localToday)()
  const day = dayShown(session.model.diagrams.find((d) => d.id === session.activeDiagramId), viewing.days, today)
  /** A link made from a unit's inspector and kept in another scope: that scope's step, under its rights (ADR-0036, amended). */
  const writeIn = useWriteIn({
    scopes: source.repositories.scopes, writable: source.writable ?? writableLikeHere(source.readOnly ?? false), mayChange: session.mayChange, onTreeChanged,
  })
  const { onGoHome } = navigation
  const units = useMemo(() => ({
    people: shell.people, today, day, makeId: shell.makeId, scopePaths: flattenScopes(tree.scopes).map((one) => one.path), writeIn,
    openHome: onGoHome,
  }), [shell.people, today, day, shell.makeId, tree.scopes, writeIn, onGoHome])
  /** A unit deleted here, with what it takes in other scopes, landed as one change (3.6.2): structure, so no manager's right. */
  const landStructure = useLandPeopleMoves({
    scope: project.path, scopes: source.repositories.scopes, session, mayChange: session.mayChange,
    writable: source.writable ?? writableLikeHere(source.readOnly ?? false), save: base.document.document.flush,
    published: source.publishesSteps ?? false, onTreeChanged,
  })
  const deleting = useMemo(() => ({ land: landStructure, onRefused: (text: string) => notify(text, 'error') }), [landStructure, notify])
  /** The same for an agent's element.remove on a unit, its steps marked its own. */
  const agentLandStructure = useLandPeopleMoves({
    scope: project.path, scopes: source.repositories.scopes, session, mayChange: session.mayChange,
    writable: source.writable ?? writableLikeHere(source.readOnly ?? false), save: base.document.document.flush,
    published: source.publishesSteps ?? false, onTreeChanged, origin: 'agent',
  })
  const agentLandSteps = useCallback<LandSteps>((steps) => agentLandStructure(steps, DELETE_BARRIER), [agentLandStructure])
  const ownership = useWorkspaceOwnership({
    session, scope: project.path, index, indexAnswered: tree.indexAnswered, scopes: source.repositories.scopes, onOpenScope,
    rowsThrough: readings.rowsThrough, scopeLabel: readings.scopeLabel,
    gestureOffers: gestures.offers, gestureChoose: gestures.choose, addExisting: library.open, units, deleting, s,
  })
  /** A change to a scope below made from the observations page, as that scope's step (ADR-0032 §2). */
  const changeBelow = useChangeBelow({ scopes: source.repositories.scopes, mayChange: session.mayChange, onTreeChanged })
  /** A change to several scopes as one — a merge across the tree (ADR-0035 §5): the others in one apply, this one through the session. */
  const changeAcross = useChangeAcross({
    scope: project.path, scopes: source.repositories.scopes, session, mayChange: session.mayChange,
    writable: source.writable ?? writableLikeHere(source.readOnly ?? false), save: base.document.document.flush,
    published: source.publishesSteps ?? false, onTreeChanged,
  })
  /** The same for an agent in this window, its steps marked its own: how its merge across the tree lands (ADR-0035 §6). */
  const agentChangeAcross = useChangeAcross({
    scope: project.path, scopes: source.repositories.scopes, session, mayChange: session.mayChange,
    writable: source.writable ?? writableLikeHere(source.readOnly ?? false), save: base.document.document.flush,
    published: source.publishesSteps ?? false, origin: 'agent', onTreeChanged,
  })
  /** The people a reorganisation moves, written as one step in every scope they are kept in (ADR-0036 §6). */
  const landMoves = useLandPeopleMoves({
    scope: project.path, scopes: source.repositories.scopes, session, mayChange: session.mayChange,
    writable: source.writable ?? writableLikeHere(source.readOnly ?? false), save: base.document.document.flush,
    published: source.publishesSteps ?? false, onTreeChanged,
    // A manager's part in scopes only read to them (ADR-0036 §12).
    ...(shell.people?.manages ? { manages: shell.people.manages } : {}),
  })
  /** A finding marked as intended from any list here (ADR-0036, amended): this scope's through the session, another's as its step. */
  const marking = useMemo(() => checkMarking({
    index, writeIn, today, onRefused: (key) => notify(s(key), 'error'),
    open: { scope: project.path, model: session.model, dispatch: session.dispatch, writable: !base.readOnly },
    writable: source.writable ?? writableLikeHere(source.readOnly ?? false),
  }), [index, writeIn, today, notify, s, project.path, session.model, session.dispatch, base.readOnly, source.writable, source.readOnly])
  // Where a unit made on the chart is filed in another scope (3.6.2): written there, under its rights.
  const unitWrites = useMemo(() => ({ writeIn, writable: source.writable ?? writableLikeHere(source.readOnly ?? false) }), [writeIn, source.writable, source.readOnly])
  return { readings, gestures, library, ownership, changeBelow, changeAcross, agentChangeAcross, viewing, landMoves, agentLandSteps, marking, unitWrites }
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
    kept: props.snapshots.kept,
    scopes: source.repositories.scopes,
    index: props.tree.index,
    project: session.snapshot,
    steps: session.history,
    // `flush` and not `forceSave`: a save that was refused rejects, and an
    // entry of a scope that does not hold what is on screen is never recorded.
    save: base.document.document.flush,
    indexed: session.indexed,
    dispatch: session.dispatch,
    ...(base.recovering && project.id !== undefined ? {
      recover: { scopes: source.repositories.scopes, scope: project.id, done: navigation.onReload ?? NOTHING_TO_READ },
    } : {}),
    notify,
    s,
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
  const { viewing } = tree
  const pages = useWorkspacePages({
    session, scope: project.path, makeId, s, viewing, focusElement: requests.focusElement,
    maps: base.maps, landscapes: base.landscapes, onGoHome: navigation.onGoHome, documentationShown: requests.documentationShown,
  })
  useWorkspaceAgentView({
    session, scope: project.path, indexRef: base.indexRef, rowsElsewhereRef: tree.readings.rowsElsewhereRef,
    scopes: props.tree.scopes, reader: source.repositories.scopes, ancestorRecords: base.ancestorRecords, readOnly: base.readOnly,
    documentStatus: base.document.document.state.status, renderer: renderer.renderer,
    save: base.document.document.flush, putPicture: base.writer.put, pages,
    showElement: showElement.show, openDocumentation: requests.openDocumentation,
    leaveDocumentation: requests.leaveDocumentation, makeId, today, s, onAgentSession: props.agent.onSession,
    changeAcross: tree.agentChangeAcross, landSteps: tree.agentLandSteps, writeIn: tree.unitWrites.writeIn, people: shell.people,
    ...(source.comments ? { comments: source.comments } : {}),
    ...(props.snapshots.history ? { history: props.snapshots.history } : {}),
  })
  useInitialPage({
    initialPage: navigation.initialPage, pages, createSheet: base.sheets.create, showElement: showElement.show,
    openDocumentation: requests.openDocumentation, gestures: tree.gestures, model: session.current,
  })
  const show = useMemo(
    () => showOn(pages, showElement.show, requests.openDocumentation, requests.leaveDocumentation),
    [pages, showElement.show, requests.openDocumentation, requests.leaveDocumentation],
  )
  const dialogs = useWorkspaceDialogs({
    session, settings: props.settings, diagnostics: host.diagnostics, notify, s, save: base.document.document.flush,
    scope: project.path, show, ...(navigation.onOpenScope ? { onOpenScope: navigation.onOpenScope } : {}), pointComment: requests.pointComment,
  })
  const analysis = useAnalysisActions({ session, makeId, today, s })
  return { snapshots, toolbarRef, pageChrome, todayDay, today, pages, show, dialogs, analysis }
}

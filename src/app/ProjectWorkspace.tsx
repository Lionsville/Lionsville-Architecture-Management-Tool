/**
 * One project, open: the toolbar, the editor, and the dialogs around them.
 *
 * Mounted with a concrete project and remounted when you switch — which is not a
 * detail but the mechanism. A workspace's session holds the undo stack, the
 * id aliases and the pending batches, and none of those mean anything in a
 * different project. Remounting is what guarantees they cannot leak across.
 *
 * Everything it needs arrives as a prop, typed as the narrowest shape that will
 * do: `projects` is "something that can save", not a `ProjectStore`. It can be
 * mounted in a test with two plain objects and a two-diagram model.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import { EditorRefused, SolutionDesignEditor } from '../editor'
import type { ReactNode } from 'react'
import type { EditorHandle, EditorOwnership, PageView, StandInNote } from '../editor'
import { RendererRefused } from '../agent/renderer'
import type { RendererView } from '../agent/renderer'
import type { Destination } from '../agent/screen'
import type { Language, Translate } from '../i18n'
import type { ScopeModel, ScopeSnapshot, ScopeSummary } from '../projects/scope'
import type { ScopePath } from '../projects/scopePath'
import type { ScopeIndex } from '../projects/scopeIndex'
import { FIXED_ON_A_STANDIN, mayApplyPatch, mayEdit } from '../projects/mayEdit'
import { CHECK_LABEL, documentFindings, identityFindings, offeredBeyond } from '../projects/checks'
import { technologyRows } from './organisation/technologyRegister'
import { ancestorScopes } from '../projects/scopePath'
import { flattenScopes } from '../projects/scope'
import { coverageOf, unmappedFunctions } from '../business'
import { causesToCommands, decisionsOf, decisionsToCommands, describeLeverage, leverageOf, observationsToCommands, transaction, transitionsOf } from '../model'
import type { DesignElement, ElementId, PlatformDescription, Relation, DesignDiagram, SharedElsewhere } from '../model'
import { transitionLabel } from '../model/transition'
import { formatAdrNumber } from '../decisions/adr'
import type { EditorPreferences } from '../editor'
import type { Adr } from '../decisions/adr'
import type { AncestorRecords } from '../decisions/adrScope'
import type { SearchHit } from '../search/search'
import type { WindowChrome } from '../platform/windowChrome'
import { NO_WINDOW_CHROME } from '../platform/windowChrome'
import type { SourceStatus, SourceWork } from '../platform/sourceProvider'
import type { HostCommand } from '../platform/hostCommands'
import type { ProjectHistory } from '../ports/ProjectHistory'
import { ConfirmDialog } from '../widgets/ConfirmDialog'
import { AdrPage } from '../decisions/ui/AdrPage'
import { ObservationsPage } from '../observations/ui/ObservationsPage'
import type { Analysis } from '../observations/observation'
import { DiskChangeNotice } from './DiskChangeNotice'
import { HistoryPage } from './history/HistoryPage'
import { SnapshotDialog } from './history/SnapshotDialog'
import { useProjectHistory } from './history/useProjectHistory'
import { MoveRecordDialog } from './dialogs/MoveRecordDialog'
import { ShellDialogs } from './dialogs/ShellDialogs'
import { ErrorBoundary } from './ErrorBoundary'
import { messageFor } from './messageFor'
import type { CrashTrail } from './ErrorBoundary'
import type { HostControls } from '../ports/HostControls'
import { GlobalSearchDialog } from '../search/ui/GlobalSearchDialog'
import { ProjectSettingsDialog } from './ProjectSettingsDialog'
import type { ProjectSettings } from './ProjectSettingsDialog'
import type { InitialPage } from './App'
import { renderMarkdown } from '../documentation/ui/renderMarkdown'
import { PlanPage, ReplaceDialog, RoadmapPage } from '../roadmap'
import { MapPage, SheetPage } from '../business'
import { PlatformReportPage, ServiceReportPage, TechnologyLandscapePage } from '../technology'
import type { Supporter } from '../business'
import type { SheetHandle } from '../business'
import { documentsUsing, imageSrcFile } from '../documentation'
import type { MarkdownRenderOptions } from '../documentation'
import { ShellToolbar } from './ShellToolbar'
import type { Crumb, ToolbarAgent, ToolbarOverflow } from './ShellToolbar'
import { useDocumentSession } from './useDocumentSession'
import type { ProjectSaver } from './useDocumentSession'
import type { WorkspaceAgentView } from './useAgentShell'
import { useDiagramActions } from './useDiagramActions'
import type { MakeId } from './useDiagramActions'
import { useFilePicker } from './useFilePicker'
import { useGestures } from './useGestures'
import { useModelSession } from './useModelSession'
import { usePlans } from './usePlans'
import { useSheet } from './useSheet'
import { useShowElement } from './useShowElement'
import { ChooseBoardDialog } from './dialogs/ChooseBoardDialog'
import { useLibrary } from './useLibrary'
import { standInOf } from '../projects/library'
import { useOwnerDescriptions } from './useOwnerDescriptions'
import { AddFromLibraryDialog } from './dialogs/AddFromLibraryDialog'
import { useMap } from './useMap'
import { useTechnologyLandscape } from './useTechnologyLandscape'
import { usePlatformReport } from './usePlatformReport'
import { useProjectFiles } from './useProjectFiles'
import type { ProjectFileChannel } from './useProjectFiles'
import { useNearlyFullNotice } from './useStorageNotice'
import type { StorageNotice } from './useStorageNotice'
import type { Notify } from './useToasts'

export type ProjectWorkspaceProps = {
  project: ScopeSnapshot
  projects: ProjectSaver
  /**
   * The organisation's index, read-only (ADR-0012 §2, §10).
   *
   * Held above this workspace because it outlives a scope switch and because
   * the first screen reads it too. Everything below takes what it needs from
   * it: the id policy the ids spoken for, `mayEdit` who answers for one, and a
   * sheet at the root the `supports` rows a landscape wrote.
   */
  index: ScopeIndex
  /**
   * Somebody else changed this project's files. Bound to this project's ref by
   * the caller, and absent in a browser tab, where nothing can watch.
   */
  watch?: (onChanged: () => void) => () => void
  /**
   * May work here be written?
   *
   * A fact about the source this scope is kept in, read rather than assumed —
   * it was the constant `false` until a source could be somewhere other than a
   * folder this machine owns, and for all three sources that ship it still is.
   */
  readOnly?: boolean
  /**
   * What this source means by *dirty*, *saving*, *clean*, *external-changed*
   * and *conflict*. Absent where the document's own machine is the whole
   * answer, which is what a file is.
   */
  sourceStatus?: (work: SourceWork) => SourceStatus
  /**
   * Menu items, the web's overflow and files the OS opened us with — the ones
   * about the project that is open. The shell above takes the ones about
   * folders and preferences; subscribing in both places is how each layer
   * handles what it owns.
   */
  commands?: (listener: (command: HostCommand) => void) => () => void
  /** The host has a menu bar of its own, which carries ⌘Z and ⌘⇧Z (ADR-0005, amended). */
  hostMenu?: boolean
  /**
   * The menu, for a host with no menu bar. Absent on the desktop. The
   * workspace fills in the one capability it knows — whether there is a
   * history to offer — and passes the rest through.
   */
  overflow?: Omit<ToolbarOverflow, 'can'> & { can: Omit<ToolbarOverflow['can'], 'history'> }
  /**
   * Tell the host whether closing the window would lose something. Absent in a
   * browser tab, where the window is ours and `beforeunload` says it.
   */
  onUnsavedWork?: (unsaved: boolean) => void
  /**
   * The snapshots of the folder this project is in. Absent in a browser tab and
   * until a folder is chosen — there is nothing for a history to be a history
   * of — and the menu offers nothing when it is.
   */
  history?: ProjectHistory
  /** A snapshot succeeded. The shell decides whether that means a push. */
  onSnapshotTaken?: () => void
  /**
   * The agent's view of this session (ADR-0007, ADR-0019), handed up as
   * soon as it exists and taken back on unmount. The shell binds the seam,
   * because the subscription must outlive a scope switch and an agent's
   * `app.open` is what causes one; what the workspace owns is the session,
   * the page over the canvas and how to show another.
   */
  onAgentSession?: (view: WorkspaceAgentView | undefined) => void
  /** The glyph on the bar: the server's state, and the way to the dialog. */
  agentBar?: ToolbarAgent
  documents: ProjectFileChannel

  notify: Notify
  onStorageResult: StorageNotice
  s: Translate
  language: Language
  editorPreferences: unknown
  onEditorPreferencesChange: (next: EditorPreferences) => void

  /**
   * Leave this scope for a home: one above it from a crumb on the bar, or its
   * own when a page closes over a canvas that draws nothing. Where a home is
   * the shell's state, the same as which scope is open.
   */
  onGoHome: (path: ScopePath) => void
  /** Every scope above this one, root first, for the bar (`crumbsFor`). */
  crumbs: readonly Crumb[]
  /**
   * Open another scope by its path — *Open …* beside a field another scope
   * answers for (ADR-0012 §10).
   *
   * The shell's, because opening a scope is the shell's: it reads it, makes it
   * the one that is open, and remembers it. This workspace neither loads nor
   * lists. Absent where there is nowhere to go, and the button is then not
   * drawn rather than drawn and dead.
   */
  onOpenScope?: (path: ScopePath, page?: InitialPage) => void
  /** The tree as it stands, for the settings dialog's "filed under" select. */
  scopes: ScopeSummary
  /**
   * Every scope's records, read when a gesture is asked for (ADR-0012 §10).
   *
   * Not the index, which keeps a summary: deciding whether the scope a
   * definition would move into already answers for the id needs the record.
   * Read on the gesture rather than held, because a gesture is a decision and
   * not a keystroke. Absent in a test, and nothing is then offered.
   */
  models?: () => Promise<ScopeModel[]>
  /**
   * Every scope in full, read when an export asks (ADR-0018). Beside `models`
   * and for the opposite reason: that one is the thin read the index wants,
   * this is the whole thing the working file is made of.
   */
  workingSet?: () => Promise<ScopeSnapshot[]>
  /**
   * Write the scopes an opened working file brought with it (ADR-0018). The
   * shell's, because it owns the store; absent where there is none, and such a
   * file is then refused rather than half-opened.
   */
  onAdoptScopes?: (scopes: readonly ScopeSnapshot[]) => Promise<void>
  /** Called when the dialog opens, so the caller can refresh that list. */
  onOpenSettings: () => void
  /**
   * A gesture changed the tree: read the listing and the index again
   * (ADR-0012 §10). The shell owns both, and a gesture is the one thing this
   * workspace does that changes a scope other than the one it has open.
   */
  onTreeChanged?: () => void
  /**
   * Apply the settings to the project as it stands, and hand back what was
   * saved so the session can take it on. Nothing comes back from a move: that
   * changes the ref, and this workspace is remounted on it.
   */
  onApplySettings: (
    settings: ProjectSettings,
    current: ScopeSnapshot,
  ) => Promise<ScopeSnapshot | undefined>
  makeId: MakeId
  /**
   * The records of every scope above this one, nearest first (ADR-0012 §7).
   *
   * One list, read up the tree. They are not this scope's to change — a record
   * is edited where it lives — so they arrive and nothing goes back: the
   * decisions page shows them in a *From …* section and offers to open the
   * scope that holds them.
   */
  ancestorDecisions: readonly AncestorRecords[]
  /**
   * What the organisation this scope sits in is called, walked up the tree
   * (`projects/scopeLabel.ts`). Shown on the bar and above a description.
   */
  groupName: string
  /**
   * Who drawings made here are addressed to. Absent = the organisation's name,
   * which is what the title block said before a scope could say otherwise.
   */
  groupClient?: string
  /**
   * For the boundary around the canvas. The editor is the largest thing in the
   * app and the likeliest to throw; catching it here is what keeps the toolbar,
   * the save menu and the pages beside it alive when it does.
   */
  diagnostics: CrashTrail
  hostControls: HostControls
  /** Today as `yyyy-mm-dd`, for a decision's dates. Injected so a test can pin it. */
  today?: () => string
  /**
   * Which page to show the moment this appears, when it was opened for one.
   *
   * The organisation screen's cards open the ROOT scope, which usually draws
   * nothing at all: its decisions, its plans and its business architecture are
   * what it holds, and a canvas is not. Without this a person pressing *Open*
   * on a card would land on an empty board and have to find the page again on
   * the bar. Absent is the ordinary case — a landscape opened on its canvas.
   *
   * `sheet` with no id means "the one this scope is about to be given": the
   * seeding is a `Command` through the session like any other, so it is one
   * undo step and one Activity line rather than a write from the screen.
   */
  initialPage?: InitialPage
  /** Passed straight to the toolbar, which is the bar the window borrows. */
  windowChrome?: WindowChrome
}

function localToday(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function ProjectWorkspace({
  project, projects, index, watch, readOnly = false, sourceStatus,
  commands, hostMenu = false, overflow, onUnsavedWork, history: projectHistory,
  onSnapshotTaken, onAgentSession, agentBar, documents, notify, onStorageResult, s, language, editorPreferences, onEditorPreferencesChange,
  onGoHome, crumbs, onOpenScope, scopes, models, workingSet, onAdoptScopes,
  onOpenSettings, onTreeChanged = () => {},
  onApplySettings, makeId, ancestorDecisions,
  groupName, groupClient,
  diagnostics, hostControls, today = localToday, initialPage, windowChrome,
}: ProjectWorkspaceProps) {
  /**
   * Every ancestor's records as one list — what the search and the agent read.
   *
   * Flat, because neither of them asks WHICH scope above: the search says a
   * record is from a scope above this one, and the agent answers for the
   * session (its `scope` on a record is step 13's). The page beside them keeps
   * the sections, because a person needs to know where to go to edit one.
   */
  const ancestorRecords = useMemo(
    () => ancestorDecisions.flatMap((one) => one.decisions),
    [ancestorDecisions],
  )
  const [settingsOpen, setSettingsOpen] = useState(false)
  const openSettings = useCallback(() => { onOpenSettings(); setSettingsOpen(true) }, [onOpenSettings])
  // The index by reference, for the callbacks that must not be rebuilt when it
  // is: the id policy is minted once for the life of the session.
  const indexRef = useRef(index)
  indexRef.current = index
  const session = useModelSession({
    initialProject: project,
    notify,
    s,
    // Read per ask, not captured: the index is rebuilt under a live session
    // whenever the folder changes (ADR-0012 §2).
    takenInTree: useCallback(() => indexRef.current.takenIds(), []),
  })
  const diagrams = useDiagramActions({ session, notify, s, makeId })
  // A request INTO the editor carries a nonce: "show this one" asked twice is
  // two requests. Declared here because the agent's renderer view, below,
  // points with it too.
  const [focusRequest, setFocusRequest] = useState<{ id: string; nonce: number } | undefined>(undefined)
  /** The store write, and then the two reads a changed tree needs (ADR-0012 §10). */
  const adoptWorkingSet = useCallback(
    async (held: readonly ScopeSnapshot[]) => {
      await onAdoptScopes!(held)
      onTreeChanged()
    },
    [onAdoptScopes, onTreeChanged],
  )
  const files = useProjectFiles({
    session,
    documents,
    ...(workingSet ? { workingSet } : {}),
    ...(onAdoptScopes ? { adoptWorkingSet } : {}),
    notify,
    s,
  })
  // Declared here rather than beside the other pages, because the agent's
  // renderer view below points into both: at the canvas, and at the sheet.
  const focusElement = useCallback((id: string) => {
    setFocusRequest((prev) => ({ id, nonce: (prev?.nonce ?? 0) + 1 }))
  }, [])
  /**
   * Requests INTO the editor carry a nonce, because "open the documentation"
   * asked twice is two requests and a prop that did not change is none.
   *
   * Up here with the focus request for the same reason, one page further on:
   * the sheet is wired next, and a coverage link on it lands on the element's
   * own page when no board draws the element at all.
   */
  const [docRequest, setDocRequest] = useState<{ elementId?: string; diagramId?: string; nonce: number } | undefined>(undefined)
  /** `diagramId` is the view the reader came from — a sheet, whose neighbours the page then lists. */
  const openDocumentation = useCallback((elementId?: string, diagramId?: string) => {
    const model = session.current()
    if (model.elements.length === 0) { notify(s('shell.noElements'), 'info'); return }
    // A stand-in's page is the owner's page: the description is maintained
    // where the thing is defined (ADR-0012 §3), so the page opens there.
    const held = elementId !== undefined ? model.elements.find((element) => element.id === elementId) : undefined
    const master = held?.ref !== undefined ? indexRef.current.lookup(held.id)?.master : undefined
    if (elementId !== undefined && master !== undefined && master !== project.path && onOpenScope) {
      onOpenScope(master, { page: 'document', id: elementId })
      return
    }
    setDocRequest((prev) => ({ elementId, diagramId, nonce: (prev?.nonce ?? 0) + 1 }))
  }, [session, notify, s, project.path, onOpenScope])
  /**
   * Where a link to an element lands: a board here, a choice, its page, or
   * the scope that answers for it. The sheet, the register and a row of the
   * organisation's own list all end here.
   */
  const showElement = useShowElement({
    session, scope: project.path, notify, s,
    focus: focusElement,
    toDocumentation: openDocumentation,
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
  // A platform's page (ADR-0013): read only, so it needs nobody's actions.
  const platformReading = usePlatformReport()

  /**
   * The picture behind an image source, or nothing — which is the whole of the
   * "this app does not fetch" rule for documents (ADR-0009).
   *
   * Stable for the life of the workspace, deliberately: `MarkdownView` memoises
   * its component table on this function, so a new one per render would remount
   * every block in every document and redraw every mermaid diagram. It reads
   * the library through the session instead, and a picture just added shows
   * because adding one also writes a line into the document, which is what the
   * view actually re-renders on.
   */
  const resolveImage = useCallback((src: string): string | undefined => {
    const file = imageSrcFile(src)
    return file ? session.currentImages().find((image) => image.file === file)?.url : undefined
  }, [session])

  /**
   * Every document that shows a picture, by name — descriptions, decisions and
   * plans alike, which is why this is answered here and not on the page that
   * asks: the page knows one board, and the session knows the project.
   */
  const imageUsedBy = useCallback((file: string): readonly string[] => {
    const model = session.indexed()
    return documentsUsing(file, [
      ...Object.values(model.elements).map((element) => ({ label: element.name, text: element.description ?? '' })),
      ...Object.values(decisionsOf(model)).map((adr) => ({ label: `${formatAdrNumber(adr.number)} ${adr.title}`, text: adr.body })),
      ...Object.values(transitionsOf(model)).map((plan) => ({ label: `${transitionLabel(plan)} ${plan.title}`, text: plan.body })),
    ])
  }, [session])

  /** The shared renderer, with this project's pictures behind it. */
  const renderDocument = useCallback(
    (md: string, options?: MarkdownRenderOptions) => renderMarkdown(md, { ...options, resolveImage }),
    [resolveImage],
  )

  /**
   * What the bar says about saving. Two pieces of state, not one: the last
   * accepted time is worth keeping through a failure — it is the honest answer
   * to "how much did I lose" — but it must not be what is on screen while the
   * store is refusing.
   */
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)
  const onSaveResult = useCallback((ok: boolean) => {
    setSaveFailed(!ok)
    onStorageResult(ok)
  }, [onStorageResult])
  // Per project rather than per session, because the workspace is remounted when
  // one is opened: the same warning on a different project is worth hearing.
  const nearlyFull = useNearlyFullNotice(notify, s)

  const document = useDocumentSession({
    session,
    projects,
    // A browser tab has no watcher to say the tree changed, so a save is the
    // one moment it can learn that this scope's records now say something
    // else — a plan flagged an initiative reaches the organisation's roadmap
    // through the index, and the index is read again only when asked.
    onSaved: (at: Date) => { setSavedAt(at); if (!watch) onTreeChanged() },
    onResult: onSaveResult,
    onPressure: nearlyFull,
    watch,
    sourceStatus,
    onUnsavedWork,
    // Their version, once it has been read: straight onto the session, without
    // a relayout — a project read back from its folder carries its geometry.
    onAdopt: useCallback((held: ScopeSnapshot) => session.adopt(held, false), [session]),
  })
  const forceSave = document.forceSave

  /**
   * The agent, as a peer of the menu: a request is answered against the
   * session as it stands, and refused while the person is deciding which
   * version of the project stands.
   */
  const documentStatus = document.state.status

  /**
   * The editor's handle, as the agent's renderer view (ADR-0007). Held in a
   * ref because the editor hands out a new one whenever a pass starts or
   * ends, and the view must always reach the current one without the
   * subscription being rebuilt.
   */
  const editorHandle = useRef<EditorHandle | undefined>(undefined)
  const onEditorHandle = useCallback((handle: EditorHandle | undefined) => { editorHandle.current = handle }, [])
  /**
   * The same arrangement for the laid-out views, which are drawn in the tab
   * in place of the canvas (ADR-0016). One ref for all of them: only one is
   * the active view, and the agent asks for a picture by diagram id.
   */
  const sheetHandle = useRef<SheetHandle | undefined>(undefined)
  const onSheetHandle = useCallback((handle: SheetHandle | undefined) => { sheetHandle.current = handle }, [])
  const renderer = useMemo<RendererView>(() => {
    const current = (): EditorHandle => {
      const held = editorHandle.current
      if (!held) throw new RendererRefused('gone')
      return held
    }
    const asRefusal = (error: unknown): never => {
      if (error instanceof EditorRefused) throw new RendererRefused(error.reason)
      throw error
    }
    /** Poll until the editor says it is on the diagram and idle, or give up. */
    const settled = async (diagramId: string) => {
      const deadline = Date.now() + 10_000
      while (Date.now() < deadline) {
        const held = editorHandle.current
        if (held && held.activeDiagramId === diagramId && !held.busy) return
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      throw new RendererRefused('busy')
    }
    return {
      async show(diagramId) {
        if (session.currentActiveId() !== diagramId) session.setActiveDiagramId(diagramId)
        await settled(diagramId)
        // A settling pass on a machine-laid-out diagram starts a moment after
        // the switch; give it that moment, then wait it out.
        await new Promise((resolve) => setTimeout(resolve, 150))
        await settled(diagramId)
      },
      tidy: () => current().tidy().catch(asRefusal),
      route: () => current().routeEdges().catch(asRefusal),
      capture: async (options) => {
        const blob = await current().capture(options).catch(asRefusal)
        return new Uint8Array(await blob.arrayBuffer())
      },
      focus: (elementId) => setFocusRequest((prev) => ({ id: elementId, nonce: (prev?.nonce ?? 0) + 1 })),
      /**
       * A laid-out view is drawn in the tab, not on the canvas: make it the
       * active view, wait for it to hand over its handle, and rasterise what
       * it drew. Nothing is laid out asynchronously here, so the wait is for
       * React rather than for a worker — but it is still a wait, and a page
       * that never arrives is a refusal rather than a hang.
       */
      async sheet(diagramId, options) {
        if (session.currentActiveId() !== diagramId) session.setActiveDiagramId(diagramId)
        const deadline = Date.now() + 5_000
        while (Date.now() < deadline) {
          const held = sheetHandle.current
          if (held?.diagramId === diagramId) return held.capture(options)
          await new Promise((resolve) => setTimeout(resolve, 50))
        }
        throw new RendererRefused('gone')
      },
    }
  }, [session])


  /**
   * Who answers for each record on this board (ADR-0012 §10).
   *
   * The whole of federation, as far as the editor is concerned: one question,
   * asked per element. The editor may not know a scope tree exists, so the
   * list of fields and the words come from `projects/` and the way out comes
   * from `App` — which is the one thing that knows how to open a scope.
   */
  /**
   * What every card on this board says about a record another scope defines
   * (ADR-0012 §3, §9) — one entry per stand-in, and one fold over the tree.
   *
   * Keyed on the INDEX and not on the model, which is what makes it affordable:
   * the index is rebuilt twice a session, so a card's note is the same object
   * from one keystroke to the next and `React.memo` below the canvas holds.
   * Computing a note per element per derive is precisely what ADR-0004
   * measured and took out of this path.
   *
   * The consequence is that a record linked a second ago draws as a definition
   * until the tree is read again. The inspector beside it says otherwise at
   * once, because it asks the live record; that difference is the right way
   * round — the panel is where a person is looking.
   */
  /**
   * What the owners say about the stand-ins drawn here (ADR-0012 §3): read
   * from the owning scopes, shown on the card and in the panel, never kept.
   */
  const ownerDescriptions = useOwnerDescriptions({
    scope: project.path, index,
    ...(projects.load ? { load: projects.load } : {}),
    ...(projects.descriptions ? { descriptions: projects.descriptions } : {}),
  })

  const notes = useMemo(() => {
    const bySubject = new Map<string, string>()
    for (const finding of identityFindings(index)) {
      if (finding.scope !== project.path || bySubject.has(finding.id)) continue
      bySubject.set(finding.id, s(CHECK_LABEL[finding.key], {
        name: finding.name,
        scope: finding.scopes?.[0] || s('common.organisation'),
        detail: finding.detail ?? '',
      }))
    }
    const found = new Map<string, StandInNote>()
    for (const entry of index.entries()) {
      if (!entry.drawnIn.includes(project.path)) continue
      const owner = entry.master ?? ''
      const warning = bySubject.get(entry.id)
      const description = ownerDescriptions.get(entry.id)
      found.set(entry.id, {
        from: s('standIn.from', { scope: owner || s('common.organisation') }),
        ...(warning !== undefined ? { warning } : {}),
        ...(description !== undefined ? { description } : {}),
      })
    }
    return found
  }, [index, project.path, s, ownerDescriptions])

  /**
   * The `supports` and `assigned` rows the rest of the organisation wrote
   * about the functions this scope defines (ADR-0012 §2).
   *
   * What makes "2 apps" under a capability on the ORGANISATION's own sheet
   * true: the applications are in a landscape's model and the rows with them.
   * Per function this scope holds rather than the whole tree's rows, so a page
   * pays for what it draws; memoised on the index and the elements, because
   * the sheet lays itself out from it and a fresh array per render would lay
   * the page out per render.
   */
  const rowsElsewhere = useMemo(() => {
    const found: Relation[] = []
    for (const element of session.model.elements) {
      if (element.kind !== 'function') continue
      for (const row of index.rowsTo(element.id, ['supports', 'assigned'])) found.push(row.relation)
    }
    return found
  }, [index, session.model.elements])
  /**
   * The rows the rest of the organisation wrote that name a platform this
   * scope holds (ADR-0013): what runs on the shared cluster is a landscape's
   * row, and so is every interface that crosses the shared bus. Per platform
   * this scope holds, for the reason the rows above are per function.
   */
  const rowsThrough = useMemo(() => {
    const found: Relation[] = []
    for (const element of session.model.elements) {
      if (element.kind !== 'platform' && element.kind !== 'platformService') continue
      for (const row of index.rowsOf(element.id)) found.push(row.relation)
    }
    return found
  }, [index, session.model.elements])
  // By reference for the agent's findings, which are computed per call rather
  // than per render.
  const rowsElsewhereRef = useRef(rowsElsewhere)
  rowsElsewhereRef.current = rowsElsewhere

  /**
   * The four gestures that cross scopes (ADR-0012 §10).
   *
   * Here rather than in `App` because a gesture ends in a `Command` at THIS
   * session: the other scope is written through the store, and then this
   * scope's record becomes a stand-in as one undo step with a barrier on it.
   */
  /** What to call a scope on screen: its path, or the organisation's own name. */
  const scopeLabel = useCallback(
    (path: ScopePath) => path || groupName || s('common.organisation'),
    [groupName, s],
  )
  const gestures = useGestures({
    scope: project.path,
    scopes: projects,
    ...(models ? { models } : {}),
    index,
    session,
    onTreeChanged,
    ...(onOpenScope ? { onOpenScope } : {}),
    scopeLabel,
    notify,
    onFailure: useCallback((where: string, cause: unknown) => {
      diagnostics.report({ level: 'error', where, message: 'rejected', cause })
    }, [diagnostics]),
    s,
  })

  // Read off the hook so the editor's ownership seam is not rebuilt every
  // time a dialog opens: both are `useCallback`s over the tree and the
  // session, and neither moves when the choice does.
  const { offers: gestureOffers, choose: gestureChoose } = gestures

  /**
   * The initiatives of the scopes below this one (ADR-0012 §7), for the
   * roadmap to draw under its own plans. Off the index, so a domain flagging
   * a plan reaches the organisation's roadmap when the watcher next reads
   * the tree, and never costs a load per domain.
   */
  const initiativesBelow = useMemo(
    () => index.initiativesBelow(project.path).map(({ scope, transition, elements }) => ({
      scope, label: scopeLabel(scope), plan: transition, elements,
    })),
    [index, project.path, scopeLabel],
  )

  /**
   * What the map calls a column, and whose it is (ADR-0012 §9).
   *
   * The applications supporting the organisation's capabilities are a
   * landscape's, so their names come from the index rather than from this
   * scope's model — which holds them, if at all, as stand-ins whose cache may
   * have drifted. `where` is the master's scope where that is not this one,
   * said the way the bar says it.
   */
  const describeForMap = useCallback((id: ElementId): PlatformDescription | undefined => {
    const entry = index.lookup(id)
    if (!entry) return undefined
    const { master } = entry
    return {
      name: entry.name,
      kind: entry.kind,
      ...(master !== undefined && master !== project.path ? { where: scopeLabel(master) } : {}),
      // What a platform is, what it is filed under and whether it is the
      // organisation's, as its master says (ADR-0014): a stand-in here
      // carries nothing the owner answers for.
      ...(entry.platformArchetype !== undefined ? { platformArchetype: entry.platformArchetype } : {}),
      ...(entry.parentId !== undefined ? { parentId: entry.parentId } : {}),
      ...(entry.outside ? { outside: entry.outside } : {}),
    }
  }, [index, project.path, scopeLabel])

  /**
   * Every application in the organisation, for the sheet's *Supported by…*
   * (ADR-0012 §2). The register, said the way the map says a column: the
   * name, and the scope that defines it where that is not this one. Off the
   * index, so an application a landscape adds reaches the organisation's
   * sheet when the watcher next reads the tree.
   */
  /**
   * Every offering the rest of the tree marks shared, for the landscape's
   * shared row (ADR-0020): the scope that answers for it and what realises
   * it there, off the index rather than a load per scope.
   */
  const sharedElsewhere = useMemo<SharedElsewhere[]>(
    () => index.entries()
      .filter((entry) => entry.kind === 'platformService' && entry.shared && entry.master !== undefined && entry.master !== project.path)
      .map((entry) => ({
        id: entry.id, name: entry.name, where: scopeLabel(entry.master!),
        realisedBy: [...new Set(index.rowsTo(entry.id, ['realises']).map(({ relation }) => relation.sourceId))],
      })),
    [index, project.path, scopeLabel],
  )

  const applicationsInTree = useMemo<Supporter[]>(
    () => index.register().map(({ id, name, master }) => ({
      id, name,
      ...(master !== undefined && master !== project.path ? { where: scopeLabel(master) } : {}),
    })),
    [index, project.path, scopeLabel],
  )

  /**
   * The register as a library (ADR-0012 §2): an application the organisation
   * already has, drawn on this board without a claim on it. After the label,
   * because the toast names the scope that answers for it.
   */
  const library = useLibrary({
    session, scope: project.path, index, notify, s, focus: focusElement, scopeLabel,
  })

  const ownership = useMemo<EditorOwnership>(() => ({
    ownerOf: (elementId) => {
      const held = session.indexed().elements[elementId]
      const rights = mayEdit(elementId, project.path, index, held)
      if (rights.all) return undefined
      // The scope this record SAYS defines it, where the tree cannot say —
      // a dangling stand-in still points somewhere, and the cached path is
      // the only address anybody wrote down.
      const owner = rights.owner ?? held?.ref
      const description = ownerDescriptions.get(elementId)
      return {
        label: owner === undefined ? s('common.organisation') : owner || s('common.organisation'),
        fields: FIXED_ON_A_STANDIN,
        ...(description !== undefined ? { description } : {}),
        // A stand-in nobody defines has nowhere to go, and offering to open
        // the scope its cache names would be offering a folder that is not
        // there. *Link* is the repair, and it is step 10's.
        ...(rights.owner !== undefined && onOpenScope
          ? {
            onOpen: () => onOpenScope(rights.owner!),
            onShow: () => onOpenScope(rights.owner!, { page: 'element', id: elementId }),
            onDocument: () => onOpenScope(rights.owner!, { page: 'document', id: elementId }),
          }
          : {}),
      }
    },
    noteFor: (elementId) => notes.get(elementId),
    // What a platform is filed under and what it is, off the index (ADR-0013,
    // ADR-0014): the deployment boxes nest by the platform tree and draw a
    // box only for a place, and a landscape holds stand-ins of the platforms
    // it stands on — both facts are the scope's that defines them.
    platformTree: {
      parentOf: (platformId) => index.lookup(platformId)?.parentId,
      archetypeOf: (platformId) => index.lookup(platformId)?.platformArchetype,
      outsideOf: (platformId) => index.lookup(platformId)?.outside,
    },
    // Who uses a service from another team (ADR-0014), off the rows the whole
    // tree holds: what the *Shared* tick says beside itself.
    offeredBeyond: (serviceId) => (index.lookup(serviceId)?.kind === 'platformService'
      ? offeredBeyond(index, serviceId).outside.map((one) => one.name)
      : undefined),
    // What an application leverages (ADR-0014), over the tree's rows — what
    // realises a service is the platform scope's row — and named off the
    // index, since the platform behind a service need not be drawn here.
    leverageOf: (applicationId) => describeLeverage(
      leverageOf(session.model, applicationId, { elsewhere: rowsThrough }),
      (id) => index.lookup(id)?.name ?? session.model.elements.find((held) => held.id === id)?.name,
    ),
    // The technology the rest of the organisation defines (ADR-0017): every
    // platform and service another scope answers for, named with its scope,
    // and the stand-in this scope would keep of one.
    technology: {
      elsewhere: index.entries()
        .filter((entry) => (entry.kind === 'platform' || entry.kind === 'platformService')
          && entry.master !== undefined && entry.master !== project.path)
        .map((entry) => ({
          id: entry.id, name: entry.name, kind: entry.kind as 'platform' | 'platformService',
          place: entry.platformArchetype === 'place', where: scopeLabel(entry.master!),
          // What an offering is and what delivers it, for *Uses* and the
          // landscape's shared row (ADR-0020): the other scope's rows, off
          // the index rather than a load per scope.
          ...(entry.shared ? { shared: true as const } : {}),
          ...(entry.kind === 'platformService'
            ? { realisedBy: [...new Set(index.rowsTo(entry.id, ['realises']).map(({ relation }) => relation.sourceId))] }
            : {}),
        })),
      standInFor: (id) => {
        const entry = index.lookup(id)
        const ref = entry?.master ?? entry?.cachedRef
        return entry && ref !== undefined ? standInOf(entry, ref) : undefined
      },
    },
    gestures: {
      offered: (elementId) => gestureOffers(elementId).length > 0,
      label: s('gesture.move'),
      tip: s('gesture.moveTip'),
      onMove: (elementId) => gestureChoose(elementId),
    },
    onAddExisting: library.open,
  }), [session, project.path, index, notes, rowsThrough, onOpenScope, s, gestureOffers, gestureChoose, library.open, ownerDescriptions, scopeLabel])

  const snapshots = useProjectHistory({
    history: projectHistory,
    index,
    project: session.snapshot,
    steps: session.history,
    save: forceSave,
    indexed: session.indexed,
    dispatch: session.dispatch,
    notify,
    s,
    onTaken: onSnapshotTaken,
  })

  const documentPicker = useFilePicker({
    // A working file is a zip now; the JSON entries are versions 1 and 2, which
    // still open.
    accept: '.lvarch,.json,application/json,application/zip',
    onPick: files.openFile,
    testId: 'document-input',
  })
  // No button in the toolbar for this one: the place you ask for a mark is the
  // icon picker itself, inside the editor.
  const logoPicker = useFilePicker({
    accept: 'image/svg+xml,image/png', onPick: files.addLogo, testId: 'logo-input',
  })

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
  useEffect(() => commands?.((command) => {
    switch (command.type) {
      case 'save': forceSave(); break
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
  }), [commands, forceSave, files, documentPicker, snapshots, session, hostControls])

  /**
   * The PNG still succeeds when a mark could not be embedded — the element falls
   * back to its kind glyph. That is exactly the case worth saying out loud: the
   * picture looks finished and is not.
   */
  const onExportImagesMissing = useCallback((labels: string[]) => {
    if (!labels.length) return
    notify(s('shell.imagesMissing', { labels: labels.join(', ') }), 'warning')
  }, [notify, s])

  const onLayoutError = useCallback((message: string) => {
    notify(message, 'error')
    console.error('layout', message)
  }, [notify])

  // --- the three pages beside the canvas ---------------------------------------

  const [adrPage, setAdrPage] = useState<{ open: boolean; adrId?: string }>({ open: false })
  /** The observations page (ADR-0021), on one observation or cause when an id is given. */
  const [obsPage, setObsPage] = useState<{ open: boolean; id?: string }>({ open: false })
  /**
   * How tall the shell toolbar is, measured: every page opens below it, so
   * Documentation, Decisions and Roadmap stay one click from each other while
   * a page is up. Measured rather than declared, because the bar's height is
   * its content's, and a constant here would drift the first time a button
   * grew. Zero until measured — and in a test with no layout — which makes a
   * page cover the window, as it did before the bar stayed.
   */
  const [toolbarHeight, setToolbarHeight] = useState(0)
  const toolbarRef = useCallback((node: HTMLDivElement | null) => {
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setToolbarHeight(node.getBoundingClientRect().height))
    observer.observe(node)
    setToolbarHeight(node.getBoundingClientRect().height)
  }, [])
  const pageChrome = useMemo<WindowChrome>(
    () => ({ ...(windowChrome ?? NO_WINDOW_CHROME), topInset: toolbarHeight }),
    [windowChrome, toolbarHeight],
  )
  // The clock, read once per render of the workspace rather than per component:
  // a roadmap re-deriving because a millisecond passed is a landscape re-laid.
  const todayDay = useMemo(() => today(), [today])
  const [searchOpen, setSearchOpen] = useState(false)

  // The toolbar's pages are one at a time: opening one closes the others, so
  // the bar reads as tabs rather than stacking pages under each other.
  const showDecision = useCallback((adrId?: string) => setAdrPage({ open: true, adrId }), [])
  const plans = usePlans({
    session, makeId, s,
    navigate: useMemo(() => ({ toElement: focusElement, toDecision: showDecision }), [focusElement, showDecision]),
  })
  // The toolbar's pages are one at a time, and the sheet and the map are two of them.
  const openDecisions = useCallback((adrId?: string) => {
    plans.closeAll()
    platformReading.close()
    setObsPage({ open: false })
    showDecision(adrId)
  }, [plans.closeAll, platformReading.close, showDecision])
  /** The observations page (ADR-0021): the same one-at-a-time rule. */
  const openObservations = useCallback((id?: string) => {
    plans.closeAll()
    platformReading.close()
    setAdrPage({ open: false })
    setObsPage({ open: true, ...(id !== undefined ? { id } : {}) })
  }, [plans.closeAll, platformReading.close])
  const openRoadmap = useCallback(() => {
    setAdrPage({ open: false }); setObsPage({ open: false })
    platformReading.close()
    plans.openRoadmap()
  }, [plans.openRoadmap, platformReading.close])
  /** Every page beside the canvas shut, so the tab shows: what opening a view does first. */
  const closePages = useCallback(() => {
    setAdrPage({ open: false }); setObsPage({ open: false })
    plans.closeAll()
    platformReading.close()
  }, [plans.closeAll, platformReading.close])
  /** A view on its tab, whichever kind: a board, a sheet, a map or a landscape (ADR-0016). */
  const openView = useCallback((id: string) => {
    closePages()
    session.setActiveDiagramId(id)
  }, [closePages, session])
  const openSheet = openView
  const openMap = useCallback((id: string) => {
    setAdrPage({ open: false }); setObsPage({ open: false })
    plans.closeAll()
    platformReading.close()
    session.setActiveDiagramId(id)
  }, [plans.closeAll, platformReading.close, session])
  const createMap = useCallback(() => {
    setAdrPage({ open: false }); setObsPage({ open: false })
    plans.closeAll()
    platformReading.close()
    maps.create()
  }, [plans.closeAll, platformReading.close, maps.create])
  /** The technology landscape (ADR-0015): the third laid-out page, opened and made the map's way. */
  const openTechnology = useCallback((id: string) => {
    setAdrPage({ open: false }); setObsPage({ open: false })
    plans.closeAll()
    platformReading.close()
    landscapes.open(id)
  }, [plans.closeAll, platformReading.close, landscapes.open])
  /** The door from a record (ADR-0020): the scope's landscape, on that application. */
  const openTechnologyFor = useCallback((elementId: string) => {
    setAdrPage({ open: false }); setObsPage({ open: false })
    plans.closeAll()
    platformReading.close()
    landscapes.showOn(elementId)
  }, [plans.closeAll, platformReading.close, landscapes.showOn])
  const createTechnology = useCallback(() => {
    setAdrPage({ open: false }); setObsPage({ open: false })
    plans.closeAll()
    platformReading.close()
    landscapes.create()
  }, [plans.closeAll, platformReading.close, landscapes.create])
  /**
   * A platform's report (ADR-0013, redone): reached from the platform's own
   * card and from the finding that names it, and never created — every mark on
   * it is derived from the rows, so opening it is the whole of making it.
   */
  const openServiceReport = useCallback((serviceId: string) => {
    setAdrPage({ open: false }); setObsPage({ open: false })
    plans.closeAll()
    platformReading.openService(serviceId)
  }, [plans.closeAll, platformReading.openService])
  const openPlatformReport = useCallback((platformId: string) => {
    plans.closeAll()
    platformReading.open(platformId)
  }, [plans.closeAll, platformReading.open])

  /**
   * The agent's view of this session (ADR-0007, ADR-0019): what the handler
   * needs from the session, and the two things only this screen knows —
   * which page is up, and how to show another. Handed up to the shell,
   * which binds the seam; below the pages because it names their state.
   */
  const agentView = useMemo<WorkspaceAgentView>(() => ({
    indexed: session.indexed,
    current: session.current,
    activeDiagramId: session.currentActiveId,
    scopePath: () => project.path,
    ancestorDecisions: () => ancestorRecords,
    blocked: () => (documentStatus === 'conflict' ? 'agent.conflict' : undefined),
    dispatch: session.dispatch,
    ids: session.ids,
    makeId,
    today,
    translate: s,
    containerName: (name: string) => s('shell.containerDiagram', { name }),
    // ADR-0012 §10, as the agent's half of the one rule: what the inspector
    // greys out is what an `element.update` is refused for. Read through the
    // ref so a rebuilt index reaches a request arriving between two renders.
    ownedElsewhere: (id: string, patch: Partial<DesignElement>) => {
      const held = session.indexed().elements[id]
      const answer = mayApplyPatch(patch, id, project.path, indexRef.current, held)
      return answer === true ? undefined : { owner: answer.owner }
    },
    // The stand-in a technology.use writes for a target another scope
    // defines (ADR-0020): the same record the inspector's picker writes.
    standInFor: (id: string) => {
      const entry = indexRef.current.lookup(id)
      const ref = entry?.master ?? entry?.cachedRef
      return entry && ref !== undefined ? standInOf(entry, ref) : undefined
    },
    renderer,
    revision: session.revision,
    history: session.history,
    undo: session.undo,
    images: session.currentImages,
    addImage: (image) => session.setImageLibrary((library) => [...library, image]),
    save: forceSave,
    page: () => {
      if (adrPage.open) return { page: 'decisions', ...(adrPage.adrId !== undefined ? { id: adrPage.adrId } : {}) }
      if (obsPage.open) return { page: 'observations', ...(obsPage.id !== undefined ? { id: obsPage.id } : {}) }
      if (plans.planId !== undefined) return { page: 'plan', id: plans.planId }
      if (plans.roadmapOpen) return { page: 'roadmap' }
      if (platformReading.platformId !== undefined) return { page: 'platform', id: platformReading.platformId }
      if (platformReading.serviceId !== undefined) return { page: 'service', id: platformReading.serviceId }
      return undefined
    },
    show: (to: Destination & { scope: string }) => {
      switch (to.page) {
        case 'board': case 'sheet': case 'map': case 'technology':
          if (to.id !== undefined) openView(to.id)
          break
        case 'decisions': openDecisions(to.id); break
        case 'roadmap': openRoadmap(); break
        case 'plan': openRoadmap(); if (to.id !== undefined) plans.openPlan(to.id); break
        case 'element': closePages(); if (to.id !== undefined) showElement.show(to.id); break
        case 'document': closePages(); openDocumentation(to.id); break
        case 'documentation': closePages(); openDocumentation(); break
        case 'platform': if (to.id !== undefined) openPlatformReport(to.id); break
        case 'service': if (to.id !== undefined) openServiceReport(to.id); break
        default: closePages()
      }
    },
    /**
     * The tree, for the agent (ADR-0012, step 13). Through the ref, as
     * `ownedElsewhere` is, so a rebuilt index reaches a request arriving
     * between two renders. The findings are the tree's plus the open scope's
     * own document's, the way its page shows them; another scope's document
     * findings would be a load per call, and the identity findings about it
     * are in the same list already.
     */
    tree: {
      scopes: () => flattenScopes(scopes).map((held) => ({
        path: held.path, name: held.name, ...(held.kind ? { kind: held.kind } : {}), views: held.diagrams,
      })),
      lookup: (id) => indexRef.current.lookup(id),
      register: () => indexRef.current.register(),
      technology: () => technologyRows(indexRef.current, identityFindings(indexRef.current)),
      initiativesBelow: (path) => indexRef.current.initiativesBelow(path),
      observationsBelow: (path) => indexRef.current.observationsBelow(path),
      rowsTo: (id, types) => indexRef.current.rowsTo(id, types).map((row) => row.relation),
      findings: () => {
        const model = session.current()
        const coverage = coverageOf(model.relations, rowsElsewhereRef.current)
        return [
          ...identityFindings(indexRef.current),
          ...documentFindings({
            scope: project.path, model, index: indexRef.current,
            business: {
              unmapped: unmappedFunctions(model.elements).map((held) => held.id),
              uncovered: model.elements
                .filter((held) => held.kind === 'function' && (coverage.get(held.id)?.coverage ?? 'uncovered') === 'uncovered')
                .map((held) => held.id),
            },
          }),
        ]
      },
      // A read for one call, the scope and its ancestors' records: what the
      // open scope was handed at open, done again for the one asked about.
      read: async (path) => {
        const load = projects.load
        if (!load) return undefined
        const held = await load(path)
        if (!held) return undefined
        const above = await Promise.all(ancestorScopes(path).map((one) => load(one)))
        return {
          model: held.model,
          activeDiagramId: held.activeDiagramId,
          ancestorDecisions: above.flatMap((one) => one?.model.decisions ?? []),
        }
      },
    },
  }), [
    session, project.path, ancestorRecords, documentStatus, makeId, today, s, renderer, forceSave, scopes, projects,
    adrPage, plans.planId, plans.roadmapOpen, plans.openPlan, platformReading.platformId, platformReading.serviceId,
    openView, openDecisions, openRoadmap, closePages, showElement.show, openDocumentation, openPlatformReport, openServiceReport,
  ])
  useEffect(() => {
    onAgentSession?.(agentView)
    return () => onAgentSession?.(undefined)
  }, [onAgentSession, agentView])

  /**
   * The page this was opened for, shown once.
   *
   * An effect and not a seeded `useState`, because two of the three are owned
   * by hooks of their own and one of them has to make a diagram first. Keyed on
   * nothing: the workspace remounts on a project switch, so "once" is once per
   * project, which is what was asked for.
   */
  const openedFor = useRef(false)
  useEffect(() => {
    if (!initialPage || openedFor.current) return
    openedFor.current = true
    if (initialPage.page === 'decisions') openDecisions(initialPage.id)
    if (initialPage.page === 'observations') openObservations(initialPage.id)
    if (initialPage.page === 'roadmap') openRoadmap()
    if (initialPage.page === 'sheet') {
      if (initialPage.id) openSheet(initialPage.id)
      else sheets.create()
    }
    if (initialPage.page === 'map') {
      if (initialPage.id) openMap(initialPage.id)
      else createMap()
    }
    if (initialPage.page === 'technology') {
      if (initialPage.id) openTechnology(initialPage.id)
      else createTechnology()
    }
    // Over the roadmap, so closing the plan lands on the roadmap and closing
    // that leaves a scope that draws nothing, rather than on an empty board.
    if (initialPage.page === 'plan') {
      openRoadmap()
      plans.openPlan(initialPage.id)
    }
    // A row of the register, opened where it is answered for.
    if (initialPage.page === 'element') showElement.show(initialPage.id)
    // A report, reached by an agent or a link (ADR-0019): derived, so opening it is the whole of it.
    if (initialPage.page === 'platform') openPlatformReport(initialPage.id)
    if (initialPage.page === 'service') openServiceReport(initialPage.id)
    if (initialPage.page === 'document') openDocumentation(initialPage.id)
    if (initialPage.page === 'documentation') openDocumentation()
    // Not a page: the register's *Link…*, which can only be done by the
    // session that holds this scope (ADR-0012 §10).
    if (initialPage.page === 'link') {
      gestures.ask({ gesture: 'link', id: initialPage.id, to: initialPage.to })
    }
  }, [initialPage, openDecisions, openObservations, openRoadmap, openSheet, sheets.create, openMap, createMap, openTechnology, createTechnology, plans.openPlan, focusElement, openDocumentation, gestures, openPlatformReport, openServiceReport])

  /**
   * A scope that draws nothing has nowhere to go when the page closes.
   *
   * The canvas would show "diagram not found", which is true and useless: this
   * scope was opened FOR its decisions or its roadmap, and closing them means
   * going back to where they were opened from. A scope with a board closes its
   * pages onto that board, as it always has.
   */
  const drawsNothing = session.model.diagrams.length === 0
  const leaveIfNothingToDraw = useCallback(
    () => { if (drawsNothing) onGoHome(project.path) },
    [drawsNothing, onGoHome, project.path],
  )

  const chooseHit = useCallback((hit: SearchHit) => {
    switch (hit.kind) {
      case 'element':
        focusElement(hit.elementId)
        break
      case 'documentation':
        openDocumentation(hit.elementId)
        break
      case 'adr':
        openDecisions(hit.adrId)
        break
    }
  }, [focusElement, openDocumentation, openDecisions])

  // ⌘K / Ctrl+K from anywhere in the workspace. The editor's own ⌘F stays the
  // canvas finder; this is the wider one.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /**
   * Hand the settings to the caller together with the project as the session
   * has it, and take back whatever was saved.
   *
   * Both halves matter. The session's model is the one being edited, so it is
   * what the settings must be applied to; and the saved result has to come back
   * into the session, or the session goes on holding a model from before the
   * dialog and the next autosave writes the settings straight back out again.
   */
  const applySettings = useCallback((settings: ProjectSettings) => {
    void onApplySettings(settings, session.snapshot()).then(
      (saved) => { if (saved) session.adopt(saved, false) },
      // The caller reports what it could; this is the case where the promise
      // itself broke, which nothing above would otherwise hear about.
      (cause: unknown) => {
        diagnostics.report({ level: 'error', where: 'applySettings', message: 'rejected', cause })
        notify(messageFor(cause, s), 'error')
      },
    )
  }, [session, onApplySettings, diagnostics, notify, s])

  /**
   * The project's records live on the model, so a change to them is a change to
   * the model. The page hands back the whole list; what actually moved becomes
   * one undo step, so ⌘Z puts back a record rather than a list.
   */
  const onProjectDecisionsChange = useCallback((next: Adr[]) => {
    const commands = decisionsToCommands(session.indexed(), next)
    if (commands.length) session.dispatch(transaction(commands))
  }, [session])

  /** The observations page hands both lists back (ADR-0021); what moved is one undo step. */
  const onAnalysisChange = useCallback((next: Analysis) => {
    const indexed = session.indexed()
    const commands = [...observationsToCommands(indexed, next.observations), ...causesToCommands(indexed, next.causes)]
    if (commands.length) session.dispatch(transaction(commands))
  }, [session])

  /**
   * The observations the scopes below shared (ADR-0021), off the index like
   * the initiatives — and, the other way, which of this scope's own a scope
   * above folded into one of its own.
   */
  const sharedBelow = useMemo(() => index.observationsBelow(project.path), [index, project.path])
  const absorbedAbove = useMemo(() => index.absorbedFrom(project.path), [index, project.path])

  /**
   * "History…" on a diagram's tab and on the documentation page (ADR-0008):
   * the page, opened on one thing. Absent where there is no history to open,
   * so no page offers an item that leads nowhere.
   */
  const openHistoryOf = snapshots.openPage
  const historyRequests = useMemo(() => (snapshots.available
    ? {
      onDiagram: (id: string) => openHistoryOf({ what: 'diagram', id }),
      onDescription: (id: string) => openHistoryOf({ what: 'description', id }),
    }
    : undefined), [snapshots.available, openHistoryOf])

  /**
   * The app's one undo stack, as the editor takes it. Memoised on what actually
   * moves, so a render for any other reason does not look like a new stack.
   */
  const history = useMemo(() => ({
    undo: session.undo, redo: session.redo,
    canUndo: session.canUndo, canRedo: session.canRedo,
    keysOwnedByHost: hostMenu,
  }), [session.undo, session.redo, session.canUndo, session.canRedo, hostMenu])

  /**
   * The laid-out views, drawn in the tab (ADR-0016): the editor hands back
   * the active diagram and its own selection, and this draws the page where
   * the canvas would be. Rebuilt per render, as the editor's other props are.
   */
  const renderPage = (diagram: DesignDiagram, view: PageView): ReactNode => {
    if (diagram.kind === 'sheet') {
      return (
        <SheetPage
          open inline
          model={session.model}
          sheet={diagram}
          readOnly={view.readOnly}
          actions={sheets.actions}
          onClose={() => {}}
          onHandle={onSheetHandle}
          ownerOf={ownership.ownerOf}
          elsewhere={rowsElsewhere}
          applications={applicationsInTree}
          onOpenDocumentation={(id) => openDocumentation(id, diagram.id)}
          onSave={files.savePicture}
        />
      )
    }
    if (diagram.kind === 'map') {
      return (
        <MapPage
          open inline
          model={session.model}
          map={diagram}
          readOnly={view.readOnly}
          actions={sheets.actions}
          onClose={() => {}}
          onHandle={onSheetHandle}
          ownerOf={ownership.ownerOf}
          elsewhere={rowsElsewhere}
          describe={describeForMap}
          today={todayDay}
          applications={applicationsInTree}
          onOpenDocumentation={(id) => openDocumentation(id, diagram.id)}
        />
      )
    }
    if (diagram.kind === 'technology') {
      return (
        <TechnologyLandscapePage
          open inline
          model={session.model}
          diagram={diagram}
          readOnly={view.readOnly}
          {...(view.selectedId !== undefined ? { selectedId: view.selectedId } : {})}
          {...(landscapes.focus !== undefined ? { focus: landscapes.focus } : {})}
          onSelect={view.onSelect}
          onAdd={view.onAdd}
          onHost={view.onHost}
          onUse={view.onUse}
          notify={notify}
          onClose={() => {}}
          onHandle={onSheetHandle}
          elsewhere={rowsThrough}
          sharedElsewhere={sharedElsewhere}
          describe={describeForMap}
          tree={ownership.platformTree}
          onOpenDocumentation={(id) => openDocumentation(id, diagram.id)}
          onOpenServiceReport={openServiceReport}
          onOpenPlatformReport={openPlatformReport}
        />
      )
    }
    return null
  }

  return (
    <>
      <Box ref={toolbarRef} sx={{ flex: '0 0 auto' }}>
      <ShellToolbar
        designName={session.model.name}
        crumbs={crumbs}
        scopePath={project.path}
        savedAt={savedAt}
        status={document.state.status}
        saveFailed={saveFailed}
        language={language}
        overflow={overflow && { ...overflow, can: { ...overflow.can, history: snapshots.available } }}
        onGoHome={onGoHome}
        onOpenSettings={openSettings}
        onOpenDocumentation={() => openDocumentation()}
        onOpenDecisions={() => openDecisions()}
        onOpenObservations={() => openObservations()}
        onOpenRoadmap={openRoadmap}
        onOpenSearch={() => setSearchOpen(true)}
        activity={session.history}
        agent={agentBar}
        s={s}
        windowChrome={windowChrome}
      />
      </Box>
      <DiskChangeNotice
        status={document.state.status}
        onTakeTheirs={document.takeTheirs}
        onKeepMine={document.keepMine}
        onSaveCopy={files.saveWorkingFile}
        s={s}
      />
      {documentPicker.input}
      {logoPicker.input}

      <Box sx={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <ErrorBoundary where="editor" diagnostics={diagnostics} controls={hostControls} s={s}>
        <SolutionDesignEditor
          key={session.editorKey}
          document={{
            model: session.model,
            activeDiagramId: session.activeDiagramId,
            onActiveDiagramChange: session.setActiveDiagramId,
          }}
          editing={{ dispatch: session.dispatch, history, ids: session.ids }}
          pages={{ render: renderPage }}
          diagrams={{
            onCreateContainer: diagrams.onCreateContainerDiagram,
            onCreateLayer7: diagrams.onCreateLayer7Diagram,
            onRename: diagrams.onRenameDiagram,
            onDuplicate: diagrams.onDuplicateDiagram,
            onDelete: diagrams.requestDeleteDiagram,
            onSettingsChange: diagrams.onDiagramSettingsChange,
            onOpenSheet: openSheet,
            onCreateSheet: sheets.create,
            onOpenMap: openMap,
            onCreateMap: createMap,
            onOpenTechnology: openTechnology,
            onCreateTechnology: createTechnology,
            onOpenTechnologyFor: openTechnologyFor,
            onOpenPlatformReport: openPlatformReport,
            onOpenServiceReport: openServiceReport,
          }}
          history={historyRequests}
          requests={{ focus: focusRequest, documentation: docRequest }}
          plans={{
            list: session.model.transitions ?? [],
            onOpen: plans.openPlan,
            onReplace: plans.startReplace,
          }}
          ownership={ownership}
          layout={{ onError: onLayoutError, onSettled: session.onLayoutSettled }}
          preferences={{ initial: editorPreferences, onChange: onEditorPreferencesChange }}
          // No `onChange`: the language is chosen in the preferences dialog
          // now (ADR-0005), and the editor's contract withdraws its own NL/EN
          // toggle when the host owns the language elsewhere.
          language={{ value: language }}
          logos={{
            library: session.logoLibrary,
            onRequestUpload: logoPicker.open,
            onExportImagesMissing,
          }}
          // The project's answers, which a diagram's own settings override. The
          // author used to be the design's NAME, so every exported PNG said
          // AUTHOR: <project name>; it is now the project's default author,
          // which is absent until somebody sets one.
          exportTitleBlock={{
            client: groupClient ?? groupName,
            author: session.model.defaultAuthor,
          }}
          renderMarkdown={renderDocument}
          onAddImage={files.addImage}
          images={{ library: session.imageLibrary, usedBy: imageUsedBy, onRemove: files.removeImage }}
          windowChrome={pageChrome}
          onForceSave={forceSave}
          onHandle={onEditorHandle}
        />
        </ErrorBoundary>
      </Box>

      <SnapshotDialog
        open={snapshots.dialogOpen}
        keeping={snapshots.keeping}
        draft={snapshots.draft}
        onCancel={snapshots.closeDialog}
        onTake={snapshots.take}
        s={s}
      />
      <HistoryPage
        open={snapshots.pageOpen}
        onClose={snapshots.closePage}
        entries={snapshots.entries}
        chosen={snapshots.chosen}
        onChoose={snapshots.choose}
        current={session.model}
        subject={snapshots.subject}
        onSubjectChange={snapshots.setSubject}
        scopes={snapshots.places.map((place) => scopeLabel(place.path))}
        onRestore={snapshots.restore}
        onLabel={snapshots.label}
        language={language}
        s={s}
        windowChrome={pageChrome}
      />
      <ShellDialogs
        s={s}
        diagramToDelete={diagrams.diagramToDelete}
        isLastLandscape={diagrams.isLastLandscape}
        onCancelDelete={diagrams.cancelDeleteDiagram}
        onConfirmDelete={diagrams.confirmDeleteDiagram}
        newDiagramName={diagrams.newDiagramName}
        onNewDiagramNameChange={diagrams.setNewDiagramName}
        onConfirmNewDiagram={diagrams.confirmNewDiagram}
      />
      <AdrPage
        open={adrPage.open}
        onClose={() => { setAdrPage({ open: false }); setObsPage({ open: false }); leaveIfNothingToDraw() }}
        model={session.model}
        groupName={groupName}
        ancestors={ancestorDecisions}
        {...(onOpenScope ? { onOpenScope } : {})}
        onProjectDecisionsChange={onProjectDecisionsChange}
        initialAdrId={adrPage.adrId}
        s={s}
        language={language}
        makeId={makeId}
        today={today}
        renderMarkdown={renderDocument}
        onOpenElement={(elementId) => openDocumentation(elementId)}
        onOpenHistory={snapshots.available
          ? (adrId) => { setAdrPage({ open: false }); setObsPage({ open: false }); openHistoryOf({ what: 'decision', id: adrId }) }
          : undefined}
        onOpenPlan={plans.openPlan}
        windowChrome={pageChrome}
      />
      <ObservationsPage
        open={obsPage.open}
        onClose={() => { setObsPage({ open: false }); leaveIfNothingToDraw() }}
        model={session.model}
        groupName={groupName}
        shared={sharedBelow}
        scopeLabel={scopeLabel}
        absorbedAbove={absorbedAbove}
        canShare={project.path !== ''}
        {...(onOpenScope ? { onOpenScope: (path: string) => onOpenScope(path, { page: 'observations' }) } : {})}
        onChange={onAnalysisChange}
        initialId={obsPage.id}
        s={s}
        language={language}
        makeId={makeId}
        today={today}
        renderMarkdown={renderDocument}
        onAddImage={files.addImage}
        images={{ library: session.imageLibrary, usedBy: imageUsedBy, onRemove: files.removeImage }}
        windowChrome={pageChrome}
      />
      <RoadmapPage
        open={plans.roadmapOpen}
        model={session.model}
        fromBelow={initiativesBelow}
        onOpenInitiative={onOpenScope ? (scope, id) => onOpenScope(scope, { page: 'plan', id }) : undefined}
        today={todayDay}
        platformTree={ownership.platformTree}
        asOf={session.model.diagrams.find((d) => d.id === session.activeDiagramId)?.asOf}
        readOnly={readOnly}
        actions={plans.roadmapActions}
        onClose={() => { plans.closeRoadmap(); leaveIfNothingToDraw() }}
        windowChrome={pageChrome}
      />
      <ReplaceDialog
        subject={plans.replacing}
        model={session.model}
        onCancel={plans.cancelReplace}
        onConfirm={plans.confirmReplace}
      />
      <PlanPage
        open={plans.planId !== undefined}
        plan={plans.plan}
        model={session.model}
        decisions={session.model.decisions}
        today={todayDay}
        readOnly={readOnly}
        actions={plans.planActions}
        renderMarkdown={renderDocument}
        onAddImage={files.addImage}
        images={{ library: session.imageLibrary, usedBy: imageUsedBy, onRemove: files.removeImage }}
        onClose={plans.closePlan}
        windowChrome={pageChrome}
        initiativeToggle={project.path !== ''}
      />
      <ServiceReportPage
        open={platformReading.serviceId !== undefined}
        model={session.model}
        serviceId={platformReading.serviceId}
        onClose={() => { platformReading.close(); leaveIfNothingToDraw() }}
        elsewhere={rowsThrough}
        describe={describeForMap}
        today={todayDay}
        onOpenDocumentation={(id) => openDocumentation(id)}
        windowChrome={pageChrome}
      />
      <PlatformReportPage
        open={platformReading.platformId !== undefined}
        model={session.model}
        platformId={platformReading.platformId}
        onClose={() => { platformReading.close(); leaveIfNothingToDraw() }}
        elsewhere={rowsThrough}
        describe={describeForMap}
        today={todayDay}
        onOpenDocumentation={(id) => openDocumentation(id)}
        windowChrome={pageChrome}
      />
      <ChooseBoardDialog
        choice={showElement.choice}
        onChoose={showElement.choose}
        onCancel={showElement.dismiss}
        s={s}
      />
      <AddFromLibraryDialog
        choice={library.choice}
        scopeLabel={scopeLabel}
        onPick={library.pick}
        onOwn={library.own}
        onDrawOnly={library.drawOnly}
        onPlace={library.place}
        onCancel={library.close}
        s={s}
      />
      <GlobalSearchDialog
        open={searchOpen}
        model={session.model}
        ancestorDecisions={ancestorRecords}
        onClose={() => setSearchOpen(false)}
        onChoose={chooseHit}
        s={s}
      />
      {/* The four gestures (ADR-0012 §10): the chooser, and the confirmation
          that three of them write two scopes and cannot be undone here. */}
      <MoveRecordDialog
        target={gestures.choice?.kind === 'choosing'
          ? { id: gestures.choice.id, name: gestures.choice.name }
          : undefined}
        offers={gestures.choice?.kind === 'choosing' ? gestures.offers(gestures.choice.id) : []}
        targets={gestures.targets}
        scopeLabel={scopeLabel}
        onCancel={gestures.close}
        onMove={gestures.ask}
        busy={gestures.busy}
        s={s}
      />
      <ConfirmDialog
        open={gestures.choice?.kind === 'confirming'}
        title={gestures.choice?.kind === 'confirming'
          ? s('gesture.confirmTitle', {
            scope: scopeLabel(gestures.choice.plan.owner), name: gestures.choice.plan.name,
          })
          : ''}
        body={gestures.choice?.kind === 'confirming'
          ? s('gesture.confirmBody', { scope: scopeLabel(gestures.choice.plan.owner) })
          : ''}
        confirmLabel={s('gesture.go')}
        cancelLabel={s('common.cancel')}
        onCancel={gestures.close}
        onConfirm={gestures.confirm}
      />
      <ProjectSettingsDialog
        open={settingsOpen}
        project={project}
        scopes={scopes}
        onCancel={() => setSettingsOpen(false)}
        onSave={(settings) => { setSettingsOpen(false); applySettings(settings) }}
        s={s}
      />
    </>
  )
}

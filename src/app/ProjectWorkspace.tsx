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
import type { EditorHandle } from '../editor'
import { RendererRefused } from '../agent/renderer'
import type { RendererView } from '../agent/renderer'
import type { Language, Translate } from '../i18n'
import { groupNameOf } from '../projects/project'
import type { ProjectGroup, ProjectSnapshot } from '../projects/project'
import {
  addDays, decisionsToCommands, isDay, nextTransitionNumber, portCommands, portsOf, replacementCommands,
  shiftDays, transaction, transitionList, transitionsOf, unportCommands,
} from '../model'
import type { Command } from '../model'
import type { EditorPreferences } from '../editor'
import type { Adr } from '../decisions/adr'
import type { SearchHit } from '../search/search'
import type { WindowChrome } from '../platform/windowChrome'
import { NO_WINDOW_CHROME } from '../platform/windowChrome'
import type { HostCommand } from '../platform/hostCommands'
import type { WorkingSource } from '../platform/workingSource'
import type { AgentGateway } from '../ports/AgentGateway'
import type { ProjectHistory } from '../ports/ProjectHistory'
import { AdrPage } from '../decisions/ui/AdrPage'
import { DiskChangeNotice } from './DiskChangeNotice'
import { HistoryPage } from './history/HistoryPage'
import { SnapshotDialog } from './history/SnapshotDialog'
import { useProjectHistory } from './history/useProjectHistory'
import { ShellDialogs } from './dialogs/ShellDialogs'
import { ErrorBoundary } from './ErrorBoundary'
import { messageFor } from './messageFor'
import type { CrashControls, CrashTrail } from './ErrorBoundary'
import { GlobalSearchDialog } from '../search/ui/GlobalSearchDialog'
import { ProjectSettingsDialog } from './ProjectSettingsDialog'
import type { ProjectSettings } from './ProjectSettingsDialog'
import { renderMarkdown } from '../documentation/ui/renderMarkdown'
import { PlanPage, ReplaceDialog, RoadmapPage, planBodyTemplate } from '../roadmap'
import type { PlanActions, ReplaceAnswer, RoadmapActions } from '../roadmap'
import { imageSrcFile } from '../documentation'
import type { MarkdownRenderOptions } from '../documentation'
import { ShellToolbar } from './ShellToolbar'
import type { ToolbarAgent, ToolbarOverflow } from './ShellToolbar'
import { useDocumentSession } from './useDocumentSession'
import type { ProjectSaver } from './useDocumentSession'
import { useAgentGateway } from './useAgentGateway'
import { useDiagramActions } from './useDiagramActions'
import type { MakeId } from './useDiagramActions'
import { useFilePicker } from './useFilePicker'
import { useModelSession } from './useModelSession'
import { useProjectFiles } from './useProjectFiles'
import type { ProjectFileChannel } from './useProjectFiles'
import { useNearlyFullNotice } from './useStorageNotice'
import type { StorageNotice } from './useStorageNotice'
import type { Notify } from './useToasts'

export type ProjectWorkspaceProps = {
  project: ProjectSnapshot
  projects: ProjectSaver
  /**
   * Somebody else changed this project's files. Bound to this project's ref by
   * the caller, and absent in a browser tab, where nothing can watch.
   */
  watch?: (onChanged: () => void) => () => void
  /**
   * Menu items, the web's overflow and files the OS opened us with — the ones
   * about the project that is open. The shell above takes the ones about
   * folders and preferences; subscribing in both places is how each layer
   * handles what it owns.
   */
  commands?: (listener: (command: HostCommand) => void) => () => void
  /**
   * The menu, for a host with no menu bar. Absent on the desktop. The
   * workspace fills in the one capability it knows — whether there is a
   * history to offer — and passes the rest through.
   */
  overflow?: Omit<ToolbarOverflow, 'can'> & { can: Omit<ToolbarOverflow['can'], 'history'> }
  /** Where this project is kept, for the bar to say. */
  source?: WorkingSource
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
   * Where an agent's tool calls arrive (ADR-0007). Absent in a browser tab.
   * Bound here, to the session, because a request is answered against the
   * project that is open.
   */
  agent?: AgentGateway
  /** The glyph on the bar: the server's state, and the way to the dialog. */
  agentBar?: ToolbarAgent
  documents: ProjectFileChannel

  notify: Notify
  onStorageResult: StorageNotice
  s: Translate
  language: Language
  editorPreferences: unknown
  onEditorPreferencesChange: (next: EditorPreferences) => void

  /** Leave this project and go back to the picker. */
  onLeave: () => void
  /** The groups that exist, for the settings dialog's group picker. */
  groups: readonly ProjectGroup[]
  /** Called when the dialog opens, so the caller can refresh that list. */
  onOpenSettings: () => void
  /**
   * Apply the settings to the project as it stands, and hand back what was
   * saved so the session can take it on. Nothing comes back from a move: that
   * changes the ref, and this workspace is remounted on it.
   */
  onApplySettings: (
    settings: ProjectSettings,
    current: ProjectSnapshot,
  ) => Promise<ProjectSnapshot | undefined>
  makeId: MakeId
  /**
   * The group's own decision records, and how to write them back. They are
   * kept with the group, not with this project, so they arrive and leave as a
   * list rather than living on the model like the project's own.
   */
  groupDecisions: readonly Adr[]
  onGroupDecisionsChange: (next: Adr[]) => void
  /**
   * Who the group's drawings are made for, from its record. Absent = the
   * group's name, which is what the title block said before a group could say
   * otherwise.
   */
  groupClient?: string
  /**
   * For the boundary around the canvas. The editor is the largest thing in the
   * app and the likeliest to throw; catching it here is what keeps the toolbar,
   * the save menu and the pages beside it alive when it does.
   */
  diagnostics: CrashTrail
  hostControls: CrashControls
  /** Today as `yyyy-mm-dd`, for a decision's dates. Injected so a test can pin it. */
  today?: () => string
  /** Passed straight to the toolbar, which is the bar the window borrows. */
  windowChrome?: WindowChrome
}

function localToday(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function ProjectWorkspace({
  project, projects, watch, commands, overflow, source, onUnsavedWork, history: projectHistory,
  onSnapshotTaken, agent, agentBar, documents, notify, onStorageResult, s, language, editorPreferences, onEditorPreferencesChange,
  onLeave, groups, onOpenSettings, onApplySettings, makeId, groupDecisions, onGroupDecisionsChange,
  groupClient,
  diagnostics, hostControls, today = localToday, windowChrome,
}: ProjectWorkspaceProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const openSettings = useCallback(() => { onOpenSettings(); setSettingsOpen(true) }, [onOpenSettings])
  const session = useModelSession({ initialProject: project, notify, s })
  const diagrams = useDiagramActions({ session, notify, s, makeId })
  // A request INTO the editor carries a nonce: "show this one" asked twice is
  // two requests. Declared here because the agent's renderer view, below,
  // points with it too.
  const [focusRequest, setFocusRequest] = useState<{ id: string; nonce: number } | undefined>(undefined)
  const files = useProjectFiles({ session, documents, notify, s })

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
    onSaved: setSavedAt,
    onResult: onSaveResult,
    onPressure: nearlyFull,
    watch,
    onUnsavedWork,
    // Their version, once it has been read: straight onto the session, without
    // a relayout — a project read back from its folder carries its geometry.
    onAdopt: useCallback((held: ProjectSnapshot) => session.adopt(held, false), [session]),
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
    }
  }, [session])

  useAgentGateway(agent, useMemo(() => ({
    indexed: session.indexed,
    current: session.current,
    activeDiagramId: session.currentActiveId,
    groupDecisions: () => groupDecisions,
    blocked: () => (documentStatus === 'conflict' ? 'agent.conflict' : undefined),
    dispatch: session.dispatch,
    ids: session.ids,
    makeId,
    today,
    translate: s,
    containerName: (name: string) => s('shell.containerDiagram', { name }),
    renderer,
  }), [session, groupDecisions, documentStatus, makeId, today, s, renderer]))

  const snapshots = useProjectHistory({
    history: projectHistory,
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
    // A working file is a zip now; the JSON entries are the older versions and
    // the interchange format, both of which still open.
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
   * ignored rather than answered with a dialog that would go nowhere.
   */
  useEffect(() => commands?.((command) => {
    switch (command.type) {
      case 'save': forceSave(); break
      case 'export': files.saveWorkingFile(); break
      case 'exportInterchange': files.saveInterchange(); break
      case 'open': documentPicker.open(); break
      case 'openDocument': files.openDocument(command.name, command.bytes); break
      case 'snapshot': if (snapshots.available) snapshots.openDialog(); break
      case 'history': if (snapshots.available) snapshots.openPage(); break
    }
  }), [commands, forceSave, files, documentPicker, snapshots])

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

  /**
   * Requests INTO the editor carry a nonce, because "open the documentation"
   * asked twice is two requests and a prop that did not change is none.
   */
  const [docRequest, setDocRequest] = useState<{ elementId?: string; nonce: number } | undefined>(undefined)
  const [adrPage, setAdrPage] = useState<{ open: boolean; adrId?: string }>({ open: false })
  const [roadmapOpen, setRoadmapOpen] = useState(false)
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
  // The plan being read on its own page (ADR-0010); over the roadmap, which
  // stays open underneath so closing the plan lands back on the axis.
  const [planId, setPlanId] = useState<string | undefined>(undefined)
  // The element a replacement is being started from (ADR-0010).
  const [replacing, setReplacing] = useState<string | undefined>(undefined)
  // The clock, read once per render of the workspace rather than per component:
  // a roadmap re-deriving because a millisecond passed is a landscape re-laid.
  const todayDay = useMemo(() => today(), [today])
  const [searchOpen, setSearchOpen] = useState(false)

  const openDocumentation = useCallback((elementId?: string) => {
    if (session.current().elements.length === 0) { notify(s('shell.noElements'), 'info'); return }
    setDocRequest((prev) => ({ elementId, nonce: (prev?.nonce ?? 0) + 1 }))
  }, [session, notify, s])

  // The toolbar's pages are one at a time: opening one closes the others, so
  // the bar reads as tabs rather than stacking pages under each other.
  const openDecisions = useCallback((adrId?: string) => {
    setRoadmapOpen(false)
    setPlanId(undefined)
    setAdrPage({ open: true, adrId })
  }, [])
  const openRoadmap = useCallback(() => {
    setAdrPage({ open: false })
    setRoadmapOpen(true)
  }, [])

  const chooseHit = useCallback((hit: SearchHit) => {
    switch (hit.kind) {
      case 'element':
        setFocusRequest((prev) => ({ id: hit.elementId, nonce: (prev?.nonce ?? 0) + 1 }))
        break
      case 'documentation':
        openDocumentation(hit.elementId)
        break
      case 'adr':
        openDecisions(hit.adrId)
        break
    }
  }, [openDocumentation, openDecisions])

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
  /**
   * What the roadmap may do (ADR-0009).
   *
   * Every one of them is a command, so a plan written, moved or thrown away is
   * one undo step and one Activity line, exactly like a node dragged. The shift
   * is the only interesting one: it moves the plan's own window and the dates
   * on the elements it introduces and retires, in one transaction, because a
   * plan slipping is one thing that happened.
   */
  const roadmapActions = useMemo<RoadmapActions>(() => ({
    addTransition(title) {
      const model = session.indexed()
      const list = transitionList(model)
      const number = nextTransitionNumber(list)
      const id = makeId('tr')
      session.dispatch({
        type: 'transition.add',
        transition: {
          id, number, title, status: 'draft',
          elements: [], decisions: [], milestones: [], body: planBodyTemplate(s),
        },
      })
      setPlanId(id)
    },
    onOpenPlan(id) { setPlanId(id) },
    setAsOf(day) {
      const id = session.currentActiveId()
      if (!id) return
      session.dispatch({ type: 'diagram.update', id, patch: { asOf: day }, coalesce: `asOf:${id}` })
    },
    onOpenElement(id) {
      setRoadmapOpen(false)
      setFocusRequest((prev) => ({ id, nonce: (prev?.nonce ?? 0) + 1 }))
    },
  }), [session, makeId, s])

  /**
   * What a plan's page may do (ADR-0010). The dates on an element the plan
   * introduces or retires are written to the element, not to the plan — the
   * page is where they are set together, the element is where they live.
   */
  const planActions = useMemo<PlanActions>(() => ({
    updateTransition(id, patch) {
      session.dispatch({ type: 'transition.update', id, patch, coalesce: `plan:${id}` })
    },
    removeTransition(id) {
      session.dispatch({ type: 'transition.remove', id })
    },
    shiftTransition(id, days) {
      const model = session.indexed()
      const plan = transitionsOf(model)[id]
      if (!plan || !days) return
      const moved = shiftDays(plan, days)
      const commands: Command[] = [{ type: 'transition.update', id, patch: moved }]
      // The dates on what it introduces and retires are the elements' own, so
      // they move as element updates beside the plan rather than inside it.
      for (const one of plan.elements) {
        if (one.role === 'changes') continue
        const element = model.elements[one.elementId]
        const dates = element?.lifecycleDates
        if (!element || !dates) continue
        const shifted = Object.fromEntries(
          Object.entries(dates).map(([phase, day]) => [phase, isDay(day) ? addDays(day, days) : day]),
        )
        commands.push({ type: 'element.update', id: one.elementId, patch: { lifecycleDates: shifted } })
      }
      session.dispatch(transaction(commands))
    },
    updateElementDates(id, lifecycleDates) {
      session.dispatch({ type: 'element.update', id, patch: { lifecycleDates }, coalesce: `dates:${id}` })
    },
    // A port is read off the live model at the moment it is written, so a
    // twin drawn since — by the agent, by hand — is re-dated rather than
    // doubled. Each is one transaction: the twin and the closed original.
    port(planId, connectionId, toId, on) {
      const model = session.indexed()
      const plan = transitionsOf(model)[planId]
      const port = plan && portsOf(session.current(), plan).find((one) => one.from.id === connectionId)
      if (!port) return
      session.dispatch(transaction(portCommands(port, toId, on, () => session.ids.connection())))
    },
    portAll(planId, toId, on) {
      const model = session.indexed()
      const plan = transitionsOf(model)[planId]
      if (!plan) return
      const remaining = portsOf(session.current(), plan).filter((one) => one.on === undefined)
      if (remaining.length === 0) return
      session.dispatch(transaction(remaining.flatMap((port) => portCommands(port, toId, on, () => session.ids.connection()))))
    },
    unport(planId, connectionId) {
      const model = session.indexed()
      const plan = transitionsOf(model)[planId]
      const port = plan && portsOf(session.current(), plan).find((one) => one.from.id === connectionId)
      if (!port) return
      session.dispatch(transaction(unportCommands(port)))
    },
    onOpenElement(id) {
      setPlanId(undefined)
      setRoadmapOpen(false)
      setFocusRequest((prev) => ({ id, nonce: (prev?.nonce ?? 0) + 1 }))
    },
    onOpenDecision(adrId) {
      setPlanId(undefined)
      setRoadmapOpen(false)
      setAdrPage({ open: true, adrId })
    },
  }), [session])

  /**
   * Replace… answered (ADR-0010): the new element, the dates, the successor,
   * the tap and the plan, as one transaction — then the plan's page, because
   * the next thing to do is on it.
   */
  const startReplacement = useCallback((answer: ReplaceAnswer) => {
    const current = session.current()
    const from = current.elements.find((e) => e.id === answer.from[0]?.elementId)
    const to = answer.to
    const toName = 'name' in to ? to.name : current.elements.find((e) => e.id === to.elementId)?.name ?? ''
    const { commands, planId: id } = replacementCommands(current, {
      ...answer,
      words: {
        planTitle: s('replace.planTitle', { from: from?.name ?? '', to: toName }),
        tapLabel: s('replace.tap'),
        shadowMilestone: s('replace.shadowMilestone'),
        cutoverMilestone: s('replace.cutoverMilestone'),
        body: planBodyTemplate(s),
        owner: from?.owner,
      },
    }, {
      element: (name) => session.ids.element(name),
      connection: () => session.ids.connection(),
      transition: makeId('tr'),
    }, nextTransitionNumber(transitionList(session.indexed())))
    session.dispatch(transaction(commands))
    setReplacing(undefined)
    setPlanId(id)
  }, [session, makeId, s])

  const onProjectDecisionsChange = useCallback((next: Adr[]) => {
    const commands = decisionsToCommands(session.indexed(), next)
    if (commands.length) session.dispatch(transaction(commands))
  }, [session])

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
  }), [session.undo, session.redo, session.canUndo, session.canRedo])

  return (
    <>
      <Box ref={toolbarRef} sx={{ flex: '0 0 auto' }}>
      <ShellToolbar
        source={source}
        designName={session.model.name}
        groupName={groupNameOf(session.model)}
        savedAt={savedAt}
        status={document.state.status}
        saveFailed={saveFailed}
        language={language}
        overflow={overflow && { ...overflow, can: { ...overflow.can, history: snapshots.available } }}
        onLeave={onLeave}
        onOpenSettings={openSettings}
        onOpenDocumentation={() => openDocumentation()}
        onOpenDecisions={() => openDecisions()}
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
          diagrams={{
            onCreateContainer: diagrams.onCreateContainerDiagram,
            onCreateLayer7: diagrams.onCreateLayer7Diagram,
            onRename: diagrams.onRenameDiagram,
            onDuplicate: diagrams.onDuplicateDiagram,
            onDelete: diagrams.requestDeleteDiagram,
            onSettingsChange: diagrams.onDiagramSettingsChange,
          }}
          history={historyRequests}
          requests={{ focus: focusRequest, documentation: docRequest }}
          plans={{
            list: session.model.transitions ?? [],
            onOpen: (id) => setPlanId(id),
            onReplace: (elementId) => setReplacing(elementId),
          }}
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
            client: groupClient ?? groupNameOf(session.model),
            author: session.model.defaultAuthor,
          }}
          renderMarkdown={renderDocument}
          onAddImage={files.addImage}
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
        onClose={() => setAdrPage({ open: false })}
        model={session.model}
        groupName={groupNameOf(session.model)}
        groupDecisions={groupDecisions}
        onGroupDecisionsChange={onGroupDecisionsChange}
        onProjectDecisionsChange={onProjectDecisionsChange}
        initialAdrId={adrPage.adrId}
        s={s}
        language={language}
        makeId={makeId}
        today={today}
        renderMarkdown={renderDocument}
        onOpenElement={(elementId) => openDocumentation(elementId)}
        onOpenHistory={snapshots.available
          ? (adrId) => { setAdrPage({ open: false }); openHistoryOf({ what: 'decision', id: adrId }) }
          : undefined}
        onOpenPlan={(id) => setPlanId(id)}
        windowChrome={pageChrome}
      />
      <RoadmapPage
        open={roadmapOpen}
        model={session.model}
        today={todayDay}
        asOf={session.model.diagrams.find((d) => d.id === session.activeDiagramId)?.asOf}
        readOnly={false}
        actions={roadmapActions}
        onClose={() => setRoadmapOpen(false)}
        windowChrome={pageChrome}
      />
      <ReplaceDialog
        subject={replacing ? session.model.elements.find((e) => e.id === replacing) : undefined}
        model={session.model}
        onCancel={() => setReplacing(undefined)}
        onConfirm={startReplacement}
      />
      <PlanPage
        open={planId !== undefined}
        plan={planId ? session.model.transitions?.find((one) => one.id === planId) : undefined}
        model={session.model}
        decisions={session.model.decisions}
        today={todayDay}
        readOnly={false}
        actions={planActions}
        renderMarkdown={renderDocument}
        onClose={() => setPlanId(undefined)}
        windowChrome={pageChrome}
      />
      <GlobalSearchDialog
        open={searchOpen}
        model={session.model}
        groupDecisions={groupDecisions}
        onClose={() => setSearchOpen(false)}
        onChoose={chooseHit}
        s={s}
      />
      <ProjectSettingsDialog
        open={settingsOpen}
        project={project}
        groups={groups}
        onCancel={() => setSettingsOpen(false)}
        onSave={(settings) => { setSettingsOpen(false); applySettings(settings) }}
        s={s}
      />
    </>
  )
}

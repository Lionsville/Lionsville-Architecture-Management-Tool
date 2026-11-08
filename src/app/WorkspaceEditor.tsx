// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The editor, inside the boundary that keeps the bar and the pages alive when
 * it throws, and the laid-out views it draws in the tab.
 */
import { useCallback, useContext, useMemo } from 'react'
import type { ComponentProps, ReactElement, ReactNode } from 'react'
import Box from '@mui/material/Box'
import { SolutionDesignEditor } from '../editor'
import type { PageView } from '../editor'
import type { DesignDiagram, DiagramSettings } from '../model'
import type { DrawingView as DrawingViewShape } from './DrawingView'
import { lazyPart } from '../widgets/lazyPart'
import type { MapPage as MapPageShape } from '../business/ui/MapPage'
import type { SheetPage as SheetPageShape } from '../business/ui/SheetPage'
import type { DayGroup } from '../widgets/kit/DayControl'
import { sheetResponsibleFor } from './units/sheetResponsible'
import { sheetClaimsFor, sheetDomainsFor, takenUpHere } from './sheetMapping'
import type { SheetWaysOut } from './units/sheetResponsible'
import type { TechnologyLandscapePage as TechnologyLandscapePageShape } from '../technology/ui/TechnologyLandscapePage'
import { unitViewInspector, unitViewPage } from './units/UnitViewPages'
import { unitLanding } from './units/unitViewsHere'
import { ErrorBoundary } from './ErrorBoundary'
import { FrameStoreContext, throughGuard } from './frame/frameStore'
import { drawingViewProps, NewViewFor } from './DrawingPage'
import { foldKey } from './sessionFolds'
import { useTheme } from '@mui/material/styles'
import { shellTheme } from './theme'
import type { WorkspaceParts } from './workspaceParts'
import { hostCommands, useCommands } from '../model/technologyWrites'
import type { WrittenIn } from './units/writeIn'
import { handOver } from './handOver'
import type { StringKey } from '../i18n'
import { showOnDoor } from './pageLanding'

/**
 * A drawing is a tab, never the first view: its picture and its editor arrive
 * when one is opened (`widgets/lazyPart`), so the first download does not
 * carry them.
 */
const DrawingView = lazyPart<ComponentProps<typeof DrawingViewShape>>(
  () => import('./DrawingView').then((held) => held.DrawingView),
)

/** The sheet and its Coverage are tabs as well: their rows, panel and matrix arrive with the first one opened. */
const SheetPage = lazyPart<ComponentProps<typeof SheetPageShape>>(
  () => import('../business/ui/SheetPage').then((held) => held.SheetPage),
)
const MapPage = lazyPart<ComponentProps<typeof MapPageShape>>(
  () => import('../business/ui/MapPage').then((held) => held.MapPage),
)

/**
 * A technology landscape is a tab, as a chart is: its page, its tree of
 * platforms and its dialogs arrive when the first landscape is opened.
 */
const TechnologyLandscapePage = lazyPart<ComponentProps<typeof TechnologyLandscapePageShape>>(
  () => import('../technology/ui/TechnologyLandscapePage').then((held) => held.TechnologyLandscapePage),
)

export function WorkspaceEditor({ parts }: { parts: WorkspaceParts }) {
  const { props, session, requests, ownership, pictures, files, pickers, renderer } = parts
  const { s, language } = props.shell
  const { groupName, groupClient } = props.tree
  const seams = useEditorSeams(parts)
  const frame = useContext(FrameStoreContext)
  /** A tab is the most ordinary press on the screen, and it is asked about like every other way out. */
  const tabMove = (id: string, go: () => void) => throughGuard(frame, { page: 'board', id }, go)
  return (
    <Box sx={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <ErrorBoundary where="editor" diagnostics={props.host.diagnostics} controls={props.host.controls} s={s}>
      <SolutionDesignEditor
        key={session.editorKey}
        document={{
          model: session.model,
          activeDiagramId: session.activeDiagramId,
          // A view's tab is also the way out of a page: the view comes up, and the page goes.
          onActiveDiagramChange: (id) => tabMove(id, () => { parts.pages.closePages(); session.setActiveDiagramId(id) }),
          viewing: parts.viewing,
        }}
        editing={{ dispatch: session.dispatch, history: seams.history, ids: session.ids, readOnly: session.readOnly }}
        pages={{ render: (diagram, view) => laidOutPage(parts, diagram, view), inspector: (diagram) => unitViewInspector(parts, diagram) }}
        diagrams={diagramCalls(parts, tabMove)}
        history={seams.historyRequests}
        requests={{
          focus: requests.focus, documentation: requests.documentation, onDocumentation: requests.shownDocumentation,
          ...(requests.leftDocumentation ? { leaveDocumentation: requests.leftDocumentation } : {}),
        }}
        plans={{
          list: session.model.transitions ?? [],
          onOpen: parts.pages.plans.openPlan,
          onReplace: parts.pages.plans.startReplace,
        }}
        ownership={ownership}
        layout={{ onError: seams.onLayoutError, onSettled: session.onLayoutSettled }}
        preferences={{ initial: props.preferences.initial, onChange: props.preferences.onChange }}
        // No `onChange`: the language is chosen in the preferences dialog
        // now (ADR-0005), and the editor's contract withdraws its own NL/EN
        // toggle when the host owns the language elsewhere.
        language={{ value: language }}
        logos={{
          library: session.logoLibrary,
          onRequestUpload: pickers.logo.open,
          onExportImagesMissing: seams.onExportImagesMissing,
        }}
        // The project's answers, which a diagram's own settings override. The
        // author used to be the design's NAME, so every exported PNG said
        // AUTHOR: <project name>; it is now the project's default author,
        // which is absent until somebody sets one.
        exportTitleBlock={{
          client: groupClient ?? groupName,
          author: session.model.defaultAuthor,
        }}
        renderMarkdown={pictures.renderDocument}
        onAddImage={files.addImage}
        images={{ library: session.imageLibrary, usedBy: pictures.imageUsedBy, onRemove: files.removeImage }}
        windowChrome={parts.pageChrome}
        themeFor={seams.themeFor}
        // ⌘S does not wait: a save says how it went on the bar itself.
        onForceSave={() => { void parts.document.document.forceSave() }}
        {...(parts.props.host.showShortcuts ? { onShowShortcuts: parts.props.host.showShortcuts } : {})}
        onHandle={renderer.onEditorHandle}
      />
      </ErrorBoundary>
      <NewViewFor parts={parts} />
    </Box>
  )
}

/** What the editor is handed that the workspace keeps stable across renders. */
function useEditorSeams(parts: WorkspaceParts) {
  const { session } = parts
  const { s, notify, language } = parts.props.shell
  const hostMenu = parts.props.host.hostMenu ?? false
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

  /**
   * "History…" on a diagram's tab and on the documentation page (ADR-0008):
   * the page, opened on one thing. Absent where there is no history to open,
   * so no page offers an item that leads nowhere.
   */
  const { available: historyAvailable, openPage: openHistoryOf } = parts.snapshots
  const historyRequests = useMemo(() => (historyAvailable
    ? {
      onDiagram: (id: string) => openHistoryOf({ what: 'diagram', id }),
      onDescription: (id: string) => openHistoryOf({ what: 'description', id }),
    }
    : undefined), [historyAvailable, openHistoryOf])

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
   * The app's own theme in the other mode, for an export made in it: the
   * picture wears this palette's surfaces and accent, not MUI's defaults.
   */
  const accent = useTheme().tokens?.shades
  const themeFor = useCallback(
    (mode: 'light' | 'dark') => shellTheme(mode, language, { cssVariables: false, ...(accent ? { accent } : {}) }),
    [language, accent],
  )
  return { onExportImagesMissing, onLayoutError, historyRequests, history, themeFor }
}

/** The tab strip's calls: a board made, renamed or removed, and a view of each kind opened or made. */
function diagramCalls({ diagrams, sheets, pages, session }: WorkspaceParts, tabMove: (id: string, go: () => void) => void) {
  const opening = (open: (id: string) => void) => (id: string) => tabMove(id, () => open(id))
  return {
    onCreateContainer: diagrams.onCreateContainerDiagram,
    onCreateLayer7: diagrams.onCreateLayer7Diagram,
    onRename: diagrams.onRenameDiagram,
    onDuplicate: diagrams.onDuplicateDiagram,
    onDelete: diagrams.requestDeleteDiagram,
    onSettingsChange: diagrams.onDiagramSettingsChange,
    onOpenSheet: opening(pages.openView),
    onCreateSheet: sheets.create,
    onOpenMap: opening(pages.openView),
    onCreateMap: pages.createMap,
    onOpenTechnology: opening(pages.openTechnology),
    onCreateTechnology: pages.createTechnology,
    onOpenDrawing: opening(pages.openView),
    onCreateDrawing: pages.createDrawing,
    onNewView: pages.drawings.chooseView,
    onOpenChart: opening(pages.openView),
    onCreateChart: () => pages.createUnitView('chart'),
    onOpenConway: opening(pages.openView),
    onCreateConway: () => pages.createUnitView('conway'),
    onCreateDrawingFor: pages.createDrawingFor,
    onOpenTechnologyFor: showOnDoor('technology', session.model.diagrams, pages.openTechnologyFor),
    onOpenPlatformReport: pages.openPlatformReport,
    onOpenServiceReport: pages.openServiceReport,
  }
}

/**
 * The laid-out views, drawn in the tab (ADR-0016): the editor hands back
 * the active diagram and its own selection, and this draws the page where
 * the canvas would be. Rebuilt per render, as the editor's other props are.
 */
export function laidOutPage(parts: WorkspaceParts, diagram: DesignDiagram, view: PageView): ReactNode {
  switch (diagram.kind) {
    case 'sheet':
      return sheetPage(parts, diagram, view)
    case 'map':
      return mapPage(parts, diagram, view)
    case 'technology':
      return technologyPage(parts, diagram, view)
    case 'drawing':
      return drawingPage(parts, diagram, view)
    // The organisation chart and the Conway map (ADR-0036 §7).
    case 'chart':
    case 'conway':
      return unitViewPage(diagram.kind, parts, diagram, view)
    case 'layer7':
    case 'container':
      // A board is the canvas, drawn by the editor itself.
      return null
    default: {
      const unexpected: never = diagram.kind
      return unexpected
    }
  }
}

function sheetPage(parts: WorkspaceParts, diagram: DesignDiagram, view: PageView): ReactNode {
  const { session, sheets, ownership, readings, requests, files, renderer } = parts
  return (
    <SheetPage
      open inline
      model={session.model}
      sheet={diagram}
      readOnly={view.readOnly}
      actions={sheets.actions}
      onClose={() => {}}
      onHandle={renderer.onSheetHandle}
      ownerOf={ownership.ownerOf}
      elsewhere={readings.rowsElsewhere}
      applications={readings.applicationsInTree}
      // Who is responsible for what (ADR-0036, amended): the organisation's units, offered and named here.
      responsible={sheetResponsibleFor({
        index: parts.props.tree.index, scope: parts.props.project.path, model: session.model, day: parts.todayDay,
        scopeName: readings.scopeLabel, s: parts.props.shell.s,
        ...(ownership.unitDeletion ? { unitDeletion: ownership.unitDeletion } : {}),
        open: sheetWaysOut(parts),
      })}
      // The sheet mapped to the tree (ADR-0040 §4–§6): a function's domains, one taken up from above, and the band's reading.
      takenUp={takenUpHere(parts.props.tree.index, parts.props.project.path)}
      {...sheetMapping(parts, diagram)}
      onOpenDocumentation={(id) => requests.openDocumentation(id, diagram.id)}
      onSave={files.savePicture}
      onPrint={files.printPage}
      addImage={files.addImage}
      {...(view.readOnly ? {} : { poster: parts.sheets.poster })}
      scopeName={parts.readings.scopeLabel(parts.props.project.path)}
      select={parts.pages.selectRequestFor(diagram.id)}
      // The rail's *All units* and the units kept on it, for the session and per view (ADR-0036, amended 12 October 2026).
      remember={foldKey(parts.props.project.path, diagram.id, 'rail')}
      notify={parts.props.shell.notify}
      {...businessReading(parts)}
      {...(coverageWay(parts, view) ? { onCoverage: coverageWay(parts, view) } : {})}
    />
  )
}

/** What the sheet and its Coverage both read: the organisation's scales, the plans' days, today and what a row names. */
function businessReading(parts: WorkspaceParts) {
  const { session, readings, todayDay } = parts
  const scales = parts.props.tree.index.operatingModel().aspectScales
  return {
    describe: readings.describeForMap,
    today: todayDay,
    days: planDays(session.model),
    ...(scales ? { scales } : {}),
  }
}

/** The days worth looking at: where each plan with a day ends. */
function planDays(model: { transitions?: readonly { title: string; to?: string }[] }): readonly DayGroup[] {
  const days = (model.transitions ?? []).flatMap((plan) => (plan.to !== undefined ? [{ day: plan.to, label: plan.title }] : []))
  return days.length > 0 ? [{ days }] : []
}

/**
 * The way from the sheet to its Coverage: this scope's map, or one made on first
 * use where the person may. A reader in a scope with no map has nowhere to go, and
 * the switch then does not offer it.
 */
function coverageWay(parts: WorkspaceParts, view: PageView): (() => void) | undefined {
  const { session, pages } = parts
  const first = session.model.diagrams.find((diagram) => diagram.kind === 'map')
  if (first) return () => pages.openView(first.id)
  return view.readOnly ? undefined : pages.createMap
}

/** *Domains* and *From above…* on the open scope's sheet, over the index, as one step in its session. */
function sheetMapping(parts: WorkspaceParts, diagram: DesignDiagram) {
  const { session, readings } = parts
  const at = {
    index: parts.props.tree.index, scope: parts.props.project.path, model: session.model,
    scopeName: readings.scopeLabel, s: parts.props.shell.s,
  }
  const claims = sheetClaimsFor({
    ...at,
    current: () => {
      const model = session.current()
      return { model, sheet: model.diagrams.find((held) => held.id === diagram.id) }
    },
    dispatch: (command) => session.dispatch(command),
    notify: parts.props.shell.notify,
  })
  return {
    domains: sheetDomainsFor({ ...at, openScope: parts.props.navigation.onGoHome }),
    ...(claims ? { claims } : {}),
  }
}

/**
 * Where a function's label on the sheet leads (ADR-0036, amended 13 October
 * 2026): a scope's home, as a crumb goes there; a unit where it is kept, on
 * that scope's chart where it has one, as a link to an element lands — here,
 * through the open scope's own pages, or elsewhere by opening that scope.
 */
function sheetWaysOut(parts: WorkspaceParts): SheetWaysOut {
  const { navigation, project } = parts.props
  return {
    home: navigation.onGoHome,
    unit: (keptIn, unitId) => {
      const to = { page: 'element' as const, id: unitId }
      if (keptIn === project.path) parts.show({ ...to, ...unitLanding(parts.session.current(), to), scope: keptIn })
      else navigation.onOpenScope?.(keptIn, to)
    },
  }
}

function mapPage(parts: WorkspaceParts, diagram: DesignDiagram, view: PageView): ReactNode {
  const { session, sheets, ownership, readings, requests, renderer, todayDay, pages, diagrams, files } = parts
  const { project, navigation } = parts.props
  const sheet = session.model.diagrams.find((held) => held.kind === 'sheet')
  const domains = sheetMapping(parts, diagram).domains
  const maps = session.model.diagrams.filter((held) => held.kind === 'map')
  return (
    <MapPage
      open inline
      model={session.model}
      map={diagram}
      readOnly={view.readOnly}
      actions={sheets.actions}
      onClose={() => {}}
      onHandle={renderer.onSheetHandle}
      ownerOf={ownership.ownerOf}
      elsewhere={readings.rowsElsewhere}
      applications={readings.applicationsInTree}
      onOpenDocumentation={(id) => requests.openDocumentation(id, diagram.id)}
      select={pages.selectRequestFor(diagram.id)}
      onSave={files.savePicture}
      responsible={sheetResponsibleFor({
        index: parts.props.tree.index, scope: project.path, model: session.model, day: todayDay,
        scopeName: readings.scopeLabel, s: parts.props.shell.s,
        ...(ownership.unitDeletion ? { unitDeletion: ownership.unitDeletion } : {}),
        open: sheetWaysOut(parts),
      })}
      domains={domains}
      {...businessReading(parts)}
      maps={maps.map((held) => ({ id: held.id, name: held.name, here: held.id === diagram.id }))}
      onOpenMap={pages.openView}
      {...(sheet ? { onSheet: () => pages.openView(sheet.id) } : !view.readOnly ? { onSheet: sheets.create } : {})}
      {...(!view.readOnly ? {
        onCreateMap: pages.createMap,
        onRename: (name: string) => diagrams.onRenameDiagram(diagram.id, name),
        onDelete: () => diagrams.requestDeleteDiagram(diagram.id),
        onUpdate: (patch) => {
          // A title block is a view's settings, and what it draws and its day are its own fields.
          if (patch.areas !== undefined || 'asOf' in patch) session.dispatch({ type: 'diagram.update', id: diagram.id, patch })
          else diagrams.onDiagramSettingsChange(diagram.id, { ...settingsOf(diagram), ...patch })
        },
      } : {})}
      onOpenApplication={(id) => {
        const keptIn = parts.props.tree.index.lookup(id)?.master
        if (keptIn !== undefined && keptIn !== project.path) navigation.onOpenScope?.(keptIn, { page: 'element', id })
        else sheets.actions.onOpenElement(id)
      }}
      onUndo={session.undo}
    />
  )
}

/**
 * A use or a hosting said on the landscape is a row of the scope that keeps
 * the application (ADR-0012 §7): this scope's through the editor, so it is on
 * this scope's undo, and another's as that scope's step under its rights. A row
 * an earlier build wrote here about somebody else's application is taken off
 * here as well, or it would go on being read.
 */
function technologyWrites(parts: WorkspaceParts, view: PageView) {
  const { session, ownership, unitWrites } = parts
  const here = parts.props.project.path
  const masterOf = (id: string) => parts.readings.masterOf(id)
  const rowId = () => session.ids.connection()
  const usesHere = (app: string) => session.model.relations.filter((row) => row.type === 'uses' && row.sourceId === app).map((row) => row.targetId)
  const refusal = (written: WrittenIn) => (written.ok || written.reason === 'unchanged' ? undefined : parts.props.shell.s(written.reason as StringKey))
  return {
    onSetUse: async (app: string, target: string, on: boolean) => {
      const master = masterOf(app)
      if (master === undefined || master === here) {
        const before = usesHere(app)
        view.onUse(app, on ? [...before, target] : before.filter((one) => one !== target))
        return undefined
      }
      if (!on && usesHere(app).includes(target)) view.onUse(app, usesHere(app).filter((one) => one !== target))
      const standIn = ownership.technology?.standInFor(target)
      return refusal(await unitWrites.writeIn(master, (held) => useCommands(held.model, { rowId, ...(standIn ? { standIn } : {}) }, app, target, on)))
    },
    onSetHost: async (app: string, platform: string | undefined) => {
      const master = masterOf(app)
      if (master === undefined || master === here) {
        if (platform !== undefined) view.onHost(app, platform)
        else {
          const row = session.model.relations.find((one) => one.type === 'hostedOn' && one.sourceId === app)
          if (row) session.dispatch({ type: 'relation.delete', id: row.id })
        }
        return undefined
      }
      const standIn = platform !== undefined ? ownership.technology?.standInFor(platform) : undefined
      return refusal(await unitWrites.writeIn(master, (held) => hostCommands(held.model, { rowId, ...(standIn ? { standIn } : {}) }, app, platform)))
    },
  }
}

/** Keep the picture where a person says, and say so once it is kept; a failure is said, and goes on the trail. */
function saveLandscapePicture(parts: WorkspaceParts, name: string, png: Uint8Array) {
  const { files: { documents }, shell: { notify, s }, host: { diagnostics } } = parts.props
  void handOver(() => documents.save({ name, mediaType: 'image/png', bytes: png }), {
    saved: () => notify(s('shell.savedPicture'), 'success'),
    failed: (cause) => {
      diagnostics.report({ level: 'error', where: 'landscapeExport', message: 'shell.saveFileFailed', cause })
      notify(s('shell.saveFileFailed', { message: cause instanceof Error ? cause.message : String(cause) }), 'error')
    },
  })
}

/** The settings a view has now, for one to change: the rest stay as they are. */
function settingsOf(diagram: DesignDiagram): DiagramSettings {
  const { name, author, client, documentDate, showTitleBlock, aspectConfig, showAspects } = diagram
  return {
    name, ...(author !== undefined ? { author } : {}), ...(client !== undefined ? { client } : {}),
    ...(documentDate !== undefined ? { documentDate } : {}), ...(showTitleBlock !== undefined ? { showTitleBlock } : {}),
    ...(aspectConfig !== undefined ? { aspectConfig } : {}), ...(showAspects !== undefined ? { showAspects } : {}),
  }
}

function technologyPage(parts: WorkspaceParts, diagram: DesignDiagram, view: PageView): ReactNode {
  const { session, ownership, readings, renderer, landscapes, pages } = parts
  const here = parts.props.project.path
  const held = (id: string) => session.model.elements.some((one) => one.id === id)
  const container = (id: string) => session.model.diagrams.find((one) => one.kind === 'container' && one.applicationElementId === id)
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
      {...technologyWrites(parts, view)}
      onBring={(id) => {
        const standIn = ownership.technology?.standInFor(id)
        if (standIn) session.dispatch({ type: 'element.create', element: standIn })
      }}
      {...(ownership.technology ? { technologyElsewhere: ownership.technology.elsewhere } : {})}
      {...(view.record !== undefined ? { record: view.record } : {})}
      {...(view.onDay ? { onDay: view.onDay } : {})}
      {...(view.ownerText ? { ownerText: view.ownerText } : {})}
      onExport={(name, png) => saveLandscapePicture(parts, name, png)}
      today={parts.todayDay}
      {...(diagram.colourBy !== undefined ? { kept: diagram.colourBy } : {})}
      onKeepColour={(colour) => session.dispatch({ type: 'diagram.update', id: diagram.id, patch: { colourBy: colour } })}
      onOpenElsewhere={(id) => {
        const master = parts.readings.masterOf(id)
        if (master !== undefined) parts.show({ scope: master, page: 'element', id })
      }}
      hasContainers={(id) => container(id) !== undefined || (!held(id) && parts.readings.masterOf(id) !== undefined)}
      onOpenContainers={(id) => {
        const own = container(id)
        if (own) { parts.show({ scope: here, page: 'board', id: own.id }); return true }
        const master = parts.readings.masterOf(id)
        if (held(id) || master === undefined) return false
        parts.show({ scope: master, page: 'element', id })
        return true
      }}
      notify={parts.props.shell.notify}
      onClose={() => {}}
      onHandle={renderer.onSheetHandle}
      elsewhere={readings.rowsThrough}
      sharedElsewhere={readings.sharedElsewhere}
      describe={readings.describeForMap}
      tree={ownership.platformTree}
      onOpenServiceReport={pages.openServiceReport}
      onOpenPlatformReport={pages.openPlatformReport}
    />
  )
}

/**
 * A drawing's page, keyed by the drawing: one drawing per mount, so an editor
 * open on one drawing's tab is gone when another drawing's tab is up, and its
 * next save cannot write into that one.
 */
export function drawingPage(
  parts: Pick<WorkspaceParts, 'props' | 'session' | 'show'> & Partial<Pick<WorkspaceParts, 'pages'>>,
  diagram: DesignDiagram,
  view: Pick<PageView, 'readOnly'>,
): ReactElement {
  return <DrawingView key={diagram.id} {...drawingViewProps(parts, diagram, view)} />
}


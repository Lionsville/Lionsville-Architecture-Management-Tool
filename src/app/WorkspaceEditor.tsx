// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The editor, inside the boundary that keeps the bar and the pages alive when
 * it throws, and the laid-out views it draws in the tab.
 */
import { useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import { SolutionDesignEditor } from '../editor'
import type { PageView } from '../editor'
import type { DesignDiagram } from '../model'
import { MapPage, SheetPage } from '../business'
import { TechnologyLandscapePage } from '../technology'
import { ErrorBoundary } from './ErrorBoundary'
import type { WorkspaceParts } from './workspaceParts'

export function WorkspaceEditor({ parts }: { parts: WorkspaceParts }) {
  const { props, session, requests, ownership, pictures, files, pickers, renderer } = parts
  const { s, language } = props.shell
  const { groupName, groupClient } = props.tree
  const seams = useEditorSeams(parts)
  return (
    <Box sx={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <ErrorBoundary where="editor" diagnostics={props.host.diagnostics} controls={props.host.controls} s={s}>
      <SolutionDesignEditor
        key={session.editorKey}
        document={{
          model: session.model,
          activeDiagramId: session.activeDiagramId,
          onActiveDiagramChange: session.setActiveDiagramId,
          viewing: parts.viewing,
        }}
        editing={{ dispatch: session.dispatch, history: seams.history, ids: session.ids, readOnly: session.readOnly }}
        pages={{ render: (diagram, view) => laidOutPage(parts, diagram, view) }}
        diagrams={diagramCalls(parts)}
        history={seams.historyRequests}
        requests={{ focus: requests.focus, documentation: requests.documentation }}
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
        // ⌘S does not wait: a save says how it went on the bar itself.
        onForceSave={() => { void parts.document.document.forceSave() }}
        onHandle={renderer.onEditorHandle}
      />
      </ErrorBoundary>
    </Box>
  )
}

/** What the editor is handed that the workspace keeps stable across renders. */
function useEditorSeams(parts: WorkspaceParts) {
  const { session } = parts
  const { s, notify } = parts.props.shell
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
  return { onExportImagesMissing, onLayoutError, historyRequests, history }
}

/** The tab strip's calls: a board made, renamed or removed, and a view of each kind opened or made. */
function diagramCalls({ diagrams, sheets, pages }: WorkspaceParts) {
  return {
    onCreateContainer: diagrams.onCreateContainerDiagram,
    onCreateLayer7: diagrams.onCreateLayer7Diagram,
    onRename: diagrams.onRenameDiagram,
    onDuplicate: diagrams.onDuplicateDiagram,
    onDelete: diagrams.requestDeleteDiagram,
    onSettingsChange: diagrams.onDiagramSettingsChange,
    onOpenSheet: pages.openView,
    onCreateSheet: sheets.create,
    onOpenMap: pages.openView,
    onCreateMap: pages.createMap,
    onOpenTechnology: pages.openTechnology,
    onCreateTechnology: pages.createTechnology,
    onOpenTechnologyFor: pages.openTechnologyFor,
    onOpenPlatformReport: pages.openPlatformReport,
    onOpenServiceReport: pages.openServiceReport,
  }
}

/**
 * The laid-out views, drawn in the tab (ADR-0016): the editor hands back
 * the active diagram and its own selection, and this draws the page where
 * the canvas would be. Rebuilt per render, as the editor's other props are.
 */
function laidOutPage(parts: WorkspaceParts, diagram: DesignDiagram, view: PageView): ReactNode {
  if (diagram.kind === 'sheet') return sheetPage(parts, diagram, view)
  if (diagram.kind === 'map') return mapPage(parts, diagram, view)
  if (diagram.kind === 'technology') return technologyPage(parts, diagram, view)
  return null
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
      onOpenDocumentation={(id) => requests.openDocumentation(id, diagram.id)}
      onSave={files.savePicture}
    />
  )
}

function mapPage(parts: WorkspaceParts, diagram: DesignDiagram, view: PageView): ReactNode {
  const { session, sheets, ownership, readings, requests, renderer, todayDay } = parts
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
      describe={readings.describeForMap}
      today={todayDay}
      applications={readings.applicationsInTree}
      onOpenDocumentation={(id) => requests.openDocumentation(id, diagram.id)}
    />
  )
}

function technologyPage(parts: WorkspaceParts, diagram: DesignDiagram, view: PageView): ReactNode {
  const { session, ownership, readings, requests, renderer, landscapes, pages } = parts
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
      notify={parts.props.shell.notify}
      onClose={() => {}}
      onHandle={renderer.onSheetHandle}
      elsewhere={readings.rowsThrough}
      sharedElsewhere={readings.sharedElsewhere}
      describe={readings.describeForMap}
      tree={ownership.platformTree}
      onOpenDocumentation={(id) => requests.openDocumentation(id, diagram.id)}
      onOpenServiceReport={pages.openServiceReport}
      onOpenPlatformReport={pages.openPlatformReport}
    />
  )
}

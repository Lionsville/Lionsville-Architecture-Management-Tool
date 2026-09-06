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
import { useCallback, useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import { SolutionDesignEditor } from '../editor'
import type { Language, Translate } from '../i18n'
import { groupNameOf } from '../projects/project'
import type { ProjectGroup, ProjectSnapshot } from '../projects/project'
import { decisionsToCommands, transaction } from '../model'
import type { EditorPreferences } from '../editor'
import type { Adr } from '../decisions/adr'
import type { ThemeMode } from '../projects/preferences'
import type { SearchHit } from '../search/search'
import type { WindowChrome } from '../platform/windowChrome'
import type { HostCommand } from '../platform/hostCommands'
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
import { ShellToolbar } from './ShellToolbar'
import { useDocumentSession } from './useDocumentSession'
import type { ProjectSaver } from './useDocumentSession'
import { useDiagramActions } from './useDiagramActions'
import type { MakeId } from './useDiagramActions'
import { useFilePicker } from './useFilePicker'
import { useModelSession } from './useModelSession'
import { useProjectFiles } from './useProjectFiles'
import type { ProjectFileChannel } from './useProjectFiles'
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
   * Menu items and files the OS opened us with — the ones about the project
   * that is open. The shell above takes the ones about folders; subscribing in
   * both places is how each layer handles what it owns.
   */
  commands?: (listener: (command: HostCommand) => void) => () => void
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
  documents: ProjectFileChannel

  notify: Notify
  onStorageResult: StorageNotice
  s: Translate
  language: Language
  themeMode: ThemeMode
  onCycleTheme: () => void
  onChooseLanguage: (language: Language) => void
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
  project, projects, watch, commands, onUnsavedWork, history: projectHistory, documents, notify,
  onStorageResult, s, language, themeMode,
  onCycleTheme, onChooseLanguage, editorPreferences, onEditorPreferencesChange,
  onLeave, groups, onOpenSettings, onApplySettings, makeId, groupDecisions, onGroupDecisionsChange,
  diagnostics, hostControls, today = localToday, windowChrome,
}: ProjectWorkspaceProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const openSettings = useCallback(() => { onOpenSettings(); setSettingsOpen(true) }, [onOpenSettings])
  const session = useModelSession({ initialProject: project, notify, s })
  const diagrams = useDiagramActions({ session, notify, s, makeId })
  const files = useProjectFiles({ session, documents, notify, s })

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
  const document = useDocumentSession({
    session,
    projects,
    onSaved: setSavedAt,
    onResult: onSaveResult,
    watch,
    onUnsavedWork,
    // Their version, once it has been read: straight onto the session, without
    // a relayout — a project read back from its folder carries its geometry.
    onAdopt: useCallback((held: ProjectSnapshot) => session.adopt(held, false), [session]),
  })
  const forceSave = document.forceSave

  const snapshots = useProjectHistory({
    history: projectHistory,
    project: session.snapshot,
    steps: session.history,
    save: forceSave,
    notify,
    s,
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
   * What the File menu asks for, and what the OS opens us with.
   *
   * Everything here is something the toolbar can already do; the menu is a
   * second way to reach it, which is what a menu is for. It is deliberately
   * not a switch over every command — the ones this workspace does not own
   * fall through to whoever does.
   */
  useEffect(() => commands?.((command) => {
    switch (command.type) {
      case 'save': forceSave(); break
      case 'export': files.saveWorkingFile(); break
      case 'open': documentPicker.open(); break
      case 'openDocument': files.openDocument(command.name, command.bytes); break
    }
  }), [commands, forceSave, files, documentPicker])

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
  const [focusRequest, setFocusRequest] = useState<{ id: string; nonce: number } | undefined>(undefined)
  const [adrPage, setAdrPage] = useState<{ open: boolean; adrId?: string }>({ open: false })
  const [searchOpen, setSearchOpen] = useState(false)

  const openDocumentation = useCallback((elementId?: string) => {
    if (session.current().elements.length === 0) { notify(s('shell.noElements'), 'info'); return }
    setDocRequest((prev) => ({ elementId, nonce: (prev?.nonce ?? 0) + 1 }))
  }, [session, notify, s])

  const openDecisions = useCallback((adrId?: string) => setAdrPage({ open: true, adrId }), [])

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
  const onProjectDecisionsChange = useCallback((next: Adr[]) => {
    const commands = decisionsToCommands(session.indexed(), next)
    if (commands.length) session.dispatch(transaction(commands))
  }, [session])

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
      <ShellToolbar
        designName={session.model.name}
        groupName={groupNameOf(session.model)}
        savedAt={savedAt}
        status={document.state.status}
        saveFailed={saveFailed}
        language={language}
        themeMode={themeMode}
        onCycleTheme={onCycleTheme}
        onSaveWorkingFile={files.saveWorkingFile}
        onSaveInterchange={files.saveInterchange}
        onSnapshot={snapshots.available ? snapshots.openDialog : undefined}
        onOpenHistory={snapshots.available ? snapshots.openPage : undefined}
        onOpenFile={documentPicker.open}
        onLeave={onLeave}
        onOpenSettings={openSettings}
        onOpenDocumentation={() => openDocumentation()}
        onOpenDecisions={() => openDecisions()}
        onOpenSearch={() => setSearchOpen(true)}
        activity={session.history}
        s={s}
        windowChrome={windowChrome}
      />
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
          requests={{ focus: focusRequest, documentation: docRequest }}
          layout={{ onError: onLayoutError, onSettled: session.onLayoutSettled }}
          preferences={{ initial: editorPreferences, onChange: onEditorPreferencesChange }}
          language={{ value: language, onChange: onChooseLanguage }}
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
            client: groupNameOf(session.model),
            author: session.model.defaultAuthor,
          }}
          renderMarkdown={renderMarkdown}
          windowChrome={windowChrome}
          onForceSave={forceSave}
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
        language={language}
        s={s}
        windowChrome={windowChrome}
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
        renderMarkdown={renderMarkdown}
        onOpenElement={(elementId) => openDocumentation(elementId)}
        windowChrome={windowChrome}
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

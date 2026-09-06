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
import { useCallback, useEffect, useState } from 'react'
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
import { AdrPage } from '../decisions/ui/AdrPage'
import { ShellDialogs } from './dialogs/ShellDialogs'
import { ErrorBoundary } from './ErrorBoundary'
import { messageFor } from './messageFor'
import type { CrashControls, CrashTrail } from './ErrorBoundary'
import { GlobalSearchDialog } from '../search/ui/GlobalSearchDialog'
import { ProjectSettingsDialog } from './ProjectSettingsDialog'
import type { ProjectSettings } from './ProjectSettingsDialog'
import { renderMarkdown } from '../documentation/ui/renderMarkdown'
import { ShellToolbar } from './ShellToolbar'
import { useAutosave } from './useAutosave'
import type { ProjectSaver } from './useAutosave'
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
  project, projects, documents, notify, onStorageResult, s, language, themeMode,
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
  const { forceSave } = useAutosave({
    session, projects, onSaved: setSavedAt, onResult: onSaveResult,
  })

  const documentPicker = useFilePicker({
    accept: '.lvarch,.json,application/json', onPick: files.openFile, testId: 'document-input',
  })
  // No button in the toolbar for this one: the place you ask for a mark is the
  // icon picker itself, inside the editor.
  const logoPicker = useFilePicker({
    accept: 'image/svg+xml,image/png', onPick: files.addLogo, testId: 'logo-input',
  })

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
    session.flush()
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
    session.flush()
    const commands = decisionsToCommands(session.indexed(), next)
    if (commands.length) session.dispatch(transaction(commands))
  }, [session])

  return (
    <>
      <ShellToolbar
        designName={session.model.name}
        groupName={groupNameOf(session.model)}
        savedAt={savedAt}
        saveFailed={saveFailed}
        language={language}
        themeMode={themeMode}
        onCycleTheme={onCycleTheme}
        onSaveWorkingFile={files.saveWorkingFile}
        onSaveInterchange={files.saveInterchange}
        onOpenFile={documentPicker.open}
        onLeave={onLeave}
        onOpenSettings={openSettings}
        onOpenDocumentation={() => openDocumentation()}
        onOpenDecisions={() => openDecisions()}
        onOpenSearch={() => setSearchOpen(true)}
        s={s}
        windowChrome={windowChrome}
      />
      {documentPicker.input}
      {logoPicker.input}

      <Box sx={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <ErrorBoundary where="editor" diagnostics={diagnostics} controls={hostControls} s={s}>
        <SolutionDesignEditor
          key={session.editorKey}
          model={session.model}
          activeDiagramId={session.activeDiagramId}
          onActiveDiagramChange={session.setActiveDiagramId}
          onChange={session.onChange}
          onCreateContainerDiagram={diagrams.onCreateContainerDiagram}
          onCreateLayer7Diagram={diagrams.onCreateLayer7Diagram}
          // The project's answers, which a diagram's own settings override. The
          // author used to be the design's NAME, so every exported PNG said
          // AUTHOR: <project name>; it is now the project's default author,
          // which is absent until somebody sets one.
          exportTitleBlock={{
            client: groupNameOf(session.model),
            author: session.model.defaultAuthor,
          }}
          layoutOnOpenDiagramIds={session.sessionLayoutIds}
          onLayoutSettled={session.onLayoutSettled}
          onForceSave={forceSave}
          idAliases={session.aliasProp}
          logoLibrary={session.logoLibrary}
          onRequestLogoUpload={logoPicker.open}
          onExportImagesMissing={onExportImagesMissing}
          onLayoutError={onLayoutError}
          renderMarkdown={renderMarkdown}
          windowChrome={windowChrome}
          onRenameDiagram={diagrams.onRenameDiagram}
          onDiagramSettingsChange={diagrams.onDiagramSettingsChange}
          onDuplicateDiagram={diagrams.onDuplicateDiagram}
          onDeleteDiagram={diagrams.requestDeleteDiagram}
          initialPreferences={editorPreferences}
          onPreferencesChange={onEditorPreferencesChange}
          historyResetToken={session.historyToken}
          rebaseToken={session.rebaseToken}
          onUndo={session.undo}
          onRedo={session.redo}
          canUndo={session.canUndo}
          canRedo={session.canRedo}
          language={language}
          onLanguageChange={onChooseLanguage}
          focusElement={focusRequest}
          documentationRequest={docRequest}
        />
        </ErrorBoundary>
      </Box>

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

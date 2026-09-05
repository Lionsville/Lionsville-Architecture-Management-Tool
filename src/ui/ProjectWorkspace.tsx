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
import { useCallback, useState } from 'react'
import Box from '@mui/material/Box'
import { SolutionDesignEditor } from '@lionsville/solution-design'
import type { Language, Translate } from '@lionsville/solution-design'
import { groupNameOf } from '../core/project'
import type { ProjectGroup, ProjectSnapshot } from '../core/project'
import type { EditorPreferences } from '@lionsville/solution-design'
import type { ThemeMode } from '../core/preferences'
import type { WindowChrome } from '../core/windowChrome'
import { ShellDialogs } from './dialogs/ShellDialogs'
import { ProjectSettingsDialog } from './ProjectSettingsDialog'
import type { ProjectSettings } from './ProjectSettingsDialog'
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
  onApplySettings: (settings: ProjectSettings) => void
  makeId: MakeId
  /** Passed straight to the toolbar, which is the bar the window borrows. */
  windowChrome?: WindowChrome
}

export function ProjectWorkspace({
  project, projects, documents, notify, onStorageResult, s, language, themeMode,
  onCycleTheme, onChooseLanguage, editorPreferences, onEditorPreferencesChange,
  onLeave, groups, onOpenSettings, onApplySettings, makeId, windowChrome,
}: ProjectWorkspaceProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const openSettings = useCallback(() => { onOpenSettings(); setSettingsOpen(true) }, [onOpenSettings])
  const session = useModelSession({ initialProject: project, notify, s })
  const diagrams = useDiagramActions({ session, notify, s, makeId })
  const files = useProjectFiles({ session, documents, notify, s })

  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const { forceSave } = useAutosave({
    session, projects, onSaved: setSavedAt, onResult: onStorageResult,
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

  return (
    <>
      <ShellToolbar
        designName={session.model.name}
        groupName={groupNameOf(session.model)}
        savedAt={savedAt}
        language={language}
        themeMode={themeMode}
        onCycleTheme={onCycleTheme}
        onSaveWorkingFile={files.saveWorkingFile}
        onSaveInterchange={files.saveInterchange}
        onOpenFile={documentPicker.open}
        onLeave={onLeave}
        onOpenSettings={openSettings}
        s={s}
        windowChrome={windowChrome}
      />
      {documentPicker.input}
      {logoPicker.input}

      <Box sx={{ flex: '1 1 auto', minHeight: 0 }}>
        <SolutionDesignEditor
          key={session.editorKey}
          model={session.model}
          activeDiagramId={session.activeDiagramId}
          onActiveDiagramChange={session.setActiveDiagramId}
          onChange={session.onChange}
          onCreateContainerDiagram={diagrams.onCreateContainerDiagram}
          onCreateLayer7Diagram={diagrams.onCreateLayer7Diagram}
          parameterSpecs={() => []}
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
          onRenameDiagram={diagrams.onRenameDiagram}
          onDiagramSettingsChange={diagrams.onDiagramSettingsChange}
          onDuplicateDiagram={diagrams.onDuplicateDiagram}
          onDeleteDiagram={diagrams.requestDeleteDiagram}
          initialPreferences={editorPreferences}
          onPreferencesChange={onEditorPreferencesChange}
          historyResetToken={session.historyToken}
          language={language}
          onLanguageChange={onChooseLanguage}
        />
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
      <ProjectSettingsDialog
        open={settingsOpen}
        project={project}
        groups={groups}
        onCancel={() => setSettingsOpen(false)}
        onSave={(settings) => { setSettingsOpen(false); onApplySettings(settings) }}
        s={s}
      />
    </>
  )
}

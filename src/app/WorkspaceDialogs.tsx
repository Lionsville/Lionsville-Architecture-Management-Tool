// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The workspace's dialogs: the folder's snapshots and history, the board
 * dialogs, the choosers, the wider search, the four gestures and the scope's
 * settings.
 */
import { useCallback, useEffect, useState } from 'react'
import { ConfirmDialog } from '../widgets/ConfirmDialog'
import { GlobalSearchDialog } from '../search/ui/GlobalSearchDialog'
import type { SearchHit } from '../search/search'
import type { ScopeSnapshot } from '../projects/scope'
import { HistoryPage } from './history/HistoryPage'
import { SnapshotDialog } from './history/SnapshotDialog'
import { AddFromLibraryDialog } from './dialogs/AddFromLibraryDialog'
import { ChooseBoardDialog } from './dialogs/ChooseBoardDialog'
import { MoveRecordDialog } from './dialogs/MoveRecordDialog'
import { ShellDialogs } from './dialogs/ShellDialogs'
import { messageFor } from './messageFor'
import { ProjectSettingsDialog } from './ProjectSettingsDialog'
import type { ProjectSettings } from './ProjectSettingsDialog'
import type { ModelSession } from './useModelSession'
import type { WorkspaceParts } from './workspaceParts'
import type { WorkspaceHost, WorkspaceSettings, WorkspaceShell } from './workspaceProps'

export type WorkspaceDialogState = ReturnType<typeof useWorkspaceDialogs>

/**
 * The two dialogs the workspace opens itself — the scope's settings and the
 * wider search — and what their answers do.
 */
export function useWorkspaceDialogs(deps: {
  session: ModelSession
  settings: WorkspaceSettings
  diagnostics: WorkspaceHost['diagnostics']
  notify: WorkspaceShell['notify']
  s: WorkspaceShell['s']
  focusElement: (id: string) => void
  openDocumentation: (elementId?: string) => void
  openDecisions: (adrId?: string) => void
}) {
  const { session, diagnostics, notify, s, focusElement, openDocumentation, openDecisions } = deps
  const { onOpen: onOpenSettings, onApply: onApplySettings } = deps.settings
  const [settingsOpen, setSettingsOpen] = useState(false)
  const openSettings = useCallback(() => { onOpenSettings(); setSettingsOpen(true) }, [onOpenSettings])
  const [searchOpen, setSearchOpen] = useState(false)

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
      (saved: ScopeSnapshot | undefined) => { if (saved) session.adopt(saved, false) },
      // The caller reports what it could; this is the case where the promise
      // itself broke, which nothing above would otherwise hear about.
      (cause: unknown) => {
        diagnostics.report({ level: 'error', where: 'applySettings', message: 'rejected', cause })
        notify(messageFor(cause, s), 'error')
      },
    )
  }, [session, onApplySettings, diagnostics, notify, s])

  return { settingsOpen, setSettingsOpen, openSettings, searchOpen, setSearchOpen, chooseHit, applySettings }
}

/** The folder's snapshot and history (ADR-0008), and the board dialogs the shell draws. */
export function HistoryDialogs({ parts }: { parts: WorkspaceParts }) {
  const { props, session, snapshots, diagrams, readings, pageChrome } = parts
  const { s, language } = props.shell
  return (
    <>
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
        scopes={snapshots.places.map((place) => readings.scopeLabel(place.path))}
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
    </>
  )
}

/** The choosers, the wider search, the gestures and the settings, after the pages. */
export function WorkspaceDialogs({ parts }: { parts: WorkspaceParts }) {
  const { props, session, showElement, library, readings, dialogs, ancestorRecords } = parts
  const { s } = props.shell
  return (
    <>
      <ChooseBoardDialog
        choice={showElement.choice}
        onChoose={showElement.choose}
        onCancel={showElement.dismiss}
        s={s}
      />
      <AddFromLibraryDialog
        choice={library.choice}
        scopeLabel={readings.scopeLabel}
        onPick={library.pick}
        onOwn={library.own}
        onDrawOnly={library.drawOnly}
        onPlace={library.place}
        onCancel={library.close}
        s={s}
      />
      <GlobalSearchDialog
        open={dialogs.searchOpen}
        model={session.model}
        ancestorDecisions={ancestorRecords}
        onClose={() => dialogs.setSearchOpen(false)}
        onChoose={dialogs.chooseHit}
        s={s}
      />
      <GestureDialogs parts={parts} />
      <ProjectSettingsDialog
        open={dialogs.settingsOpen}
        project={props.project}
        scopes={props.tree.scopes}
        onCancel={() => dialogs.setSettingsOpen(false)}
        onSave={(settings) => { dialogs.setSettingsOpen(false); dialogs.applySettings(settings) }}
        s={s}
      />
    </>
  )
}

/**
 * The four gestures (ADR-0012 §10): the chooser, and the confirmation that
 * three of them write two scopes and cannot be undone here.
 */
function GestureDialogs({ parts }: { parts: WorkspaceParts }) {
  const { props, gestures, readings } = parts
  const { s } = props.shell
  const { scopeLabel } = readings
  const choosing = gestures.choice?.kind === 'choosing' ? gestures.choice : undefined
  const confirming = gestures.choice?.kind === 'confirming' ? gestures.choice : undefined
  return (
    <>
      <MoveRecordDialog
        target={choosing ? { id: choosing.id, name: choosing.name } : undefined}
        offers={choosing ? gestures.offers(choosing.id) : []}
        targets={gestures.targets}
        scopeLabel={scopeLabel}
        onCancel={gestures.close}
        onMove={gestures.ask}
        busy={gestures.busy}
        s={s}
      />
      <ConfirmDialog
        open={confirming !== undefined}
        title={confirming
          ? s('gesture.confirmTitle', { scope: scopeLabel(confirming.plan.owner), name: confirming.plan.name })
          : ''}
        body={confirming ? s('gesture.confirmBody', { scope: scopeLabel(confirming.plan.owner) }) : ''}
        confirmLabel={s('gesture.go')}
        cancelLabel={s('common.cancel')}
        onCancel={gestures.close}
        onConfirm={gestures.confirm}
      />
    </>
  )
}

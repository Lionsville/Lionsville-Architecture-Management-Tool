// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The workspace's dialogs: the folder's snapshots and history, the board
 * dialogs, the choosers, the wider search, the four gestures and the scope's
 * settings.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Destination } from '../agent/screen'
import type { ProjectPatch } from '../model/commands'
import type { HostModel } from '../model/hostModel'
import { ConfirmDialog } from '../widgets/ConfirmDialog'
import { GlobalSearchDialog } from '../search/ui/GlobalSearchDialog'
import { treeSources } from '../search/search'
import type { SearchHit } from '../search/search'
import { flattenScopes } from '../projects/scope'
import type { ScopePath } from '../projects/scopePath'
import { HistoryPage } from './history/lazyHistoryPage'
import { useSaveUnread } from './history/saveUnread'
import type { SavedDocument } from '../ports/DocumentGateway'
import { SnapshotDialog } from './history/SnapshotDialog'
import { AddFromLibraryDialog } from './dialogs/AddFromLibraryDialog'
import { ChooseBoardDialog } from './dialogs/ChooseBoardDialog'
import { MoveRecordDialog } from './dialogs/MoveRecordDialog'
import { ShellDialogs } from './dialogs/ShellDialogs'
import { messageFor } from './messageFor'
import { ProjectSettingsDialog } from './ProjectSettingsDialog'
import type { ProjectSettings } from './ProjectSettingsDialog'
import type { InitialPage } from './App'
import { initialPageFor } from './bootLanding'
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
  /** The scope that is open: a hit here opens on its page, a hit elsewhere opens that scope. */
  scope: ScopePath
  /** Show a page of this scope, as the agent's `app.open` does (ADR-0019). */
  show: (to: Destination & { scope: string }) => void
  /** Open another scope on a page; absent where there is nowhere to go. */
  onOpenScope?: (path: ScopePath, page?: InitialPage) => void
  /** Write what the session holds now, and answer once it has landed (`DocumentSessionHook.flush`). */
  save: () => Promise<void>
}) {
  const { session, diagnostics, notify, s, scope, show, onOpenScope, save } = deps
  const { onOpen: onOpenSettings, onApply: onApplySettings } = deps.settings
  const [settingsOpen, setSettingsOpen] = useState(false)
  // The settings rename the scope and can move it — so on a scope that is
  // only read they are refused at the door, not after.
  const openSettings = useCallback(() => {
    if (!session.mayChange()) return
    onOpenSettings()
    setSettingsOpen(true)
  }, [session, onOpenSettings])
  const [searchOpen, setSearchOpen] = useState(false)

  /**
   * A hit opens where it lives (ADR-0012 §7, ADR-0029): on its page here, or
   * in the scope that holds it — which the shell opens as it opens any scope,
   * read-only where the source is. The page words are the destination's, the
   * same three words the agent's `app.open` takes, so a hit and an agent land
   * in the same place.
   */
  const chooseHit = useCallback((hit: SearchHit) => {
    const to: Destination = { page: hit.opens.page, id: hit.opens.id }
    if (hit.scope !== undefined && hit.scope !== scope && onOpenScope) onOpenScope(hit.scope, initialPageFor(to))
    else show({ ...to, scope })
  }, [scope, show, onOpenScope])

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
   * The name and the defaults are the session's own to change: one step, on
   * the stack and in the Activity list like any other. Where the scope is
   * filed is the caller's, handed the project once what the session holds is
   * written, because a move enters the scope again at its new address, from
   * what is kept there.
   */
  const applySettings = useCallback((settings: ProjectSettings) => {
    if (!session.mayChange()) return
    const patch = settingsPatch(session.current(), settings)
    if (patch) session.dispatch({ type: 'project.settings', patch })
    void save().then(() => onApplySettings(settings, session.snapshot())).catch(
      // The caller reports what it could; this is the case where the promise
      // itself broke, which nothing above would otherwise hear about.
      (cause: unknown) => {
        diagnostics.report({ level: 'error', where: 'applySettings', message: 'rejected', cause })
        notify(messageFor(cause, s), 'error')
      },
    )
  }, [session, save, onApplySettings, diagnostics, notify, s])

  return { settingsOpen, setSettingsOpen, openSettings, searchOpen, setSearchOpen, chooseHit, applySettings }
}

/** The folder's snapshot and history (ADR-0008), and the board dialogs the shell draws. */
export function HistoryDialogs({ parts }: { parts: WorkspaceParts }) {
  const { props, session, snapshots, diagrams, readings, pageChrome } = parts
  const { s, language } = props.shell
  const documents = props.files.documents
  const saveUnread = useSaveUnread({
    history: props.snapshots.history,
    keep: useCallback((doc: SavedDocument) => documents.save(doc), [documents]),
    scopeName: useCallback(() => session.snapshot().model.name, [session]),
    notify: props.shell.notify,
    s,
  })
  return (
    <>
      <SnapshotDialog
        open={snapshots.dialogOpen}
        keeping={snapshots.keeping}
        draft={snapshots.draft}
        onCancel={snapshots.closeDialog}
        onTake={snapshots.take}
        note={props.snapshots.note}
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
        scopes={snapshots.places.map((place) => readings.scopeLabel(place))}
        onRestore={snapshots.restore}
        whole={snapshots.whole}
        {...(saveUnread ? { onSaveUnread: saveUnread } : {})}
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
  const { props, session, showElement, library, readings, dialogs } = parts
  const { s } = props.shell
  const { index, scopeModels, ancestorDecisions } = props.tree
  /**
   * What ⌘K searches, nearest first: this scope as the session has it, the
   * scopes above with their records, and the rest of the tree as the index
   * read it. Rebuilt when one of those moves; each source's folds are kept
   * on its own lists, so a rebuild re-folds nothing that did not change.
   */
  const sources = useMemo(() => treeSources({
    scope: props.project.path,
    model: session.model,
    above: ancestorDecisions,
    ...(scopeModels ? { tree: scopeModels } : {}),
    masterOf: (id) => index.lookup(id)?.master,
  }), [props.project.path, session.model, ancestorDecisions, scopeModels, index])
  /** A hit's scope by its name where the listing has one, which is what a person calls it. */
  const pathLabel = readings.scopeLabel
  const scopeLabel = useMemo(() => {
    const names = new Map(flattenScopes(props.tree.scopes).map((one) => [one.path, one.name]))
    return (path: string) => names.get(path) || pathLabel(path)
  }, [props.tree.scopes, pathLabel])
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
        sources={sources}
        scopeLabel={scopeLabel}
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

/** What the dialog changes of the model itself, as a patch; nothing where it changes nothing. */
function settingsPatch(model: HostModel, settings: ProjectSettings): ProjectPatch | undefined {
  const patch: ProjectPatch = {}
  if (settings.name !== model.name) patch.name = settings.name
  if (settings.defaultAuthor !== model.defaultAuthor) patch.defaultAuthor = settings.defaultAuthor
  if (JSON.stringify(settings.defaultAspectConfig) !== JSON.stringify(model.defaultAspectConfig)) {
    patch.defaultAspectConfig = settings.defaultAspectConfig
  }
  return Object.keys(patch).length > 0 ? patch : undefined
}

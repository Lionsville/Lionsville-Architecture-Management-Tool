// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The workspace's dialogs: the folder's snapshots and history, the board
 * dialogs, the choosers, the wider search, the four gestures and the scope's
 * settings.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ComponentProps } from 'react'
import type { Destination } from '../agent/screen'
import { ConfirmDialog } from '../widgets/ConfirmDialog'
import { usePersonNames } from '../people/ui/names'
import { GlobalSearchDialog } from '../search/ui/GlobalSearchDialog'
import { useFrameCommands } from './frame/frameStore'
import { treeSources } from '../search/search'
import type { SearchHit } from '../search/search'
import { flattenScopes } from '../projects/scope'
import type { ScopePath } from '../projects/scopePath'
import { HistoryPage } from './history/lazyHistoryPage'
import { useSaveUnread } from './history/saveUnread'
import type { SavedDocument } from '../ports/DocumentGateway'
import { SnapshotDialog } from './history/SnapshotDialog'
import type { WorkspaceHost, WorkspaceShell } from './workspaceProps'
import type { AddFromLibraryDialog as AddFromLibraryDialogShape } from './dialogs/AddFromLibraryDialog'
import { ChooseBoardDialog } from './dialogs/ChooseBoardDialog'
import { MoveRecordDialog } from './dialogs/MoveRecordDialog'
import { ShellDialogs } from './dialogs/ShellDialogs'
import { lazyPart } from '../widgets/lazyPart'
import { ArrivingDialog, } from '../widgets/Arriving'
import type { InitialPage } from './App'
import { initialPageFor } from './bootLanding'
import type { ModelSession } from './useModelSession'
import type { WorkspaceParts } from './workspaceParts'
import { commandKey } from '../widgets/kit/keys'

/**
 * The scope's settings and what to do with an element dropped from the
 * library are asked for, never part of the first view: each arrives the
 * first time it is up, in a script of its own (`widgets/lazyPart`).
 */
const AddFromLibraryDialog = lazyPart<ComponentProps<typeof AddFromLibraryDialogShape>>(
  () => import('./dialogs/AddFromLibraryDialog').then((held) => held.AddFromLibraryDialog), { until: (props) => props.choice !== undefined, fallback: (props) => (props.choice === undefined ? null : <ArrivingDialog />) },
)

export type WorkspaceDialogState = ReturnType<typeof useWorkspaceDialogs>

/**
 * The two dialogs the workspace opens itself — the scope's settings and the
 * wider search — and what their answers do.
 */
export function useWorkspaceDialogs(deps: {
  session: ModelSession
  diagnostics: WorkspaceHost['diagnostics']
  notify: WorkspaceShell['notify']
  s: WorkspaceShell['s']
  /** The scope that is open: a hit here opens on its page, a hit elsewhere opens that scope. */
  scope: ScopePath
  /** Show a page of this scope, as the agent's `app.open` does (ADR-0019). */
  show: (to: Destination & { scope: string }) => void
  /** Open another scope on a page; absent where there is nowhere to go. */
  onOpenScope?: (path: ScopePath, page?: InitialPage) => void
  /** The People page with one person picked: the organisation's, on its home, so a person's hit leaves the scope. Absent where there is nowhere to go. */
  onOpenPeople?: (person: string) => void
  /** Point at the comment a search hit named, for the thread that holds it (`useWorkspaceRequests`). */
  pointComment: (id: string) => void
  /** Write what the session holds now, and answer once it has landed (`DocumentSessionHook.flush`). */
  save: () => Promise<void>
}) {
  const { scope, show, onOpenScope, onOpenPeople, pointComment } = deps
  const [searchOpen, setSearchOpen] = useState(false)

  /**
   * A hit opens where it lives (ADR-0012 §7, ADR-0029): on its page here, or
   * in the scope that holds it — which the shell opens as it opens any scope,
   * read-only where the source is. The page words are the destination's, the
   * same three words the agent's `app.open` takes, so a hit and an agent land
   * in the same place.
   */
  const chooseHit = useCallback((hit: SearchHit) => {
    if (hit.kind === 'person') {
      onOpenPeople?.(hit.id)
      return
    }
    const to: Destination = { page: hit.opens.page, id: hit.opens.id }
    if (hit.scope !== undefined && hit.scope !== scope && onOpenScope) onOpenScope(hit.scope, initialPageFor(to))
    else {
      show({ ...to, scope })
      // A hit on a comment opens the record's reader, and the thread under it marks the comment and brings it into view (ADR-0037 §7).
      if (hit.kind === 'comment') pointComment(hit.id)
    }
  }, [scope, show, onOpenScope, onOpenPeople, pointComment])

  // ⌘K / Ctrl+K from anywhere in the workspace. The editor's own ⌘F stays the
  // canvas finder; this is the wider one.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (commandKey(event) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return { searchOpen, setSearchOpen, chooseHit }
}

/** The folder's snapshot and history (ADR-0008), and the board dialogs the shell draws. */
export function HistoryDialogs({ parts }: { parts: WorkspaceParts }) {
  const { props, session, snapshots, diagrams, readings } = parts
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
        of={session.model.name}
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
        {...(session.readOnly ? {} : { onSnapshot: snapshots.openDialog })}
        language={language}
        s={s}
      />
      <ShellDialogs
        s={s}
        diagramToDelete={diagrams.diagramToDelete}
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
  const frameCommands = useFrameCommands()
  // A person is found through the register first, then the records that point at them (ADR-0036 §8).
  const names = usePersonNames()
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
        people={names.match}
        more={frameCommands}
        s={s}
      />
      <GestureDialogs parts={parts} />
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
  // A unit's assignments go with it (ADR-0036 §4): the confirmation says how many.
  const carried = confirming?.plan.writes.reduce((sum, write) => sum + (write.assignments?.length ?? 0), 0) ?? 0
  const carriedText = carried === 0 ? '' : ` ${s(carried === 1 ? 'gesture.confirmAssignmentsOne' : 'gesture.confirmAssignmentsOther', { count: carried })}`
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
        body={confirming ? `${s('gesture.confirmBody', { scope: scopeLabel(confirming.plan.owner) })}${carriedText}` : ''}
        confirmLabel={s('gesture.go')}
        cancelLabel={s('common.cancel')}
        onCancel={gestures.close}
        onConfirm={gestures.confirm}
      />
    </>
  )
}


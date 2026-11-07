// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The bar over an open scope, and the notices under it: a scope whose files
 * did not all read, and a folder somebody else changed.
 */
import { useMemo } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import type { StringKey } from '../i18n'
import { NO_WINDOW_CHROME } from '../platform/windowChrome'
import type { WindowChrome } from '../platform/windowChrome'
import { scopeActivity } from './activityMoves'
import { ChangedElsewhereNotice } from './ChangedElsewhereNotice'
import { isLookingAway, shownAsOf } from '../editor'
import { agentRun, putBackRun } from '../projects/agentRun'
import type { StackedBand } from '../widgets/kit/Band'
import { Button as KitButton } from '../widgets/kit/Button'
import { useFrameFacts } from './frame/frameStore'
import type { WorkspaceParts } from './workspaceParts'

/**
 * What a page is told of the window: nothing of the rows' duties, since the
 * frame's row one keeps clear of the window's controls and is what it is dragged by.
 */
export function usePageChrome(windowChrome: WindowChrome | undefined) {
  const pageChrome = useMemo<WindowChrome>(
    () => ({ ...(windowChrome ?? NO_WINDOW_CHROME), controlsInset: 0, draggable: false, topInset: 0 }),
    [windowChrome],
  )
  return { pageChrome }
}

/**
 * What this scope tells the frame, and the strips under the rows. The rows
 * themselves are the frame's: what a screen owes them is these facts.
 */
export function WorkspaceBar({ parts }: { parts: WorkspaceParts }) {
  const { props, session, document: { document, savedAt, saveFailed }, alsoHere, pages, requests, dialogs } = parts
  const { s } = props.shell
  /**
   * The source's own log of the open scope, bound to it — held by scope, so the
   * list asks once per opening rather than once per render of this bar.
   * Nothing where the source keeps no log, and the list is the session's.
   */
  const keptLog = props.source.recentActivity
  const scope = props.project.id
  const history = props.snapshots.history
  // By the scope's identity, so the list follows it through a move and says
  // the move (`activityMoves.ts`).
  const recentActivity = useMemo(() => scopeActivity(scope, keptLog, history), [scope, keptLog, history])
  const active = session.model.diagrams.find((one) => one.id === session.activeDiagramId)
  const boardUp = pages.page() === undefined && requests.documentationShown === undefined
    && (active?.kind === 'layer7' || active?.kind === 'container')
  const looking = active !== undefined && isLookingAway(active, parts.viewing.days)
  const bands = useMemo<readonly StackedBand[]>(() => (looking && active ? [{
    id: 'looking', tone: 'looking',
    title: s('frame.lookingAt', { day: shownAsOf(active, parts.viewing.days) ?? '' }),
    detail: s('frame.lookingDetail'),
    action: <KitButton size="small" onClick={() => parts.viewing.forget(active.id)} data-testid="looking-back">{s('frame.lookingBack')}</KitButton>,
  }] : NO_BANDS), [looking, active, parts.viewing, s])
  const publishes = props.source.publishesSteps
  useFrameFacts({
    kind: 'workspace', path: props.project.path, name: session.model.name,
    openSearch: () => dialogs.setSearchOpen(true), openSettings: dialogs.openSettings,
    ...(session.readOnly ? {} : {
      undo: { can: session.canUndo, run: session.undo },
      redo: { can: session.canRedo, run: session.redo },
    }),
    status: document.state.status, savedAt, saveFailed,
    ...(publishes !== undefined ? { publishesSteps: publishes } : {}),
    sourceStatus: props.source.status !== undefined,
    alsoHere,
    activity: session.history,
    ...(recentActivity ? { recentActivity } : {}),
    activityKept: keptLog !== undefined,
    bands, boardUp,
    showShortcuts: parts.renderer.editorHandle.current ? () => parts.renderer.editorHandle.current?.showShortcuts() : undefined,
    agentRun: () => {
      const run = agentRun(session.history())
      if (run.steps.length === 0) return undefined
      if (publishes) return { steps: run.steps.length, putBack: () => { session.dispatch(putBackRun(run, s('agent.someone'), parts.todayDay)) } }
      return { steps: run.steps.length, undo: () => { session.undoRun(run) } }
    },
  })
  return (
    <>
      {parts.unreadable.length > 0 && <UnreadableNotice parts={parts} />}
      <ChangedElsewhereNotice
        status={document.state.status}
        onTakeTheirs={document.takeTheirs}
        onKeepMine={document.keepMine}
        onSaveCopy={parts.files.saveWorkingFile}
        s={s}
      />
    </>
  )
}

const NO_BANDS: readonly StackedBand[] = []

/**
 * A scope that could not be read whole: what could not, and — where the
 * source may be written — the two ways to put it back whole
 * (`ScopeState.unreadable`), from the history where one is kept and from a
 * working file brought in. In the source's own words where it has more to
 * say (`WorkspaceSource.unreadableKey`).
 */
function UnreadableNotice({ parts }: { parts: WorkspaceParts }) {
  const { props, snapshots, pickers, recovering } = parts
  const { s } = props.shell
  // A later version's scope is somebody's newer work: nothing here puts it
  // back, and the notice says what does.
  const key = props.project.later ? 'shell.unreadableLater' : (props.source.unreadableKey ?? 'shell.unreadableScope') as StringKey
  return (
    <Alert
      severity="warning"
      square
      sx={{ py: 0.25, fontSize: 13, borderRadius: 0, '& .MuiAlert-action': { alignItems: 'center', pt: 0 } }}
      data-testid="unreadable-notice"
      action={recovering ? (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {snapshots.available && (
            <Button size="small" color="inherit" onClick={() => snapshots.openPage()} data-testid="unreadable-put-back">
              {s('shell.putBackFromHistory')}
            </Button>
          )}
          <Button size="small" color="inherit" onClick={pickers.document.open} data-testid="unreadable-bring-in">
            {s('shell.bringInWorkingFile')}
          </Button>
        </Box>
      ) : undefined}
    >
      {s(key, { files: parts.unreadable.join(', ') })}
    </Alert>
  )
}

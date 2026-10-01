// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The bar over an open scope, and the notices under it: a scope whose files
 * did not all read, and a folder somebody else changed.
 */
import { useCallback, useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import type { StringKey } from '../i18n'
import { NO_WINDOW_CHROME } from '../platform/windowChrome'
import type { WindowChrome } from '../platform/windowChrome'
import { scopeActivity } from './activityMoves'
import { ChangedElsewhereNotice } from './ChangedElsewhereNotice'
import { ShellToolbar } from './ShellToolbar'
import type { WorkspaceParts } from './workspaceParts'

/**
 * How tall the shell toolbar is, measured: every page opens below it, so
 * Documentation, Decisions and Roadmap stay one click from each other while
 * a page is up. Measured rather than declared, because the bar's height is
 * its content's, and a constant here would drift the first time a button
 * grew. Zero until measured — and in a test with no layout — which makes a
 * page cover the window, as it did before the bar stayed.
 */
export function usePageChrome(windowChrome: WindowChrome | undefined) {
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
  return { toolbarRef, pageChrome }
}

export function WorkspaceBar({ parts, toolbarRef }: {
  parts: WorkspaceParts
  toolbarRef: (node: HTMLDivElement | null) => void
}) {
  const { props, session, document: { document, savedAt, saveFailed }, alsoHere, snapshots, pages, requests, dialogs } = parts
  const { s, language } = props.shell
  const { overflow, windowChrome } = props.host
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
  return (
    <>
      <Box ref={toolbarRef} sx={{ flex: '0 0 auto' }}>
      <ShellToolbar
        designName={session.model.name}
        crumbs={props.navigation.crumbs}
        scopePath={props.project.path}
        savedAt={savedAt}
        status={document.state.status}
        saveFailed={saveFailed}
        alsoHere={alsoHere}
        language={language}
        overflow={overflow && { ...overflow, can: { ...overflow.can, history: snapshots.available } }}
        onGoHome={props.navigation.onGoHome}
        onOpenSettings={dialogs.openSettings}
        onOpenDocumentation={() => requests.openDocumentation()}
        onOpenDecisions={() => pages.openDecisions()}
        onOpenObservations={() => pages.openObservations()}
        onOpenRoadmap={pages.openRoadmap}
        onOpenSearch={() => dialogs.setSearchOpen(true)}
        activity={session.history}
        {...(recentActivity ? { recentActivity } : {})}
        activityKept={keptLog !== undefined}
        agent={props.agent.bar}
        sourceChip={props.source.chip}
        barButton={props.source.barButton}
        {...(props.source.publishesSteps !== undefined ? { publishesSteps: props.source.publishesSteps } : {})}
        sourceStatus={props.source.status !== undefined}
        s={s}
        windowChrome={windowChrome}
      />
      </Box>
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

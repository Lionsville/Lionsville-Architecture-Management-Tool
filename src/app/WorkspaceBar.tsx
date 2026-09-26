// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The bar over an open scope, and the notices under it: a scope whose files
 * did not all read, and a folder somebody else changed.
 */
import { useCallback, useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import { NO_WINDOW_CHROME } from '../platform/windowChrome'
import type { WindowChrome } from '../platform/windowChrome'
import { DiskChangeNotice } from './DiskChangeNotice'
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
        agent={props.agent.bar}
        s={s}
        windowChrome={windowChrome}
      />
      </Box>
      {parts.unreadable.length > 0 && (
        <Alert
          severity="warning"
          square
          sx={{ py: 0.25, fontSize: 13, borderRadius: 0 }}
          data-testid="unreadable-notice"
        >
          {s('shell.unreadableScope', { files: parts.unreadable.join(', ') })}
        </Alert>
      )}
      <DiskChangeNotice
        status={document.state.status}
        onTakeTheirs={document.takeTheirs}
        onKeepMine={document.keepMine}
        onSaveCopy={parts.files.saveWorkingFile}
        s={s}
      />
    </>
  )
}

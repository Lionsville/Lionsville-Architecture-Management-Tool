// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The working file from an open scope (ADR-0018, ADR-0023, ADR-0025), and the
 * two invisible inputs the menu and the icon picker open.
 */
import { useCallback, useRef } from 'react'
import type { RefObject } from 'react'
import type { Translate } from '../i18n'
import type { ScopeSnapshot } from '../projects/scope'
import { useFilePicker } from './useFilePicker'
import type { FilePicker } from './useFilePicker'
import type { ModelSession } from './useModelSession'
import { useProjectFiles } from './useProjectFiles'
import type { ProjectFiles } from './useProjectFiles'
import type { Notify } from './useToasts'
import type { WorkspaceFiles, WorkspaceTree } from './workspaceProps'

export type WorkspaceFileParts = {
  files: ProjectFiles
  pickers: { document: FilePicker; logo: FilePicker }
  /**
   * *Replace here*'s snapshot (ADR-0025, amended). The history is set up after
   * this (it needs the save this file list does not), so it is reached through
   * a ref the workspace fills once the history exists.
   */
  safeguardRef: RefObject<() => Promise<boolean>>
}

export function useWorkspaceFiles(deps: {
  session: ModelSession
  seams: WorkspaceFiles
  workingSet: WorkspaceTree['workingSet']
  onAdoptScopes: WorkspaceTree['onAdoptScopes']
  onTreeChanged: () => void
  notify: Notify
  s: Translate
}): WorkspaceFileParts {
  const { session, workingSet, onAdoptScopes, onTreeChanged, notify, s } = deps
  const { documents, askPassword, landing, chooseFolder } = deps.seams
  /** The store write, and then the two reads a changed tree needs (ADR-0012 §10). */
  const adoptWorkingSet = useCallback(
    async (held: readonly ScopeSnapshot[]) => {
      await onAdoptScopes!(held)
      onTreeChanged()
    },
    [onAdoptScopes, onTreeChanged],
  )
  const safeguardRef = useRef<() => Promise<boolean>>(async () => true)
  const beforeReplace = useCallback(() => safeguardRef.current(), [])
  const files = useProjectFiles({
    session,
    documents,
    beforeReplace,
    ...(workingSet ? { workingSet } : {}),
    ...(onAdoptScopes ? { adoptWorkingSet } : {}),
    askPassword,
    landing,
    ...(chooseFolder ? { chooseFolder } : {}),
    notify,
    s,
  })
  const document = useFilePicker({
    // A working file is a zip now; the JSON entries are versions 1 and 2, which
    // still open.
    accept: '.lvarch,.json,application/json,application/zip',
    onPick: files.openFile,
    testId: 'document-input',
  })
  // No button in the toolbar for this one: the place you ask for a mark is the
  // icon picker itself, inside the editor.
  const logo = useFilePicker({
    accept: 'image/svg+xml,image/png', onPick: files.addLogo, testId: 'logo-input',
  })
  return { files, pickers: { document, logo }, safeguardRef }
}

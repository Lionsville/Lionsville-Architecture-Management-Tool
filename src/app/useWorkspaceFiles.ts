// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The working file from an open scope (ADR-0018, ADR-0023, ADR-0025), and the
 * two invisible inputs the menu and the icon picker open.
 */
import { useCallback, useRef } from 'react'
import type { RefObject } from 'react'
import type { Translate } from '../i18n'
import { useFilePicker } from './useFilePicker'
import type { FilePicker } from './useFilePicker'
import type { ModelSession } from './useModelSession'
import { useProjectFiles } from './useProjectFiles'
import type { ProjectFiles, ProjectFilesDeps } from './useProjectFiles'
import type { Notify } from './useToasts'
import type { OpenedWorkingFile } from './workingFileFlows'
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
  /** Put a picture's bytes where the scope is kept, and answer its library entry (`ScopeWriter.put`). */
  putPicture: ProjectFilesDeps['putPicture']
  seams: WorkspaceFiles
  carryOut: WorkspaceTree['carryOut']
  onAdoptScopes: WorkspaceTree['onAdoptScopes']
  readScope?: WorkspaceTree['readScope']
  onTreeChanged: () => void
  notify: Notify
  s: Translate
}): WorkspaceFileParts {
  const { session, putPicture, carryOut, onAdoptScopes, readScope, onTreeChanged, notify, s } = deps
  const { documents, interchange, askPassword, landing, chooseDestination } = deps.seams
  /** The store write, and then the two reads a changed tree needs (ADR-0012 §10). */
  const adoptWorkingSet = useCallback(
    async (opened: OpenedWorkingFile) => {
      await onAdoptScopes!(opened)
      onTreeChanged()
    },
    [onAdoptScopes, onTreeChanged],
  )
  const safeguardRef = useRef<() => Promise<boolean>>(async () => true)
  const beforeReplace = useCallback(() => safeguardRef.current(), [])
  const files = useProjectFiles({
    session,
    putPicture,
    documents,
    beforeReplace,
    carryOut,
    interchange,
    ...(onAdoptScopes ? { adoptWorkingSet } : {}),
    ...(readScope ? { readScope } : {}),
    askPassword,
    landing,
    ...(chooseDestination ? { chooseDestination } : {}),
    notify,
    s,
  })
  const document = useFilePicker({
    accept: interchange.accepts,
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

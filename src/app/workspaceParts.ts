// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { EditorOwnership, ShownDays } from '../editor'
import type { Adr } from '../decisions/adr'
import type { WindowChrome } from '../platform/windowChrome'
import type { ProjectHistoryState } from './history/useProjectHistory'
import type { AnalysisActions } from './useAnalysisActions'
import type { DiagramActions } from './useDiagramActions'
import type { DocumentPictures } from './useDocumentPictures'
import type { FilePicker } from './useFilePicker'
import type { Gestures } from './useGestures'
import type { Library } from './useLibrary'
import type { ModelSession } from './useModelSession'
import type { ProjectFiles } from './useProjectFiles'
import type { RendererSeam } from './useRendererView'
import type { Sheets } from './useSheet'
import type { ShowElement } from './useShowElement'
import type { TechnologyLandscapes } from './useTechnologyLandscape'
import type { TreeReadings } from './useTreeReadings'
import type { WorkspaceDialogState } from './WorkspaceDialogs'
import type { WorkspaceDocument } from './useWorkspaceDocument'
import type { WorkspacePages } from './useWorkspacePages'
import type { WorkspaceRequests } from './useWorkspaceRequests'
import type { ProjectWorkspaceProps } from './workspaceProps'

/**
 * The workspace's state, as the hooks that hold it hand it out: one object
 * per concern, so a panel names the concerns it reads rather than sixty
 * values one by one — the shape `editor/editorParts.ts` gives the editor
 * body. Built once per render by `ProjectWorkspace`; a hook that memoises
 * over it depends on its fields, never on the object, which is new each time.
 */
export interface WorkspaceParts {
  props: ProjectWorkspaceProps
  /**
   * Whether anything here may be written: not where the source says so, and
   * not in a scope a file of which did not read (`ScopeSnapshot.unreadable`) —
   * a save there would write an empty model over the one that did not parse.
   * One flag, so every affordance and the agent's refusal follow it.
   */
  readOnly: boolean
  /** The files of this scope that did not read, for the notice under the bar. */
  unreadable: readonly string[]
  session: ModelSession
  document: WorkspaceDocument
  /** Who else has this scope open, as whoever answers for the source last said. */
  alsoHere: readonly string[]
  files: ProjectFiles
  pickers: { document: FilePicker; logo: FilePicker }
  snapshots: ProjectHistoryState
  requests: WorkspaceRequests
  pictures: DocumentPictures
  renderer: RendererSeam
  readings: TreeReadings
  ownership: EditorOwnership
  gestures: Gestures
  library: Library
  showElement: ShowElement
  diagrams: DiagramActions
  sheets: Sheets
  landscapes: TechnologyLandscapes
  pages: WorkspacePages
  analysis: AnalysisActions
  dialogs: WorkspaceDialogState
  /** The day each board is being looked at, which is nobody's write (ADR-0027). */
  viewing: ShownDays
  /** Every ancestor's records as one list — what the search and the agent read. */
  ancestorRecords: readonly Adr[]
  /** Today, read once per render of the workspace rather than per component. */
  todayDay: string
  today: () => string
  /** The window's chrome with the bar's measured height as the pages' top inset. */
  pageChrome: WindowChrome
}

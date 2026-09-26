// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The organisation screen's own snapshots, history and working file, while it
 * is up — and what its home is called.
 */
import { useCallback, useEffect, useMemo } from 'react'
import type { RefObject } from 'react'
import type { Translate } from '../i18n'
import type { Command, StepSummary } from '../model'
import { fromArrays } from '../model'
import type { HostModel } from '../model/hostModel'
import { bareScope, flattenScopes } from '../projects/scope'
import type { ScopeSnapshot } from '../projects/scope'
import type { ScopeIndex } from '../projects/scopeIndex'
import { ROOT_SCOPE, scopePathLabel } from '../projects/scopePath'
import type { ScopePath } from '../projects/scopePath'
import type { ProjectHistory } from '../ports/ProjectHistory'
import { useProjectHistory } from './history/useProjectHistory'
import type { Organisation } from './organisation/useOrganisation'
import type { HomeFileDoors, HomeHistoryDoors } from './useShellCommands'
import { useFilePicker } from './useFilePicker'
import { useHomeFiles } from './useHomeFiles'
import type { useOpenIntoPrompt } from './useOpenIntoPrompt'
import type { usePasswordPrompt } from './usePasswordPrompt'
import type { ProjectFileChannel } from './useProjectFiles'
import type { Notify } from './useToasts'
import type { ChooseFolderForWorkingFile } from './workingFileFlows'

/** The organisation screen has no command log: the history drafts its default message. */
const NO_STEPS = (): readonly { summary: StepSummary }[] => []
/** …and nothing waiting to be written: the screen writes straight through. */
const SAVED = (): Promise<void> => Promise.resolve()
/** What the history page compares against before the home's document has been read. */
const EMPTY_MODEL: HostModel = { name: '', elements: [], relations: [], diagrams: [] }

export type HomeParts = ReturnType<typeof useHomeParts>

export function useHomeParts(deps: {
  organisation: Organisation
  home: ScopePath
  setHome: (path: ScopePath) => void
  /** The scope that is open; everything here is inert while there is one. */
  scopeOpen: boolean
  history: ProjectHistory | undefined
  index: ScopeIndex
  /** A restore on the history page: one write of the home's document. */
  restore: (command: Command) => void
  onSnapshotTaken: () => void
  documents: ProjectFileChannel
  workingSet: () => Promise<ScopeSnapshot[]>
  adopt: (held: readonly ScopeSnapshot[]) => Promise<void>
  password: ReturnType<typeof usePasswordPrompt>
  openInto: ReturnType<typeof useOpenIntoPrompt>
  chooseFolder: ChooseFolderForWorkingFile | undefined
  doors: { history: RefObject<HomeHistoryDoors | undefined>; files: RefObject<HomeFileDoors | undefined> }
  notify: Notify
  s: Translate
}) {
  const { organisation, home, setHome, scopeOpen, index, restore, notify, s } = deps
  /**
   * Snapshots and the history, while the organisation screen is up.
   *
   * A snapshot is of the FOLDER (ADR-0003), so it means the same thing from
   * here as from inside a landscape: the menu offers it on both, and an item
   * that was offered has to work. What differs is what stands behind the
   * page: the home scope's own document — the organisation's business layer,
   * or a domain's records — which the screen has already read for its cards,
   * and which is written straight through, so there is nothing to save first.
   * A restore is one write of that document, the way the settings dialog
   * writes it. Inert while a scope is open: the workspace has its own, and
   * the seam is withheld from this one so the two never both answer.
   */
  const homeDocument = useCallback(
    () => organisation.root ?? bareScope(home, organisation.tree.name),
    [organisation.root, organisation.tree.name, home],
  )
  const history = useProjectHistory({
    history: scopeOpen ? undefined : deps.history,
    index,
    project: homeDocument,
    steps: NO_STEPS,
    save: SAVED,
    indexed: () => fromArrays(homeDocument().model),
    dispatch: restore,
    notify,
    s,
    onTaken: deps.onSnapshotTaken,
  })
  deps.doors.history.current = scopeOpen ? undefined : history
  const model: HostModel = organisation.root?.model ?? EMPTY_MODEL
  const scopeLabel = useCallback(
    (path: ScopePath) => (path === ROOT_SCOPE ? organisation.tree.name : scopePathLabel(path)),
    [organisation.tree.name],
  )
  const { files, picker } = useHomeFileDoors({ ...deps, homeDocument, beforeReplace: history.safeguard })

  /**
   * A home the listing no longer has — the scope was removed, from its own
   * page or by somebody else's hand — falls back to the root's rather than
   * showing a heading over nothing.
   */
  const homeListed = home === ROOT_SCOPE
    || flattenScopes(organisation.tree).some((scope) => scope.path === home)
  useEffect(() => { if (!homeListed) setHome(ROOT_SCOPE) }, [homeListed, setHome])
  /** What the home that is up is called, for the window's title and the agent. */
  const name = useMemo(
    () => flattenScopes(organisation.tree).find((scope) => scope.path === home)?.name,
    [organisation.tree, home],
  )
  return { history, model, scopeLabel, files, picker, name }
}

/** The working file from a home (ADR-0023), and the invisible input the home's *Open…* clicks. */
function useHomeFileDoors(deps: Parameters<typeof useHomeParts>[0] & {
  homeDocument: () => ScopeSnapshot
  beforeReplace: () => Promise<boolean>
}) {
  const { password, openInto, notify, s } = deps
  const files = useHomeFiles({
    documents: deps.documents,
    workingSet: deps.workingSet,
    into: deps.homeDocument,
    adopt: deps.adopt,
    askPassword: password.askPassword,
    landing: openInto.prompts,
    chooseFolder: deps.chooseFolder,
    beforeReplace: deps.beforeReplace,
    notify,
    s,
  })
  const picker = useFilePicker({
    accept: '.lvarch,.json,application/json,application/zip,application/octet-stream',
    onPick: files.openFile,
    testId: 'home-document-input',
  })
  deps.doors.files.current = deps.scopeOpen ? undefined : {
    exportWorkingFile: files.exportWorkingFile,
    open: picker.open,
    openDocument: files.openDocument,
  }
  return { files, picker }
}

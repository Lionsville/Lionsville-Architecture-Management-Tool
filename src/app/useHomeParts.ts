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
import { ROOT_SCOPE } from '../projects/scopePath'
import { scopeDisplayName } from '../projects/scopeLabel'
import type { ScopePath } from '../projects/scopePath'
import type { Repositories } from '../ports/Repositories'
import { useProjectHistory } from './history/useProjectHistory'
import type { Organisation } from './organisation/useOrganisation'
import type { HomeFileDoors, HomeHistoryDoors } from './useShellCommands'
import { useFilePicker } from './useFilePicker'
import { useHomeFiles } from './useHomeFiles'
import type { useOpenIntoPrompt } from './useOpenIntoPrompt'
import type { usePasswordPrompt } from './usePasswordPrompt'
import type { ProjectFileChannel } from './useProjectFiles'
import type { Notify } from './useToasts'
import { ANY_WORKING_FILE_TYPES } from './workingFileFlows'
import type { ChooseDestination } from './workingFileFlows'
import type { WorkingFileManifest } from '../projects/workingFileManifest'

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
  /** Where the home's history is read and recorded, and its tree for which scope is which. */
  repositories: Pick<Repositories, 'scopes' | 'history'>
  /** Whether a history is kept here already (`ProviderParts.historyKept`). */
  historyKept?: () => Promise<boolean>
  index: ScopeIndex
  /** A restore on the history page: one write of the home's document. */
  restore: (command: Command) => void
  documents: ProjectFileChannel
  workingSet: () => Promise<ScopeSnapshot[]>
  adopt: (held: readonly ScopeSnapshot[], manifest?: WorkingFileManifest) => Promise<void>
  /** One scope as the store holds it now: an opened working file is read back through it (ADR-0023, amended). */
  readScope: (path: ScopePath) => Promise<ScopeSnapshot | undefined>
  password: ReturnType<typeof usePasswordPrompt>
  openInto: ReturnType<typeof useOpenIntoPrompt>
  chooseDestination: ChooseDestination | undefined
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
    history: scopeOpen ? undefined : deps.repositories.history,
    kept: deps.historyKept,
    scopes: deps.repositories.scopes,
    index,
    project: homeDocument,
    steps: NO_STEPS,
    save: SAVED,
    indexed: () => fromArrays(homeDocument().model),
    dispatch: restore,
    notify,
    s,
  })
  deps.doors.history.current = scopeOpen ? undefined : history
  const model: HostModel = organisation.root?.model ?? EMPTY_MODEL
  /**
   * What the history's places are called: each scope by its own name out of
   * the listing (`scopeDisplayName`), never by its path, and the root by the
   * organisation's name or the word for one.
   */
  const everyScope = useMemo(() => flattenScopes(organisation.tree), [organisation.tree])
  const scopeLabel = useCallback(
    (path: ScopePath) => scopeDisplayName(path, everyScope, organisation.tree.name.trim() || s('common.organisation')),
    [everyScope, organisation.tree.name, s],
  )
  const { files, picker } = useHomeFileDoors({ ...deps, homeDocument, beforeReplace: history.safeguard })

  /**
   * A home the listing no longer has — the scope was removed, from its own
   * page or by somebody else's hand — falls back to the root's rather than
   * showing a heading over nothing.
   */
  const homeListed = home === ROOT_SCOPE
    || flattenScopes(organisation.tree).some((scope) => scope.path === home)
  // Only once the listing has been read: a home the boot landed on is not in
  // the empty tree the first paint has, and is not gone for that.
  useEffect(() => { if (organisation.listed && !homeListed) setHome(ROOT_SCOPE) }, [organisation.listed, homeListed, setHome])
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
    readScope: deps.readScope,
    askPassword: password.askPassword,
    landing: openInto.prompts,
    chooseDestination: deps.chooseDestination,
    beforeReplace: deps.beforeReplace,
    notify,
    s,
  })
  const picker = useFilePicker({
    accept: ANY_WORKING_FILE_TYPES,
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

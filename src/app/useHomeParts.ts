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
import { organisationHoldsWork } from '../projects/organisationWork'
import { bareScope, flattenScopes } from '../projects/scope'
import type { ScopeSnapshot } from '../projects/scope'
import type { CarryChoice } from './workingFileFlows'
import type { ScopeIndex } from '../projects/scopeIndex'
import { isWithinScope, ROOT_SCOPE } from '../projects/scopePath'
import { scopeDisplayName } from '../projects/scopeLabel'
import type { ScopePath } from '../projects/scopePath'
import type { CarriedOut, Interchange } from '../ports/Interchange'
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
import { anyWorkingFile } from './workingFileFlows'
import type { ChooseDestination, OpenedWorkingFile } from './workingFileFlows'

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
  /** Which page of a home is up, where the shell knows: a home that is gone is said as the page it leaves up. */
  pageUp?: { readonly current: () => string | undefined }
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
  /** The organisation, carried out as one working file on the gesture. */
  carryOut: (held?: readonly ScopeSnapshot[], choice?: CarryChoice) => Promise<CarriedOut>
  /** What reads a working file, and holds a landing to it. */
  interchange: Pick<Interchange, 'accepts' | 'open' | 'check'>
  adopt: (opened: OpenedWorkingFile) => Promise<void>
  /** One scope as the store holds it now: an opened working file is read back through it (ADR-0023, amended). */
  readScope: (path: ScopePath) => Promise<ScopeSnapshot | undefined>
  password: ReturnType<typeof usePasswordPrompt>
  openInto: ReturnType<typeof useOpenIntoPrompt>
  chooseDestination: ChooseDestination | undefined
  /** A copy reached the person. */
  onCopySaved?: () => void
  doors: { history: RefObject<HomeHistoryDoors | undefined>; files: RefObject<HomeFileDoors | undefined> }
  notify: Notify
  s: Translate
}) {
  const { organisation, home, setHome, scopeOpen, index, restore, notify, s, pageUp } = deps
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
  const { files, picker } = useHomeFileDoors({ ...deps, homeDocument, beforeReplace: history.safeguard, keepsHistory: history.keepsNow })

  /**
   * A home the listing no longer has — the scope was removed, from its own
   * page or by somebody else's hand — falls back to the root's rather than
   * showing a heading over nothing.
   */
  const homeListed = home === ROOT_SCOPE
    || flattenScopes(organisation.tree).some((scope) => scope.path === home)
  // Only once the listing has been read since the last refresh: a home the
  // boot landed on is not in the empty tree the first paint has, and a scope
  // made a moment ago and landed on — one made without a board — is not in
  // the listing read before it was made. Neither is gone for that.
  useEffect(() => {
    if (!organisation.listedNow || homeListed) return
    setHome(ROOT_SCOPE)
    // An address, a link or Back named it: say which scope was not there, rather than land somewhere else in silence —
    // and what is shown instead, which on the settings page is the organisation's settings, not its home.
    notify(s(pageUp?.current() === 'settings' ? 'shell.placeNoScopeSettings' : 'shell.placeNoScope', { scope: home }), 'info')
  }, [organisation.listedNow, homeListed, setHome, notify, s, home, pageUp])
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
  keepsHistory: () => Promise<boolean>
}) {
  const { password, openInto, notify, s } = deps
  const files = useHomeFiles({
    documents: deps.documents,
    carryOut: deps.carryOut,
    interchange: deps.interchange,
    into: deps.homeDocument,
    adopt: deps.adopt,
    readScope: deps.readScope,
    askPassword: password.askPassword,
    // Nothing made here yet, so a file just opens: an untouched first run has nothing to lose.
    untouched: () => {
      const { tree, root } = deps.organisation
      return deps.home === ROOT_SCOPE && !organisationHoldsWork(tree, root)
    },
    below: () => flattenScopes(deps.organisation.tree).filter((scope) => scope.path !== deps.home && isWithinScope(scope.path, deps.home)).length,
    ...(deps.onCopySaved ? { onCopySaved: deps.onCopySaved } : {}),
    landing: openInto.prompts,
    chooseDestination: deps.chooseDestination,
    beforeReplace: deps.beforeReplace,
    keepsHistory: deps.keepsHistory,
    notify,
    s,
  })
  const picker = useFilePicker({
    accept: anyWorkingFile(deps.interchange.accepts),
    onPick: files.openFile,
    testId: 'home-document-input',
  })
  deps.doors.files.current = deps.scopeOpen ? undefined : {
    exportWorkingFile: () => { void files.exportWorkingFile() },
    open: picker.open,
    openDocument: files.openDocument,
  }
  return { files, picker }
}

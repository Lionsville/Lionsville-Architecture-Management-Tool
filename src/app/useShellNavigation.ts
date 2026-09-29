// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where the shell is: the scope that is open and the page it was opened for,
 * or the home that is up while nothing is — and the moves between them.
 */
import { useCallback, useMemo, useState } from 'react'
import type { RefObject } from 'react'
import { bareScope } from '../projects/scope'
import type { ScopeSnapshot } from '../projects/scope'
import { ROOT_SCOPE, scopePathLabel } from '../projects/scopePath'
import type { ScopePath } from '../projects/scopePath'
import type { InitialPage } from './App'
import { ensureScope, readScope } from '../projects/scopeAccess'
import type { ScopeReader } from '../projects/scopeAccess'
import type { ScopeRepository } from '../ports/ScopeRepository'
import type { SourceChanges } from '../ports/ProviderParts'
import type { Failed } from './useShellServices'
import type { ShellPreferences } from './useShellPreferences'

export type ShellNavigation = ReturnType<typeof useShellNavigation>

/**
 * Is this a page a scope has before anything is written in it — its decisions,
 * its observations, its roadmap, or a sheet, map or technology landscape it is
 * about to be given? Those open on a scope with no document. A page that names
 * a record, a plan or a board names something that has to be there, and a
 * scope that is not there is then one somebody removed, not one to make.
 */
export function opensOnNothing(page: InitialPage | undefined): boolean {
  if (page === undefined) return false
  switch (page.page) {
    case 'decisions':
    case 'observations':
      return page.id === undefined
    case 'roadmap':
    case 'documentation':
      return true
    case 'sheet':
    case 'map':
    case 'technology':
      return page.id === undefined
    default:
      return false
  }
}

export function useShellNavigation(deps: {
  initialProject: ScopeSnapshot | undefined
  /** Whose home is up at the first paint where nothing is open; the root's where absent. */
  initialHome?: ScopePath
  scopes: ScopeReader & Pick<ScopeRepository, 'create'>
  watchProject: SourceChanges | undefined
  prefs: ShellPreferences
  failedRef: RefObject<Failed>
  /**
   * The listing read again. A ref because the callbacks that re-read the tree
   * are declared above the hook that owns it, and a hook cannot move above the
   * `enter` it is given.
   */
  refreshTree: RefObject<() => void>
  /**
   * The index read again (`useIndex`), for the same reason and by the same
   * route: going home is where the cards and the register are counted, and
   * they are counted off the index, which a source that publishes steps is
   * not rebuilt by on its own.
   */
  refreshIndex?: RefObject<() => void>
  /**
   * May this person change the scope at this path? What opening a page on a
   * scope with no document asks before it writes one. Every scope where absent.
   */
  writable?: (path: ScopePath) => boolean
}) {
  const { initialProject, initialHome, scopes, watchProject, prefs, failedRef, refreshTree, refreshIndex, writable } = deps
  const [project, setProject] = useState<ScopeSnapshot | undefined>(initialProject)

  /**
   * The watcher, bound to the project that is open.
   *
   * Bound here because this is where "which project" is known, and memoised on
   * the ref because the workspace subscribes to whatever it is handed: a fresh
   * function every render would be a fresh subscription every render.
   */
  const openPath = project?.path
  const watchOpenProject = useMemo(() => {
    if (!watchProject || openPath === undefined) return undefined
    return (onChanged: () => void) => watchProject(openPath, onChanged)
  }, [watchProject, openPath])

  /**
   * Bumped when the open project has to be read again from disk with nothing
   * carried over — after *take theirs* on the whole folder. Part of the
   * workspace's key, so the session and its undo stack start again from what
   * is now on disk, the way they do when a different project is opened.
   */
  const [reloadKey, setReloadKey] = useState(0)
  const reloadOpenProject = useCallback(() => {
    if (!project) return
    void readScope(scopes, project.path).then(
      (found) => {
        if (!found) { setProject(undefined); refreshTree.current(); return }
        setProject(found)
        setReloadKey((k) => k + 1)
      },
      (cause: unknown) => failedRef.current('reloadOpenProject', cause, 'picker.loadFailed'),
    )
  }, [project, scopes, refreshTree, failedRef])

  /**
   * Opening is what makes a scope "last opened", so both happen here — and, when
   * it was opened for one of the organisation's own pages, which page that was.
   *
   * Held beside the project rather than inside the workspace so that switching
   * scopes clears it: a page asked for on the root is not a page asked for on
   * the landscape opened next.
   */
  const [initialPage, setInitialPage] = useState<InitialPage | undefined>(undefined)
  const enter = useCallback((next: ScopeSnapshot, page?: InitialPage) => {
    // Opened for one board: the session starts on it, the way a tab click
    // would leave it — no step on the stack, and nothing dirty for it.
    const asked = page !== undefined && 'id' in page && page.id !== undefined
      && (page.page === 'board' || page.page === 'sheet' || page.page === 'map' || page.page === 'technology')
      ? page.id : undefined
    setProject(asked !== undefined ? { ...next, activeDiagramId: asked } : next)
    setInitialPage(page)
    prefs.writePreference({ lastScope: next.path })
  }, [prefs])

  /**
   * Whose home is up while nothing is open: the root's, or a scope's beneath
   * it (`OrganisationScreen`). A crumb on the bar and a row's name set it;
   * closing a page over a canvas that draws nothing lands on the open scope's
   * own. Session state and not a preference: `lastScope` says where the work
   * was, and a home is a place you pass through on the way to it.
   */
  const [home, setHome] = useState<ScopePath>(initialHome ?? ROOT_SCOPE)

  /**
   * Open another scope by its path — what *Open …* beside a field another
   * scope answers for does (ADR-0012 §10).
   *
   * Here rather than in the workspace because opening a scope is the shell's
   * act: reading it, making it the one that is open, and remembering it. A
   * path that names nothing is a refreshed tree and nothing else — somebody
   * removed the scope between the index being read and the button being
   * pressed, and there is nothing useful to say about that beyond showing what
   * is there now.
   *
   * A page asked for on a scope with no document is not that: it is a page on
   * a scope nobody has written yet, and it is answered as the organisation's
   * home answers it (`useOrganisation`'s `open`). Written bare and whole first
   * for somebody who may write there — a source whose changes travel as steps
   * refuses a step on a scope that does not exist — and opened empty, with
   * nothing written, for somebody who may only read.
   */
  const openScopeAt = useCallback((path: ScopePath, page?: InitialPage) => {
    void (async () => {
      const found = await readScope(scopes, path)
      if (found) { enter(found, page); return }
      if (!opensOnNothing(page)) { refreshTree.current(); return }
      const bare = bareScope(path, scopePathLabel(path))
      if (writable && !writable(path)) { enter(bare, page); return }
      // Made only where nothing is: a scope somebody made in between is
      // theirs, and is the one entered.
      await ensureScope(scopes, path, { name: bare.model.name })
      const written = await readScope(scopes, path)
      if (!written) { refreshTree.current(); return }
      enter(written, page)
      refreshTree.current()
      refreshIndex?.current()
    })().catch((cause: unknown) => failedRef.current('openScopeAt', cause, 'picker.loadFailed'))
  }, [scopes, enter, refreshTree, refreshIndex, writable, failedRef])

  const goHome = useCallback((to: ScopePath) => {
    setHome(to)
    setProject(undefined)
    setInitialPage(undefined)
    // Deliberately keeps `lastScope`: closing a scope is not the same as saying
    // you never want to see it again, and a refresh should still land you back
    // in your work.
    refreshTree.current()
    // And the index: what a session changed reaches the cards, the register
    // and the findings here, however the source keeps it.
    refreshIndex?.current()
  }, [refreshTree, refreshIndex])

  return {
    project, watchOpenProject, reloadKey, reloadOpenProject, initialPage, enter, home, setHome, openScopeAt, goHome,
  }
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where the shell is: the scope that is open and the page it was opened for,
 * or the home that is up while nothing is — and the moves between them.
 */
import { useCallback, useMemo, useState } from 'react'
import type { RefObject } from 'react'
import type { ScopeSnapshot } from '../projects/scope'
import { ROOT_SCOPE } from '../projects/scopePath'
import type { ScopePath } from '../projects/scopePath'
import type { InitialPage, ScopeLibrary } from './App'
import type { AppFolder } from './appProps'
import type { Failed } from './useShellServices'
import type { ShellPreferences } from './useShellPreferences'

export type ShellNavigation = ReturnType<typeof useShellNavigation>

export function useShellNavigation(deps: {
  initialProject: ScopeSnapshot | undefined
  projects: Pick<ScopeLibrary, 'load'>
  watchProject: AppFolder['watch']
  prefs: ShellPreferences
  failedRef: RefObject<Failed>
  /**
   * The listing read again. A ref because the callbacks that re-read the tree
   * are declared above the hook that owns it, and a hook cannot move above the
   * `enter` it is given.
   */
  refreshTree: RefObject<() => void>
}) {
  const { initialProject, projects, watchProject, prefs, failedRef, refreshTree } = deps
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
    void projects.load(project.path).then(
      (found) => {
        if (!found) { setProject(undefined); refreshTree.current(); return }
        setProject(found)
        setReloadKey((k) => k + 1)
      },
      (cause: unknown) => failedRef.current('reloadOpenProject', cause, 'picker.loadFailed'),
    )
  }, [project, projects, refreshTree, failedRef])

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
  const [home, setHome] = useState<ScopePath>(ROOT_SCOPE)

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
   */
  const openScopeAt = useCallback((path: ScopePath, page?: InitialPage) => {
    void projects.load(path).then(
      (found) => {
        if (found) enter(found, page)
        else refreshTree.current()
      },
      (cause: unknown) => failedRef.current('openScopeAt', cause, 'picker.loadFailed'),
    )
  }, [projects, enter, refreshTree, failedRef])

  const goHome = useCallback((to: ScopePath) => {
    setHome(to)
    setProject(undefined)
    setInitialPage(undefined)
    // Deliberately keeps `lastScope`: closing a scope is not the same as saying
    // you never want to see it again, and a refresh should still land you back
    // in your work.
    refreshTree.current()
  }, [refreshTree])

  return {
    project, watchOpenProject, reloadKey, reloadOpenProject, initialPage, enter, home, setHome, openScopeAt, goHome,
  }
}

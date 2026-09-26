// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The scopes above the open one: their decisions, the name and the client
 * they carry, and the crumbs on the bar.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { RefObject } from 'react'
import type { Translate } from '../i18n'
import type { AncestorRecords } from '../decisions/adrScope'
import { flattenScopes } from '../projects/scope'
import type { ScopeSnapshot, ScopeSummary } from '../projects/scope'
import { organisationLabel, scopeClient } from '../projects/scopeLabel'
import { ancestorScopes } from '../projects/scopePath'
import type { ScopePath } from '../projects/scopePath'
import type { ScopeLibrary } from './App'
import { crumbsFor } from './ShellToolbar'
import type { Failed } from './useShellServices'

export type ScopeAncestry = ReturnType<typeof useScopeAncestry>

export function useScopeAncestry(deps: {
  project: ScopeSnapshot | undefined
  projects: Pick<ScopeLibrary, 'load'>
  /** The listing, which names the crumbs. */
  tree: ScopeSummary
  failedRef: RefObject<Failed>
  s: Translate
}) {
  const { project, projects, tree, failedRef, s } = deps
  /**
   * The scopes above the open one, for the decisions and the client they carry.
   *
   * Read when a scope is entered and after every write, not on every render.
   * ADR-0012 §7 reads a decision up the tree as well as at the scope, so the
   * page beside the landscape still shows the domain's records — which is where
   * a group's used to live, filed one level up and under another name.
   *
   * Loaded rather than listed, because a listing carries names and not
   * decisions. There are at most a handful of ancestors, and a domain's model
   * is small; the root's is the one that is not, and reading it once on opening
   * a scope is the price of the records being reachable at all.
   */
  const [ancestors, setAncestors] = useState<readonly ScopeSnapshot[]>([])
  const openPath = project?.path
  // How a failure is reported is not an input to reading a scope. `failed` is
  // read through the ref so it cannot re-trigger the read: a dependency that
  // changes identity on render is not a needless read but an endless one.
  const readAncestors = useCallback(async (of: ScopePath): Promise<ScopeSnapshot[]> => {
    const held = await Promise.all(ancestorScopes(of).map((path) => projects.load(path)))
    return held.filter((scope): scope is ScopeSnapshot => !!scope)
  }, [projects])
  useEffect(() => {
    if (openPath === undefined) return
    let live = true
    void readAncestors(openPath).then(
      (held) => { if (live) setAncestors(held) },
      (cause: unknown) => {
        if (live) setAncestors([])
        // No message: what an ancestor says is decoration here, and a decisions
        // page that is empty is visible on its own. The trail still gets it.
        failedRef.current('ancestors', cause)
      },
    )
    return () => { live = false }
  }, [openPath, readAncestors, failedRef])

  /**
   * The records of every scope above this one, nearest first (ADR-0012 §7).
   *
   * One list, read up the tree: the decisions page shows this scope's own and
   * a *From …* section per ancestor that has any. Read-only there — a record
   * is edited where it lives, which is the same rule `mayEdit` applies to an
   * element — so nothing here writes them back any more.
   */
  const ancestorDecisions = useMemo<readonly AncestorRecords[]>(
    () => ancestors.map((scope) => ({
      path: scope.path,
      name: scope.model.name,
      decisions: scope.model.decisions ?? [],
    })),
    [ancestors],
  )

  /**
   * The name and the client, walked up the tree over what has been read.
   *
   * The summaries the ancestors were loaded as, plus the open scope's own — so
   * a scope that says nothing yields to the one above it, and a title block is
   * never blank (`projects/scopeLabel.ts`).
   */
  const chain = useMemo<ScopeSummary[]>(() => {
    if (!project) return []
    return [project, ...ancestors].map((scope) => ({
      path: scope.path,
      name: scope.model.name,
      ...(scope.client !== undefined ? { client: scope.client } : {}),
      diagrams: scope.model.diagrams.length,
      children: [],
    }))
  }, [project, ancestors])
  const groupName = project ? organisationLabel(project.path, chain) : ''
  const groupClient = project ? scopeClient(project.path, chain) : undefined
  /** Every scope above the open one, root first, named from the listing. */
  const crumbs = useMemo(
    () => (project ? crumbsFor(project.path, flattenScopes(tree), s) : []),
    [project, tree, s],
  )
  return { ancestorDecisions, groupName, groupClient, crumbs }
}

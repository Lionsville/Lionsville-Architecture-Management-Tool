// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the organisation's home reads off the index (ADR-0012 §2, §7, §9;
 * ADR-0014; ADR-0021): the findings by scope, the register and the
 * technology register, the counts on two cards, and the tree as the agent
 * reads it while nothing is open. One fold each over the index, memoised on
 * it — nothing here commits anything, and nothing loads for it.
 */
import { useMemo, useRef } from 'react'
import type { AppFolder } from './appProps'
import { useIndex } from './useIndex'
import type { Failed } from './useShellServices'
import type { TreeView } from '../agent/tree'
import { findingsByScope, identityFindings } from '../projects/checks'
import { flattenScopes } from '../projects/scope'
import type { ScopeSummary } from '../projects/scope'
import type { ScopeIndex } from '../projects/scopeIndex'
import { ancestorScopes, ROOT_SCOPE } from '../projects/scopePath'
import type { ScopePath } from '../projects/scopePath'
import { technologyRows } from '../projects/technologyRegister'
import type { ScopeLibrary } from './App'
import { registerRows } from './organisation/register'

/**
 * The organisation's index (ADR-0012 §2), held by the shell rather than the
 * workspace because both screens read it: the id policy and `mayEdit` below
 * a canvas, and the finding line on every row of the tree above one. It
 * outlives a scope switch, which is right — it is about the folder and not
 * about what is open in it.
 *
 * Watched over the WHOLE tree (`ROOT_SCOPE`), not the open scope: a sibling
 * domain renaming its ERP is exactly the change the drift check exists to
 * notice, and a watcher bound to the open scope would never hear of it.
 * Watching the root is one subscription on the same watcher the workspace
 * uses — main watches a root once, whoever asks.
 */
export function useTreeIndex(projects: ScopeLibrary, watchProject: AppFolder['watch'], failed: Failed) {
  const watchTree = useMemo(() => {
    if (!watchProject) return undefined
    return (onChanged: () => void) => watchProject(ROOT_SCOPE, onChanged, true)
  }, [watchProject])
  return useIndex({ scopes: projects, watch: watchTree, onFailure: failed })
}

export type TreeFindings = ReturnType<typeof useTreeFindings>

export function useTreeFindings(deps: {
  index: ScopeIndex
  /** The listing, for the agent's `scopes`. */
  tree: ScopeSummary
  /** Whose home is up: the cards count what is below it. */
  home: ScopePath
  projects: Pick<ScopeLibrary, 'load'>
}) {
  const { index, tree, home, projects } = deps
  /**
   * What the organisation contradicts about itself, by scope (ADR-0012 §9).
   *
   * One fold over the index for the whole tree, memoised on it — a row that
   * asked for its own would be a fold per row, and there is one row per scope.
   * Only the findings the index alone can answer are in here; the ones that
   * need a scope's own records belong to the scope that is open.
   */
  const identity = useMemo(() => identityFindings(index), [index])
  /** Every plan flagged as an initiative anywhere below the root (ADR-0012 §7), for the roadmap card. */
  const initiatives = useMemo(() => index.initiativesBelow(home).length, [index, home])
  /** Every observation shared from anywhere below this home (ADR-0021), for the observations card. */
  const sharedObservations = useMemo(
    () => index.observationsBelow(home).filter(({ observation }) => !observation.archived).length,
    [index, home],
  )
  const treeFindings = useMemo(() => findingsByScope(identity), [identity])
  /**
   * The register, derived over the same index and in the same one pass
   * (ADR-0012 §2). The card on the organisation screen and the page behind it
   * read this; nothing commits it, and nothing loads for it.
   */
  const register = useMemo(() => registerRows(index, identity), [index, identity])
  /** The technology register (ADR-0014 §2.6), the same fold over the same index. */
  const technology = useMemo(() => technologyRows(index, identity), [index, identity])
  const shellTree = useShellTree(tree, index, identity, projects)
  return { initiatives, sharedObservations, treeFindings, register, technology, shellTree }
}

/**
 * The tree, for the agent while nothing is open (ADR-0019): the same index
 * the workspace hands it, minus the open document's own findings, which
 * there is no document for. Through a ref, so the shell object the handler
 * keeps reaches the current listing and index.
 */
function useShellTree(
  tree: ScopeSummary, index: ScopeIndex, identity: ReturnType<typeof identityFindings>,
  projects: Pick<ScopeLibrary, 'load'>,
): TreeView {
  const treeRef = useRef({ tree, index, identity })
  treeRef.current = { tree, index, identity }
  return useMemo<TreeView>(() => ({
    scopes: () => flattenScopes(treeRef.current.tree).map((held) => ({
      path: held.path, name: held.name, ...(held.kind ? { kind: held.kind } : {}), views: held.diagrams,
    })),
    lookup: (id) => treeRef.current.index.lookup(id),
    register: () => treeRef.current.index.register(),
    technology: () => technologyRows(treeRef.current.index, treeRef.current.identity),
    initiativesBelow: (path) => treeRef.current.index.initiativesBelow(path),
    observationsBelow: (path) => treeRef.current.index.observationsBelow(path),
    rowsTo: (id, types) => treeRef.current.index.rowsTo(id, types).map((row) => row.relation),
    findings: () => treeRef.current.identity,
    read: async (path) => {
      const held = await projects.load(path)
      if (!held) return undefined
      const above = await Promise.all(ancestorScopes(path).map((one) => projects.load(one)))
      return {
        model: held.model,
        activeDiagramId: held.activeDiagramId,
        ancestorDecisions: above.flatMap((one) => one?.model.decisions ?? []),
      }
    },
  }), [projects])
}

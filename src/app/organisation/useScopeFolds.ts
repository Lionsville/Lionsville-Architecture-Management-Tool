// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Which scopes of the organisation's tree are folded shut.
 *
 * A fold for the session and never saved, as the chart's are (`sessionFolds`).
 * What is kept is what was opened, not what was folded: the tree starts shut,
 * so a home lists its first column and an organisation of a hundred scopes is
 * a page of its domains rather than a page of every team in them. A scope
 * filed a moment ago, or met on a re-read, is folded like the rest.
 */
import { useCallback, useMemo, useState } from 'react'
import { flattenScopes } from '../../projects/scope'
import type { ScopeSummary } from '../../projects/scope'
import type { ScopePath } from '../../projects/scopePath'
import { toggled } from '../sessionFolds'

export type ScopeFolds = {
  /** Every scope with children, until it is opened. */
  collapsed: ReadonlySet<ScopePath>
  toggleCollapsed: (path: ScopePath) => void
  /** Every scope in the tree opened, or every one folded shut again. */
  openAll: () => void
  foldAll: () => void
}

/** The paths below `tree`'s top that have something to fold. */
export function foldsBelow(tree: ScopeSummary): ScopePath[] {
  return flattenScopes(tree).slice(1)
    .filter((scope) => scope.children.length > 0)
    .map((scope) => scope.path)
}

export function useScopeFolds(tree: ScopeSummary): ScopeFolds {
  const [unfolded, setUnfolded] = useState<ReadonlySet<ScopePath>>(() => new Set())
  const parents = useMemo(() => flattenScopes(tree)
    .filter((scope) => scope.children.length > 0)
    .map((scope) => scope.path), [tree])
  const collapsed = useMemo<ReadonlySet<ScopePath>>(
    () => new Set(parents.filter((path) => !unfolded.has(path))), [parents, unfolded],
  )
  const toggleCollapsed = useCallback((path: ScopePath) => setUnfolded((held) => toggled(held, path)), [])
  const openAll = useCallback(() => setUnfolded(new Set(parents)), [parents])
  const foldAll = useCallback(() => setUnfolded(new Set()), [])
  return useMemo(() => ({ collapsed, toggleCollapsed, openAll, foldAll }), [collapsed, toggleCollapsed, openAll, foldAll])
}

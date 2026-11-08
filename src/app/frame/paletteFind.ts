// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What ⌘K finds that is not a record: a scope by its name, and a view of any
 * scope by its name, so every place in the organisation is one search away.
 * And how the lines rank against the records: a line whose words start with
 * what was typed goes ahead of them, so "light" runs Theme: Light rather than
 * opening a box whose description says "slightly".
 */
import type { Destination } from '../../agent/screen'
import { viewPage } from '../../agent/screen'
import type { DesignDiagram } from '../../model/types'
import { fold, matchesQuery, queryTokens } from '../../model/textSearch'
import { flattenScopes } from '../../projects/scope'
import type { ScopeSummary } from '../../projects/scope'
import type { PaletteLine } from '../../search/ui/GlobalSearchDialog'

/** A view as the palette names it: whose it is, and enough to open it. */
export type TreeView = { readonly scope: string; readonly id: string; readonly name: string; readonly kind: DesignDiagram['kind'] }

/** Whether every word typed starts a word of the label: a match on the name itself, not inside it. */
export function startsWords(asked: string, label: string): boolean {
  const tokens = queryTokens(asked)
  if (tokens.length === 0) return false
  const words = fold(label).split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  return tokens.every((token) => words.some((word) => word.startsWith(token)))
}

/** The trail above a scope, by name, for telling two scopes of one name apart. */
function trailOf(tree: ScopeSummary, path: string): string {
  const names: string[] = []
  const walk = (at: ScopeSummary, above: string[]): boolean => {
    if (at.path === path) { names.push(...above); return true }
    return at.children.some((child) => walk(child, [...above, at.name]))
  }
  walk(tree, [])
  return names.join(' › ')
}

/** The scopes whose name answers what was typed, each opening on its home. */
export function scopeLines(tree: ScopeSummary, asked: string, heading: string, go: (to: Destination) => void): PaletteLine[] {
  if (queryTokens(asked).length === 0) return []
  return flattenScopes(tree)
    .filter((scope) => matchesQuery(asked, [scope.name]))
    .map((scope) => ({
      id: `scope:${scope.path}`, group: heading, label: scope.name, lead: true,
      ...(scope.path !== tree.path ? { hint: trailOf(tree, scope.path) } : {}),
      run: () => go({ scope: scope.path, page: 'home' }),
    }))
}

/** The views whose name answers what was typed, each opening where it is drawn. */
export function viewLines(views: readonly TreeView[], tree: ScopeSummary, asked: string, heading: string, go: (to: Destination) => void): PaletteLine[] {
  if (queryTokens(asked).length === 0) return []
  const names = new Map(flattenScopes(tree).map((scope) => [scope.path, scope.name]))
  return views
    .filter((view) => matchesQuery(asked, [view.name]))
    .map((view) => ({
      id: `view:${view.id}`, group: heading, label: view.name, lead: true,
      ...(names.has(view.scope) ? { hint: names.get(view.scope)! } : {}),
      run: () => go({ scope: view.scope, page: viewPage(view.kind), id: view.id }),
    }))
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Whether the organisation holds work: the one rule, for every caller that
 * decides by it — an example kept or copied in (`examples/copy`), the browser's
 * work copied into a folder (`copyScopes`), a working set carried out
 * (`scopeAccess.everyScope`), the first-run page, the field a home shows for a
 * name, and a file that just opens.
 *
 * **A name nobody chose is no work.** A folder lists its organisation under
 * the folder's own name until something is written there (ADR-0012 §1), so a
 * root that answers with a name is not yet a root somebody named: the listing
 * says which (`unnamed`). Each caller that read the name for itself took the
 * folder's for somebody's — a copy into a folder left the organisation and all
 * it held behind, and an example kept into an empty folder was filed under it
 * as a child, its operating model where nothing reads one — so the name is
 * asked here, once, and nowhere else.
 *
 * **Everything else is work**: a scope filed under it, a view of its own, a
 * record, anything it says about itself, a picture, and whatever could not be
 * read, which may be anything.
 *
 * Pure, and over types only: `scopeAccess` asks it, so it asks nothing of
 * `scopeAccess`.
 */
import type { ScopeSnapshot, ScopeSummary } from './scope'
import type { ScopeState } from './scopeState'

/**
 * A scope with no name, and nothing in it or said about it: the organisation
 * before anybody put anything there, which is always there all the same.
 */
export function blank(scope: ScopeState | ScopeSnapshot): boolean {
  const { model } = scope
  const said = Object.entries(model).some(([key, value]) => key !== 'name' && (Array.isArray(value) ? value.length > 0 : value !== undefined))
  const described = scope.kind !== undefined || scope.client !== undefined || (scope.links?.length ?? 0) > 0 || (scope.relevantTo?.length ?? 0) > 0
    || (scope.logoLibrary?.length ?? 0) > 0
  return model.name.trim() === '' && !said && !described && (scope.images?.length ?? 0) === 0
}

/** Whether somebody named it: a name, and not the one the place lists it under. */
export function namedBySomebody(listed: Pick<ScopeSummary, 'name' | 'unnamed'>): boolean {
  return !listed.unnamed && listed.name.trim() !== ''
}

/**
 * Whether a scope holds work, its listing having said whose its name is: a
 * name nobody chose is passed over, and one that could not be read whole, or
 * that a later version wrote, holds work whatever could be read of it.
 */
export function holdsWorkBeyondItsName(scope: ScopeState | ScopeSnapshot, listed: Pick<ScopeSummary, 'name' | 'unnamed'>): boolean {
  if ((scope.unreadable?.length ?? 0) > 0 || ('later' in scope && scope.later)) return true
  return !blank(namedBySomebody(listed) ? scope : { ...scope, model: { ...scope.model, name: '' } })
}

/**
 * Whether the organisation holds work, off its listing and — where it was
 * read — its own document. A listing alone answers for the name, the scopes
 * under it and its views, and cannot see a record: a caller that has the
 * document passes it.
 */
export function organisationHoldsWork(tree: ScopeSummary, root?: ScopeState | ScopeSnapshot): boolean {
  if ((tree.unreadable?.length ?? 0) > 0) return true
  if (tree.children.length > 0 || tree.diagrams > 0 || namedBySomebody(tree)) return true
  return root !== undefined && holdsWorkBeyondItsName(root, tree)
}

/**
 * What to call the organisation a scope belongs to, and who its drawings are
 * made out to.
 *
 * One question, asked in two places — the top bar, and the title block on an
 * exported picture — and answered by walking up the tree (ADR-0012 §1). It used
 * to be `model.customerName`, a copy of the group's name kept on every project
 * in it, which is why renaming a group was a sweep over its projects rather
 * than one write. A name has one home now: the `scope.json` of the scope it is
 * the name of.
 *
 * **The nearest answer wins.** A landscape's own `client` beats its domain's,
 * and the domain's beats the organisation's, because the closest record to the
 * drawing is the one that knows. A scope that says nothing yields to the one
 * above it, all the way to the root — and if the root says nothing either, the
 * scope's own name is a better answer than a blank line.
 *
 * Pure, and over summaries rather than snapshots: the callers have a listing,
 * and loading a whole model to read one field is how a name comes to cost a
 * landscape.
 */
import type { ScopeSummary } from './scope'
import type { ScopePath } from './scopePath'
import { ancestorScopes, ROOT_SCOPE } from './scopePath'

/** A scope and everything above it, nearest first. */
function chain(path: ScopePath, byPath: ReadonlyMap<ScopePath, ScopeSummary>): ScopeSummary[] {
  return [path, ...ancestorScopes(path)]
    .map((held) => byPath.get(held))
    .filter((held): held is ScopeSummary => held !== undefined)
}

/** Everything strictly above this scope, nearest first. */
function above(path: ScopePath, byPath: ReadonlyMap<ScopePath, ScopeSummary>): ScopeSummary[] {
  return ancestorScopes(path)
    .map((held) => byPath.get(held))
    .filter((held): held is ScopeSummary => held !== undefined)
}

/** Every scope in a tree by its path, which is what both answers walk over. */
export function scopesByPath(scopes: readonly ScopeSummary[]): Map<ScopePath, ScopeSummary> {
  return new Map(scopes.map((scope) => [scope.path, scope]))
}

/**
 * The organisation this scope sits in, as a name to show — or nothing, when
 * nothing above it has a name.
 *
 * The root's name where the root has one, because an organisation is the root;
 * the outermost named ancestor otherwise, so a tree somebody has half filled in
 * still says something true. **Never the scope's own name**: a bar reading
 * "Warehouse / Warehouse" says less than "Warehouse" does, and a scope with
 * nothing above it genuinely has no organisation yet.
 */
export function organisationLabel(
  path: ScopePath, scopes: readonly ScopeSummary[],
): string {
  const held = above(path, scopesByPath(scopes))
  const root = held[held.length - 1]
  if (root?.path === ROOT_SCOPE && root.name.trim()) return root.name.trim()
  return [...held].reverse().find((scope) => scope.name.trim())?.name.trim() ?? ''
}

/**
 * Who a drawing made in this scope is addressed to.
 *
 * The nearest `client` up the chain — the scope's own first, because the
 * closest record to the drawing is the one that knows — then the organisation's
 * name, and finally the scope's own name, so a title block is never blank.
 */
export function scopeClient(path: ScopePath, scopes: readonly ScopeSummary[]): string {
  const held = chain(path, scopesByPath(scopes))
  const stated = held.find((scope) => scope.client?.trim())
  if (stated) return stated.client!.trim()
  return organisationLabel(path, scopes) || (held[0]?.name.trim() ?? '')
}

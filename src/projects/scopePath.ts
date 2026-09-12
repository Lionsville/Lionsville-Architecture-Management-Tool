/**
 * Where a scope is: a path, and nothing else (ADR-0012 §1).
 *
 * A scope is a folder, every scope is the same kind of document, and the ref IS
 * the path. That replaces the pair this file used to hold — a group and a key
 * inside it — which could say exactly two levels and had to say both even when
 * one of them meant nothing. A path says any number of levels, including none:
 * the **root is the empty path**, and the root is the organisation by position
 * rather than by anything written in it.
 *
 * ```
 * ''                      the organisation
 * 'retail'                a domain under it
 * 'retail/warehouse'      a landscape under that
 * ```
 *
 * Segments are slugs, so a path survives a URL, a file path and a storage key
 * without escaping, and a store that keeps scopes in folders uses it as a path
 * directly. Nothing inside a scope names its own path: a folder moved in the
 * file manager is the scope at its new address, which is the one rule the old
 * ref shape already had and the only one worth keeping.
 *
 * Addressing only. What a scope is CALLED lives in its `scope.json`, and
 * `scopeLabel.ts` is what walks up the tree for the name a drawing is made out
 * to.
 */
import { KEY_RE, slug } from '../model/keys'

/**
 * A scope's address: slug segments separated by `/`, the empty string for the
 * root.
 *
 * A bare `string` rather than a branded type, because it is used as a map key,
 * a folder path and a storage key by turns, and every one of those would need
 * unwrapping. {@link isSafeScopePath} is the check that makes it trustworthy at
 * the seam, which is where it has to happen anyway — a path reaches a store
 * from stored preferences and, later, from a URL or an IPC message.
 */
export type ScopePath = string

/** The organisation. Every other scope is under it. */
export const ROOT_SCOPE: ScopePath = ''

/**
 * Names a child scope may not take, because the scope's own folder already
 * uses them (ADR-0012 §1).
 *
 * Refused at creation rather than escaped or suffixed: a domain called
 * `decisions` sitting beside the decisions is a folder whose meaning depends on
 * what is inside it, and no listing would ever be readable again.
 */
export const RESERVED_SCOPE_NAMES: readonly string[] = [
  'diagrams', 'docs', 'decisions', 'transitions', 'images', 'logos',
]

export function isReservedScopeName(name: string): boolean {
  return RESERVED_SCOPE_NAMES.includes(name)
}

/** The path split into its segments. The root is none. */
export function scopeSegments(path: ScopePath): string[] {
  return path.split('/').filter((segment) => segment.length > 0)
}

/**
 * The scope this one is filed under, or `undefined` for the root — which has
 * no parent, and is the only scope that does not.
 */
export function parentScope(path: ScopePath): ScopePath | undefined {
  const segments = scopeSegments(path)
  if (segments.length === 0) return undefined
  return segments.slice(0, -1).join('/')
}

/** Every scope between this one and the root, nearest first, root last. */
export function ancestorScopes(path: ScopePath): ScopePath[] {
  const found: ScopePath[] = []
  let held = parentScope(path)
  while (held !== undefined) {
    found.push(held)
    held = parentScope(held)
  }
  return found
}

/** A child's path. `joinScope(ROOT_SCOPE, 'retail')` is `'retail'`. */
export function joinScope(parent: ScopePath, name: string): ScopePath {
  const segments = scopeSegments(parent)
  return [...segments, name].join('/')
}

/** Is `path` this scope, or one filed anywhere beneath it? */
export function isWithinScope(path: ScopePath, within: ScopePath): boolean {
  if (within === ROOT_SCOPE) return true
  return path === within || path.startsWith(`${within}/`)
}

/**
 * Is this something a store may be asked for?
 *
 * Checked rather than trusted, for the reason the old ref was: a segment that
 * is not a slug could walk out of its own folder once a store keeps scopes on
 * disk, and refusing once at the seam is cheaper than sanitising in every
 * adapter. A reserved segment is refused here too, so the rule holds for a path
 * that arrives whole as well as for a name somebody types.
 *
 * The root passes. It is a scope, it can be saved, and a store that refused its
 * own root would have nowhere to put the organisation.
 */
export function isSafeScopePath(value: unknown): value is ScopePath {
  if (typeof value !== 'string') return false
  if (value.startsWith('/') || value.includes('\\')) return false
  const segments = scopeSegments(value)
  // `a//b` and a trailing slash both lose a segment to the filter, so the
  // round trip is what catches them rather than a second pattern.
  if (segments.join('/') !== value) return false
  return segments.every((segment) => KEY_RE.test(segment) && !isReservedScopeName(segment))
}

/**
 * The last segment, which is what a scope is filed under.
 *
 * The root has none, and answers with the empty string rather than with a
 * stand-in name: what the root is CALLED comes from its `scope.json`, and where
 * there is none the folder's own name answers — which only the store knows.
 */
export function scopePathLabel(path: ScopePath): string {
  const segments = scopeSegments(path)
  return segments[segments.length - 1] ?? ''
}

/**
 * A child scope's path from what somebody typed.
 *
 * The name stays in `scope.json`; this only makes it addressable. `taken` keeps
 * a second scope with the same name under the same parent from landing on top
 * of the first — the same rule, and the same helper, as element keys. A name
 * that slugs to a reserved word is suffixed rather than refused, because the
 * refusal a person should see is about the name they typed and belongs in the
 * dialog; this is the address.
 */
export function scopePathFor(
  parent: ScopePath, name: string, taken: Iterable<string> = [],
): ScopePath {
  const claimed = new Set(taken)
  const base = slug(name)
  let segment = base
  let n = 2
  while (claimed.has(segment) || isReservedScopeName(segment)) segment = `${base}-${n++}`
  return joinScope(parent, segment)
}

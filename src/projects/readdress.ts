/**
 * A `ref` is an address, and a move has to carry it (ADR-0012 §3).
 *
 * A stand-in says where the thing it draws is defined, and it says it as a
 * path. Nothing inside a scope names its own path — that is the rule §1 keeps —
 * but everything *else* in the tree may name it, and a folder moved from
 * `acme/rail` to `acme/freight/rail` leaves every stand-in of its masters
 * pointing at a folder that is not there. The drift check reports it, which is
 * honest and useless: nobody edited those scopes, and nobody should have to go
 * and repair them by hand.
 *
 * So a move re-addresses. `copyExampleInto` has done this since the example
 * became a tree, for exactly the reason the drift check found it; this is the
 * same arithmetic said once, for every scope in the tree rather than for the
 * files of one example.
 *
 * Pure: models in, per-scope patches out. Who loads, who saves and in what
 * order is the caller's — and the order is not arbitrary (see
 * {@link readdressRefs}).
 */
import type { DesignElement, ElementId } from '../model'
import type { ScopeModel, ScopeSnapshot } from './scope'
import { isWithinScope, ROOT_SCOPE } from './scopePath'
import type { ScopePath } from './scopePath'

/** One scope's stand-ins that point into the moved subtree, at their new address. */
export type RefPatch = {
  /** Where the scope is NOW — what a store is asked to load, before anything moves. */
  path: ScopePath
  /** The records to rewrite, in the order the model holds them. */
  refs: readonly { id: ElementId; ref: ScopePath }[]
}

/**
 * One address, carried: `from` and anything under it becomes `to`.
 *
 * Anything else is left exactly as it was — including a ref that is already
 * wrong, which is a drift finding and not this pass's business to guess at.
 */
export function readdressRef(ref: ScopePath, from: ScopePath, to: ScopePath): ScopePath {
  if (from === ROOT_SCOPE || !isWithinScope(ref, from)) return ref
  const below = ref.slice(from.length)
  return `${to}${below}`
}

/**
 * Every scope in the tree that points into the subtree at `from`, with the
 * refs it should hold once that subtree sits at `to`.
 *
 * **The scopes outside the subtree come first**, then the ones inside it, and
 * the order is the point rather than a tidy detail: the scopes outside are
 * saved where they stand, and the ones inside are saved at their new addresses
 * by the move itself — which is followed by the removal of the old folder. A
 * pass that wrote the subtree first and then failed would have removed the old
 * folder before the rest of the tree learnt where it went.
 *
 * The root is never moved and never a subtree here: `isWithinScope` answers
 * true for everything against the root, so a move `from` the root would
 * re-address the whole organisation onto one path.
 */
export function readdressRefs(
  models: readonly ScopeModel[],
  from: ScopePath,
  to: ScopePath,
): RefPatch[] {
  if (from === ROOT_SCOPE || from === to) return []
  const found: RefPatch[] = []
  for (const { path, model } of models) {
    const refs = model.elements.flatMap((element) => {
      if (element.ref === undefined) return []
      const next = readdressRef(element.ref, from, to)
      return next === element.ref ? [] : [{ id: element.id, ref: next }]
    })
    if (refs.length > 0) found.push({ path, refs })
  }
  return found.sort((a, b) => order(a.path, from) - order(b.path, from) || a.path.localeCompare(b.path))
}

function order(path: ScopePath, from: ScopePath): number {
  return isWithinScope(path, from) ? 1 : 0
}

/**
 * The scope with this patch applied, or the scope itself where there is none.
 *
 * A new record per rewritten ref and the rest by reference: a save writes what
 * changed, and a model rebuilt whole would be a folder rewritten whole.
 */
export function applyRefPatch(scope: ScopeSnapshot, patch?: RefPatch): ScopeSnapshot {
  if (!patch || patch.refs.length === 0) return scope
  const wanted = new Map(patch.refs.map((held) => [held.id, held.ref]))
  const elements: DesignElement[] = scope.model.elements.map((element) => {
    const ref = wanted.get(element.id)
    return ref === undefined ? element : { ...element, ref }
  })
  return { ...scope, model: { ...scope.model, elements } }
}

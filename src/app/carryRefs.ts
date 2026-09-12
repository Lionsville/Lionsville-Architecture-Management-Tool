/**
 * A move re-addresses (ADR-0012 §3).
 *
 * Moving a scope is save-then-remove over a subtree, and until now that carried
 * the folders and not the addresses: every stand-in elsewhere in the tree went
 * on pointing at where the subtree used to be, which the drift check reported
 * as a fault in scopes nobody had touched. The arithmetic is
 * `projects/readdress.ts`; this is the pass that binds it to a store, and both
 * places that move a scope — the organisation screen's settings dialog and the
 * open workspace's — call it.
 *
 * **The other scopes first.** They are saved where they stand, so a failure
 * here is a move that has not started; the subtree's own refs come back as
 * patches for the caller to apply as it writes each scope at its new address,
 * because that write is happening anyway and doing it twice would be two
 * commits' worth of churn per scope. The removal of the old folder is last, as
 * it always was.
 */
import { applyRefPatch, readdressRefs } from '../projects/readdress'
import type { RefPatch } from '../projects/readdress'
import { treeModels } from '../projects/scopeIndex'
import type { IndexSource } from '../projects/scopeIndex'
import type { ScopeSnapshot } from '../projects/scope'
import { isWithinScope } from '../projects/scopePath'
import type { ScopePath } from '../projects/scopePath'

/** What this pass does to a store: reads the tree, and writes the scopes outside the move. */
export type CarryStore = IndexSource & { save(scope: ScopeSnapshot): Promise<void> }

/**
 * Carry every address that points into the subtree at `from` over to `to`.
 *
 * Answers the patches for the scopes INSIDE the subtree, keyed by where they
 * are now — which is what the caller loads them from. A scope with nothing
 * pointing into the move is not in the map, and {@link applyRefPatch} takes
 * `undefined` for exactly that reason.
 */
export async function carryRefs(deps: {
  scopes: CarryStore
  from: ScopePath
  to: ScopePath
}): Promise<Map<ScopePath, RefPatch>> {
  const { scopes, from, to } = deps
  const patches = readdressRefs(await treeModels(scopes), from, to)
  const within = new Map<ScopePath, RefPatch>()
  for (const patch of patches) {
    if (isWithinScope(patch.path, from)) { within.set(patch.path, patch); continue }
    const held = await scopes.load(patch.path)
    if (held) await scopes.save(applyRefPatch(held, patch))
  }
  return within
}

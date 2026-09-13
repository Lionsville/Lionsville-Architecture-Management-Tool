/**
 * The owner's description of every stand-in this scope draws (ADR-0012 §3).
 *
 * A description is maintained where the thing is defined, and an overview
 * only shows it: the card of another domain's application says what that
 * domain says about it, and the inspector greys the field with a way there.
 * Nothing is written into this scope for it — a copy would be one more cache
 * to drift, about the one field a person edits most.
 *
 * The index cannot answer this: it reads every scope's `model.json` and
 * never a description (`ScopeStore.models`), so the owning scopes are loaded
 * here — one load per DISTINCT owner, not per card, memoised until the tree
 * changes, which is when the index is rebuilt and this reads again. A scope
 * that will not load contributes nothing rather than an empty string, so a
 * card falls back to its own text rather than going blank.
 */
import { useEffect, useState } from 'react'
import type { ElementId } from '../model'
import type { ScopeSnapshot } from '../projects/scope'
import type { ScopeIndex } from '../projects/scopeIndex'
import type { ScopePath } from '../projects/scopePath'

export function useOwnerDescriptions(deps: {
  scope: ScopePath
  index: ScopeIndex
  /** Absent where there is no tree to read — a test, a browser tab with one scope. */
  load?: (path: ScopePath) => Promise<ScopeSnapshot | undefined>
}): ReadonlyMap<ElementId, string> {
  const { scope, index, load } = deps
  const [found, setFound] = useState<ReadonlyMap<ElementId, string>>(() => new Map())

  useEffect(() => {
    if (!load) return
    const wanted = new Map<ScopePath, ElementId[]>()
    for (const entry of index.entries()) {
      if (entry.master === undefined || entry.master === scope || !entry.drawnIn.includes(scope)) continue
      wanted.set(entry.master, [...(wanted.get(entry.master) ?? []), entry.id])
    }
    let stale = false
    void Promise.all([...wanted].map(async ([path, ids]) => {
      const held = await load(path).catch(() => undefined)
      if (!held) return []
      return ids.flatMap((id) => {
        const text = held.model.elements.find((element) => element.id === id)?.description
        return text !== undefined ? [[id, text] as const] : []
      })
    })).then((pairs) => {
      if (!stale) setFound(new Map(pairs.flat()))
    })
    return () => { stale = true }
  }, [scope, index, load])

  return found
}

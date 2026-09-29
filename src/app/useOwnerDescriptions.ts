// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
 * never a description (`ScopeStore.models`), so the owning scopes are read
 * here — one read per DISTINCT owner, not per card, memoised until the tree
 * changes, which is when the index is rebuilt and this reads again. The read
 * is `ScopeStore.descriptions` where the store has it, which is the `docs/`
 * folder and nothing else; a store without it is loaded in full, which is
 * slower and not wrong. A scope that will not read contributes nothing
 * rather than an empty string, so a card falls back to its own text rather
 * than going blank.
 */
import { useEffect, useState } from 'react'
import type { DesignElement, ElementId } from '../model'
import { readScopes } from '../projects/scopeAccess'
import type { ScopeReader } from '../projects/scopeAccess'
import type { ScopeIndex } from '../projects/scopeIndex'
import type { ScopePath } from '../projects/scopePath'

export function useOwnerDescriptions(deps: {
  scope: ScopePath
  index: ScopeIndex
  /** Where the owning scopes are read; absent where there is no tree to read — a test. */
  scopes?: ScopeReader
}): ReadonlyMap<ElementId, string> {
  const { scope, index, scopes } = deps
  const [found, setFound] = useState<ReadonlyMap<ElementId, string>>(() => new Map())

  useEffect(() => {
    if (!scopes) return
    const wanted = new Map<ScopePath, ElementId[]>()
    for (const entry of index.entries()) {
      if (entry.master === undefined || entry.master === scope || !entry.drawnIn.includes(scope)) continue
      wanted.set(entry.master, [...(wanted.get(entry.master) ?? []), entry.id])
    }
    let stale = false
    const read = async (path: ScopePath, ids: readonly ElementId[]): Promise<(readonly [ElementId, string])[]> => {
      const [held] = await readScopes(scopes, [path]).catch(() => [undefined])
      return held ? describedIn(held.model.elements, ids) : []
    }
    void Promise.all([...wanted].map(([path, ids]) => read(path, ids))).then((pairs) => {
      if (!stale) setFound(new Map(pairs.flat()))
    })
    return () => { stale = true }
  }, [scope, index, scopes])

  return found
}

/**
 * The descriptions of `ids` among an owner's elements, and of nothing else.
 *
 * An owner is often a landscape of thousands, and a scope draws a handful of
 * them: one pass that stops once every id is found, keeping only those, rather
 * than a table of every description the owner holds to look a dozen up in.
 */
export function describedIn(
  elements: readonly DesignElement[], ids: readonly ElementId[],
): (readonly [ElementId, string])[] {
  const wanted = new Set(ids)
  const found: (readonly [ElementId, string])[] = []
  if (wanted.size === 0) return found
  for (const element of elements) {
    if (!wanted.delete(element.id)) continue
    if (element.description !== undefined) found.push([element.id, element.description])
    if (wanted.size === 0) break
  }
  return found
}

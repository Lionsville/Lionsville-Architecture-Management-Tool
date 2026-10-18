// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The functions the scopes below have taken up, and the ones a scope may take
 * up from above (ADR-0012 §3, ADR-0040 §5–§6), read off the index.
 *
 * A claim is a stand-in of a function in the claiming scope's own model, so
 * the tree already says who took what up: an entry's `drawnIn`. Nothing is
 * written for it and nothing is kept: the sheet's *not yet mapped* band, the
 * organisation's card, the inspector's *Taken up by* and the agent's
 * `element.describe` all ask the same index the same question.
 *
 * Kept once per index and scope, because a sheet's layout is memoised on
 * the set this answers, and a fresh set per render would lay it out again.
 */
import type { DesignElement, ElementId } from '../model'
import type { IndexEntry, ScopeIndex } from './scopeIndex'
import { isWithinScope } from './scopePath'
import type { ScopePath } from './scopePath'

/** Strictly below `scope`: within it, and not it. */
function isBelow(path: ScopePath, scope: ScopePath): boolean {
  return path !== scope && isWithinScope(path, scope)
}

/**
 * Every function a scope strictly below `scope` holds a stand-in of, with the
 * scopes that hold one, in path order. Functions only: a stand-in of an
 * application is drawing it, not taking anything up.
 */
export function takenUpBelow(index: ScopeIndex, scope: ScopePath): ReadonlyMap<ElementId, readonly ScopePath[]> {
  let byScope = keptBelow.get(index)
  if (!byScope) {
    byScope = new Map()
    keptBelow.set(index, byScope)
  }
  const held = byScope.get(scope)
  if (held) return held
  const answer = new Map<ElementId, ScopePath[]>()
  for (const entry of index.entries()) {
    if (entry.kind !== 'function') continue
    const takers = entry.drawnIn.filter((path) => isBelow(path, scope))
    if (takers.length > 0) answer.set(entry.id, takers)
  }
  byScope.set(scope, answer)
  return answer
}
const keptBelow = new WeakMap<ScopeIndex, Map<ScopePath, ReadonlyMap<ElementId, readonly ScopePath[]>>>()

/** The ids alone, as the band reads them: the same set for the same map. */
export function takenUpIds(taken: ReadonlyMap<ElementId, readonly ScopePath[]>): ReadonlySet<ElementId> {
  const held = keptIds.get(taken)
  if (held) return held
  const ids: ReadonlySet<ElementId> = new Set(taken.keys())
  keptIds.set(taken, ids)
  return ids
}
const keptIds = new WeakMap<ReadonlyMap<ElementId, readonly ScopePath[]>, ReadonlySet<ElementId>>()

/** The scopes strictly below the one that defines `id` that hold a stand-in of it: who took it up. */
export function takenUpBy(index: ScopeIndex, id: ElementId): ScopePath[] {
  const entry = index.lookup(id)
  if (entry?.master === undefined) return []
  const master = entry.master
  return entry.drawnIn.filter((path) => isBelow(path, master))
}

/** One function a scope may take up: the entry, and the names of what it sits in, nearest last. */
export type Claimable = { entry: IndexEntry & { master: ScopePath }; within: string[] }

/**
 * Every function of a sheet above `scope` that `scope` does not hold yet, by
 * the scope that defines it — nearest the organisation first — and then by
 * name. `model` is the scope's session, so one taken up a moment ago is not
 * offered again.
 */
export function claimable(
  index: ScopeIndex, scope: ScopePath, model: { readonly elements: readonly DesignElement[] },
): Claimable[] {
  const held = new Set(model.elements.map((element) => element.id))
  const out: Claimable[] = []
  for (const entry of index.entries()) {
    if (entry.kind !== 'function' || entry.master === undefined || held.has(entry.id)) continue
    if (!isBelow(scope, entry.master)) continue
    out.push({ entry: entry as Claimable['entry'], within: parentsOf(index, entry) })
  }
  return out.sort((a, b) => a.entry.master.length - b.entry.master.length
    || a.entry.master.localeCompare(b.entry.master)
    || a.entry.name.localeCompare(b.entry.name))
}

/** What an entry sits in, by name, from its root down to its parent. */
function parentsOf(index: ScopeIndex, entry: IndexEntry): string[] {
  const names: string[] = []
  const seen = new Set<ElementId>([entry.id])
  let at = entry.parentId
  while (at !== undefined && !seen.has(at)) {
    seen.add(at)
    const parent = index.lookup(at)
    if (!parent) break
    names.unshift(parent.name)
    at = parent.parentId
  }
  return names
}

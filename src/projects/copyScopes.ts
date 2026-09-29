// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Every scope one place keeps, copied into another that keeps what it has
 * (ADR-0031 §1): the work a person did before they chose where work should
 * live, brought along once they have.
 *
 * **Nothing there is written over.** A scope at an address the destination
 * already holds something at is kept as it is, and counted; the copy is for
 * work that has nowhere else to be, and a destination that holds a scope at
 * the same address holds somebody's work. **Nothing is taken from where it
 * was.** Until somebody has opened the destination and seen their work in it,
 * the old copy is the only one that has certainly survived.
 *
 * One scope at a time, each a content that arrives whole, shallowest first so
 * a scope's parent is its own and not one made to hold it: a scope that will
 * not land is counted and the rest go on, and a scope that will not read is
 * left where it is and counted apart — the count a person looking for lost
 * work reads.
 */
import type { ImageRepository } from '../ports/ImageRepository'
import type { ScopeRepository } from '../ports/ScopeRepository'
import {
  blank, carriedOf, contentOf, nodesOf, picturesOf, placeTogether, readScope, snapshotOf,
} from './scopeAccess'
import type { ScopeReader } from './scopeAccess'
import type { ScopeAddress } from './scopeState'
import { isScopeMoved } from './revision'
import type { ScopeSnapshot } from './scope'

/** What a copy did: brought, kept as the destination had it, would not land, would not read. */
export type CopyTally = {
  scopes: number
  kept: number
  failed: number
  unread: number
  /** Where a scope was left behind, failed or unread: for the person, who is looking for it. */
  missed: ScopeAddress[]
}

type From = { scopes: ScopeReader; images: Pick<ImageRepository, 'bytes'> }
type Into = {
  scopes: ScopeReader & Pick<ScopeRepository, 'create' | 'apply' | 'remove'>
  images: Pick<ImageRepository, 'put'>
}

/**
 * Whether a place holds any work at all: a scope somebody put something in.
 * The organisation is always there, and with nothing in it is nothing yet. A
 * place that will not answer holds nothing anybody can act on — what hangs on
 * this is whether to ask a question, and one raised by a failed read is one
 * nobody can answer.
 */
export async function holdsWork(from: { scopes: ScopeReader }): Promise<boolean> {
  try {
    for (const node of nodesOf((await from.scopes.tree()).root)) {
      const state = await from.scopes.state(node.id).catch(() => undefined)
      if (state && !blank(state)) return true
    }
  } catch {
    return false
  }
  return false
}

/** What was checked at an address: nothing there, or the revision read — and nothing to say where the read had none. */
function checkedOf(there: ScopeSnapshot | undefined): { checked?: { revision?: string } } {
  if (!there) return { checked: {} }
  return there.revision !== undefined ? { checked: { revision: there.revision } } : {}
}

export async function copyScopes(from: From, into: Into): Promise<CopyTally> {
  const tally: CopyTally = { scopes: 0, kept: 0, failed: 0, unread: 0, missed: [] }
  const tree = await from.scopes.tree()
  tally.unread += tree.unreadable?.length ?? 0
  tally.missed.push(...tree.unreadable ?? [])
  for (const node of nodesOf(tree.root)) {
    const state = await from.scopes.state(node.id).catch(() => undefined)
    if (!state) { tally.unread += 1; tally.missed.push(node.address); continue }
    if (blank(state)) continue
    try {
      const there = await readScope(into.scopes, node.address)
      if (there && !blank(there)) { tally.kept += 1; continue }
      const carried = await carriedOf(from.images, state.id, state.images)
      // Expecting what was checked: a write that lands there in between is
      // somebody working in the folder, and theirs stands.
      await placeTogether(into, [{
        address: node.address, content: contentOf(snapshotOf(state), []), pictures: picturesOf(carried),
        ...checkedOf(there),
      }])
      tally.scopes += 1
    } catch (cause) {
      if (isScopeMoved(cause)) { tally.kept += 1; continue }
      tally.failed += 1
      tally.missed.push(node.address)
    }
  }
  return tally
}

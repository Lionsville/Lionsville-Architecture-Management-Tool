// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The other tabs of this browser that keep work in the same database, and what
 * each wrote: the second author a browser tab has, which a folder's watcher
 * hears for a folder (ADR-0022's `SourceChanges`).
 *
 * Every write that lands here is said on a channel the others listen to, by
 * the identities of the scopes it wrote; a tab never hears its own. A tab
 * without the channel — a browser that has none — hears nothing and says
 * nothing, which is what it did before.
 */
import type { SourceChanges } from '../../ports/ProviderParts'
import type { ScopeRepository } from '../../ports/ScopeRepository'
import type { ScopeId } from '../../projects/scopeState'

/** What one tab says to the others: the scopes a write touched, or that the tree's shape moved. */
export type TabWrite = { readonly scopes: readonly ScopeId[]; readonly tree?: true }

/** As much of a `BroadcastChannel` as this needs, so a suite can hand in its own. */
export type TabChannel = {
  postMessage(message: TabWrite): void
  addEventListener(type: 'message', listener: (event: { data: unknown }) => void): void
  removeEventListener(type: 'message', listener: (event: { data: unknown }) => void): void
}

export const TAB_CHANNEL = 'lvarch.repositories'

/** This browser's channel between tabs, where it has one. */
export function tabChannel(name: string = TAB_CHANNEL): TabChannel | undefined {
  const Made = (globalThis as { BroadcastChannel?: new (name: string) => TabChannel }).BroadcastChannel
  if (!Made) return undefined
  try {
    return new Made(name)
  } catch {
    return undefined
  }
}

function isTabWrite(data: unknown): data is TabWrite {
  return typeof data === 'object' && data !== null && Array.isArray((data as TabWrite).scopes)
}

/**
 * The scopes, saying every write that landed to the other tabs, and the way
 * to hear theirs: a scope by its address, read against the tree as it is when
 * the word arrives, or — with `wholeTree` — any write at all.
 */
export function overOtherTabs(scopes: ScopeRepository, channel: TabChannel): { scopes: ScopeRepository; changes: SourceChanges } {
  const say = (write: TabWrite) => {
    try {
      channel.postMessage(write)
    } catch {
      // A channel closed under a closing tab: nobody is left to tell.
    }
  }
  const told = <T extends object>(answer: T, write: TabWrite): T => {
    if (!('refused' in answer)) say(write)
    return answer
  }
  const said: ScopeRepository = {
    id: scopes.id,
    tree: () => scopes.tree(),
    state: (id) => scopes.state(id),
    apply: async (work) => told(await scopes.apply(work), { scopes: work.map((one) => one.scope) }),
    create: async (at, scope) => told(await scopes.create(at, scope), { scopes: [], tree: true }),
    move: async (scope, to, expects) => told(await scopes.move(scope, to, expects), { scopes: [scope], tree: true }),
    remove: async (scope, expects, options) => told(await scopes.remove(scope, expects, options), { scopes: [scope], tree: true }),
  }
  const changes: SourceChanges = (scope, onChanged, wholeTree = false) => {
    const listener = (event: { data: unknown }) => {
      const write = event.data
      if (!isTabWrite(write)) return
      if (wholeTree) { onChanged(); return }
      void scopes.tree().then((tree) => {
        const ids = new Set(write.scopes)
        const walk = (node: typeof tree.root): boolean => (node.address === scope ? ids.has(node.id) : node.children.some(walk))
        if (walk(tree.root)) onChanged()
      }, () => onChanged())
    }
    channel.addEventListener('message', listener)
    return () => channel.removeEventListener('message', listener)
  }
  return { scopes: said, changes }
}

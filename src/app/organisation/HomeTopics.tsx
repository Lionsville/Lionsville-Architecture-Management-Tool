// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The topics over a home (ADR-0042): the access every topic screen on it
 * reads — the card, the catalogue, *Relevant topics*, the tree's ↗ rows —
 * made from the shell's store and the home's own reads, and handed down once.
 * Where the shell keeps no store for them, nothing is handed down and none of
 * them is drawn.
 */
import type { ReactNode } from 'react'
import { TopicsProvider } from './TopicsContext'
import { useTopicsAccess } from './useTopicsAccess'
import type { TopicsDeps } from './useTopicsAccess'

/** What the shell gives the topics: where scopes are kept and the index to move one by, and what follows a write. */
export type TopicsStore = Pick<TopicsDeps, 'scopes' | 'index' | 'written' | 'notify'>

type Reads = Omit<TopicsDeps, keyof TopicsStore>

function WithTopics({ store, reads, children }: { store: TopicsStore; reads: Reads; children: ReactNode }) {
  const access = useTopicsAccess({ ...store, ...reads })
  return <TopicsProvider value={access}>{children}</TopicsProvider>
}

export function HomeTopics({ store, children, ...reads }: Reads & { store: TopicsStore | undefined; children: ReactNode }) {
  if (!store) return <>{children}</>
  return <WithTopics store={store} reads={reads}>{children}</WithTopics>
}

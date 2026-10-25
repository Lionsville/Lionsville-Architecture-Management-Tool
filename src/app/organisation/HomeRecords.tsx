// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The records a home reads across the tree and writes in other scopes: the
 * topics (ADR-0042) and the building blocks with every scope's evaluation of
 * one (ADR-0043). The access every screen of either reads — the cards, the
 * catalogue, the register, a block's page, *Relevant topics*, the tree's ↗
 * rows — made from the shell's store and the home's own reads, and handed
 * down once. Where the shell keeps no store for them, nothing is handed down
 * and none of them is drawn.
 */
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { BlocksProvider } from '../../blocks/ui/BlocksContext'
import type { ScopeIndex } from '../../projects/scopeIndex'
import type { ScopePath } from '../../projects/scopePath'
import { useBlocksAccess } from '../blocks/useBlocksAccess'
import { TopicsProvider } from './TopicsContext'
import { useTopicsAccess } from './useTopicsAccess'
import type { TopicsDeps } from './useTopicsAccess'

/** What the shell gives the home: where scopes are kept, the index to move one by and the tree's index to read, and what follows a write. */
export type HomeStore = Pick<TopicsDeps, 'scopes' | 'index' | 'written' | 'notify'> & {
  /** The tree's index as it stands: every block and every evaluation. */
  treeIndex: ScopeIndex
  makeId: (prefix: string) => string
}

type Reads = Omit<TopicsDeps, keyof HomeStore | 'blocksAt'> & {
  /** A block's page over the home, on a scope's evaluation where one is named. */
  openBlock: (block: string, evaluation?: ScopePath) => void
}

function WithRecords({ store, reads, children }: { store: HomeStore; reads: Reads; children: ReactNode }) {
  const { treeIndex } = store
  const blocksAt = useMemo(() => {
    const kept = treeIndex.buildingBlocks()
    return (path: ScopePath) => kept.filter((one) => one.scope === path).length
  }, [treeIndex])
  const topics = useTopicsAccess({ ...store, ...reads, blocksAt })
  const blocks = useBlocksAccess({ ...store, ...reads, index: treeIndex })
  return (
    <TopicsProvider value={topics}>
      <BlocksProvider value={blocks}>{children}</BlocksProvider>
    </TopicsProvider>
  )
}

export function HomeRecords({ store, children, ...reads }: Reads & { store: HomeStore | undefined; children: ReactNode }) {
  if (!store) return <>{children}</>
  return <WithRecords store={store} reads={reads}>{children}</WithRecords>
}

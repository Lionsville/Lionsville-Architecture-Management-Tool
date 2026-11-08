// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it, vi } from 'vitest'
import { memoryRepositories } from '../memory/memoryRepositories'
import { contentOf, placeTogether } from '../../projects/scopeAccess'
import { overOtherTabs } from './otherTabs'
import type { TabChannel, TabWrite } from './otherTabs'

/** Two tabs' ends of one channel: what one posts the other hears, and never itself. */
function channelPair(): [TabChannel, TabChannel] {
  const ends = [new Set<(event: { data: unknown }) => void>(), new Set<(event: { data: unknown }) => void>()]
  const end = (mine: number): TabChannel => ({
    postMessage: (message: TabWrite) => { for (const listener of ends[1 - mine]) listener({ data: structuredClone(message) }) },
    addEventListener: (_type, listener) => { ends[mine].add(listener) },
    removeEventListener: (_type, listener) => { ends[mine].delete(listener) },
  })
  return [end(0), end(1)]
}

async function oneDatabase() {
  const repositories = memoryRepositories()
  const scope = (path: string, name: string) => ({ address: path, content: contentOf({ path, model: { name, elements: [], relations: [], diagrams: [] }, activeDiagramId: '', logoLibrary: [] }, []) })
  await placeTogether(repositories, [scope('', 'Acme'), scope('acme', 'Acme Logistics'), scope('other', 'Other')])
  return repositories
}

const settled = () => new Promise((resolve) => { setTimeout(resolve, 0) })

describe('the other tabs of this browser', () => {
  it('hear a write to the scope they have open, and not one to another scope', async () => {
    const database = await oneDatabase()
    const [here, there] = channelPair()
    const a = overOtherTabs(database.scopes, here)
    const b = overOtherTabs(database.scopes, there)
    const onAcme = vi.fn()
    const onOther = vi.fn()
    b.changes('acme', onAcme)
    b.changes('other', onOther)
    const ownHere = vi.fn()
    a.changes('acme', ownHere)
    const acme = (await database.scopes.tree()).root.children.find((node) => node.address === 'acme')!
    await a.scopes.apply([{ scope: acme.id, steps: [] }])
    await settled()
    expect(onAcme).toHaveBeenCalledTimes(1)
    expect(onOther).not.toHaveBeenCalled()
    // A tab never hears its own write as somebody else's.
    expect(ownHere).not.toHaveBeenCalled()
  })

  it('tells the whole tree of any write, and stops telling once let go', async () => {
    const database = await oneDatabase()
    const [here, there] = channelPair()
    const a = overOtherTabs(database.scopes, here)
    const b = overOtherTabs(database.scopes, there)
    const onTree = vi.fn()
    const stop = b.changes('', onTree, true)
    await a.scopes.create('new-one', { name: 'New' } as never)
    await settled()
    expect(onTree).toHaveBeenCalledTimes(1)
    stop()
    await a.scopes.create('newer', { name: 'Newer' } as never)
    await settled()
    expect(onTree).toHaveBeenCalledTimes(1)
  })
})

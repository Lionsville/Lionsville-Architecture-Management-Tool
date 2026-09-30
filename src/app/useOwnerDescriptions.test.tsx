// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A description is maintained where the thing is defined (ADR-0012 §3): an
 * overview reads the owner's, one load per owning scope, and keeps none.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { FakeDirectory } from '../adapters/folder/fakeDirectory'
import { folderRepositories } from '../adapters/folder/folderRepositories'
import { descriptionPath } from '../adapters/folder/format/folderFormat'
import { markdownFile } from '../adapters/folder/format/fileText'
import { writeAt } from '../adapters/folder/handles'
import { memoryGit } from '../adapters/folder/memoryGit'
import { contentOf, placeTogether } from '../projects/scopeAccess'
import { useIndex } from './useIndex'
import type { DesignElement } from '../model'
import type { ScopeSnapshot } from '../projects/scope'
import { indexScopes } from '../projects/scopeIndex'
import { heldRepositories } from './testing/heldRepositories'
import { describedIn, useOwnerDescriptions } from './useOwnerDescriptions'

afterEach(() => cleanup())

const element = (id: string, over: Partial<DesignElement> = {}): DesignElement =>
  ({ id, kind: 'application', name: id, lifecycle: 'live', isManaged: true, aspects: {}, ...over })

const snapshot = (path: string, elements: DesignElement[]): ScopeSnapshot =>
  ({ path, model: { name: path, elements, relations: [], diagrams: [] }, activeDiagramId: '', logoLibrary: [] })

const tree = {
  'acme/retail': snapshot('acme/retail', [element('erp', { description: 'Retail says: the ERP' }), element('pos')]),
  'acme/logistics': snapshot('acme/logistics', [element('wms', { description: 'Stock and docks' })]),
  '': snapshot('', [
    element('erp', { ref: 'acme/retail', description: 'What the overview once wrote' }),
    element('wms', { ref: 'acme/logistics' }),
    element('pos', { ref: 'acme/retail' }),
    element('ghost', { ref: 'nowhere' }),
  ]),
}
const index = indexScopes(Object.values(tree).map(({ path, model }) => ({ path, model })))

function mount() {
  const repositories = heldRepositories(Object.values(tree))
  const states = vi.fn((id: string) => repositories.scopes.state(id))
  const scopes = { tree: () => repositories.scopes.tree(), state: states }
  let held!: ReadonlyMap<string, string>
  function Host() {
    held = useOwnerDescriptions({ scope: '', index, scopes })
    return null
  }
  render(<Host />)
  return { states, repositories, held: () => held }
}

describe('useOwnerDescriptions', () => {
  it('reads each owner once and answers with what the owner says, for the ids it has text for', async () => {
    const host = mount()
    await vi.waitFor(() => expect(host.held().get('erp')).toBe('Retail says: the ERP'))
    const owners = [(await host.repositories.read('acme/logistics'))?.id, (await host.repositories.read('acme/retail'))?.id]
    expect(host.states.mock.calls.map(([id]) => id).sort()).toEqual([...owners].sort())
    expect(host.held().get('wms')).toBe('Stock and docks')
    // No text at the owner, and no owner at all: nothing, so a card falls back.
    expect(host.held().has('pos')).toBe(false)
    expect(host.held().has('ghost')).toBe(false)
  })

  it('reads nothing where there is nothing to read from', () => {
    let held!: ReadonlyMap<string, string>
    function Host() { held = useOwnerDescriptions({ scope: '', index }); return null }
    render(<Host />)
    expect(held.size).toBe(0)
  })
})

/**
 * A description changed and nothing else: a pull, or another window, writing
 * an owner's `docs/`. A folder's index reads no description, so `since` says
 * nothing changed and the index keeps its identity; the descriptions are read
 * again all the same, because the source answered.
 */
describe('an owner whose description alone changed, in a folder', () => {
  it('is read again when the index answers, though the index did not move', async () => {
    const root = new FakeDirectory()
    const repositories = folderRepositories({ root, git: memoryGit(root) })
    await placeTogether(repositories, [snapshot('', [element('erp', { ref: 'acme/retail' })]), tree['acme/retail']]
      .map((scope) => ({ address: scope.path, content: contentOf(scope, []), pictures: [] })))
    let tell = () => {}
    let held!: ReadonlyMap<string, string>
    let seen!: { index: unknown; answered: number }
    function Host() {
      const hook = useIndex({ index: repositories.index, watch: (onChanged) => { tell = onChanged; return () => {} }, onFailure: () => {} })
      seen = hook
      held = useOwnerDescriptions({ scope: '', index: hook.index, answered: hook.answered, scopes: repositories.scopes })
      return null
    }
    render(<Host />)
    await vi.waitFor(() => expect(held.get('erp')).toBe('Retail says: the ERP'))
    const before = seen

    await writeAt(root, `acme/retail/${descriptionPath('erp')!}`, markdownFile('Retail says it again'))
    await act(async () => { tell() })
    await vi.waitFor(() => expect(seen.answered).toBe(before.answered + 1))
    expect(seen.index).toBe(before.index)
    await vi.waitFor(() => expect(held.get('erp')).toBe('Retail says it again'))
  })
})

describe('describedIn', () => {
  it('answers for the ids asked about and nothing else the owner holds', () => {
    const owner = [
      element('erp', { description: 'the ERP' }),
      element('crm', { description: 'not asked for' }),
      element('pos'),
      element('wms', { description: 'Stock and docks' }),
    ]
    expect(describedIn(owner, ['wms', 'erp', 'pos', 'gone'])).toEqual([['erp', 'the ERP'], ['wms', 'Stock and docks']])
    expect(describedIn(owner, [])).toEqual([])
  })

  it('stops reading once every id asked about is found', () => {
    let read = 0
    const owner = Array.from({ length: 1000 }, (_, n) => element(`e${n}`, { description: `${n}` }))
    const counted = new Proxy(owner, {
      get: (target, key, receiver) => {
        if (typeof key === 'string' && /^\d+$/.test(key)) read += 1
        return Reflect.get(target, key, receiver) as unknown
      },
    })
    expect(describedIn(counted, ['e2', 'e0'])).toEqual([['e0', '0'], ['e2', '2']])
    expect(read).toBe(3)
  })
})

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A description is maintained where the thing is defined (ADR-0012 §3): an
 * overview reads the owner's, one load per owning scope, and keeps none.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { DesignElement } from '../model'
import type { ScopeSnapshot } from '../projects/scope'
import { indexScopes } from '../projects/scopeIndex'
import { heldRepositories } from './testing/heldRepositories'
import { useOwnerDescriptions } from './useOwnerDescriptions'

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

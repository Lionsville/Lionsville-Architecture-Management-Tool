// @vitest-environment jsdom
/**
 * One identity across the organisation, as the shell wires it (ADR-0012 §2).
 *
 * `useIndex` pins the reading and `useModelSession` pins the minting; what is
 * left is whether the two are actually joined up, and that is the half a type
 * cannot check. The agent is the cheapest way in: `element.add` mints an id
 * through the same policy a person's palette does and answers with it, so one
 * call exercises the whole path — store, index, session, `idPolicy`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { laidOut } from '../model/testFixtures'
import { InMemoryScopeStore } from '../adapters/memory/InMemoryScopeStore'
import type { AgentAnswer, AgentRequest } from '../agent/tools'
import type { AgentGateway } from '../ports/AgentGateway'
import type { DesignElement } from '../model'
import type { ScopeSnapshot } from '../projects/scope'
import { renderApp } from './testing/renderShell'

vi.mock('../editor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor')>()
  return { ...actual, SolutionDesignEditor: () => <div data-testid="editor" /> }
})

afterEach(() => cleanup())

function element(id: string, name: string): DesignElement {
  return { id, kind: 'application', name, lifecycle: 'live', isManaged: true, aspects: {} }
}

function scope(path: string, elements: DesignElement[] = []): ScopeSnapshot {
  return {
    path,
    model: {
      name: path || 'Acme Logistics',
      elements,
      relations: [],
      diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [] })],
    },
    activeDiagramId: 'd1',
    logoLibrary: [],
  }
}

/** A gateway that hands the shell's own handler back to the test. */
function fakeGateway() {
  let answer: ((request: AgentRequest) => Promise<AgentAnswer>) | undefined
  const gateway: AgentGateway = {
    id: 'fake',
    on: (handler) => { answer = handler; return () => { answer = undefined } },
    status: () => Promise.resolve({ kind: 'off' }),
    onStatus: () => () => {},
    configure: () => Promise.resolve({ kind: 'off' }),
    newToken: () => Promise.resolve({ kind: 'off' }),
  }
  return {
    gateway,
    call: async (tool: string, args: unknown): Promise<AgentAnswer> => {
      let held!: AgentAnswer
      await act(async () => { held = await answer!({ id: '1', tool, args }) })
      return held
    },
  }
}

const said = (answer: AgentAnswer): Record<string, unknown> => {
  if (!answer.ok) throw new Error(`refused: ${answer.refusal}`)
  const first = answer.content[0]
  return JSON.parse(first.type === 'text' ? first.text : '{}') as Record<string, unknown>
}

/**
 * Two scopes under one organisation, with `finance` open. `retail` defines
 * `warehouse` and the open session has never heard of it: the index is the
 * only thing in the app that knows.
 */
async function twoScopes() {
  const wire = fakeGateway()
  const held = new InMemoryScopeStore([
    scope(''),
    scope('acme/retail', [element('warehouse', 'Warehouse')]),
    scope('acme/finance'),
  ])
  let read = 0
  const scopes = {
    list: () => held.list(),
    load: (path: string) => held.load(path),
    save: (given: ScopeSnapshot) => held.save(given),
    remove: (path: string) => held.remove(path),
    models: () => { read += 1; return held.models() },
  }
  renderApp({ scopes, initialProject: scope('acme/finance'), agent: wire.gateway })
  // Nothing on screen waits for the tree to be read, so the test does — which
  // is the same wait the watcher's report ends on disk.
  await waitFor(() => expect(read).toBeGreaterThan(0))
  await act(async () => {})
  return { wire, scopes: held }
}

describe('an agent is refused the owner\'s detail, as a person is', () => {
  /**
   * One rule, wherever the write arrives from (ADR-0012 §10). The refusal
   * carries the owning scope so a client can go and open it, and the record's
   * own description — this scope's perspective — is still writable.
   */
  async function withStandIn() {
    const wire = fakeGateway()
    const open: ScopeSnapshot = {
      ...scope('acme/finance'),
      model: {
        ...scope('acme/finance').model,
        elements: [{ ...element('erp', 'Retail ERP'), ref: 'acme/retail' }],
      },
    }
    const held = new InMemoryScopeStore([
      scope(''),
      scope('acme/retail', [element('erp', 'Retail ERP')]),
      open,
    ])
    let read = 0
    renderApp({
      scopes: {
        list: () => held.list(),
        load: (path: string) => held.load(path),
        save: (given: ScopeSnapshot) => held.save(given),
        remove: (path: string) => held.remove(path),
        models: () => { read += 1; return held.models() },
      },
      initialProject: open,
      agent: wire.gateway,
    })
    await waitFor(() => expect(read).toBeGreaterThan(0))
    await act(async () => {})
    return wire
  }

  it('refuses a field the defining scope answers for, and says which scope', async () => {
    const wire = await withStandIn()
    const answer = await wire.call('element.update', { id: 'erp', vendor: 'Somebody' })
    expect(answer.ok).toBe(false)
    expect(!answer.ok && answer.refusal).toBe('check.ownedElsewhere')
    expect(!answer.ok && answer.detail).toBe('acme/retail')
  })

  /**
   * The description is the owner's too: shown here, changed there. What a
   * stand-in may still say for itself is how this scope draws it.
   */
  it('refuses the description as well, and lets it write the presentation', async () => {
    const wire = await withStandIn()
    const refused = await wire.call('element.update', { id: 'erp', description: 'What it means here.' })
    expect(!refused.ok && refused.refusal).toBe('check.ownedElsewhere')
    const answer = await wire.call('element.update', { id: 'erp', accentColor: '#336699' })
    expect(said(answer)).toMatchObject({ id: 'erp', changed: ['accentColor'] })
  })
})

describe('the shell hands the tree the id policy reads', () => {
  it('does not let one scope mint an id a sibling already defines', async () => {
    const { wire } = await twoScopes()
    expect(said(await wire.call('element.add', { name: 'Warehouse' })).id).toBe('warehouse-2')
  })

  it('leaves a name nobody in the tree has used exactly as it was', async () => {
    const { wire } = await twoScopes()
    expect(said(await wire.call('element.add', { name: 'Depot' })).id).toBe('depot')
  })
})

/**
 * The agent at every scope (ADR-0012, step 13), as the shell wires it: the
 * tree the workspace hands the handler is the index and the store, so
 * `scopes.list` names every scope and a read with `scope` is answered over a
 * document the open session never loaded.
 */
describe('the agent reads the tree', () => {
  it('lists the scopes, and answers a read over another one', async () => {
    const { wire } = await twoScopes()
    const scopes = said(await wire.call('scopes.list', {}))
    // In the store's listing order, which is by name.
    expect((scopes.scopes as { path: string; open: boolean }[]).map((s) => [s.path, s.open])).toEqual([
      ['', false], ['acme/finance', true], ['acme/retail', false],
    ])
    const retail = said(await wire.call('elements.list', { scope: 'acme/retail' }))
    expect((retail.elements as { id: string }[]).map((e) => e.id)).toEqual(['warehouse'])
    const register = said(await wire.call('register.list', {}))
    expect((register.some as { id: string; master: string }[])).toEqual([
      expect.objectContaining({ id: 'warehouse', master: 'acme/retail' }),
    ])
  })

  it('refuses to write to a scope that is not open', async () => {
    const { wire, scopes } = await twoScopes()
    const out = await wire.call('element.add', { scope: 'acme/retail', kind: 'application', name: 'Ghost' })
    expect(out.ok).toBe(false)
    expect(!out.ok && out.refusal).toBe('agent.scopeNotOpen')
    expect((await scopes.load('acme/retail'))?.model.elements.map((e) => e.id)).toEqual(['warehouse'])
  })
})

/**
 * The map at the organisation reads the tree (ADR-0012 §9): the capabilities
 * are the root's, the systems supporting them and the rows saying so are a
 * landscape's, and the page names those systems under the landscape. Nothing
 * in the root's own document knows the warehouse system exists.
 */
describe('the enterprise map, across scopes', () => {
  it('names a landscape\u2019s systems under the landscape, from the index', async () => {
    const root: ScopeSnapshot = {
      path: '',
      model: {
        name: 'Acme Logistics',
        elements: [{
          id: 'fulfilment', kind: 'function', name: 'Fulfilment', lifecycle: 'live', isManaged: false, aspects: {},
        }],
        relations: [],
        diagrams: [{ id: 'mp', kind: 'map', name: 'Enterprise map', members: [], geometry: { nodes: [] } }],
      },
      activeDiagramId: 'mp',
      logoLibrary: [],
    }
    const retail = scope('acme/retail', [element('wms', 'Warehouse system')])
    retail.model.relations = [{ id: 's1', type: 'supports', sourceId: 'wms', targetId: 'fulfilment' }]
    renderApp({ scopes: new InMemoryScopeStore([root, retail]) })

    fireEvent.click(await screen.findByTestId('open-map'))
    const grid = await screen.findByTestId('map-grid')
    await waitFor(() => expect(within(grid).getByTestId('map-column-wms').textContent).toBe('Warehouse system'))
    expect(within(grid).getByTestId('map-owner-0').textContent).toBe('acme/retail')
    expect(within(grid).getByTestId('map-cell-fulfilment-wms').dataset.mark).toBe('supports')
    expect(within(grid).getByTestId('map-coverage-fulfilment').textContent).toBe('')
  })
})

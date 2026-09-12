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
import { act, cleanup, waitFor } from '@testing-library/react'
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

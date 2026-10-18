// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The agent keeps the tree in the app (ADR-0040 §3): from the organisation's
 * home a scope is made and the tree shows it under the banner naming the
 * client, the next call names it, a scope with work in it goes only at the
 * person's words and says so on screen, and the scope open is left to its
 * session.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import type { AgentAnswer, AgentRequest } from '../agent/tools'
import type { AgentGateway } from '../ports/AgentGateway'
import type { ScopeSnapshot } from '../projects/scope'
import { readScope } from '../projects/scopeAccess'
import { heldRepositories } from './testing/heldRepositories'
import { renderApp } from './testing/renderShell'

// The canvas, as App.driving.test.tsx draws it: the workspace's board is not what is under test.
vi.mock('../editor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor')>()
  const { useEffect } = await import('react')
  return {
    ...actual,
    SolutionDesignEditor: (props: { document: { activeDiagramId: string }; onHandle?: (handle: unknown) => void }) => {
      const { onHandle, document } = props
      useEffect(() => {
        onHandle?.({ activeDiagramId: document.activeDiagramId, busy: false, tidy: async () => {}, routeEdges: async () => {}, capture: async () => ({ arrayBuffer: async () => new ArrayBuffer(0) }) })
        return () => onHandle?.(undefined)
      }, [onHandle, document.activeDiagramId])
      return <div data-testid="canvas">{document.activeDiagramId}</div>
    },
  }
})

afterEach(() => cleanup())

const scope = (path: string, name: string, over: Partial<ScopeSnapshot['model']> = {}): ScopeSnapshot => ({
  path, model: { name, elements: [], relations: [], diagrams: [], ...over }, activeDiagramId: '', logoLibrary: [],
})
const rail = scope('acme/rail', 'Rail', {
  elements: [{ id: 'crews', kind: 'application', name: 'Crews', lifecycle: 'live', isManaged: false, aspects: {} }],
  diagrams: [{ id: 'board', kind: 'layer7', name: 'Rail board', members: [], geometry: { nodes: [] } }],
})

/** A gateway that keeps whoever subscribed, and says a client is connected. */
function gateway() {
  let handler: ((request: AgentRequest) => Promise<AgentAnswer>) | undefined
  const connected = { kind: 'connected' as const, port: 51733, token: 't'.repeat(24), client: { name: 'Claude Code', version: '2.0' } }
  const held: AgentGateway = {
    id: 'fake',
    on(next) {
      handler = next
      return () => { if (handler === next) handler = undefined }
    },
    status: () => Promise.resolve(connected),
    onStatus: () => () => {},
    configure: () => Promise.resolve(connected),
    newToken: () => Promise.resolve(connected),
  }
  let n = 0
  const ask = async (tool: string, args: unknown = {}): Promise<AgentAnswer> => {
    if (!handler) throw new Error('nobody is listening')
    return handler({ id: `r${++n}`, tool, args })
  }
  return { gateway: held, ask, bound: () => handler !== undefined }
}

const parsed = (answer: AgentAnswer): Record<string, unknown> => {
  if (!answer.ok || answer.content[0].type !== 'text') throw new Error(`refused: ${JSON.stringify(answer)}`)
  return JSON.parse(answer.content[0].text) as Record<string, unknown>
}

describe('the tree kept by an agent, in the app', () => {
  it('makes a scope from the organisation\'s home, the tree shows it under the banner, and the next call names it', async () => {
    const held = heldRepositories([scope('', 'Acme Logistics'), scope('acme', 'Acme')])
    const wire = gateway()
    renderApp({ agent: wire.gateway, repositories: held })
    await waitFor(() => expect(wire.bound()).toBe(true))
    await screen.findByTestId('scope-acme')
    let made: Record<string, unknown> = {}
    await act(async () => { made = parsed(await wire.ask('scope.create', { parent: 'acme', name: 'Rail yards', withBoard: true })) })
    expect(made).toMatchObject({ path: 'acme/rail-yards', kind: 'landscape' })
    expect(screen.getByTestId('agent-driving').textContent).toContain('Claude Code is driving the app.')
    fireEvent.click(await screen.findByTestId('fold-acme'))
    expect(await screen.findByTestId('scope-acme/rail-yards')).toBeDefined()
    await act(async () => { parsed(await wire.ask('scope.update', { path: 'acme/rail-yards', description: 'Where the trains sleep' })) })
    expect((await readScope(held.scopes, 'acme/rail-yards'))?.model.description).toBe('Where the trains sleep')
  })

  it('removes a scope with work in it only at the person\'s words, and says so on their screen', async () => {
    const held = heldRepositories([scope('', 'Acme Logistics'), scope('acme', 'Acme'), rail])
    const wire = gateway()
    renderApp({ agent: wire.gateway, repositories: held })
    await waitFor(() => expect(wire.bound()).toBe(true))
    await screen.findByTestId('scope-acme')
    const refused = await wire.ask('scope.remove', { path: 'acme/rail' })
    expect(refused.ok ? undefined : [refused.refusal, JSON.parse(refused.detail ?? '{}').holds]).toEqual(['scope.notEmpty', { views: 1, elements: 1, viewNames: ['Rail board'] }])
    await act(async () => {
      parsed(await wire.ask('scope.remove', { path: 'acme/rail', removeContents: true, personSaid: 'Yes, remove Rail with everything' }))
    })
    expect(await readScope(held.scopes, 'acme/rail')).toBeUndefined()
    expect((await screen.findByText(/removed Rail with 1 views and 1 other records/)).textContent).toContain('Yes, remove Rail with everything')
  })

  it('leaves the scope open to its session, and moves it once the agent has gone home', async () => {
    const held = heldRepositories([scope('', 'Acme Logistics'), scope('acme', 'Acme'), rail, scope('globex', 'Globex')])
    const wire = gateway()
    renderApp({ agent: wire.gateway, repositories: held })
    await waitFor(() => expect(wire.bound()).toBe(true))
    expect(parsed(await wire.ask('app.open', { scope: 'acme/rail' })).arrived).toBe(true)
    const open = await wire.ask('scope.move', { path: 'acme/rail', parent: 'globex' })
    expect(open.ok ? undefined : open.refusal).toBe('scope.isOpen')
    expect(parsed(await wire.ask('app.open', { scope: 'acme', page: 'home' })).arrived).toBe(true)
    let moved: Record<string, unknown> = {}
    await act(async () => { moved = parsed(await wire.ask('scope.move', { path: 'acme/rail', parent: 'globex' })) })
    expect(moved).toMatchObject({ from: 'acme/rail', to: 'globex/rail', moved: true })
    expect((await readScope(held.scopes, 'globex/rail'))?.model.name).toBe('Rail')
  }, 20_000)
})

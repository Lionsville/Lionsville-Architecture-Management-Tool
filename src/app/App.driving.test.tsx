// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * An agent drives the app (ADR-0019), through the whole shell.
 *
 * The seam is filled by a fake that keeps the handler, the way
 * `useAgentGateway.test.tsx` does, and the editor is stubbed. What is pinned
 * is the shell's half: with nothing open the agent is told where the app is
 * and can open a scope, a page or a home; the banner names the client while
 * it drives; Stop ends the session, the agent reads `agent.stopped`, and
 * `session.start` puts the banner back with the reason on it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { laidOut } from '../model/testFixtures'
import type { AgentAnswer, AgentRequest } from '../agent/tools'
import type { AgentGateway } from '../ports/AgentGateway'
import type { ScopeSnapshot } from '../projects/scope'
import { InMemoryScopeStore } from '../adapters/memory/InMemoryScopeStore'
import { renderApp } from './testing/renderShell'

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

const root: ScopeSnapshot = {
  path: '',
  model: {
    name: 'Acme Logistics',
    elements: [{ id: 'fulfilment', kind: 'function', name: 'Fulfilment', lifecycle: 'live', isManaged: false, aspects: {} }],
    relations: [],
    diagrams: [{ id: 'sheet-1', kind: 'sheet', name: 'Business architecture', members: [], geometry: { nodes: [] } }],
    decisions: [{ id: 'adr-1', number: 1, title: 'One warehouse', status: 'proposed', date: '2026-09-01', body: 'One.', signers: [] }],
  },
  activeDiagramId: 'sheet-1',
  logoLibrary: [],
}

const retail: ScopeSnapshot = {
  path: 'acme/retail',
  model: {
    name: 'Retail',
    elements: [{ id: 'wms', kind: 'application', name: 'Warehouse system', lifecycle: 'live', isManaged: true, aspects: {} }],
    relations: [],
    diagrams: [laidOut({ id: 'r7', kind: 'layer7', name: 'Retail board', placements: [{ id: 'wms', x: 0, y: 0 }] })],
  },
  activeDiagramId: 'r7',
  logoLibrary: [],
}

/** A gateway that keeps whoever subscribed and says Claude Code is connected. */
function fakeGateway() {
  let handler: ((request: AgentRequest) => Promise<AgentAnswer>) | undefined
  const connected = { kind: 'connected' as const, port: 51733, token: 't'.repeat(24), client: { name: 'Claude Code', version: '2.0' } }
  const gateway: AgentGateway = {
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
  const ask = (tool: string, args: unknown = {}): Promise<AgentAnswer> => {
    if (!handler) throw new Error('nobody is listening')
    return handler({ id: `r${++n}`, tool, args })
  }
  return { gateway, ask, bound: () => handler !== undefined }
}

const parsed = (answer: AgentAnswer): Record<string, unknown> => {
  if (!answer.ok || answer.content[0].type !== 'text') throw new Error(`refused: ${JSON.stringify(answer)}`)
  return JSON.parse(answer.content[0].text)
}
const refusal = (answer: AgentAnswer) => (answer.ok ? undefined : answer.refusal)

async function organisationOnScreen() {
  const wire = fakeGateway()
  renderApp({ agent: wire.gateway, scopes: new InMemoryScopeStore([root, retail]), boot: { initialProject: undefined } })
  await waitFor(() => expect(wire.bound()).toBe(true))
  return wire
}

describe('with the organisation screen up', () => {
  it('tells the agent where the app is, and what there is', async () => {
    const { ask } = await organisationOnScreen()
    await waitFor(async () => expect(parsed(await ask('app.current')).scopes).toBe(2))
    const where = parsed(await ask('app.current'))
    expect(where.home).toEqual({ path: '', name: 'Acme Logistics' })
    expect(where.open).toBeUndefined()
    expect(where.agent).toEqual({ client: 'Claude Code' })
    const views = parsed(await ask('views.list'))
    expect((views.some as { scope: string; id: string }[]).map((row) => [row.scope, row.id])).toEqual([['', 'sheet-1'], ['acme/retail', 'r7']])
    expect(screen.queryByTestId('agent-driving')).toBeNull()
  })

  it('opens a scope for the agent, and puts the banner up under the client\'s name', async () => {
    const { ask } = await organisationOnScreen()
    await waitFor(async () => expect(parsed(await ask('app.current')).scopes).toBe(2))
    const out = parsed(await ask('app.open', { scope: 'acme/retail' }))
    expect(out.arrived).toBe(true)
    expect(out.open).toEqual({ path: 'acme/retail', name: 'Retail', view: { id: 'r7', name: 'Retail board', kind: 'layer7' } })
    expect(screen.getByTestId('canvas').textContent).toBe('r7')
    const banner = screen.getByTestId('agent-driving')
    expect(banner.textContent).toContain('Claude Code is driving the app.')
    // Now a write lands where the agent went, without anybody clicking.
    const added = parsed(await ask('element.add', { kind: 'application', name: 'Ledger' }))
    expect(added.revision).toBe(1)
    expect(parsed(await ask('elements.list')).total).toBe(2)
  })

  it('opens the organisation\'s register, and a page over an open scope', async () => {
    const { ask } = await organisationOnScreen()
    await waitFor(async () => expect(parsed(await ask('app.current')).scopes).toBe(2))
    const register = parsed(await ask('app.open', { scope: '', page: 'register' }))
    expect(register.arrived).toBe(true)
    expect(register.page).toEqual({ page: 'register' })
    expect(screen.getByTestId('register-topbar')).toBeDefined()

    const decisions = parsed(await ask('app.open', { scope: '', page: 'decisions', id: 'adr-1' }))
    expect(decisions.arrived).toBe(true)
    expect(decisions.open).toMatchObject({ path: '', name: 'Acme Logistics' })
    expect(decisions.page).toEqual({ page: 'decisions', id: 'adr-1' })

    const home = parsed(await ask('app.open', { scope: '', page: 'home' }))
    expect(home.arrived).toBe(true)
    expect(home.home).toEqual({ path: '', name: 'Acme Logistics' })
    expect(home.page).toBeUndefined()
  })

  it('lets the person stop the agent, tells the agent so, and lets it ask to go on', async () => {
    const { ask } = await organisationOnScreen()
    await waitFor(async () => expect(parsed(await ask('app.current')).scopes).toBe(2))
    await ask('app.open', { scope: 'acme/retail' })
    fireEvent.click(screen.getByTestId('agent-stop'))
    await waitFor(() => expect(screen.queryByTestId('agent-driving')).toBeNull())
    expect(await screen.findByText(/Claude Code was stopped/)).toBeDefined()

    expect(refusal(await ask('element.add', { kind: 'application', name: 'Ghost' }))).toBe('agent.stopped')
    expect(refusal(await ask('app.open', { scope: '' }))).toBe('agent.stopped')
    // Looking is not driving.
    expect(parsed(await ask('elements.list')).total).toBe(1)
    expect((parsed(await ask('app.current')).agent as { stopped?: object }).stopped).toMatchObject({ client: 'Claude Code' })

    const again = parsed(await ask('session.start', { purpose: 'Renaming the warehouse system, as asked' }))
    expect((again.agent as { session: { purpose: string } }).session.purpose).toBe('Renaming the warehouse system, as asked')
    await waitFor(() => expect(screen.getByTestId('agent-driving').textContent).toContain('Renaming the warehouse system, as asked'))
    expect((await ask('element.update', { id: 'wms', name: 'WMS' })).ok).toBe(true)
    expect(parsed(await ask('session.end'))).toEqual({ ended: true })
    await waitFor(() => expect(screen.queryByTestId('agent-driving')).toBeNull())
  })
})

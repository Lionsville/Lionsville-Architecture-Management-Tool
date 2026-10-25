// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * One way every page behaves (ADR-0044), on the app: a crumb in the shell's
 * bar closes whatever page is up — over a home, the same home's crumb
 * included, and over an open scope — and then goes where it says (§3).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { laidOut } from '../model/testFixtures'
import type { AgentAnswer, AgentRequest } from '../agent/tools'
import type { AgentGateway } from '../ports/AgentGateway'
import type { ScopeSnapshot } from '../projects/scope'
import { heldRepositories } from './testing/heldRepositories'
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
// One window for the file: each test starts on an entry nobody has written a place into.
beforeEach(() => { window.history.replaceState(null, '', '/') })

const root: ScopeSnapshot = {
  path: '',
  model: {
    name: 'Acme Logistics',
    elements: [],
    relations: [],
    diagrams: [{ id: 'sheet-1', kind: 'sheet', name: 'Business architecture', members: [], geometry: { nodes: [] } }],
    decisions: [
      { id: 'adr-1', number: 1, title: 'One warehouse', status: 'proposed', date: '2026-09-01', body: 'One.', signers: [] },
      { id: 'adr-2', number: 2, title: 'Two depots', status: 'proposed', date: '2026-09-02', body: 'Two.', signers: [] },
    ],
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
    diagrams: [
      laidOut({ id: 'r7', kind: 'layer7', name: 'Retail board', placements: [{ id: 'wms', x: 0, y: 0 }] }),
      laidOut({ id: 'r8', kind: 'layer7', name: 'Second board', placements: [] }),
    ],
  },
  activeDiagramId: 'r7',
  logoLibrary: [],
}

/** A gateway that keeps whoever subscribed, as `App.driving.test.tsx` has it. */
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

/** The organisation screen up, the tree read, and the first entry written. */
async function organisationOnScreen() {
  const wire = fakeGateway()
  renderApp({ agent: wire.gateway, repositories: heldRepositories([root, retail]), boot: { initialProject: undefined } })
  await waitFor(() => expect(wire.bound()).toBe(true))
  await waitFor(async () => expect(parsed(await wire.ask('app.current')).scopes).toBe(3))
  await screen.findByTestId('organisation-cards')
  return wire
}

/** Is a page up: anything with a page's × on it. */
const pageUp = () => screen.queryByTestId('page-close') !== null

describe('a crumb (ADR-0044 §3)', () => {
  it('closes a page up over a home, the same home’s crumb included', async () => {
    await organisationOnScreen()
    fireEvent.click(screen.getByTestId('open-register'))
    await waitFor(() => expect(pageUp()).toBe(true))
    fireEvent.click(screen.getByTestId('crumb-current'))
    await waitFor(() => expect(pageUp()).toBe(false))
    expect(screen.getByTestId('organisation-cards')).toBeTruthy()
  })

  it('closes a page up over an open scope, and the scope opens again without it', async () => {
    const { ask } = await organisationOnScreen()
    expect(parsed(await ask('app.open', { scope: 'acme/retail', page: 'roadmap' })).arrived).toBe(true)
    await waitFor(() => expect(pageUp()).toBe(true))
    fireEvent.click(screen.getByTestId('crumb-'))
    await waitFor(() => expect(screen.getByTestId('organisation-cards')).toBeTruthy())
    expect(pageUp()).toBe(false)
    expect(parsed(await ask('app.open', { scope: 'acme/retail', page: 'board', id: 'r7' })).arrived).toBe(true)
    await screen.findByTestId('canvas')
    expect(pageUp()).toBe(false)
  })
})

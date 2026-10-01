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
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { laidOut } from '../model/testFixtures'
import type { AgentAnswer, AgentRequest } from '../agent/tools'
import type { MovedBy, Screen } from '../agent/screen'
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

const root: ScopeSnapshot = {
  path: '',
  model: {
    name: 'Acme Logistics',
    elements: [{ id: 'fulfilment', kind: 'function', name: 'Fulfilment', lifecycle: 'live', isManaged: false, aspects: {} }],
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

/**
 * The root, `acme/retail`, and `acme` above it: a scope is filed under a scope,
 * so the one between is made with it (`ScopeRepository.create`).
 */
async function organisationOnScreen() {
  const wire = fakeGateway()
  renderApp({ agent: wire.gateway, repositories: heldRepositories([root, retail]), boot: { initialProject: undefined } })
  await waitFor(() => expect(wire.bound()).toBe(true))
  return wire
}

describe('with the organisation screen up', () => {
  it('tells the agent where the app is, and what there is', async () => {
    const { ask } = await organisationOnScreen()
    await waitFor(async () => expect(parsed(await ask('app.current')).scopes).toBe(3))
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
    await waitFor(async () => expect(parsed(await ask('app.current')).scopes).toBe(3))
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
    await waitFor(async () => expect(parsed(await ask('app.current')).scopes).toBe(3))
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

  /**
   * A home is opened as itself: the page over its cards closes, whichever of
   * the two it was, and the home that comes back after a scope comes back
   * without the page last asked for.
   */
  it('closes the page over the home when the home itself is asked for', async () => {
    const { ask } = await organisationOnScreen()
    await waitFor(async () => expect(parsed(await ask('app.current')).scopes).toBe(3))
    for (const [page, bar] of [['register', 'register-topbar'], ['technologyRegister', 'technology-register-topbar']]) {
      expect(parsed(await ask('app.open', { scope: '', page })).page).toEqual({ page })
      expect(await screen.findByTestId(bar)).toBeDefined()
      const home = parsed(await ask('app.open', { scope: '', page: 'home' }))
      expect(home.arrived).toBe(true)
      expect(home.page).toBeUndefined()
      await waitFor(() => expect(screen.queryByTestId(bar)).toBeNull())
      expect(screen.getByTestId('organisation-cards')).toBeDefined()
    }
    await ask('app.open', { scope: '', page: 'register' })
    expect(await screen.findByTestId('register-topbar')).toBeDefined()
    await ask('app.open', { scope: 'acme/retail' })
    fireEvent.click(screen.getByTestId('crumb-'))
    expect(await screen.findByTestId('organisation-cards')).toBeDefined()
    expect(screen.queryByTestId('register-topbar')).toBeNull()
    expect(parsed(await ask('app.current')).page).toBeUndefined()
  })

  /**
   * The agent is told the record on show, not the one it last asked for; and
   * asking for that one again after the person moved off it lands, where it
   * used to leave the page where it was.
   */
  it('takes the page back to a record asked for again, and says which record is on show', async () => {
    const { ask } = await organisationOnScreen()
    await waitFor(async () => expect(parsed(await ask('app.current')).scopes).toBe(3))
    await ask('app.open', { scope: '', page: 'decisions', id: 'adr-1' })
    const title = () => within(screen.getByTestId('adr-reader')).getByRole('heading', { level: 1 }).textContent
    await waitFor(() => expect(title()).toBe('One warehouse'))
    fireEvent.click(within(screen.getByTestId('adr-list')).getByText('Two depots'))
    expect(title()).toBe('Two depots')
    expect(parsed(await ask('app.current')).page).toEqual({ page: 'decisions', id: 'adr-2' })
    const back = parsed(await ask('app.open', { scope: '', page: 'decisions', id: 'adr-1' }))
    expect(back.page).toEqual({ page: 'decisions', id: 'adr-1' })
    await waitFor(() => expect(title()).toBe('One warehouse'))
    expect(parsed(await ask('app.current')).page).toEqual({ page: 'decisions', id: 'adr-1' })
  })

  /** The observations page on a tab (ADR-0019, amended): the agent arrives once that tab is up, and is told it. */
  it('opens the observations on the tab asked for, and says which tab is up', async () => {
    const { ask } = await organisationOnScreen()
    await waitFor(async () => expect(parsed(await ask('app.current')).scopes).toBe(3))
    const out = parsed(await ask('app.open', { scope: '', page: 'observations', tab: 'solutions' }))
    expect(out.arrived).toBe(true)
    expect(out.page).toMatchObject({ page: 'observations', tab: 'solutions' })
    expect(screen.getByTestId('observation-tab-solutions').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByTestId('observation-tab-register'))
    await waitFor(async () => expect(parsed(await ask('app.current')).page).toMatchObject({ page: 'observations', tab: 'register' }))
  })

  it('lets the person stop the agent, tells the agent so, and lets it ask to go on', async () => {
    const { ask } = await organisationOnScreen()
    await waitFor(async () => expect(parsed(await ask('app.current')).scopes).toBe(3))
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

/**
 * A provider's chrome is told who moved the app (ADR-0022, amended): an arrival
 * the agent caused is the agent's, and so is any move while its banner is up;
 * the screen it brought the app to stays its own after the session ends, and
 * the next move the person makes is theirs.
 */
describe('a chrome, told who moved the app', () => {
  it('says the agent for its moves and the person for theirs', async () => {
    const told: { at: string; by: MovedBy }[] = []
    function Where({ screen: where, movedBy }: { screen: Screen; movedBy: MovedBy }) {
      const at = where.open ? where.open.path : `home ${where.home?.path ?? ''}`
      if (told[told.length - 1]?.at !== at || told[told.length - 1]?.by !== movedBy) told.push({ at, by: movedBy })
      return <p data-testid="provider-where">{`${at} by ${movedBy}`}</p>
    }
    const wire = fakeGateway()
    renderApp({
      agent: wire.gateway,
      repositories: heldRepositories([root, retail]),
      boot: { initialProject: undefined },
      provider: { chrome: [{ kind: 'elsewhere', chrome: Where }] },
    })
    await waitFor(() => expect(wire.bound()).toBe(true))
    const where = () => screen.getByTestId('provider-where').textContent
    expect(where()).toBe('home  by person')

    await waitFor(async () => expect(parsed(await wire.ask('app.current')).scopes).toBe(3))
    expect(parsed(await wire.ask('app.open', { scope: 'acme/retail' })).arrived).toBe(true)
    await waitFor(() => expect(where()).toBe('acme/retail by agent'))

    // The person's own click while the banner is up is still the agent's.
    fireEvent.click(screen.getByTestId('crumb-'))
    await waitFor(() => expect(where()).toBe('home  by agent'))
    expect(parsed(await wire.ask('app.open', { scope: 'acme/retail' })).arrived).toBe(true)
    await waitFor(() => expect(where()).toBe('acme/retail by agent'))

    // The session ends: where the agent left the app is still its doing.
    expect(parsed(await wire.ask('session.end'))).toEqual({ ended: true })
    await waitFor(() => expect(screen.queryByTestId('agent-driving')).toBeNull())
    expect(where()).toBe('acme/retail by agent')

    // And the next move is the person's.
    fireEvent.click(screen.getByTestId('crumb-'))
    await waitFor(() => expect(where()).toBe('home  by person'))
    expect(told.map((one) => `${one.at} by ${one.by}`)).toEqual([
      'home  by person', 'acme/retail by agent', 'home  by agent', 'acme/retail by agent', 'home  by person',
    ])
  })

  it('says the person again once they stop the agent', async () => {
    function Where({ screen: where, movedBy }: { screen: Screen; movedBy: MovedBy }) {
      return <p data-testid="provider-where">{`${where.open?.path ?? 'home'} by ${movedBy}`}</p>
    }
    const wire = fakeGateway()
    renderApp({
      agent: wire.gateway,
      repositories: heldRepositories([root, retail]),
      boot: { initialProject: undefined },
      provider: { chrome: [{ kind: 'elsewhere', chrome: Where }] },
    })
    await waitFor(() => expect(wire.bound()).toBe(true))
    await waitFor(async () => expect(parsed(await wire.ask('app.current')).scopes).toBe(3))
    await wire.ask('app.open', { scope: 'acme/retail' })
    await waitFor(() => expect(screen.getByTestId('provider-where').textContent).toBe('acme/retail by agent'))
    fireEvent.click(screen.getByTestId('agent-stop'))
    await waitFor(() => expect(screen.queryByTestId('agent-driving')).toBeNull())
    fireEvent.click(screen.getByTestId('crumb-'))
    await waitFor(() => expect(screen.getByTestId('provider-where').textContent).toBe('home by person'))
  })
})

// @vitest-environment jsdom
/**
 * The session that leaves nothing behind, and says so.
 *
 * When browser storage refuses at boot the composition swaps in memory stores.
 * Everything then works — and nothing survives the tab. Because those stores
 * never fail, `useStorageNotice` is never called and the user was told
 * precisely nothing; they would find out on the next morning's first coffee.
 *
 * A standing notice rather than a toast: it is true for the whole session, not
 * an event within it.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { laidOut } from '../model/testFixtures';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import type { SourceStatus } from '../platform/sourceProvider'
import type { AgentAnswer, AgentRequest } from '../agent/tools'
import type { AgentGateway } from '../ports/AgentGateway'
import { renderApp } from './testing/renderShell'

afterEach(() => cleanup())

describe('App and the storage it was given', () => {
  it('shows the notice from the first render when nothing will be kept', () => {
    renderApp({ source: { kind: 'memory' } })
    expect(screen.getByTestId('storage-notice').textContent)
      .toContain('This browser could not save the design')
  })

  it('says nothing when storage works, which is the ordinary case', () => {
    renderApp({ source: { kind: 'browserStorage' } })
    expect(screen.queryByTestId('storage-notice')).toBeNull()
  })

  it('assumes storage works when nobody said otherwise', () => {
    renderApp()
    expect(screen.queryByTestId('storage-notice')).toBeNull()
  })
})

describe('what the root’s home says you are working from', () => {
  // The source is a fact about the folder, and the folder is the root: the
  // root's home says it, and the workspace's bar — which has crumbs where
  // the source used to be — does not. The memory case is the one where
  // saying so matters most: the strip at the foot says it, and so does the
  // home.
  const project = {
    path: 'acme/landscape',
    model: {
      name: 'Landscape', elements: [], relations: [],
      diagrams: [laidOut({ id: 'd1', kind: 'layer7' as const, name: 'L7', placements: [] })],
    },
    activeDiagramId: 'd1',
    logoLibrary: [],
  }

  it('names the folder', () => {
    renderApp({ source: { kind: 'folder', name: 'Architecture', root: '/Users/someone/Architecture' } })
    expect(screen.getByTestId('working-source').textContent).toBe('Folder · Architecture')
  })

  it('says when it is the browser, and when it is nowhere', () => {
    renderApp({ source: { kind: 'browserStorage' } })
    expect(screen.getByTestId('working-source').textContent).toBe('In this browser')
    cleanup()
    renderApp({ source: { kind: 'memory' } })
    expect(screen.getByTestId('working-source').textContent).toBe('Not kept anywhere')
    expect(screen.getByTestId('storage-notice')).toBeDefined()
  })

  it('keeps it off the bar over an open scope, where the crumbs are', () => {
    renderApp({ initialProject: project, source: { kind: 'memory' } })
    expect(screen.queryByTestId('working-source')).toBeNull()
    expect(screen.getByTestId('storage-notice')).toBeDefined()
  })
})

/**
 * A source a provider registered (`platform/sourceProvider.ts`).
 *
 * Nothing in this tree knows what kind of place it is, which is the point: the
 * bar calls it what its provider called it, and whether work may be written
 * there is the source's own answer rather than the constant the workspace
 * passed while a folder was the only thing a source could be.
 */
describe('a source a provider answers for', () => {
  const elsewhere = {
    kind: 'registered' as const, provider: 'elsewhere', name: 'Elsewhere', key: 'one',
  }
  const scope = {
    path: 'acme/landscape',
    model: {
      name: 'Landscape', elements: [], relations: [],
      diagrams: [laidOut({ id: 'd1', kind: 'layer7' as const, name: 'L7', placements: [] })],
    },
    activeDiagramId: 'd1',
    logoLibrary: [],
  }

  it('is called on the home what its provider called it, with no word of ours in front', () => {
    renderApp({ source: elsewhere })
    expect(screen.getByTestId('working-source').textContent).toBe('Elsewhere')
    // Not the nothing-is-kept strip: that is memory's, and this keeps things.
    expect(screen.queryByTestId('storage-notice')).toBeNull()
  })

  it('offers what a folder offers when it writes', async () => {
    renderApp({ initialProject: scope, source: elsewhere })
    fireEvent.click(await screen.findByText('Roadmap'))
    expect(await screen.findByText('New plan')).toBeDefined()
  })

  /**
   * The bar asks the provider again when the provider says so, and a provider
   * with work of its own outstanding has nothing else to hang that on: no
   * keystroke, no write, nothing the document's own machine can see.
   */
  it('says what the provider now says, without the document\u2019s machine moving', async () => {
    let held: SourceStatus = 'clean'
    let tell: (() => void) | undefined
    renderApp({
      initialProject: scope,
      source: elsewhere,
      sourceStatus: () => held,
      onSourceWork: (listener) => { tell = listener; return () => { tell = undefined } },
    })
    const bar = await screen.findByTestId('saved-indicator')
    expect(bar.textContent).toBe('Not saved yet')

    held = 'dirty'
    act(() => tell?.())
    expect(screen.getByTestId('saved-indicator').textContent).toBe('Unsaved changes')
  })

  it('hides what writes when it says it only reads', async () => {
    renderApp({ initialProject: scope, source: { ...elsewhere, readOnly: true } })
    fireEvent.click(await screen.findByText('Roadmap'))
    // The page is up; what is missing is the one thing on it that writes.
    expect(await screen.findByText('Roadmap', { selector: 'p' })).toBeDefined()
    expect(screen.queryByText('New plan')).toBeNull()
  })
})

/**
 * A gateway that keeps whoever subscribed, so a test can ask as an agent
 * would. The same fake as `App.driving.test.tsx`'s, cut to what is asked here.
 */
function listeningGateway() {
  let handler: ((request: AgentRequest) => Promise<AgentAnswer>) | undefined
  const connected = {
    kind: 'connected' as const, port: 51733, token: 't'.repeat(24),
    client: { name: 'Claude Code', version: '2.0' },
  }
  const gateway: AgentGateway = {
    id: 'fake',
    on(next) { handler = next; return () => { if (handler === next) handler = undefined } },
    status: () => Promise.resolve(connected),
    onStatus: () => () => {},
    configure: () => Promise.resolve(connected),
    newToken: () => Promise.resolve(connected),
  }
  let n = 0
  return {
    gateway,
    bound: () => handler !== undefined,
    ask: (tool: string, args: unknown = {}): Promise<AgentAnswer> => {
      if (!handler) throw new Error('nobody is listening')
      return handler({ id: `r${n += 1}`, tool, args })
    },
  }
}

/**
 * An agent can do what a person can (ADR-0011) — and no more. A source that
 * says work here is only read is the one fact that has to reach the agent as
 * well as the buttons: `agent.readOnly` was a refusal nothing had ever
 * answered until a source could say no.
 */
describe('an agent on a source that only reads', () => {
  const readOnly = {
    kind: 'registered' as const,
    provider: 'elsewhere', name: 'Elsewhere', key: 'one', readOnly: true,
  }
  const scope = {
    path: 'acme/landscape',
    model: {
      name: 'Landscape',
      elements: [{ id: 'billing', kind: 'application' as const, name: 'Billing', lifecycle: 'live' as const, isManaged: true, aspects: {} }],
      relations: [],
      diagrams: [laidOut({ id: 'd1', kind: 'layer7' as const, name: 'L7', placements: [{ id: 'billing', x: 0, y: 0 }] })],
    },
    activeDiagramId: 'd1',
    logoLibrary: [],
  }

  async function open(source: typeof readOnly | undefined) {
    const wire = listeningGateway()
    renderApp({ initialProject: scope, agent: wire.gateway, ...(source ? { source } : {}) })
    await waitFor(() => expect(wire.bound()).toBe(true))
    return wire
  }

  it('refuses a write, and still answers a read', async () => {
    const { ask } = await open(readOnly)
    const refused = await ask('element.add', { kind: 'application', name: 'Ledger' })
    expect(refused.ok).toBe(false)
    expect(refused.ok === false && refused.refusal).toBe('agent.readOnly')
    // Looking is not writing: the tree, the landscape and the reports still answer.
    expect((await ask('elements.list')).ok).toBe(true)
  })

  it('refuses nothing where the source writes', async () => {
    const { ask } = await open(undefined)
    expect((await ask('element.add', { kind: 'application', name: 'Ledger' })).ok).toBe(true)
  })
})

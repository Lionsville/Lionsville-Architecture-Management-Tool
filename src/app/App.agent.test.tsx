// @vitest-environment jsdom
/**
 * The way in for a person (ADR-0007): the glyph carries the server's state,
 * the menu's command and the glyph both open the dialog, and the dialog's
 * switch reaches the seam. The seam is a fake that keeps receipts; the editor
 * is stubbed, as in `App.commands.test.tsx`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { laidOut } from '../model/testFixtures';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import type { AgentAnswer, AgentRequest } from '../agent/tools'
import type { HostCommand } from '../platform/hostCommands'
import type { AgentServerPatch, AgentServerStatus } from '../platform/agentServer'
import type { AgentGateway } from '../ports/AgentGateway'
import type { ScopeSnapshot } from '../projects/scope'
import { renderApp } from './testing/renderShell'

vi.mock('../editor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor')>()
  return { ...actual, SolutionDesignEditor: () => <div data-testid="editor" /> }
})

afterEach(() => cleanup())

const project: ScopeSnapshot = {
  path: 'acme/landscape',
  model: {
    name: 'Landscape', elements: [], relations: [],
    diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [] })],
  },
  activeDiagramId: 'd1',
  logoLibrary: [],
}

const TOKEN = 'cafebabecafebabecafebabecafebabecafebabecafebabe'

/** A gateway whose facts a test can set, and whose switch keeps receipts. */
function fakeGateway(initial: AgentServerStatus) {
  let status = initial
  const listeners = new Set<(status: AgentServerStatus) => void>()
  const configured: AgentServerPatch[] = []
  let tokens = 0
  const gateway: AgentGateway = {
    id: 'fake',
    on: (_handler: (request: AgentRequest) => Promise<AgentAnswer>) => () => {},
    status: () => Promise.resolve(status),
    onStatus: (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    configure: (patch) => {
      configured.push(patch)
      status = patch.enabled ? { kind: 'listening', port: 51733, token: TOKEN } : { kind: 'off' }
      return Promise.resolve(status)
    },
    newToken: () => { tokens += 1; return Promise.resolve(status) },
  }
  return {
    gateway, configured, tokens: () => tokens,
    report: (next: AgentServerStatus) => act(() => { status = next; for (const held of listeners) held(next) }),
  }
}

function show(status: AgentServerStatus, over: Parameters<typeof renderApp>[0] = {}) {
  const wire = fakeGateway(status)
  const listeners: ((command: HostCommand) => void)[] = []
  const app = renderApp({
    initialProject: project,
    agent: wire.gateway,
    commands: (listener) => { listeners.push(listener); return () => {} },
    ...over,
  })
  return { ...wire, app, send: (command: HostCommand) => act(() => { for (const held of listeners) held(command) }) }
}

describe('the agent glyph', () => {
  it('shows the three states as main reports them', async () => {
    const view = show({ kind: 'off' })
    await waitFor(() => expect(screen.getByTestId('agent-glyph').getAttribute('data-state')).toBe('off'))
    expect(screen.getByLabelText('Connect an agent…')).toBeDefined()

    view.report({ kind: 'listening', port: 51733, token: TOKEN })
    expect(screen.getByTestId('agent-glyph').getAttribute('data-state')).toBe('listening')
    expect(screen.getByLabelText('Waiting for an agent on port 51733')).toBeDefined()

    view.report({ kind: 'connected', port: 51733, token: TOKEN, client: { name: 'Claude Code', version: '2.0' } })
    expect(screen.getByTestId('agent-glyph').getAttribute('data-state')).toBe('connected')
    expect(screen.getByLabelText('Claude Code connected')).toBeDefined()
  })

  it('opens the dialog, whose switch reaches the seam and whose recipe carries the answer', async () => {
    const view = show({ kind: 'off' })
    await waitFor(() => expect(screen.getByTestId('agent-glyph')).toBeDefined())
    fireEvent.click(screen.getByTestId('agent-glyph'))
    const toggle = await screen.findByLabelText('Accept agent connections')
    fireEvent.click(toggle)
    expect(view.configured).toEqual([{ enabled: true }])
    await waitFor(() => expect(screen.getByTestId('agent-recipe').textContent).toContain(TOKEN))
    // The dialog stays open: the recipe is the next thing the person needs.
    expect(screen.getByTestId('connect-agent-dialog')).toBeDefined()
    fireEvent.click(screen.getByText('New token'))
    expect(view.tokens()).toBe(1)
  })

  it('is reached from the menu too, through the same command bus', async () => {
    const view = show({ kind: 'off' })
    await waitFor(() => expect(screen.getByTestId('agent-glyph')).toBeDefined())
    view.send({ type: 'connectAgent' })
    expect(await screen.findByTestId('connect-agent-dialog')).toBeDefined()
  })

  it('in a browser tab shows the glyph off and the dialog explains instead of switching', async () => {
    renderApp({ initialProject: project })
    await waitFor(() => expect(screen.getByTestId('agent-glyph').getAttribute('data-state')).toBe('off'))
    fireEvent.click(screen.getByTestId('agent-glyph'))
    expect(await screen.findByTestId('agent-desktop-only')).toBeDefined()
    expect(screen.queryByLabelText('Accept agent connections')).toBeNull()
  })
})

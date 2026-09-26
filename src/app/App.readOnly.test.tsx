// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A scope that is only read, from every side a change could come in by.
 *
 * Two ways a scope is only read, and one answer for both: a source that says
 * nobody here writes (a viewer's), and a scope whose `model.json` did not
 * parse, where a save would write an empty model over it. The workspace knew
 * both and told the agent; it never told the editor, so the canvas, its
 * keyboard, its menus and its inspector went on editing a scope that was not
 * to be edited, and so did the decisions and the observations pages.
 *
 * The session is what refuses (`useModelSession.test.tsx`); these pin that the
 * widgets say so too, with the real editor, over the real workspace.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { laidOut } from '../model/testFixtures'
import { installReactFlowMocks } from '../editor/reactFlowTestSetup'
import type { AgentAnswer, AgentRequest } from '../agent/tools'
import type { AgentGateway } from '../ports/AgentGateway'
import type { ScopeSnapshot } from '../projects/scope'
import { renderApp } from './testing/renderShell'

beforeAll(() => installReactFlowMocks())
afterEach(() => cleanup())

const scope = (over: Partial<ScopeSnapshot> = {}): ScopeSnapshot => ({
  path: 'acme/landscape',
  model: {
    name: 'Landscape',
    elements: [{ id: 'billing', kind: 'application', name: 'Billing', lifecycle: 'live', isManaged: true, aspects: {} }],
    relations: [],
    diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [{ id: 'billing', x: 400, y: 200 }] })],
    decisions: [],
  },
  activeDiagramId: 'd1',
  logoLibrary: [],
  ...over,
})

/** A gateway an agent's read can be asked through: how the tests see the model. */
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

const viewer = {
  kind: 'registered' as const,
  provider: 'elsewhere', name: 'Elsewhere', key: 'one', readOnly: true,
}

const ways = [
  ['a viewer’s source', () => ({ source: viewer, initialProject: scope() })],
  ['a scope whose model did not read', () => ({ source: undefined, initialProject: scope({ unreadable: ['model.json'] }) })],
] as const

describe.each(ways)('on %s', (_name, way) => {
  async function open() {
    const wire = listeningGateway()
    const { source, initialProject } = way()
    renderApp({ agent: wire.gateway, boot: { initialProject }, ...(source ? { source } : {}) })
    await waitFor(() => expect(wire.bound()).toBe(true))
    /** How many steps this session has taken: what any change, from anywhere, leaves behind. */
    const steps = async () => {
      const answer = await wire.ask('activity.list')
      if (!answer.ok || answer.content[0].type !== 'text') throw new Error('activity.list refused')
      return (JSON.parse(answer.content[0].text) as { total: number }).total
    }
    return { steps }
  }

  it('draws the canvas read-only: no palette to drag from, and it says so', async () => {
    await open()
    expect(screen.getByText('Read-only')).toBeDefined()
    expect(screen.queryByLabelText('Element palette')).toBeNull()
  })

  it('offers no menu on the board’s tab to rename, duplicate or delete it', async () => {
    await open()
    fireEvent.contextMenu(screen.getByText('L7'))
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('changes nothing from the keyboard: duplicate, paste, nudge', async () => {
    const { steps } = await open()
    const target = screen.getByText('ACTORS')
    // One act per key, as a person presses them: the selection the first
    // one makes is what the rest act on.
    for (const key of [
      { key: 'a', ctrlKey: true }, { key: 'd', ctrlKey: true },
      { key: 'c', ctrlKey: true }, { key: 'v', ctrlKey: true },
      { key: 'ArrowRight' },
    ]) act(() => { fireEvent.keyDown(target, key) })
    expect(await steps()).toBe(0)
    // Nothing was offered, so nothing had to be refused either.
    expect(screen.queryByText(/open to be read and not changed/)).toBeNull()
  })

  it('shows the inspector’s fields without letting them edit', async () => {
    await open()
    const target = screen.getByText('ACTORS')
    act(() => { fireEvent.keyDown(target, { key: 'a', ctrlKey: true }) })
    const name = await screen.findByLabelText('Name')
    expect((name as HTMLInputElement).readOnly || (name as HTMLInputElement).disabled).toBe(true)
  })

  /** A laid-out view in the tab (ADR-0016) is handed the editor's own flag. */
  it('lays out the sheet without its author’s controls', async () => {
    const { source, initialProject } = way()
    const withSheet: ScopeSnapshot = {
      ...initialProject,
      model: {
        ...initialProject.model,
        diagrams: [laidOut({ id: 's1', kind: 'sheet', name: 'Business', placements: [] })],
      },
      activeDiagramId: 's1',
    }
    renderApp({ boot: { initialProject: withSheet }, ...(source ? { source } : {}) })
    await screen.findByLabelText('Save as a picture…')
    expect(screen.queryByLabelText('What this sheet draws')).toBeNull()
  })

  it('offers no new decision', async () => {
    await open()
    fireEvent.click(await screen.findByText('Decisions'))
    await screen.findByTestId('adr-tree')
    expect(screen.queryByText(/New decision/)).toBeNull()
  })

  it('offers nothing to record on the observations page', async () => {
    await open()
    fireEvent.click(await screen.findByText('Observations'))
    await screen.findByTestId('observation-tab-register')
    expect(screen.queryByText(/New observation/)).toBeNull()
    expect(screen.queryByText(/New cause/)).toBeNull()
  })
})

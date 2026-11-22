// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV
// @vitest-environment jsdom

/**
 * A building block's comparison, through the app and its frame (ADR-0043,
 * ADR-0033): a step written from inside it leaves it up, and it is a place of
 * its own that an address, Back and an agent reach.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { AgentAnswer, AgentRequest } from '../agent/tools'
import { installReactFlowMocks } from '../editor/reactFlowTestSetup'
import type { Evaluation } from '../model/evaluation'
import type { DesignElement } from '../model/types'
import type { ScopeSnapshot } from '../projects/scope'
import type { AgentGateway } from '../ports/AgentGateway'
import { heldRepositories } from './testing/heldRepositories'
import { renderApp } from './testing/renderShell'

beforeAll(() => installReactFlowMocks())
afterEach(() => cleanup())
beforeEach(() => { window.history.replaceState(null, '', '/') })

const BLOCK: DesignElement = {
  id: 'blk-gw', kind: 'buildingBlock', name: 'Message gateway', lifecycle: 'live', isManaged: false, aspects: {},
  capabilities: [{ id: 'cap-route', text: 'Routes by content' }, { id: 'cap-audit', text: 'Keeps an audit trail', must: true }],
  contexts: [{ id: 'cx-partners', name: 'Many partners', needs: { 'cap-route': 4, 'cap-audit': 2 } }],
  sbbs: [{ id: 'sb-a', name: 'Broker A', sort: 'product', status: 'candidate' }, { id: 'sb-b', name: 'Managed bus', sort: 'service', status: 'candidate' }],
}

const RETAIL: Evaluation = {
  id: '-~blk-gw', block: { scope: '', id: 'blk-gw' }, contexts: ['cx-partners'], options: ['sb-a'],
  coverage: { 'sb-a': { 'cap-route': { level: 2 } } },
}

const scope = (path: string, name: string, more: Partial<ScopeSnapshot['model']> = {}): ScopeSnapshot => ({
  path, model: { name, elements: [], relations: [], diagrams: [], ...more }, activeDiagramId: '', logoLibrary: [],
})
const TREE = () => [scope('', 'Acme Logistics', { elements: [BLOCK] }), scope('retail', 'Retail', { evaluations: [RETAIL] })]

function wire() {
  let handler: ((request: AgentRequest) => Promise<AgentAnswer>) | undefined
  const connected = { kind: 'connected' as const, port: 51733, token: 't'.repeat(24), client: { name: 'Claude Code', version: '1' } }
  const gateway: AgentGateway = {
    id: 'fake',
    on(next) { handler = next; return () => { if (handler === next) handler = undefined } },
    status: () => Promise.resolve(connected), onStatus: () => () => {},
    configure: () => Promise.resolve(connected), newToken: () => Promise.resolve(connected),
  }
  let n = 0
  return { gateway, bound: () => handler !== undefined, ask: (tool: string, args: unknown = {}) => handler!({ id: `r${++n}`, tool, args }) }
}
const parsed = (answer: AgentAnswer): Record<string, unknown> => {
  if (!answer.ok || answer.content[0].type !== 'text') throw new Error(`refused: ${JSON.stringify(answer)}`)
  return JSON.parse(answer.content[0].text)
}

async function home(boot: Parameters<typeof renderApp>[0] extends infer O ? O extends { boot?: infer B } ? B : never : never = {}) {
  const agent = wire()
  const repositories = heldRepositories(TREE())
  const view = renderApp({ agent: agent.gateway, repositories, boot: { initialProject: undefined, ...boot } })
  await waitFor(() => expect(agent.bound()).toBe(true))
  await screen.findByTestId('organisation-cards')
  return { ...view, ...agent, repositories }
}

/** The ball under an option, on a capability's row. */
const cellOf = (capability: RegExp, option: RegExp) => within(screen.getByRole('row', { name: capability })).getAllByRole('gridcell').find((cell) => option.test(cell.getAttribute('aria-label') ?? ''))!

describe('a comparison in the frame', () => {
  it('stays up while it is written: two balls rated in a row and an option ticked', async () => {
    const { ask } = await home()
    parsed(await ask('app.open', { scope: '', page: 'blocks', id: 'blk-gw', tab: 'used' }))
    fireEvent.click(await screen.findByRole('row', { name: /Retail/ }))
    await screen.findByTestId('evaluation-view')
    const rate = async (capability: RegExp, level: string) => {
      const cell = cellOf(capability, /Broker A/)
      fireEvent.focus(cell)
      fireEvent.keyDown(cell, { key: level })
      await waitFor(() => expect(cellOf(capability, /Broker A/).getAttribute('aria-label')).toMatch(level === '4' ? /fully/i : /./))
    }
    await rate(/Routes by content/, '4')
    // The write lands and the tree is read again: the comparison is still the screen.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.getByTestId('evaluation-view')).toBeTruthy()
    await rate(/Keeps an audit trail/, '3')
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.getByTestId('evaluation-view')).toBeTruthy()
    fireEvent.click(screen.getByTestId('evaluation-option-sb-b'))
    await waitFor(() => expect(screen.getByTestId('evaluation-option-sb-b')).toHaveProperty('checked', true))
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(screen.getByTestId('evaluation-view')).toBeTruthy()
  })
})

describe('a comparison as a place', () => {
  const look = 'at=retail'

  it('has an address of its own, which Back leaves and Forward comes back to', async () => {
    const { ask } = await home()
    parsed(await ask('app.open', { scope: '', page: 'blocks', id: 'blk-gw', tab: 'used' }))
    // A place is written once it settles: the list first, so Back has somewhere to go.
    await waitFor(() => expect(window.location.hash).toBe('#/-/blocks/blk-gw?tab=used'))
    fireEvent.click(await screen.findByRole('row', { name: /Retail/ }))
    await screen.findByTestId('evaluation-view')
    await waitFor(() => expect(window.location.hash).toBe('#/-/blocks/blk-gw?tab=used&look=at%3Dretail'))
    expect(parsed(await ask('app.current')).page).toEqual({ page: 'blocks', id: 'blk-gw', tab: 'used', look })
    window.history.back()
    await waitFor(() => expect(screen.queryByTestId('evaluation-view')).toBeNull())
    expect(screen.getByTestId('block-evaluations')).toBeTruthy()
    window.history.forward()
    expect(await screen.findByTestId('evaluation-view')).toBeTruthy()
  })

  it('is reached by an agent, and by an address the app comes up on', async () => {
    const { ask } = await home()
    parsed(await ask('app.open', { scope: '', page: 'blocks', id: 'blk-gw', tab: 'used', look }))
    expect(await screen.findByTestId('evaluation-view')).toBeTruthy()
    cleanup()
    window.history.replaceState(null, '', '/')
    await home({ initialHomePage: 'blocks', initialList: { tab: 'used', pick: 'blk-gw' }, initialPageLook: { page: 'blocks', tab: 'used', look } })
    expect(await screen.findByTestId('evaluation-view')).toBeTruthy()
  })

  it('is two presses from the home of the scope that made it', async () => {
    const { ask } = await home()
    parsed(await ask('app.open', { scope: 'retail', page: 'home' }))
    fireEvent.click(await screen.findByTestId('home-comparisons'))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Message gateway' }))
    expect(await screen.findByTestId('evaluation-view')).toBeTruthy()
    await waitFor(() => expect(window.location.hash).toBe('#/retail/-/blocks/blk-gw?tab=used&look=at%3Dretail'))
  })

  it('opens the comparison just started', async () => {
    const { ask } = await home()
    parsed(await ask('app.open', { scope: '', page: 'blocks', id: 'blk-gw', tab: 'used' }))
    fireEvent.click(await screen.findByTestId('block-evaluate'))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Many partners' }))
    fireEvent.click(screen.getByTestId('evaluate-start'))
    await waitFor(() => expect(window.location.hash).toMatch(/look=at%3D(?!retail)/))
    expect(await screen.findByTestId('evaluation-view')).toBeTruthy()
  })
})

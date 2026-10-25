// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * Topics on the homes (ADR-0042), through the whole shell over a real store:
 * the card on the organisation's home and the catalogue behind it, a topic
 * made there, the tree's ↗ row, and a link stopped from the scope's own home —
 * each a step in the topic, read back from where it is kept.
 */
import { afterEach, describe, expect, it } from 'vitest'
import type { AgentAnswer, AgentRequest } from '../../agent/tools'
import type { AgentGateway } from '../../ports/AgentGateway'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { heldRepositories } from '../testing/heldRepositories'
import { renderApp } from '../testing/renderShell'
import { readScope } from '../../projects/scopeAccess'
import type { ScopeSnapshot } from '../../projects/scope'

afterEach(() => cleanup())

const TODAY = () => '2026-09-12'

function scope(path: string, name: string, over: Partial<ScopeSnapshot> = {}): ScopeSnapshot {
  return { path, model: { name, elements: [], relations: [], diagrams: [] }, activeDiagramId: '', logoLibrary: [], ...over }
}

/** An organisation with a domain, and a topic under the topics place relevant to it since always. */
const TREE = [
  scope('', 'Acme Logistics'),
  scope('sales', 'Sales', { kind: 'domain' }),
  scope('topics', 'Topics', { kind: 'domain' }),
  scope('topics/security', 'Security', { kind: 'domain', relevantTo: [{ path: 'sales' }] }),
]

describe('topics on the homes', () => {
  it('counts the topics on the organisation\'s card, opens the catalogue, and makes a topic there', async () => {
    const repositories = heldRepositories(TREE)
    renderApp({ repositories, today: TODAY })
    // Not `open-topics`: that is the tree's row for the Topics place.
    const card = await screen.findByTestId('open-topic-catalogue')
    await waitFor(() => expect(screen.getByTestId('organisation-cards').textContent).toContain('1 topic'))
    // The tree says the topic under the scope it is relevant to.
    expect(await screen.findByTestId('topic-under-sales-topics/security')).toBeTruthy()
    fireEvent.click(card)
    const catalogue = await screen.findByTestId('topics-catalogue')
    expect(within(catalogue).getByTestId('topic-row-topics/security').textContent).toContain('Sales')
    fireEvent.click(screen.getByTestId('topics-new'))
    fireEvent.change(await screen.findByTestId('topic-name'), { target: { value: 'Privacy' } })
    fireEvent.click(screen.getByTestId('topic-create'))
    await waitFor(() => expect(screen.getByTestId('topic-row-topics/privacy')).toBeTruthy())
    expect((await readScope(repositories.scopes, 'topics/privacy'))?.model.name).toBe('Privacy')
    expect(within(screen.getByTestId('topic-detail')).getByRole('heading', { name: 'Privacy' })).toBeTruthy()
  })

  it('shows the topic on the scope\'s home, and stops the link there from today, kept as history in the topic', async () => {
    const repositories = heldRepositories(TREE)
    renderApp({ repositories, today: TODAY })
    fireEvent.click(await screen.findByTestId('home-sales'))
    const chip = await screen.findByTestId('relevant-topics/security')
    fireEvent.click(chip.querySelector('svg')!)
    await waitFor(async () => expect((await readScope(repositories.scopes, 'topics/security'))?.relevantTo).toEqual([{ path: 'sales', until: '2026-09-11' }]))
    await waitFor(() => expect(screen.queryByTestId('relevant-topics/security')).toBeNull())
  })

  it('shows no Topics card on a home below the organisation', async () => {
    renderApp({ repositories: heldRepositories(TREE), today: TODAY })
    fireEvent.click(await screen.findByTestId('home-sales'))
    await screen.findByTestId('relevant-topics')
    expect(screen.queryByTestId('open-topic-catalogue')).toBeNull()
  })

  it('opens for an agent on the topic it names, and on a building block\'s page (ADR-0042, ADR-0043)', async () => {
    const wire = gateway()
    const blocks = [
      ...TREE.slice(0, 3), scope('topics/data', 'Data', { kind: 'domain' }),
      { ...TREE[3]!, model: { ...TREE[3]!.model, elements: [{ id: 'blk-gw', kind: 'buildingBlock' as const, name: 'Message gateway', lifecycle: 'live' as const, isManaged: false, aspects: {} }] } },
    ]
    renderApp({ repositories: heldRepositories(blocks), today: TODAY, agent: wire.gateway })
    await waitFor(() => expect(wire.bound()).toBe(true))
    await wire.ask('app.open', { scope: '', page: 'topics', id: 'topics/security' })
    expect(within(await screen.findByTestId('topic-detail')).getByRole('heading', { name: 'Security' })).toBeTruthy()
    expect((await wire.ask('app.current')).page).toEqual({ page: 'topics' })
    await wire.ask('app.open', { scope: '', page: 'blocks', id: 'blk-gw' })
    expect(await screen.findByTestId('block-tab-requirements')).toBeTruthy()
    expect((await wire.ask('app.current')).page).toEqual({ page: 'blocks' })
  })

  it('goes to a topic\'s own home from its page, and the page closes so the home shows', async () => {
    renderApp({ repositories: heldRepositories(TREE), today: TODAY })
    fireEvent.click(await screen.findByTestId('open-topic-catalogue'))
    fireEvent.click(within(await screen.findByTestId('topics-catalogue')).getByTestId('topic-row-topics/security'))
    fireEvent.click(await screen.findByTestId('topic-home'))
    await waitFor(() => expect(screen.queryByTestId('topics-catalogue')).toBeNull())
    expect(await screen.findByTestId('topic-in-catalogue')).toBeTruthy()
  })

  it('makes a scope a topic from its settings: typed Topic, it is filed under the Topics place, made on first use', async () => {
    const repositories = heldRepositories(TREE.slice(0, 2))
    renderApp({ repositories, today: TODAY })
    fireEvent.click(await screen.findByRole('button', { name: 'Settings for Sales' }))
    fireEvent.mouseDown(await screen.findByLabelText('What this is'))
    fireEvent.click(screen.getByRole('option', { name: 'Topic' }))
    expect(screen.getByText(/saving moves it there/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(async () => expect((await readScope(repositories.scopes, 'topics/sales'))?.kind).toBe('topic'))
    expect((await readScope(repositories.scopes, 'topics'))?.kind).toBe('topic')
    expect(await readScope(repositories.scopes, 'sales')).toBeUndefined()
  })

  it('makes a topic for an agent, under the Topics place or under a topic as a subtopic (ADR-0042 §2)', async () => {
    const wire = gateway()
    const repositories = heldRepositories(TREE)
    renderApp({ repositories, today: TODAY, agent: wire.gateway })
    await waitFor(() => expect(wire.bound()).toBe(true))
    expect(await wire.ask('scope.create', { parent: 'sales', name: 'Privacy', topic: true })).toMatchObject({ path: 'topics/privacy', kind: 'topic' })
    expect(await wire.ask('scope.create', { parent: 'topics/security', name: 'Identity', topic: true })).toMatchObject({ path: 'topics/security/identity', kind: 'topic' })
    expect((await readScope(repositories.scopes, 'topics/privacy'))?.kind).toBe('topic')
  })
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
  const ask = async (tool: string, args: unknown = {}): Promise<Record<string, unknown>> => {
    if (!handler) throw new Error('nobody is listening')
    const answer = await handler({ id: `r${++n}`, tool, args })
    if (!answer.ok || answer.content[0].type !== 'text') throw new Error(`refused: ${JSON.stringify(answer)}`)
    return JSON.parse(answer.content[0].text) as Record<string, unknown>
  }
  return { gateway: held, ask, bound: () => handler !== undefined }
}

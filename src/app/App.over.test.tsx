// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV
// @vitest-environment jsdom

/**
 * The organisation's pages over the scope that is open (ADR-0033, amended 22
 * November 2026), through the whole shell: from a board, More opens the
 * register, the people or the checks over the scope, which stays open — its
 * tabs, its name in the trail, its undo — and every way out shows it again.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { AgentAnswer, AgentRequest } from '../agent/tools'
import { laidOut } from '../model/testFixtures'
import { installReactFlowMocks } from '../editor/reactFlowTestSetup'
import type { ScopeSnapshot } from '../projects/scope'
import type { AgentGateway } from '../ports/AgentGateway'
import type { ScopeSession } from '../ports/ScopeSession'
import { heldRepositories } from './testing/heldRepositories'
import { placePage, placePageNow } from './testing/placePage'
import { renderApp } from './testing/renderShell'

beforeAll(() => installReactFlowMocks())
afterEach(() => cleanup())
beforeEach(() => { window.history.replaceState(null, '', '/') })

const scope = (path: string, name: string, draws: boolean): ScopeSnapshot => ({
  path,
  model: {
    name, elements: [], relations: [],
    diagrams: draws ? [laidOut({ id: 'l7', kind: 'layer7', name: 'The board', placements: [] }), laidOut({ id: 'l8', kind: 'layer7', name: 'Another', placements: [] })] : [],
  },
  activeDiagramId: draws ? 'l7' : '',
  logoLibrary: [],
})
const TREE = () => [scope('', 'Acme Logistics', false), scope('retail', 'Retail', false), scope('retail/depot', 'Depot', true)]

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

/** The app on the board of Depot, with the agent's door and the open scope's session to hand. */
async function onTheBoard() {
  const agent = wire()
  let session: ScopeSession | undefined
  const view = renderApp({ agent: agent.gateway, repositories: heldRepositories(TREE()), boot: { initialProject: undefined }, provider: { onScopeSession: (held) => { session = held } } })
  await waitFor(() => expect(agent.bound()).toBe(true))
  await screen.findByTestId('organisation-cards')
  expect(parsed(await agent.ask('app.open', { scope: 'retail/depot', page: 'board', id: 'l7' })).arrived).toBe(true)
  await boardUp()
  await waitFor(() => expect(session?.scope).toBe('retail/depot'))
  // The board is a place in the history before anything is pressed: Back from a page comes here.
  await waitFor(() => expect(window.location.hash).toBe('#/retail/depot/-/board/l7'))
  return { ...view, ...agent, session: () => session! }
}

const tabs = () => within(screen.getByTestId('frame-views'))
const boardUp = () => tabs().findByRole('tab', { name: 'The board', selected: true })

/** More, and the place under it. */
async function more(place: string) {
  fireEvent.click(screen.getByTestId('frame-more'))
  fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: place }).catch(() => screen.findByRole('menuitem', { name: place })))
  return placePage()
}

describe('a page of the organisation’s, opened from a board', () => {
  it('stands over the scope: the trail still names it, its tabs stay, and the row says which page is up', async () => {
    await onTheBoard()
    await more('Register')
    await waitFor(() => expect(window.location.hash).toBe('#/-/register'))
    // The scope is still the one in the trail, and still open: no home came up in its place.
    expect(screen.getByTestId('crumb-current').textContent).toBe('Depot')
    expect(screen.queryByTestId('organisation-name')).toBeNull()
    // Its views are still row two's tabs, none of them chosen, the one under the page marked as where you were.
    const board = tabs().getByRole('tab', { name: 'The board' })
    expect(board.getAttribute('aria-selected')).toBe('false')
    expect(board.hasAttribute('data-was-here')).toBe(true)
    expect(tabs().getByRole('tab', { name: 'Another' }).hasAttribute('data-was-here')).toBe(false)
    // More is marked, and names the page.
    await waitFor(() => expect(screen.getByTestId('frame-more').textContent).toBe('More: Register'))
    expect(screen.getByTestId('frame-more').getAttribute('aria-current')).toBe('page')
  })

  it.each([['Register', '#/-/register'], ['People', '#/-/people'], ['Checks', '#/-/checks']])('%s: Esc shows the board again, as it was', async (place, address) => {
    await onTheBoard()
    const page = await more(place)
    await waitFor(() => expect(window.location.hash).toBe(address))
    expect(screen.getByTestId('crumb-current').textContent).toBe('Depot')
    fireEvent.keyDown(page, { key: 'Escape' })
    await waitFor(() => expect(placePageNow()).toBeNull())
    await boardUp()
    await waitFor(() => expect(window.location.hash).toBe('#/retail/depot/-/board/l7'))
    expect(screen.getByTestId('frame-more').textContent).toBe('More')
  })

  it('draws no second way back beside the tab it stands over, and offers it again from the home', async () => {
    await onTheBoard()
    await more('Register')
    // The board's tab is in the row under the page: the way back would be a second press to the same place.
    expect(screen.queryByTestId('frame-last-view')).toBeNull()
    fireEvent.click(screen.getByTestId('frame-home'))
    fireEvent.click(await screen.findByTestId('frame-last-view'))
    await waitFor(() => expect(placePageNow()).toBeNull())
    await boardUp()
  })

  it('is left by the tab it stands over, and by another tab, which opens that view', async () => {
    await onTheBoard()
    await more('Register')
    fireEvent.click(tabs().getByRole('tab', { name: 'The board' }))
    await waitFor(() => expect(placePageNow()).toBeNull())
    await boardUp()
    await more('People')
    fireEvent.click(tabs().getByRole('tab', { name: 'Another' }))
    await waitFor(() => expect(placePageNow()).toBeNull())
    await tabs().findByRole('tab', { name: 'Another', selected: true })
  })

  it('is left by Back, and Forward opens it over the scope again', async () => {
    await onTheBoard()
    await more('Register')
    await waitFor(() => expect(window.location.hash).toBe('#/-/register'))
    act(() => { window.history.back() })
    await waitFor(() => expect(window.location.hash).toBe('#/retail/depot/-/board/l7'))
    await waitFor(() => expect(placePageNow()).toBeNull())
    await boardUp()
    act(() => { window.history.forward() })
    await placePage()
    await waitFor(() => expect(window.location.hash).toBe('#/-/register'))
    expect(screen.getByTestId('crumb-current').textContent).toBe('Depot')
  })

  it('keeps the scope’s undo: a step made before the register was opened is taken back after it', async () => {
    const { session } = await onTheBoard()
    act(() => { session().dispatch({ type: 'diagram.rename', id: 'l7', name: 'Renamed' }) })
    await tabs().findByRole('tab', { name: 'Renamed' })
    const page = await more('Register')
    fireEvent.keyDown(page, { key: 'Escape' })
    await waitFor(() => expect(placePageNow()).toBeNull())
    // The same session, with its stack: row one's undo takes the rename back.
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await tabs().findByRole('tab', { name: 'The board', selected: true })
    expect(session().current().diagrams[0].name).toBe('The board')
  })

  it('takes ⌘Z as any page over the scope does: the scope’s newest step, by the frame’s own key', async () => {
    const { session } = await onTheBoard()
    act(() => { session().dispatch({ type: 'diagram.rename', id: 'l7', name: 'Renamed' }) })
    await tabs().findByRole('tab', { name: 'Renamed' })
    const page = await more('People')
    await waitFor(() => expect(window.location.hash).toBe('#/-/people'))
    fireEvent.keyDown(page, { key: 'z', ctrlKey: true })
    await waitFor(() => expect(session().current().diagrams[0].name).toBe('The board'))
    // Once: nothing under the page heard the key as well.
    expect(session().current().diagrams[0].name).toBe('The board')
    expect(placePageNow()).not.toBeNull()
  })

  it('leaves the words in row two meaning the scope: Decisions under the register is the scope’s', async () => {
    await onTheBoard()
    await more('Register')
    fireEvent.click(screen.getByTestId('frame-page-decisions'))
    await waitFor(() => expect(window.location.hash).toBe('#/retail/depot/-/decisions'))
    await screen.findByText(/No decisions in Depot/)
    expect(screen.getByTestId('crumb-current').textContent).toBe('Depot')
  })

  it('stands over a page of the scope’s as well, and leaving it shows that page again', async () => {
    await onTheBoard()
    fireEvent.click(screen.getByTestId('frame-page-decisions'))
    await screen.findByText(/No decisions in Depot/)
    const page = await more('Checks')
    await waitFor(() => expect(window.location.hash).toBe('#/-/checks'))
    fireEvent.keyDown(page, { key: 'Escape' })
    await waitFor(() => expect(window.location.hash).toBe('#/retail/depot/-/decisions'))
    expect(screen.getByText(/No decisions in Depot/)).toBeDefined()
  })

  it('opens the operating model over the scope, to read, at the scope’s own address', async () => {
    await onTheBoard()
    await more('Operating model')
    await waitFor(() => expect(window.location.hash).toBe('#/retail/depot/-/operating'))
    expect(screen.getByTestId('crumb-current').textContent).toBe('Depot')
    expect(tabs().getByRole('tab', { name: 'The board' }).hasAttribute('data-was-here')).toBe(true)
    await waitFor(() => expect(screen.getByTestId('frame-more').textContent).toBe('More: Operating model'))
  })
})

describe('an agent, and a page of the organisation’s over the open scope', () => {
  it('arrives on it, is told the scope is still open, and goes back to the view', async () => {
    const { ask } = await onTheBoard()
    const there = parsed(await ask('app.open', { scope: '', page: 'register' }))
    expect(there.arrived).toBe(true)
    expect((there.open as { path: string; view: { id: string } }).path).toBe('retail/depot')
    expect((there.open as { view: { id: string } }).view.id).toBe('l7')
    expect(there.home).toEqual({ path: '', name: 'Acme Logistics' })
    expect((there.page as { page: string }).page).toBe('register')
    // Nothing closed: the answer says no scope is to be opened first.
    expect(there.hint).toBeUndefined()
    const back = parsed(await ask('app.open', { scope: 'retail/depot', page: 'board', id: 'l7' }))
    expect(back.arrived).toBe(true)
    expect(back.page).toBeUndefined()
    expect(back.home).toBeUndefined()
    await waitFor(() => expect(placePageNow()).toBeNull())
  })

  it('is asked for the organisation’s home, and the scope closes as it always did', async () => {
    const { ask } = await onTheBoard()
    await ask('app.open', { scope: '', page: 'register' })
    const home = parsed(await ask('app.open', { scope: '', page: 'home' }))
    expect(home.arrived).toBe(true)
    expect(home.open).toBeUndefined()
    await screen.findByTestId('organisation-cards')
  })
})

describe('with no scope open', () => {
  it('the organisation’s pages open over its home, as before', async () => {
    const agent = wire()
    renderApp({ agent: agent.gateway, repositories: heldRepositories(TREE()), boot: { initialProject: undefined } })
    await screen.findByTestId('organisation-cards')
    await more('Register')
    await waitFor(() => expect(window.location.hash).toBe('#/-/register'))
    expect(screen.getByTestId('crumb-current').textContent).toBe('Acme Logistics')
    const now = parsed(await agent.ask('app.current'))
    expect(now.open).toBeUndefined()
    expect(now.home).toEqual({ path: '', name: 'Acme Logistics' })
  })
})

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV
// @vitest-environment jsdom

/**
 * The frame, through the app: two rows that do not change from a home to a
 * board to a page, a page as a place with an address, and every place reached
 * the same way by a person and by an agent.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { AgentAnswer, AgentRequest } from '../agent/tools'
import { laidOut } from '../model/testFixtures'
import { installReactFlowMocks } from '../editor/reactFlowTestSetup'
import type { ScopeSnapshot } from '../projects/scope'
import type { AgentGateway } from '../ports/AgentGateway'
import { heldRepositories } from './testing/heldRepositories'
import { placePage, placePageNow } from './testing/placePage'
import { renderApp } from './testing/renderShell'

beforeAll(() => installReactFlowMocks())
afterEach(() => cleanup())
beforeEach(() => { window.history.replaceState(null, '', '/') })

const scope = (path: string, name: string, draws: boolean): ScopeSnapshot => ({
  path,
  model: { name, elements: [], relations: [], diagrams: draws ? [laidOut({ id: 'l7', kind: 'layer7', name: 'The board', placements: [] })] : [] },
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

async function home() {
  const agent = wire()
  const view = renderApp({ agent: agent.gateway, repositories: heldRepositories(TREE()), boot: { initialProject: undefined } })
  await waitFor(() => expect(agent.bound()).toBe(true))
  await screen.findByTestId('organisation-cards')
  return { ...view, ...agent }
}

describe('the two rows', () => {
  it('stand on a home, on a page and on a board, the same element all the way', async () => {
    const { ask } = await home()
    const rowOne = screen.getByTestId('shell-toolbar')
    const rowTwo = screen.getByTestId('frame-places')
    fireEvent.click(within(rowTwo).getByTestId('frame-page-roadmap'))
    await placePage()
    expect(screen.getByTestId('shell-toolbar')).toBe(rowOne)
    expect(parsed(await ask('app.open', { scope: 'retail/depot', page: 'board', id: 'l7' })).arrived).toBe(true)
    expect(await screen.findByTestId('frame-places')).toBe(rowTwo)
    expect(screen.getByTestId('shell-toolbar')).toBe(rowOne)
  })

  it('docks the tree on a home, and leaves the width to the work elsewhere until it is pinned', async () => {
    const { ask } = await home()
    expect(screen.getByTestId('frame-tree')).toBeDefined()
    await ask('app.open', { scope: 'retail/depot', page: 'board', id: 'l7' })
    await waitFor(() => expect(screen.queryByTestId('frame-tree')).toBeNull())
    fireEvent.keyDown(window, { key: '\\', metaKey: true })
    expect(await screen.findByTestId('frame-tree')).toBeDefined()
    expect(screen.getByTestId('scope-retail/depot').getAttribute('aria-current')).toBe('page')
  })

  it('switches scope from the crumb’s chevron, with the same tree over the work', async () => {
    const { ask } = await home()
    await ask('app.open', { scope: 'retail/depot', page: 'board', id: 'l7' })
    fireEvent.click(await screen.findByTestId('scope-switcher-open'))
    const switcher = await screen.findByTestId('scope-switcher')
    fireEvent.change(within(switcher).getByTestId('tree-find'), { target: { value: 'retail' } })
    fireEvent.click(within(switcher).getByTestId('home-retail'))
    await waitFor(() => expect(screen.getByTestId('crumb-current').textContent).toBe('Retail'))
  })

  it('keeps the organisation’s crumb however deep the scope is', async () => {
    const { ask } = await home()
    await ask('app.open', { scope: 'retail/depot', page: 'board', id: 'l7' })
    await waitFor(() => expect(screen.getByTestId('crumb-current').textContent).toBe('Depot'))
    expect(screen.getByTestId('crumb-').textContent).toBe('Acme Logistics')
  })
})

describe('a page as a place', () => {
  it('has an address, and Esc and Home both leave it', async () => {
    await home()
    fireEvent.click(screen.getByTestId('tree-place-register'))
    await placePage()
    await waitFor(() => expect(window.location.hash).toBe('#/-/register'))
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(placePageNow()).toBeNull())
    fireEvent.click(screen.getByTestId('tree-place-people'))
    await placePage()
    fireEvent.click(screen.getByTestId('frame-home'))
    await waitFor(() => expect(placePageNow()).toBeNull())
    await waitFor(() => expect(window.location.hash).toBe('#/-/home'))
  })

  it('marks the page that is up in row two', async () => {
    await home()
    fireEvent.click(screen.getByTestId('frame-page-roadmap'))
    await placePage()
    await waitFor(() => expect(screen.getByTestId('frame-page-roadmap').getAttribute('aria-current')).toBe('page'))
    expect(screen.getByTestId('frame-home').getAttribute('aria-current')).toBeNull()
  })

  it('is left by the view’s tab, the tab that was already chosen included', async () => {
    const { ask } = await home()
    await ask('app.open', { scope: 'retail/depot', page: 'decisions' })
    await placePage()
    fireEvent.click(await within(screen.getByTestId('frame-views')).findByRole('tab', { name: 'The board' }))
    await waitFor(() => expect(placePageNow()).toBeNull())
  })
})

describe('an agent reaches every place', () => {
  it('opens Your work and Activity beside what is up, moving nothing else', async () => {
    const { ask } = await home()
    await ask('app.open', { scope: 'retail/depot', page: 'board', id: 'l7' })
    expect(parsed(await ask('app.open', { scope: 'retail/depot', page: 'work' })).arrived).toBe(true)
    expect(await screen.findByTestId('work-copy')).toBeDefined()
    const now = parsed(await ask('app.current'))
    expect(now.panel).toBe('work')
    expect((now.open as { view: { id: string } }).view.id).toBe('l7')
    await waitFor(() => expect(window.location.hash).toBe('#/retail/depot/-/board/l7?panel=work'))
    expect(parsed(await ask('app.open', { scope: 'retail/depot', page: 'activity' })).arrived).toBe(true)
    expect(await screen.findByRole('list', { name: 'Activity' }).catch(() => screen.findByText(/nothing|Nothing/))).toBeDefined()
  })

  it('opens the preferences and a scope’s settings, with nothing open', async () => {
    const { ask } = await home()
    await ask('app.open', { scope: '', page: 'preferences' })
    await screen.findByTestId('preferences-page')
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('preferences-page')).toBeNull())
    await ask('app.open', { scope: 'retail', page: 'settings' })
    await waitFor(() => expect(screen.getByTestId('crumb-current').textContent).toBe('Retail'))
    expect(await screen.findByTestId('scope-settings-page')).toBeDefined()
  })

  it('names a tab of any page that has one, and is told the page’s own where it does not', async () => {
    const { ask } = await home()
    await ask('app.open', { scope: '', page: 'people', tab: 'privacy' })
    await placePage()
    await waitFor(() => expect(window.location.hash).toBe('#/-/people?tab=privacy'))
    expect((parsed(await ask('app.current')).page as { tab: string }).tab).toBe('privacy')
    expect((await ask('app.open', { scope: '', page: 'people', tab: 'analysis' })).ok).toBe(false)
  })
})

describe('the status word', () => {
  it('opens Your work on every screen, whose acts run with nothing open', async () => {
    await home()
    fireEvent.click(screen.getByTestId('saved-indicator'))
    expect(await screen.findByTestId('work-copy')).toBeDefined()
    await waitFor(() => expect(window.location.hash).toBe('#/-/work'))
    expect(screen.queryByTestId('work-save')).toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('work-copy')).toBeNull())
  })

  it('is told by the source that it is offline, rather than saying sent', async () => {
    let up = false
    renderApp({
      repositories: heldRepositories(TREE()),
      boot: { initialProject: TREE()[2] },
      provider: { publishesSteps: true, status: () => 'clean', connected: () => up } as never,
    })
    await waitFor(() => expect(screen.getByTestId('saved-indicator').textContent).toBe('Working offline'))
    up = true
  })
})

describe('⌘K', () => {
  it('finds places and commands beside the records, from a home, and runs them', async () => {
    await home()
    fireEvent.click(screen.getByTestId('frame-find'))
    const field = await screen.findByRole('combobox')
    fireEvent.change(field, { target: { value: 'decisions' } })
    fireEvent.click(await screen.findByTestId('palette-place:decisions'))
    await placePage()
  })

  it('offers the commands of the one table, with their keys', async () => {
    await home()
    fireEvent.keyDown(window, { key: 'k', metaKey: true })
    const field = await screen.findByRole('combobox')
    fireEvent.change(field, { target: { value: 'keyboard' } })
    fireEvent.click(await screen.findByTestId('palette-help:menu.shortcuts'))
    expect(await screen.findByTestId('shortcuts-sheet')).toBeDefined()
  })
})

describe('the sheet of keys', () => {
  it('opens on ? from a home, where there is no canvas to ask', async () => {
    await home()
    fireEvent.keyDown(window, { key: '?' })
    expect(await screen.findByTestId('shortcuts-sheet')).toBeDefined()
  })
})

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
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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
    fireEvent.keyDown(window, { key: '\\', ctrlKey: true })
    expect(await screen.findByTestId('frame-tree')).toBeDefined()
    expect(screen.getByTestId('scope-retail/depot').getAttribute('aria-current')).toBe('page')
  })

  it('leaves the tree open on a home, where the toggle says so and ⌘\\ flips nothing unseen', async () => {
    const { ask } = await home()
    const toggle = screen.getByTestId('frame-tree-toggle')
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    expect(toggle.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(toggle)
    fireEvent.keyDown(window, { key: '\\', metaKey: true })
    expect(screen.getByTestId('frame-tree')).toBeDefined()
    // The preference was not flipped behind the home: the board still leaves the width to the work.
    await ask('app.open', { scope: 'retail/depot', page: 'board', id: 'l7' })
    await waitFor(() => expect(screen.queryByTestId('frame-tree')).toBeNull())
    expect(screen.getByTestId('frame-tree-toggle').getAttribute('aria-pressed')).toBe('false')
  })

  it('is one Tab stop, moved by the arrows, folded by ← and →, and found by typing', async () => {
    await home()
    const tree = screen.getByRole('tree')
    const stops = () => within(tree).getAllByRole('treeitem').filter((item) => item.tabIndex === 0)
    expect(stops()).toEqual([screen.getByTestId('scope-root')])
    screen.getByTestId('scope-root').focus()
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    const retail = screen.getByTestId('scope-retail')
    expect(document.activeElement).toBe(retail)
    expect(stops()).toEqual([retail])
    const open = retail.getAttribute('aria-expanded')
    fireEvent.keyDown(retail, { key: open === 'true' ? 'ArrowLeft' : 'ArrowRight' })
    expect(retail.getAttribute('aria-expanded')).toBe(open === 'true' ? 'false' : 'true')
    if (retail.getAttribute('aria-expanded') === 'false') fireEvent.keyDown(retail, { key: 'ArrowRight' })
    fireEvent.keyDown(retail, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(screen.getByTestId('scope-retail/depot'))
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(retail)
    fireEvent.keyDown(retail, { key: 'Home' })
    fireEvent.keyDown(document.activeElement!, { key: 'd' })
    expect(document.activeElement).toBe(screen.getByTestId('scope-retail/depot'))
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' })
    await waitFor(() => expect(screen.getByTestId('scope-retail/depot').getAttribute('aria-current')).toBe('page'))
  })

  it('opens a row’s ⋯ on a right-click', async () => {
    await home()
    fireEvent.contextMenu(screen.getByTestId('home-retail'))
    expect(await screen.findByRole('menu')).toBeDefined()
  })

  it('switches scope from the crumb’s chevron, with the same tree over the work', async () => {
    const { ask } = await home()
    await ask('app.open', { scope: 'retail/depot', page: 'board', id: 'l7' })
    fireEvent.click(await screen.findByTestId('scope-switcher-open'))
    const switcher = await screen.findByTestId('scope-switcher')
    expect(screen.getByRole('dialog', { name: 'Switch scope' })).toBeDefined()
    await waitFor(() => expect(document.activeElement).toBe(within(switcher).getByTestId('tree-find')))
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

  it('folds the scopes in between into a ⋯ deep in the tree, keeping the organisation and the one above', async () => {
    const agent = wire()
    const deep = [...TREE(), scope('retail/depot/bay', 'Bay', false), scope('retail/depot/bay/dock', 'Dock', true)]
    renderApp({ agent: agent.gateway, repositories: heldRepositories(deep), boot: { initialProject: undefined } })
    await waitFor(() => expect(agent.bound()).toBe(true))
    await agent.ask('app.open', { scope: 'retail/depot/bay/dock', page: 'home' })
    await waitFor(() => expect(screen.getByTestId('crumb-current').textContent).toBe('Dock'))
    expect(screen.getByTestId('crumb-').textContent).toBe('Acme Logistics')
    expect(screen.getByTestId('crumb-retail/depot/bay').textContent).toBe('Bay')
    expect(screen.queryByTestId('crumb-retail')).toBeNull()
    fireEvent.click(within(screen.getByTestId('crumbs-folded')).getByRole('button'))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Depot' }))
    await waitFor(() => expect(screen.getByTestId('crumb-current').textContent).toBe('Depot'))
  })
})

describe('row two on a home', () => {
  it('lists no view while moving through the tree: Home, the places on its right and More, with the views on the page beside it', async () => {
    const { ask } = await home()
    expect(parsed(await ask('app.open', { scope: 'retail/depot', page: 'home' })).arrived).toBe(true)
    await waitFor(() => expect(screen.getByTestId('crumb-current').textContent).toBe('Depot'))
    const row = screen.getByTestId('frame-places')
    expect(within(row).getByTestId('frame-home').getAttribute('aria-current')).toBe('page')
    expect(within(row).getByTestId('frame-page-decisions')).toBeDefined()
    // Places left to fold fold before the views give up width (Frame.css, `data-row-folds`).
    expect(row.querySelector(':scope > [data-row-folds]')).not.toBeNull()
    expect(readFileSync(join(process.cwd(), 'src/widgets/kit/Frame.css'), 'utf8')).toMatch(/:has\(> \[data-row-folds\]\)[^{]*kit-frame__views[^{]*\{ flex-shrink: 0; \}/)
    expect(within(row).getByRole('button', { name: 'More' })).toBeDefined()
    expect(within(row).queryByTestId(/^frame-view-/)).toBeNull()
    expect(within(row).queryByTestId('frame-new-view')).toBeNull()
    expect(within(screen.getByTestId('boards')).getByRole('row', { name: /The board/ })).toBeDefined()
  })

  it('shows the scope\'s views once one is open, with Home to go back, and they are one press away by address', async () => {
    const { ask } = await home()
    expect(parsed(await ask('app.open', { scope: 'retail/depot', page: 'board', id: 'l7' })).arrived).toBe(true)
    expect(await within(screen.getByTestId('frame-views')).findByRole('tab', { name: 'The board', selected: true })).toBeDefined()
    fireEvent.click(screen.getByTestId('frame-home'))
    await waitFor(() => expect(within(screen.getByTestId('frame-views')).queryByRole('tab')).toBeNull())
  })

  it('lists over a page the tabs the workspace draws: a map is the sheet\u2019s Coverage, not a tab, while there is a sheet', async () => {
    const root = scope('', 'Acme Logistics', true)
    const views = [
      ...root.model.diagrams,
      laidOut({ id: 'sh', kind: 'sheet', name: 'Business architecture', placements: [] }),
      laidOut({ id: 'mp', kind: 'map', name: 'Enterprise map', placements: [] }),
    ]
    const agent = wire()
    renderApp({ agent: agent.gateway, repositories: heldRepositories([{ ...root, model: { ...root.model, diagrams: views } }]), boot: { initialProject: undefined } })
    await screen.findByTestId('organisation-cards')
    fireEvent.click(screen.getByTestId('tree-place-register'))
    await placePage()
    const row = screen.getByTestId('frame-places')
    expect(within(row).getByTestId('frame-view-sh')).toBeDefined()
    expect(within(row).getByTestId('frame-view-l7')).toBeDefined()
    expect(within(row).queryByTestId('frame-view-mp')).toBeNull()
  })

  it('leaves what a page over a home shows as it was', async () => {
    await home()
    fireEvent.click(screen.getByTestId('tree-place-register'))
    await placePage()
    expect(within(screen.getByTestId('frame-places')).getByTestId('frame-new-view')).toBeDefined()
  })
})

describe('the foot of the tree', () => {
  it('folds to its heading on a press, and opens again, leaving the scopes the room', async () => {
    await home()
    const fold = screen.getByTestId('tree-foot-fold')
    expect(fold.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(fold)
    expect(fold.getAttribute('aria-expanded')).toBe('false')
    expect(screen.getByTestId('tree-place-register').closest('[hidden]')).not.toBeNull()
    fireEvent.click(fold)
    expect(screen.getByTestId('tree-place-register').closest('[hidden]')).toBeNull()
  })

  it('says what its entries hold, each word going to that page by its own address', async () => {
    await home()
    const press = async (word: string) => {
      fireEvent.click(within(await screen.findByTestId('tree-foot')).getByRole('button', { name: word }))
      await placePage()
    }
    const foot = screen.getByTestId('tree-foot')
    for (const word of ['Applications', 'Services', 'Platforms', 'Principles', 'Topics', 'Building blocks']) expect(within(foot).getByRole('button', { name: word })).toBeDefined()
    await press('Building blocks')
    await waitFor(() => expect(window.location.hash).toBe('#/-/blocks'))
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    await press('Topics')
    await waitFor(() => expect(window.location.hash).toBe('#/-/topics'))
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    await press('Platforms')
    await waitFor(() => expect(window.location.hash).toMatch(/^#\/-\/register\?.*tab=platforms/))
  })
})

describe('a page as a place', () => {
  it('has an address, and Esc and Home both leave it', async () => {
    await home()
    fireEvent.click(screen.getByTestId('tree-place-register'))
    await placePage()
    await waitFor(() => expect(window.location.hash).toBe('#/-/register'))
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    await waitFor(() => expect(placePageNow()).toBeNull())
    fireEvent.click(screen.getByTestId('tree-place-people'))
    await placePage()
    fireEvent.click(screen.getByTestId('frame-home'))
    await waitFor(() => expect(placePageNow()).toBeNull())
    await waitFor(() => expect(window.location.hash).toBe('#/-/home'))
  })

  it('closes on an Escape nothing further in claimed, and claims it, so the board under it keeps what is selected', async () => {
    await home()
    fireEvent.click(screen.getByTestId('tree-place-register'))
    await placePage()
    const claimed = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    claimed.preventDefault()
    document.body.dispatchEvent(claimed)
    expect(placePageNow()).not.toBeNull()
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    document.body.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    await waitFor(() => expect(placePageNow()).toBeNull())
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
    expect(await screen.findByRole('list', { name: 'Activity' }).catch(() => screen.findByText(/from now on shows in this list/))).toBeDefined()
  })

  it('takes the focus to a panel opened from row one, and gives it back when its × shuts it', async () => {
    await home()
    const word = screen.getByTestId('saved-indicator')
    word.focus()
    fireEvent.click(word)
    const panel = await screen.findByTestId('frame-panel')
    await waitFor(() => expect(document.activeElement).toBe(panel))
    fireEvent.click(within(panel).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByTestId('frame-panel')).toBeNull())
    expect(document.activeElement).toBe(screen.getByTestId('saved-indicator'))
  })

  it('opens the preferences and a scope’s settings, with nothing open', async () => {
    const { ask } = await home()
    await ask('app.open', { scope: '', page: 'preferences' })
    await screen.findByTestId('preferences-page')
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
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
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('work-copy')).toBeNull())
  })

  it('says the history is not started until a snapshot starts it, and never Kept before it has asked', async () => {
    const agent = wire()
    const repositories = heldRepositories(TREE())
    renderApp({ agent: agent.gateway, repositories, boot: { initialProject: undefined } })
    await screen.findByTestId('organisation-cards')
    fireEvent.click(screen.getByTestId('saved-indicator'))
    const panel = await screen.findByTestId('frame-panel')
    await waitFor(() => expect(within(panel).getByText('Not started')).toBeDefined())
    expect(within(panel).queryByText('Kept')).toBeNull()
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('frame-panel')).toBeNull())
    await repositories.history!.record({ subject: 'First' })
    fireEvent.click(screen.getByTestId('saved-indicator'))
    await waitFor(() => expect(within(screen.getByTestId('frame-panel')).getByText('Kept')).toBeDefined())
  })

  it('is told by the source that it is offline, rather than saying sent', async () => {
    let up = false
    renderApp({
      repositories: heldRepositories(TREE()),
      boot: { initialProject: TREE()[2] },
      provider: { publishesSteps: true, status: () => 'clean', connected: () => up } as never,
    })
    await waitFor(() => expect(screen.getByTestId('saved-indicator').textContent).toBe('○Working offline'))
    up = true
  })
})

/**
 * One Escape, one thing (`widgets/kit/keys.ts`): the panel shuts once whatever
 * is further in has had the key, and before the page and the board.
 */
describe('Escape and the panel', () => {
  async function panelUp() {
    await home()
    fireEvent.click(screen.getByTestId('saved-indicator'))
    return screen.findByTestId('frame-panel')
  }

  it('from a field in the panel leaves the field and keeps the panel; the next one shuts it', async () => {
    const panel = await panelUp()
    const field = document.createElement('input')
    panel.appendChild(field)
    field.focus()
    fireEvent.keyDown(field, { key: 'Escape' })
    expect(screen.getByTestId('frame-panel')).toBe(panel)
    expect(document.activeElement).toBe(panel)
    fireEvent.keyDown(panel, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('frame-panel')).toBeNull())
  })

  it('leaves a key something further in claimed, and a field elsewhere its own', async () => {
    await panelUp()
    const claimed = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    claimed.preventDefault()
    document.body.dispatchEvent(claimed)
    const elsewhere = document.createElement('input')
    document.body.appendChild(elsewhere)
    fireEvent.keyDown(elsewhere, { key: 'Escape' })
    expect(screen.getByTestId('frame-panel')).toBeDefined()
    elsewhere.remove()
  })

  it('claims the key it shut the panel with, so the board under it keeps what is selected', async () => {
    await panelUp()
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    document.body.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    await waitFor(() => expect(screen.queryByTestId('frame-panel')).toBeNull())
  })
})

describe('the menu’s keys on the web', () => {
  it('runs what the ⋯ shows a key for, with nothing open', async () => {
    await home()
    fireEvent.keyDown(window, { key: ',', ctrlKey: true })
    expect(await screen.findByTestId('preferences-page')).toBeDefined()
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('preferences-page')).toBeNull())
    fireEvent.keyDown(window, { key: 'E', ctrlKey: true, shiftKey: true })
    expect(await screen.findByText(/^Save a copy of/)).toBeDefined()
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
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    const field = await screen.findByRole('combobox')
    fireEvent.change(field, { target: { value: 'keyboard' } })
    fireEvent.click(await screen.findByTestId('palette-help:menu.shortcuts'))
    expect(await screen.findByTestId('shortcuts-sheet')).toBeDefined()
  })

  it('finds a scope by its name, ahead of the records, and opens its home', async () => {
    await home()
    fireEvent.click(screen.getByTestId('frame-find'))
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: 'depo' } })
    const line = await screen.findByTestId('palette-scope:retail/depot')
    expect(screen.getAllByRole('option')[0]).toBe(line)
    fireEvent.click(line)
    await waitFor(() => expect(screen.getByTestId('crumb-current').textContent).toBe('Depot'))
  })

  it('finds a view of any scope by its name, and opens it', async () => {
    await home()
    fireEvent.click(screen.getByTestId('frame-find'))
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: 'the board' } })
    fireEvent.click(await screen.findByTestId('palette-view:l7'))
    await waitFor(() => expect(screen.queryByTestId('organisation-cards')).toBeNull())
  })
})

describe('the sheet of keys', () => {
  it('opens on ? from a home, where there is no canvas to ask', async () => {
    await home()
    fireEvent.keyDown(window, { key: '?' })
    expect(await screen.findByTestId('shortcuts-sheet')).toBeDefined()
  })
})

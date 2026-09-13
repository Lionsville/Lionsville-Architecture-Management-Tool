// @vitest-environment jsdom
/**
 * The tree beneath the organisation: the shape of the folder, and what can be
 * done to a row.
 *
 * What the picker's tree test pinned still holds and is here — nesting, opening
 * a scope that draws and not one that does not, settings on every scope,
 * refusing to delete the root, creating under the row whose button was pressed,
 * and a reserved name refused where a person can see it. Two things it could
 * not pin are new: **the root is not a row** (it is the screen), and a scope
 * with children folds shut.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { InMemoryScopeStore } from '../../adapters/memory/InMemoryScopeStore'
import { laidOut } from '../../model/testFixtures'
import type { ScopeSnapshot } from '../../projects/scope'
import { renderApp } from '../testing/renderShell'
import { installReactFlowMocks } from '../../editor/reactFlowTestSetup'

afterEach(() => cleanup())

const TODAY = () => '2026-09-12'
const board = () => laidOut({ id: 'l7', kind: 'layer7' as const, name: 'L7', placements: [] })

/** `draws` is the one thing that makes a scope openable (ADR-0012 §1). */
function scope(path: string, name: string, draws = true): ScopeSnapshot {
  return {
    path,
    model: { name, elements: [], relations: [], diagrams: draws ? [board()] : [] },
    activeDiagramId: draws ? 'l7' : '',
    logoLibrary: [],
  }
}

const TREE = () => [
  scope('', 'Acme Logistics', false),
  scope('retail', 'Retail', false),
  scope('retail/warehouse', 'Warehouse'),
  scope('finance', 'Finance'),
]

const show = (scopes = TREE()) => {
  const store = new InMemoryScopeStore(scopes)
  return { store, ...renderApp({ scopes: store, today: TODAY }) }
}

describe('the tree', () => {
  it('nests a scope under its parent, and does not list the root in it', async () => {
    show()
    expect((await screen.findByTestId('scope-retail')).dataset.depth).toBe('0')
    expect(screen.getByTestId('scope-retail/warehouse').dataset.depth).toBe('1')
    // The root is the screen; a row for it would be the organisation inside
    // itself.
    expect(screen.queryByTestId('scope-')).toBeNull()
  })

  it('sums a subtree on a scope that has one, and a leaf on one that has not', async () => {
    show()
    const retail = await screen.findByTestId('scope-retail')
    expect(retail.textContent).toContain('1 landscape')
    expect(retail.textContent).toContain('1 diagram')
    expect(screen.getByTestId('scope-finance').textContent).toContain('1 diagram')
  })

  /** Per session and not a preference: a fold is what you are doing now. */
  it('folds a scope shut and hides everything inside it', async () => {
    show()
    const retail = await screen.findByTestId('scope-retail')
    fireEvent.click(within(retail).getByRole('button', { name: 'Hide what is under Retail' }))
    expect(screen.queryByTestId('scope-retail/warehouse')).toBeNull()
    fireEvent.click(within(screen.getByTestId('scope-retail')).getByRole('button', { name: 'Show what is under Retail' }))
    expect(screen.getByTestId('scope-retail/warehouse')).toBeDefined()
  })

  it('opens a scope that draws, and offers no way in to one that does not', async () => {
    show()
    const retail = await screen.findByTestId('scope-retail')
    expect(within(retail).queryByRole('button', { name: 'Open' })).toBeNull()
    fireEvent.click(within(screen.getByTestId('scope-retail/warehouse')).getByRole('button', { name: 'Open' }))
    // The workspace's own bar, which only exists once a scope is open.
    await waitFor(() => expect(screen.getByTestId('saved-indicator')).toBeDefined())
  })

  it('offers every scope its own settings, the root included', async () => {
    show()
    expect(await screen.findByRole('button', { name: 'Settings for Retail' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Settings for Acme Logistics' })).toBeDefined()
  })

  /** The root is the folder you opened; there is nowhere to remove it from. */
  it('does not offer to delete the root', async () => {
    show()
    expect(await screen.findByRole('button', { name: 'Delete Retail' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Delete Acme Logistics' })).toBeNull()
  })

  it('removes a scope and everything filed under it, once confirmed', async () => {
    const { store } = show()
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Retail' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByTestId('scope-retail')).toBeNull())
    expect(await store.load('retail/warehouse')).toBeUndefined()
  })

  it('creates a scope under the row whose button was pressed', async () => {
    const { store } = show()
    fireEvent.click(await screen.findByRole('button', { name: 'New scope under Retail' }))
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Returns' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(async () => expect(await store.load('retail/returns')).toBeDefined())
  })

  /**
   * A scope made by hand draws by default; unticked, it is a domain on
   * purpose — a folder for other scopes, which until now only came about as
   * a missing ancestor.
   */
  it('makes a domain on purpose when the landscape is unticked', async () => {
    const { store } = show()
    fireEvent.click(await screen.findByRole('button', { name: 'New scope under Retail' }))
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Returns' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Start with a landscape' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(async () => expect(await store.load('retail/returns')).toBeDefined())
    const made = await store.load('retail/returns')
    expect(made?.model.diagrams).toEqual([])
    expect(made?.kind).toBe('domain')
  })

  /** Refused where a person can see it, rather than quietly suffixed. */
  it('will not create a scope named after one of the folders a scope writes into', async () => {
    show()
    // Wait for the tree: before it lands the screen shows its own "New scope…"
    // in place of the heading, and clicking that one clicks a button React is
    // about to replace.
    await screen.findByTestId('scope-retail')
    fireEvent.click(screen.getByRole('button', { name: 'New scope…' }))
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Decisions' } })
    expect(await screen.findByText(/cannot be called that/)).toBeDefined()
    expect(screen.getByRole('button', { name: 'Create' })).toHaveProperty('disabled', true)
  })

  it('renames a scope without moving it', async () => {
    const { store } = show()
    fireEvent.click(await screen.findByRole('button', { name: 'Settings for Retail' }))
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Retail & wholesale' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(async () => expect((await store.load('retail'))?.model.name).toBe('Retail & wholesale'))
    // The address is how everything under it is filed; a rename is a label.
    expect(await store.load('retail/warehouse')).toBeDefined()
  })

  /**
   * A move is save-then-remove, and `remove` takes the subtree with it — so the
   * order is not a detail: removing first and failing to save loses the lot.
   */
  it('moves a scope and its subtree, saving the new addresses before removing the old', async () => {
    const { store } = show()
    const order: string[] = []
    vi.spyOn(store, 'save').mockImplementation(async function (this: InMemoryScopeStore, held) {
      order.push(`save ${held.path}`)
      return InMemoryScopeStore.prototype.save.call(this, held)
    })
    vi.spyOn(store, 'remove').mockImplementation(async function (this: InMemoryScopeStore, path) {
      order.push(`remove ${path}`)
      return InMemoryScopeStore.prototype.remove.call(this, path)
    })

    fireEvent.click(await screen.findByRole('button', { name: 'Settings for Retail' }))
    fireEvent.mouseDown(await screen.findByLabelText('Filed under'))
    fireEvent.click(screen.getByRole('option', { name: 'Finance' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(async () => expect(await store.load('finance/retail')).toBeDefined())
    expect(await store.load('finance/retail/warehouse')).toBeDefined()
    expect(await store.load('retail')).toBeUndefined()
    expect(order).toEqual([
      'save finance/retail', 'save finance/retail/warehouse', 'remove retail',
    ])
  })
})

/**
 * The finding line the tree waited a whole beta for (ADR-0012 §9).
 *
 * What matters here beyond the words: the whole organisation is folded ONCE
 * and every row reads a map, and a conflict is a finding on both scopes,
 * because neither of them is the one that is wrong.
 */
describe('what a row says the tree contradicts', () => {
  function element(id: string, name: string, ref?: string) {
    return {
      id, kind: 'application' as const, name, lifecycle: 'live' as const,
      isManaged: false, aspects: {}, ...(ref !== undefined ? { ref } : {}),
    }
  }

  /**
   * `retail` and `finance` are both one level down, so each defining `erp` is
   * a tie and therefore a conflict — two definitions at DIFFERENT depths are
   * a master and a declaration, and no finding at all. Finance also holds a
   * stand-in of something nobody defines.
   */
  const withFindings = () => {
    const held = TREE()
    const at = (path: string) => held.find((scope) => scope.path === path)!
    at('retail').model.elements = [element('erp', 'ERP')]
    at('finance').model.elements = [
      element('erp', 'Finance ERP'),
      element('crm', 'CRM', 'sales'),
    ]
    return held
  }

  it('counts the findings on the scope each is about', async () => {
    show(withFindings())
    const finance = await screen.findByTestId('findings-finance')
    expect(finance.textContent).toContain('1 conflict')
    expect(finance.textContent).toContain('1 undefined')
  })

  it('puts a conflict on both scopes, since neither is the wrong one', async () => {
    show(withFindings())
    await screen.findByTestId('findings-finance')
    expect(screen.getByTestId('findings-retail').textContent).toContain('1 conflict')
  })

  it('says nothing at all about a scope with nothing wrong', async () => {
    show(withFindings())
    await screen.findByTestId('findings-finance')
    expect(screen.queryByTestId('findings-retail/warehouse')).toBeNull()
  })

  it('says nothing on a tree nobody has found anything in', async () => {
    show()
    await screen.findByTestId('scope-finance')
    expect(screen.queryByTestId('findings-finance')).toBeNull()
  })
})

/**
 * A scope's home, one level down (ADR-0012 §1): every scope is the same
 * document, so every scope has the screen the root has. A domain's shows its
 * own name, the tree filed under it with its children as the first column,
 * and the way back as a crumb — and not the folder, which is the root's.
 */
describe('a domain’s home', () => {
  it('is reached by the row’s name, and shows what is filed under it', async () => {
    show()
    fireEvent.click(await screen.findByTestId('home-retail'))

    expect(screen.getByTestId('organisation-name').textContent).toBe('Retail')
    expect(screen.getByTestId('crumb-').textContent).toBe('Acme Logistics')
    expect(screen.getByTestId('crumb-current').textContent).toBe('Retail')
    // Its child is the first column now, and its neighbour is not on it.
    expect(screen.getByTestId('scope-retail/warehouse').dataset.depth).toBe('0')
    expect(screen.queryByTestId('scope-finance')).toBeNull()
    expect(screen.queryByTestId('scope-retail')).toBeNull()
    // The folder is the root's fact, not the domain's.
    expect(screen.queryByTestId('working-source')).toBeNull()
  })

  it('files a new scope under the domain, and settings are the domain’s', async () => {
    const { store } = show()
    fireEvent.click(await screen.findByTestId('home-retail'))
    expect(screen.getByRole('button', { name: 'Settings for Retail' })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'New scope…' }))
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Returns' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(async () => expect(await store.load('retail/returns')).toBeDefined())
  })

  it('goes back to the organisation by its crumb', async () => {
    show()
    fireEvent.click(await screen.findByTestId('home-retail'))
    fireEvent.click(screen.getByTestId('crumb-'))
    expect(screen.getByTestId('organisation-name').textContent).toBe('Acme Logistics')
    expect(screen.getByTestId('scope-finance')).toBeDefined()
  })

  /**
   * Flipped when a scope's first board became something its home offers: a
   * domain shows the section empty, with the way to a landscape in it, rather
   * than no section at all.
   */
  it('offers the canvas on a scope that draws, and an empty landscapes section on one that does not', async () => {
    show()
    fireEvent.click(await screen.findByTestId('home-retail'))
    await waitFor(() => expect(screen.getByTestId('open-decisions')).toBeDefined())
    const boards = await screen.findByTestId('boards')
    expect(within(boards).getByTestId('boards-empty')).toBeDefined()
    expect(within(boards).queryByTestId('board-l7')).toBeNull()
    expect(within(boards).getByTestId('new-board')).toBeDefined()
    fireEvent.click(screen.getByTestId('home-retail/warehouse'))
    expect(screen.getByTestId('organisation-name').textContent).toBe('Warehouse')
    const row = await screen.findByTestId('board-l7')
    fireEvent.click(within(row).getByRole('button', { name: 'Open' }))
    await waitFor(() => expect(screen.getByTestId('saved-indicator')).toBeDefined())
  })
})

/**
 * The bar over an open scope names every level above it, and each is a way
 * out — to that level's home, which is where "back" should land: a person who
 * opened a landscape from a domain's page goes back to the domain, not past
 * it to the organisation.
 */
describe('the crumbs over an open scope', () => {
  it('name the organisation, the domain and the landscape, in that order', async () => {
    show()
    fireEvent.click(within(await screen.findByTestId('scope-retail/warehouse')).getByRole('button', { name: 'Open' }))
    await waitFor(() => expect(screen.getByTestId('saved-indicator')).toBeDefined())
    const bar = screen.getByTestId('shell-toolbar').textContent ?? ''
    expect(bar.indexOf('Acme Logistics')).toBeLessThan(bar.indexOf('Retail'))
    expect(bar.indexOf('Retail')).toBeLessThan(bar.indexOf('Warehouse'))
    expect(screen.getByTestId('crumb-current').textContent).toBe('Warehouse')
  })

  it('land on the home of the crumb pressed', async () => {
    show()
    fireEvent.click(within(await screen.findByTestId('scope-retail/warehouse')).getByRole('button', { name: 'Open' }))
    await waitFor(() => expect(screen.getByTestId('saved-indicator')).toBeDefined())
    fireEvent.click(screen.getByTestId('crumb-retail'))
    expect((await screen.findByTestId('organisation-name')).textContent).toBe('Retail')
    expect(screen.getByTestId('scope-retail/warehouse')).toBeDefined()
  })
})

/**
 * Which cards a home has is the scope's shape, never its label: the business
 * layer is the root's (§4), a scope that draws has its views and its pages,
 * and the register is over what is beneath a scope — so it is on the root's
 * and a domain's home and not on a landscape's.
 */
describe('the cards, per level', () => {
  it('give the root the business layer and the register', async () => {
    show()
    const cards = await screen.findByTestId('organisation-cards')
    await waitFor(() => expect(within(cards).getByTestId('open-decisions')).toBeDefined())
    expect(within(cards).getByTestId('open-business')).toBeDefined()
    expect(within(cards).getByTestId('open-register')).toBeDefined()
    expect(within(cards).queryByTestId('open-views')).toBeNull()
    expect(within(cards).queryByTestId('open-documentation')).toBeNull()
  })

  it('give a domain its decisions, its plans and the register beneath it, and not the business layer', async () => {
    show()
    fireEvent.click(await screen.findByTestId('home-retail'))
    const cards = await screen.findByTestId('organisation-cards')
    expect(within(cards).queryByTestId('open-business')).toBeNull()
    expect(within(cards).queryByTestId('open-views')).toBeNull()
    expect(within(cards).getByTestId('open-decisions')).toBeDefined()
    expect(within(cards).getByTestId('open-roadmap')).toBeDefined()
    expect(within(cards).getByTestId('open-register')).toBeDefined()
  })

  /** A domain that draws a board of its own is both, and loses neither card. */
  it('keep the register on a domain that draws a board of its own', async () => {
    show([
      scope('', 'Acme Logistics', false),
      scope('retail', 'Retail'),
      scope('retail/warehouse', 'Warehouse'),
    ])
    fireEvent.click(await screen.findByTestId('home-retail'))
    const cards = await screen.findByTestId('organisation-cards')
    await waitFor(() => expect(within(cards).getByTestId('open-documentation')).toBeDefined())
    expect(within(cards).getByTestId('open-register')).toBeDefined()
    expect(within(cards).queryByTestId('open-business')).toBeNull()
  })

  it('give a landscape its documentation, its decisions and its plans', async () => {
    show()
    fireEvent.click(await screen.findByTestId('home-retail/warehouse'))
    const cards = await screen.findByTestId('organisation-cards')
    await waitFor(() => expect(within(cards).getByTestId('open-documentation')).toBeDefined())
    expect(within(cards).queryByTestId('open-business')).toBeNull()
    expect(within(cards).queryByTestId('open-register')).toBeNull()
    expect(within(cards).getByTestId('open-decisions')).toBeDefined()
    expect(within(cards).getByTestId('open-roadmap')).toBeDefined()
  })
})

/**
 * A landscape's boards are a table on its home, one row each with its own
 * way in — a future version of the landscape (a board with `asOf`, ADR-0009)
 * is a row beside the current one rather than a tab behind it, and opening a
 * row lands on that board.
 */
describe('the boards on a landscape’s home', () => {
  const twoBoards = (): ScopeSnapshot => ({
    path: 'finance',
    model: {
      name: 'Finance', elements: [], relations: [],
      diagrams: [
        laidOut({ id: 'now', kind: 'layer7' as const, name: 'Finance today', placements: [] }),
        laidOut({ id: 'next', kind: 'layer7' as const, name: 'Finance 2028', asOf: '2028-01-01', placements: [] }),
        laidOut({ id: 'sheet', kind: 'sheet' as const, name: 'Business', placements: [] }),
        laidOut({ id: 'cd', kind: 'container' as const, name: 'Ledger', applicationElementId: 'ledger', placements: [] }),
      ],
    },
    activeDiagramId: 'now',
    logoLibrary: [],
  })

  it('offers Delete on a container diagram only, and takes it off the scope once confirmed', async () => {
    show([scope('', 'Acme Logistics', false), twoBoards()])
    fireEvent.click(await screen.findByTestId('home-finance'))
    const boards = await screen.findByTestId('boards')
    expect(within(within(boards).getByTestId('board-now')).queryByRole('button', { name: 'Delete' })).toBeNull()
    fireEvent.click(within(within(boards).getByTestId('board-cd')).getByRole('button', { name: 'Delete' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(within(screen.getByTestId('boards')).queryByTestId('board-cd')).toBeNull())
    expect(within(screen.getByTestId('boards')).getByTestId('board-now')).toBeDefined()
  })

  it('lists every board with the day it shows, and no laid-out view', async () => {
    show([scope('', 'Acme Logistics', false), twoBoards()])
    fireEvent.click(await screen.findByTestId('home-finance'))
    const boards = await screen.findByTestId('boards')
    expect(within(boards).getByTestId('board-now').textContent).toContain('Today')
    expect(within(boards).getByTestId('board-next').textContent).toContain('2028')
    expect(within(boards).queryByTestId('board-sheet')).toBeNull()
  })

  it('opens the row’s own board, not the one that was active', async () => {
    // The canvas mounts for this one, and jsdom has no layout for it.
    installReactFlowMocks()
    show([scope('', 'Acme Logistics', false), twoBoards()])
    fireEvent.click(await screen.findByTestId('home-finance'))
    const row = await screen.findByTestId('board-next')
    fireEvent.click(within(row).getByRole('button', { name: 'Open' }))
    await waitFor(() => expect(screen.getByTestId('saved-indicator')).toBeDefined())
    expect(screen.getByRole('tab', { name: /Finance 2028/ }).getAttribute('aria-selected')).toBe('true')
    // Opened on it, not switched to it: nothing to undo and nothing unsaved.
    expect(screen.getByTestId('saved-indicator').textContent).not.toContain('Unsaved')
  })
})

/**
 * A landscape is a scope that draws, and nothing says which scopes may (§1):
 * the organisation, a domain and a team can each hold boards of their own.
 * The canvas's own "new diagram" is behind a canvas a scope with no board is
 * never given, so the way to a scope's first board is its home.
 */
describe('a scope’s first landscape', () => {
  // Every one of these lands on the canvas, and jsdom has no layout for it.
  beforeEach(() => installReactFlowMocks())

  const makeOne = async (name?: string) => {
    fireEvent.click(await screen.findByTestId('new-board'))
    const field = await screen.findByLabelText('Name')
    expect((field as HTMLInputElement).value).toBe('New landscape')
    if (name) fireEvent.change(field, { target: { value: name } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
  }

  it('is made from a domain’s home, and opened on it', async () => {
    const { store } = show()
    fireEvent.click(await screen.findByTestId('home-retail'))
    await makeOne('Retail today')
    await waitFor(() => expect(screen.getByTestId('saved-indicator')).toBeDefined())
    const retail = await store.load('retail')
    expect(retail?.model.diagrams.map((d) => [d.id, d.kind, d.name])).toEqual([['new-landscape', 'layer7', 'Retail today']])
    expect(retail?.activeDiagramId).toBe('new-landscape')
  })

  it('is made from the organisation’s own home just the same', async () => {
    const { store } = show()
    await screen.findByTestId('scope-retail')
    await makeOne()
    await waitFor(() => expect(screen.getByTestId('saved-indicator')).toBeDefined())
    expect((await store.load(''))?.model.diagrams).toHaveLength(1)
  })

  it('takes a key beside the boards the scope already has', async () => {
    const { store } = show()
    fireEvent.click(await screen.findByTestId('home-finance'))
    await makeOne()
    await waitFor(async () => expect((await store.load('finance'))?.model.diagrams).toHaveLength(2))
    expect((await store.load('finance'))?.model.diagrams.map((d) => d.id)).toEqual(['l7', 'new-landscape'])
  })
})

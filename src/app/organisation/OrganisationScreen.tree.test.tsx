// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The tree beneath the organisation: the shape of the folder, and what can be
 * done to a row.
 *
 * What the picker's tree test pinned still holds and is here — nesting, opening
 * a scope onto its home, settings on every scope,
 * refusing to delete the root, creating under the scope whose home it is,
 * and a reserved name refused where a person can see it. Two things it could
 * not pin are new: **the root is not a row** (it is the screen), and a scope
 * with children folds shut.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { checkOnPage, pressFound } from '../testing/findings'
import { heldRepositories } from '../testing/heldRepositories'
import { laidOut } from '../../model/testFixtures'
import type { ScopeSnapshot } from '../../projects/scope'
import { renderApp } from '../testing/renderShell'
import { installReactFlowMocks } from '../../editor/reactFlowTestSetup'
import { pressRowMenu } from '../testing/rowMenu'
import { chooseValue } from '../../widgets/kit/testing/select'

afterEach(() => cleanup())
// A home's *Open* mounts the canvas, which asks jsdom for the pieces it has
// not got. Installed once for the file: a test that mounts it before the
// shims are there throws inside React Flow, and the error boundary's
// recreate is a stack trace on stderr and a second mount nobody asked for.
beforeAll(() => installReactFlowMocks())

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
  const store = heldRepositories(scopes)
  return { store, ...renderApp({ repositories: store, today: TODAY }) }
}

/** The tree starts folded: open the scope at `path` to see what is under it. */
const unfold = async (path: string) => fireEvent.click(await screen.findByTestId(`fold-${path}`))

describe('the tree', () => {
  it('nests a scope under its parent, and does not list the root in it', async () => {
    show()
    expect((await screen.findByTestId('scope-retail')).dataset.depth).toBe('1')
    await unfold('retail')
    expect(screen.getByTestId('scope-retail/warehouse').dataset.depth).toBe('2')
    // The root has a row of its own over them, and none among them.
    expect(screen.getByTestId('scope-root').textContent).toContain('Acme Logistics')
    expect(screen.queryByTestId('scope-')).toBeNull()
  })

  it('sums a subtree on a scope that has one, and a leaf on one that has not', async () => {
    show()
    const retail = await screen.findByTestId('scope-retail')
    // One number on the row; the words on hover and on the scope's home.
    expect(retail.getAttribute('title')).toContain('1 view')
    expect(within(retail).getByTestId('scope-holds').textContent).toBe('1')
    expect(screen.getByTestId('scope-finance').getAttribute('title')).toContain('1 view')
  })

  /**
   * Folded until opened, so a home lists its first column; per session and
   * not a preference: a fold is what you are doing now.
   */
  it('starts with every scope folded, and opens and shuts one', async () => {
    show()
    const retail = await screen.findByTestId('scope-retail')
    expect(screen.queryByTestId('scope-retail/warehouse')).toBeNull()
    fireEvent.click(within(retail).getByRole('button', { name: 'Show what is under Retail' }))
    expect(screen.getByTestId('scope-retail/warehouse')).toBeDefined()
    fireEvent.click(within(screen.getByTestId('scope-retail')).getByRole('button', { name: 'Hide what is under Retail' }))
    expect(screen.queryByTestId('scope-retail/warehouse')).toBeNull()
  })

  /** One press for the whole tree, offered only where there is something below to fold. */
  it('unfolds all of the tree and folds it again', async () => {
    show([...TREE(), scope('retail/warehouse/dock', 'Dock')])
    await screen.findByTestId('scope-retail')
    fireEvent.click(screen.getByRole('button', { name: 'Tree options' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Unfold all' }))
    expect(screen.getByTestId('scope-retail/warehouse/dock').dataset.depth).toBe('3')
    fireEvent.click(screen.getByRole('button', { name: 'Tree options' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Fold all' }))
    expect(screen.queryByTestId('scope-retail/warehouse')).toBeNull()
  })

  it('offers no Unfold all on a tree with nothing to fold', async () => {
    show([scope('', 'Acme Logistics', false), scope('finance', 'Finance')])
    await screen.findByTestId('scope-finance')
    expect(screen.queryByTestId('tree-fold-all')).toBeNull()
  })

  /**
   * Opening a scope is arriving at its home — its pages, its boards, what is
   * filed under it — and never onto whichever board it had open last. Every
   * row offers it, a scope that draws nothing as much as one that does.
   */
  it('opens a scope on its home, and not on one of its boards', async () => {
    show()
    await unfold('retail')
    fireEvent.click(screen.getByTestId('open-retail/warehouse'))
    expect((await screen.findByTestId('organisation-name')).textContent).toBe('Warehouse')
    expect(screen.getByTestId('crumb-current').textContent).toBe('Warehouse')
    // Nothing open, so nothing waits: the word says so on a home too.
    expect(screen.getByTestId('saved-indicator').textContent).toBe('✓In this browser')
    // A board is opened from the home's list of boards, by its name.
    fireEvent.click(await screen.findByTestId('board-l7'))
    await waitFor(() => expect(screen.getByTestId('saved-indicator')).toBeDefined())
    fireEvent.click(screen.getByTestId('crumb-'))
    fireEvent.click(await screen.findByTestId('open-retail'))
    expect((await screen.findByTestId('organisation-name')).textContent).toBe('Retail')
  })

  /** The whole row is the way home, and there is no second *Open* beside the name. */
  it('opens a scope from anywhere on its row, and offers no separate Open', async () => {
    show()
    const finance = await screen.findByTestId('scope-finance')
    expect(within(finance).queryByRole('button', { name: 'Open Finance' })).toBeNull()
    fireEvent.click(within(finance).getByTestId('scope-holds'))
    expect((await screen.findByTestId('organisation-name')).textContent).toBe('Finance')
  })

  it('keeps a row’s settings to itself: pressing them does not open the scope', async () => {
    show()
    await pressRowMenu('Retail', 'Settings…')
    expect(await screen.findByTestId('scope-settings-page')).toBeDefined()
    expect(screen.getByTestId('organisation-name').textContent).toBe('Retail')
  })

  it('offers every scope its own settings, the root included', async () => {
    show()
    expect(await screen.findByRole('button', { name: 'More for Retail' })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'More for Acme Logistics' }))
    expect(await screen.findByRole('menuitem', { name: 'Settings…' })).toBeDefined()
  })

  /** The root is the folder you opened; there is nowhere to remove it from. */
  it('does not offer to delete the root', async () => {
    show()
    fireEvent.click(await screen.findByRole('button', { name: 'More for Acme Logistics' }))
    await screen.findByRole('menuitem', { name: 'Settings…' })
    expect(screen.queryByRole('menuitem', { name: 'Delete view…' })).toBeNull()
  })

  it('removes a scope and everything filed under it, once confirmed', async () => {
    const { store } = show()
    await pressRowMenu('Retail', 'Delete…')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByTestId('scope-retail')).toBeNull())
    expect(await store.read('retail/warehouse')).toBeUndefined()
  })

  /**
   * A new scope is made on the home of the scope it is filed under, once, at
   * the head of the tree — not on every row of its parent's tree.
   */
  it('creates a scope under the scope whose home it was made on', async () => {
    const { store } = show()
    await screen.findByTestId('scope-retail')
    expect(within(screen.getByTestId('scope-retail')).queryByTestId('new-scope')).toBeNull()
    expect(screen.getAllByTestId('new-scope')).toHaveLength(1)
    fireEvent.click(screen.getByTestId('home-retail'))
    expect((await screen.findByTestId('organisation-name')).textContent).toBe('Retail')
    fireEvent.click(screen.getByTestId('new-scope'))
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Returns' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(async () => expect(await store.read('retail/returns')).toBeDefined())
  })

  /** The organisation's home is the root's, so what it makes is filed at the top. */
  it('creates a top-level scope from the organisation’s home', async () => {
    const { store } = show()
    await screen.findByTestId('scope-retail')
    fireEvent.click(screen.getByTestId('new-scope'))
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Returns' } })
    // An organisation with no units has no unit to say serves it.
    expect(screen.queryByTestId('new-scope-served-by')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(async () => expect(await store.read('returns')).toBeDefined())
  })

  /** A scope that draws may still hold scopes of its own, so its home offers the way too. */
  it('offers the way to a new scope on a landscape’s home as well', async () => {
    show()
    fireEvent.click(await screen.findByTestId('home-finance'))
    expect((await screen.findByTestId('organisation-name')).textContent).toBe('Finance')
    expect(await screen.findByTestId('new-scope')).toBeDefined()
  })

  /**
   * A scope is made bare unless a view is asked for, and stays on its own home:
   * the default that made an empty board and landed on it is where most empty
   * boards came from.
   */
  it('makes no board unless asked, and stays on the new scope\'s home', async () => {
    const { store } = show()
    fireEvent.click(await screen.findByTestId('home-retail'))
    await waitFor(() => expect(screen.getByTestId('organisation-name').textContent).toBe('Retail'))
    fireEvent.click(await screen.findByTestId('new-scope'))
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Returns' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(async () => expect(await store.read('retail/returns')).toBeDefined())
    const made = await store.read('retail/returns')
    expect(made?.model.diagrams).toEqual([])
    expect(made?.kind).toBe('domain')
    // And it is entered on its home, empty until a board is made: there is no
    // board to open it on, and the canvas would say so as an error.
    await waitFor(() => expect(screen.getByTestId('organisation-name').textContent).toBe('Returns'))
    expect(screen.getByTestId('saved-indicator').textContent).toBe('✓In this browser')
    expect(screen.queryByText(/Diagram not found|no view here to show/)).toBeNull()
  })

  /** Refused where a person can see it, rather than quietly suffixed. */
  it('will not create a scope named after one of the folders a scope writes into', async () => {
    show()
    // Wait for the tree: before it lands the heading's button is the one for
    // an empty tree, and clicking that one clicks a button React is about to
    // replace.
    await screen.findByTestId('scope-retail')
    fireEvent.click(screen.getByTestId('new-scope'))
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Decisions' } })
    expect(await screen.findByText(/cannot be called that/)).toBeDefined()
    expect(screen.getByRole('button', { name: 'Create' }).getAttribute('data-refused')).toBe('true')
  })

  it('makes a board where asked, and says what the scope is, still staying on its home', async () => {
    const { store } = show()
    await screen.findByTestId('scope-retail')
    fireEvent.click(screen.getAllByTestId('new-scope')[0] as HTMLElement)
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Returns' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Start it with a landscape view' }))
    chooseValue(within(screen.getByRole('dialog')).getByLabelText(/What this is/), 'kind:team')
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(async () => expect((await store.read('returns'))?.kind).toBe('team'))
    expect((await store.read('returns'))?.model.diagrams).toHaveLength(1)
    await waitFor(() => expect(screen.getByTestId('organisation-name').textContent).toBe('Returns'))
    expect((await screen.findByTestId('boards')).textContent).toContain('New landscape')
  })

  it('opens the settings page, where Filed under is, from Move to', async () => {
    show()
    await pressRowMenu('Retail', 'Move to…')
    expect(await screen.findByTestId('scope-settings-page')).toBeDefined()
    expect(await screen.findByLabelText('Filed under')).toBeDefined()
  })

  it('narrows to scopes with work, keeping the path down, and finds flat with the path', async () => {
    show([...TREE(), scope('retail/empty', 'Empty one', false), scope('quiet', 'Quiet', false)])
    await screen.findByTestId('scope-quiet')
    expect(screen.getByTestId('scope-quiet').getAttribute('data-quiet')).toBe('true')
    fireEvent.click(screen.getByRole('tab', { name: /With work/ }))
    expect(screen.queryByTestId('scope-quiet')).toBeNull()
    expect(screen.getByTestId('scope-retail/warehouse')).toBeDefined()
    expect(screen.queryByTestId('scope-retail/empty')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: /^All/ }))
    fireEvent.change(screen.getByTestId('tree-find'), { target: { value: 'ware' } })
    expect(screen.getByTestId('home-retail/warehouse').textContent).toBe('Retail / Warehouse')
    expect(screen.queryByTestId('scope-finance')).toBeNull()
    fireEvent.keyDown(screen.getByTestId('tree-find'), { key: 'Enter' })
    await waitFor(() => expect(screen.getByTestId('organisation-name').textContent).toBe('Warehouse'))
  })

  it('leads the organisation\'s home with where this person worked last', async () => {
    show()
    fireEvent.click(await screen.findByTestId('home-finance'))
    fireEvent.click(await screen.findByTestId('board-l7'))
    await screen.findByRole('tab', { name: /L7/, selected: true })
    fireEvent.click(screen.getByTestId('crumb-'))
    const continuing = await screen.findByTestId('continue')
    expect(continuing.textContent).toContain('L7')
    expect(continuing.textContent).toContain('Finance')
    fireEvent.click(within(continuing).getByRole('row'))
    await waitFor(() => expect(screen.getByTestId('crumb-current').textContent).toBe('Finance'))
  })

  it('renames a scope without moving it', async () => {
    const { store } = show()
    await pressRowMenu('Retail', 'Settings…')
    const name = await screen.findByTestId('settings-name')
    fireEvent.change(name, { target: { value: 'Retail & wholesale' } })
    fireEvent.blur(name)
    await waitFor(async () => expect((await store.read('retail'))?.model.name).toBe('Retail & wholesale'))
    // The address is how everything under it is filed; a rename is a label.
    expect(await store.read('retail/warehouse')).toBeDefined()
  })

  /**
   * A move is save-then-remove, and `remove` takes the subtree with it — so the
   * order is not a detail: removing first and failing to save loses the lot.
   */
  it('moves a scope and its subtree, each keeping what it is', async () => {
    const { store } = show()
    const before = [(await store.read('retail'))?.id, (await store.read('retail/warehouse'))?.id]

    await pressRowMenu('Retail', 'Settings…')
    chooseValue(await screen.findByLabelText('Filed under'), 'finance')
    fireEvent.click(await screen.findByTestId('settings-move'))

    await waitFor(async () => expect(await store.read('finance/retail')).toBeDefined())
    expect([(await store.read('finance/retail'))?.id, (await store.read('finance/retail/warehouse'))?.id]).toEqual(before)
    expect(await store.read('retail')).toBeUndefined()
  })
})

/**
 * What the tree contradicts about itself (ADR-0012 §9), said under the cards.
 *
 * The rows used to count these in the warning colour — "1 conflict · 1
 * undefined" — which told a newcomer something was wrong and nothing about
 * what, and could not be pressed. Each is a sentence now, on the Checks page
 * under its check, and a way to the scope and the record it is about; the home
 * counts them by weight (3.6.1). The whole organisation is still folded ONCE;
 * and a conflict is still a finding on both scopes, because neither of them
 * is the one that is wrong.
 */
describe('what the organisation says needs attention', () => {
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

  it('counts the findings by weight under the cards, and no row counts them', async () => {
    show(withFindings())
    const attention = await screen.findByTestId('needs-attention')
    // Two definitions of one id, each a fix of its scope, and a stand-in of nothing.
    expect(attention.textContent).toContain('3 to fix')
    expect(screen.queryByTestId('findings-finance')).toBeNull()
  })

  it('says each finding on the Checks page as a sentence naming the record', async () => {
    show(withFindings())
    const conflicts = await checkOnPage('fix', 'check.conflict')
    expect(pressFound(conflicts, 'attention-finance-erp').textContent).toContain('Finance ERP is defined both here and in Retail — keep one definition')
    fireEvent.click(screen.getByTestId('checks-row-check.dangling'))
    expect(pressFound(screen.getByTestId('checks-detail'), 'attention-finance-crm').textContent).toContain('CRM stands in for something nothing in the organisation defines')
  })

  it('puts a conflict on both scopes, since neither is the wrong one', async () => {
    show(withFindings())
    const conflicts = await checkOnPage('fix', 'check.conflict')
    expect(pressFound(conflicts, 'attention-retail-erp').textContent).toContain('ERP is defined both here and in Finance')
    expect(within(conflicts).getByTestId('attention-finance-erp')).toBeDefined()
  })

  it('opens the scope the finding is about, with the record selected', async () => {
    show(withFindings())
    const dangling = await checkOnPage('fix', 'check.dangling')
    fireEvent.click(within(pressFound(dangling, 'attention-finance-crm')).getByRole('button', { name: /Open/ }))
    await waitFor(() => expect(screen.getByTestId('crumb-current').textContent).toBe('Finance'))
  })

  it('says nothing about a scope with nothing wrong', async () => {
    show(withFindings())
    const conflicts = await checkOnPage('fix', 'check.conflict')
    expect(conflicts.textContent).not.toContain('Warehouse')
  })

  // Until 3.6.1 the block showed six sentences and a Show all, and then one folded row per check; it counts them now.
  it('counts eight findings of one check under the cards, and lists all eight on the Checks page', async () => {
    const held = TREE()
    const at = (path: string) => held.find((scope) => scope.path === path)!
    // Eight stand-ins of things nobody defines: eight findings on one scope.
    at('finance').model.elements = Array.from({ length: 8 }, (_, n) => element(`ghost-${n}`, `Ghost ${n}`, 'nowhere'))
    show(held)
    const attention = await screen.findByTestId('needs-attention')
    expect(attention.textContent).toContain('8 to fix')
    const dangling = await checkOnPage('fix', 'check.dangling')
    expect(screen.getByTestId('checks-row-check.dangling').textContent).toMatch(/A stand-in of something nothing defines\s*8$/)
    expect(within(dangling).getAllByTestId(/^attention-finance-/)).toHaveLength(8)
  })

  it('shows no block at all on a tree nobody has found anything in', async () => {
    show()
    await screen.findByTestId('scope-finance')
    expect(screen.queryByTestId('needs-attention')).toBeNull()
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
    // One tree on every home: this scope marked, and what is under it open.
    expect(screen.getByTestId('scope-retail').getAttribute('aria-current')).toBe('page')
    expect(screen.getByTestId('scope-retail/warehouse').dataset.depth).toBe('2')
    expect(screen.getByTestId('scope-finance')).toBeDefined()
    // The folder is the root's fact, not the domain's.
    expect(screen.queryByTestId('working-source')).toBeNull()
  })

  it('files a new scope under the domain, and settings are the domain’s', async () => {
    const { store } = show()
    fireEvent.click(await screen.findByTestId('home-retail'))
    expect(await screen.findByTestId('scope-settings')).toBeDefined()
    fireEvent.click(await screen.findByTestId('new-scope'))
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Returns' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    await waitFor(async () => expect(await store.read('retail/returns')).toBeDefined())
  })

  it('goes back to the organisation by its crumb', async () => {
    show()
    fireEvent.click(await screen.findByTestId('home-retail'))
    fireEvent.click(screen.getByTestId('crumb-'))
    expect(screen.getByTestId('organisation-name').textContent).toBe('Acme Logistics')
    expect(screen.getByTestId('scope-finance')).toBeDefined()
  })

  /**
   * A scope with no view has none of the section: its first steps say how to
   * make one. A view's whole row opens it.
   */
  it('offers the canvas on a scope that draws, and first steps on one that does not', async () => {
    show()
    fireEvent.click(await screen.findByTestId('home-retail'))
    await waitFor(() => expect(screen.getByTestId('open-decisions')).toBeDefined())
    expect(screen.queryByTestId('boards')).toBeNull()
    expect(screen.getByTestId('new-board')).toBeDefined()
    fireEvent.click(screen.getByTestId('home-retail/warehouse'))
    expect(screen.getByTestId('organisation-name').textContent).toBe('Warehouse')
    fireEvent.click(await screen.findByTestId('board-l7'))
    await waitFor(() => expect(screen.getByTestId('saved-indicator')).toBeDefined())
  })

  /**
   * A technology landscape is laid out and never the active board
   * (ADR-0015), so a scope that draws lists it among its boards with the
   * kind said and no count, and its row opens the page rather than the
   * canvas.
   */
  it('lists a technology landscape among the boards, and its row opens the page', async () => {
    const platforms = scope('platforms', 'Platforms')
    platforms.model.diagrams.push({ id: 'tl', kind: 'technology', name: 'Technology landscape', members: [], geometry: { nodes: [] } })
    show([...TREE(), platforms])
    fireEvent.click(await screen.findByTestId('home-platforms'))
    const row = await screen.findByTestId('open-technology-landscape')
    expect(row.textContent).toContain('Laid out from the rows')
    expect(row.textContent).not.toContain('on it')
    fireEvent.click(row)
    await waitFor(() => expect(screen.getByText('What stands on what')).toBeDefined())
    expect(screen.getByTestId('landscape-summary').textContent).toBe('0 applications · 0 services · 0 platforms · read from the records')
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
    await unfold('retail')
    fireEvent.click(await screen.findByTestId('open-retail/warehouse'))
    fireEvent.click(await screen.findByTestId('board-l7'))
    await waitFor(() => expect(screen.getByTestId('saved-indicator')).toBeDefined())
    const bar = screen.getByTestId('shell-toolbar').textContent ?? ''
    expect(bar.indexOf('Acme Logistics')).toBeLessThan(bar.indexOf('Retail'))
    expect(bar.indexOf('Retail')).toBeLessThan(bar.indexOf('Warehouse'))
    expect(screen.getByTestId('crumb-current').textContent).toBe('Warehouse')
  })

  it('land on the home of the crumb pressed', async () => {
    show()
    await unfold('retail')
    fireEvent.click(await screen.findByTestId('open-retail/warehouse'))
    fireEvent.click(await screen.findByTestId('board-l7'))
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
    expect(screen.getByTestId('tree-place-register')).toBeDefined()
    expect(within(cards).queryByTestId('open-views')).toBeNull()
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
    await unfold('retail')
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

  it('offers Delete under every view\'s menu, and takes it off the scope once confirmed', async () => {
    show([scope('', 'Acme Logistics', false), twoBoards()])
    fireEvent.click(await screen.findByTestId('home-finance'))
    const boards = await screen.findByTestId('boards')
    fireEvent.click(within(within(boards).getByTestId('board-now')).getByRole('button', { name: 'More for Finance today' }))
    expect(await screen.findByRole('menuitem', { name: 'Delete view…' })).toBeDefined()
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    fireEvent.click(within(within(boards).getByTestId('board-cd')).getByRole('button', { name: 'More for Ledger' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Delete view…' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(within(screen.getByTestId('boards')).queryByTestId('board-cd')).toBeNull())
    expect(within(screen.getByTestId('boards')).getByTestId('board-now')).toBeDefined()
  })

  it('says Empty of a view with nothing on it, whatever kind it is', async () => {
    show([scope('', 'Acme Logistics', false), twoBoards()])
    fireEvent.click(await screen.findByTestId('home-finance'))
    const boards = await screen.findByTestId('boards')
    expect(within(boards).getByTestId('board-now').textContent).toContain('Empty')
    expect(within(boards).getByTestId('board-next').textContent).toContain('Empty')
    expect(within(boards).getByTestId('open-business').textContent).toContain('Empty')
  })

  it('opens a view from its row', async () => {
    show([scope('', 'Acme Logistics', false), twoBoards()])
    fireEvent.click(await screen.findByTestId('home-finance'))
    fireEvent.click(await screen.findByTestId('board-next'))
    await waitFor(() => expect(screen.getByTestId('saved-indicator')).toBeDefined())
  })

  it('opens the row’s own board, not the one that was active', async () => {
    show([scope('', 'Acme Logistics', false), twoBoards()])
    fireEvent.click(await screen.findByTestId('home-finance'))
    fireEvent.click(await screen.findByTestId('board-next'))
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

  const makeOne = async (name?: string) => {
    // New view… offers the kinds the editor's + tab does; a landscape is the
    // first, and the only one that asks for a name here.
    fireEvent.click(await screen.findByTestId('new-board'))
    fireEvent.click(await screen.findByTestId('new-board-landscape'))
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
    const retail = await store.read('retail')
    expect(retail?.model.diagrams.map((d) => [d.id, d.kind, d.name])).toEqual([['new-landscape', 'layer7', 'Retail today']])
    expect(retail?.activeDiagramId).toBe('new-landscape')
  })

  it('is made from the organisation’s own home just the same', async () => {
    const { store } = show()
    await screen.findByTestId('scope-retail')
    await makeOne()
    await waitFor(() => expect(screen.getByTestId('saved-indicator')).toBeDefined())
    expect((await store.read(''))?.model.diagrams).toHaveLength(1)
  })

  it('takes a key beside the boards the scope already has', async () => {
    const { store } = show()
    fireEvent.click(await screen.findByTestId('home-finance'))
    await makeOne()
    await waitFor(async () => expect((await store.read('finance'))?.model.diagrams).toHaveLength(2))
    expect((await store.read('finance'))?.model.diagrams.map((d) => d.id)).toEqual(['l7', 'new-landscape'])
  })
})

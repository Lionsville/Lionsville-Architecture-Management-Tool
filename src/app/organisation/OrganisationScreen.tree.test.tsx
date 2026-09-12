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
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { InMemoryScopeStore } from '../../adapters/memory/InMemoryScopeStore'
import { laidOut } from '../../model/testFixtures'
import type { ScopeSnapshot } from '../../projects/scope'
import { renderApp } from '../testing/renderShell'

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

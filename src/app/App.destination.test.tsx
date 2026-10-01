// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A destination a provider opens, through the whole shell (ADR-0019, amended):
 * a move it says is its own is said to be the provider's and never the
 * person's; an open of a view never makes one; the observations page opens on
 * the tab asked for and the screen says which tab is up; an element asked for
 * is selected on the view it opens, where that view draws it; and what is
 * opened is what is seen, with the documentation page over the board closed.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { laidOut } from '../model/testFixtures'
import type { DesignElement, DesignDiagram } from '../model'
import type { Destination, MovedBy, Screen } from '../agent/screen'
import type { SourceOpenOptions } from '../ports/ProviderParts'
import type { ScopeSnapshot } from '../projects/scope'
import { heldRepositories } from './testing/heldRepositories'
import { renderApp } from './testing/renderShell'
import { installReactFlowMocks } from '../editor/reactFlowTestSetup'

afterEach(() => cleanup())
beforeAll(() => installReactFlowMocks())

const fn = (id: string, name: string, parentId?: string): DesignElement => ({
  id, kind: 'function', name, lifecycle: 'live', isManaged: false, aspects: {}, ...(parentId ? { parentId } : {}),
})
const app = (id: string, name: string): DesignElement => ({ id, kind: 'application', name, lifecycle: 'live', isManaged: true, aspects: {} })
const sheet = (id: string): DesignDiagram => ({ id, kind: 'sheet', name: 'Capabilities', members: [], geometry: { nodes: [] } })

const board = laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [{ id: 'billing', x: 0, y: 0 }] })
const scope = (path: string, name: string, over: Partial<ScopeSnapshot['model']> = {}, activeDiagramId = ''): ScopeSnapshot => ({
  path, model: { name, elements: [], relations: [], diagrams: [], ...over }, activeDiagramId, logoLibrary: [],
})
const tree = () => [
  scope('', 'Acme'),
  scope('acme', 'Domain'),
  scope('acme/landscape', 'Landscape', {
    elements: [app('billing', 'Billing'), fn('ops', 'Operations'), fn('invoicing', 'Invoicing', 'ops'), fn('loose', 'Loose ends')],
    diagrams: [board],
  }, 'd1'),
]

const elsewhere = { provider: 'elsewhere', name: 'Elsewhere', key: 'one' }

/**
 * A chrome with one button per destination a test hands it, which says where
 * the app is and who moved it there — the provider's way about, as a step of
 * a guide would use it.
 */
function guide(stops: readonly { label: string; to: Destination; options?: SourceOpenOptions }[]) {
  return function Guide({ screen: where, movedBy, open }: {
    screen: Screen; movedBy: MovedBy; open: (to: Destination, options?: SourceOpenOptions) => void
  }) {
    return (
      <div>
        <p data-testid="guide-where">{JSON.stringify({ where, movedBy })}</p>
        {stops.map(({ label, to, options }) => (
          <button key={label} type="button" onClick={() => open(to, options)}>{label}</button>
        ))}
      </div>
    )
  }
}

const told = (): { where: Screen; movedBy: MovedBy } => JSON.parse(screen.getByTestId('guide-where').textContent ?? '{}')

function show(stops: Parameters<typeof guide>[0], scopes: ScopeSnapshot[] = tree(), initialProject?: ScopeSnapshot) {
  const repositories = heldRepositories(scopes)
  renderApp({
    repositories,
    source: elsewhere,
    boot: { initialProject },
    provider: { chrome: [{ kind: 'elsewhere', chrome: guide(stops) }] },
  })
  return repositories
}

describe('a move a provider says is its own', () => {
  it('is the provider’s, and the person’s next move is the person’s', async () => {
    show([{ label: 'To the landscape', to: { scope: 'acme/landscape' }, options: { by: 'provider' } }])
    await waitFor(() => expect(told().where.home?.path).toBe(''))
    expect(told().movedBy).toBe('person')
    fireEvent.click(screen.getByRole('button', { name: 'To the landscape' }))
    await waitFor(() => expect(told().where.open?.path).toBe('acme/landscape'))
    expect(told().movedBy).toBe('provider')
    fireEvent.click(screen.getByTestId('crumb-acme'))
    await waitFor(() => expect(told().where.home?.path).toBe('acme'))
    expect(told().movedBy).toBe('person')
  })

  it('is the provider’s through a page that comes up after the scope opens', async () => {
    show([{ label: 'To the roadmap', to: { scope: 'acme/landscape', page: 'roadmap' }, options: { by: 'provider' } }])
    await waitFor(() => expect(told().where.home?.path).toBe(''))
    fireEvent.click(screen.getByRole('button', { name: 'To the roadmap' }))
    await waitFor(() => expect(told().where.page).toEqual({ page: 'roadmap' }))
    expect(told().movedBy).toBe('provider')
  })

  it('is the person’s, as it always was, where the provider did not say so', async () => {
    show([{ label: 'To the landscape', to: { scope: 'acme/landscape' } }])
    await waitFor(() => expect(told().where.home?.path).toBe(''))
    fireEvent.click(screen.getByRole('button', { name: 'To the landscape' }))
    await waitFor(() => expect(told().where.open?.path).toBe('acme/landscape'))
    expect(told().movedBy).toBe('person')
  })
})

describe('an open of a view', () => {
  it('lands on the scope’s home where it has none of that kind, and makes none', async () => {
    const repositories = show([{ label: 'To a sheet', to: { scope: 'acme/landscape', page: 'sheet' }, options: { by: 'provider' } }])
    await waitFor(() => expect(told().where.home?.path).toBe(''))
    fireEvent.click(screen.getByRole('button', { name: 'To a sheet' }))
    await waitFor(() => expect(told().where.home?.path).toBe('acme/landscape'))
    expect(told().movedBy).toBe('provider')
    expect((await repositories.read('acme/landscape'))?.model.diagrams.map((one) => one.id)).toEqual(['d1'])
  })

  it('lands on the home from inside the scope that is open, too', async () => {
    const scopes = tree()
    const repositories = show([{ label: 'To a map', to: { page: 'map' } }], scopes, scopes[2])
    await waitFor(() => expect(told().where.open?.path).toBe('acme/landscape'))
    fireEvent.click(screen.getByRole('button', { name: 'To a map' }))
    await waitFor(() => expect(told().where.home?.path).toBe('acme/landscape'))
    expect((await repositories.read('acme/landscape'))?.model.diagrams.map((one) => one.id)).toEqual(['d1'])
  })

  it('opens the one there is, and a board with no id is the board on the tab', async () => {
    const scopes = tree()
    scopes[2].model.diagrams = [board, sheet('s1')]
    show([
      { label: 'To the sheet', to: { scope: 'acme/landscape', page: 'sheet' } },
      { label: 'To the board', to: { page: 'board' } },
    ], scopes)
    await waitFor(() => expect(told().where.home?.path).toBe(''))
    fireEvent.click(screen.getByRole('button', { name: 'To the sheet' }))
    await waitFor(() => expect(told().where.open?.view?.id).toBe('s1'))
    fireEvent.click(screen.getByRole('button', { name: 'To the board' }))
    await waitFor(() => expect(told().where.open?.view?.id).toBe('d1'))
  })
})

describe('the observations page, on a tab', () => {
  it('opens on the tab asked for, and the screen says which tab is up', async () => {
    show([{ label: 'To the solutions', to: { scope: 'acme/landscape', page: 'observations', tab: 'solutions' }, options: { by: 'provider' } }])
    await waitFor(() => expect(told().where.home?.path).toBe(''))
    fireEvent.click(screen.getByRole('button', { name: 'To the solutions' }))
    await waitFor(() => expect(told().where.page).toMatchObject({ page: 'observations', tab: 'solutions' }))
    expect(told().movedBy).toBe('provider')
    const page = await screen.findByRole('dialog')
    expect(within(page).getByTestId('observation-tab-solutions').getAttribute('aria-pressed')).toBe('true')
    // The person changes the tab: the screen says so, and it is theirs.
    fireEvent.click(within(page).getByTestId('observation-tab-analysis'))
    await waitFor(() => expect(told().where.page).toMatchObject({ page: 'observations', tab: 'analysis' }))
    expect(told().movedBy).toBe('person')
  })
})

describe('an element selected on the view opened', () => {
  it('is selected on a sheet that draws it, and nothing is where the sheet does not', async () => {
    const scopes = tree()
    scopes[2].model.diagrams = [board, sheet('s1')]
    show([
      { label: 'Invoicing on the sheet', to: { scope: 'acme/landscape', page: 'sheet', id: 's1', select: 'invoicing' } },
    ], scopes)
    await waitFor(() => expect(told().where.home?.path).toBe(''))
    fireEvent.click(screen.getByRole('button', { name: 'Invoicing on the sheet' }))
    await waitFor(() => expect(screen.getByTestId('sheet-open-page').getAttribute('aria-label')).toContain('Invoicing'))
  })

  it('selects nothing on a sheet that does not draw it', async () => {
    const scopes = tree()
    scopes[2].model.diagrams = [board, sheet('s1')]
    show([{ label: 'Billing on the sheet', to: { scope: 'acme/landscape', page: 'sheet', id: 's1', select: 'billing' } }], scopes)
    await waitFor(() => expect(told().where.home?.path).toBe(''))
    fireEvent.click(screen.getByRole('button', { name: 'Billing on the sheet' }))
    await waitFor(() => expect(told().where.open?.view?.id).toBe('s1'))
    await screen.findByTestId('sheet-inspector')
    expect(screen.queryByTestId('sheet-open-page')).toBeNull()
  })
})

describe('what is opened is what is seen', () => {
  it('closes the documentation page over the board when a provider opens another page', async () => {
    const scopes = tree()
    show([
      { label: 'Billing’s page', to: { page: 'document', id: 'billing' } },
      { label: 'To the roadmap', to: { page: 'roadmap' } },
    ], scopes, scopes[2])
    await waitFor(() => expect(told().where.open?.path).toBe('acme/landscape'))
    fireEvent.click(screen.getByRole('button', { name: 'Billing’s page' }))
    await screen.findByTestId('doc-nav')
    // The page is a dialog, so what is under it is hidden from the roles: a
    // provider's strip reaches it all the same.
    fireEvent.click(screen.getByText('To the roadmap'))
    await waitFor(() => expect(told().where.page).toEqual({ page: 'roadmap' }))
    await waitFor(() => expect(screen.queryByTestId('doc-nav')).toBeNull())
    // The one page up is the roadmap.
    expect(await screen.findAllByRole('dialog')).toHaveLength(1)
  })
})

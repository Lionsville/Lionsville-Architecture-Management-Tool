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
import { useEffect } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { laidOut } from '../model/testFixtures'
import type { DesignElement, DesignDiagram } from '../model'
import type { Adr } from '../model/adr'
import type { Observation } from '../model/observation'
import type { Destination, MovedBy, Screen } from '../agent/screen'
import type { SourceOpenOptions } from '../ports/ProviderParts'
import type { ScopeSnapshot } from '../projects/scope'
import { answering, heldRepositories } from './testing/heldRepositories'
import type { HeldRepositories } from './testing/heldRepositories'
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

/** The same tree with records on the landscape: two observations and two decisions, for a record page to pick from. */
const observation = (id: string, number: number): Observation => ({
  id, number, title: `Seen ${id}`, date: '2026-09-01', impact: 'minor', seen: 1, body: '', history: [{ date: '2026-09-01', kind: 'recorded' }],
})
const decision = (id: string, number: number): Adr => ({
  id, number, title: `Decided ${id}`, status: 'proposed', date: '2026-09-01', body: '', signers: [],
})
const withRecords = () => {
  const scopes = tree()
  scopes[2].model.observations = [observation('o1', 1), observation('o2', 2)]
  scopes[2].model.decisions = [decision('l1', 1), decision('l2', 2)]
  return scopes
}

const elsewhere = { provider: 'elsewhere', name: 'Elsewhere', key: 'one' }

/** Every screen the chrome was handed, with who it was told moved the app there, in order. */
let handed: { where: Screen; movedBy: MovedBy }[] = []
beforeEach(() => { handed = [] })
/** Who moved the app, for every screen handed over since `from`. */
const movers = (from: number) => handed.slice(from).map((one) => one.movedBy)

/**
 * A chrome with one button per destination a test hands it, which says where
 * the app is and who moved it there — the provider's way about, as a step of
 * a guide would use it.
 */
function guide(stops: readonly { label: string; to: Destination; options?: SourceOpenOptions }[]) {
  return function Guide({ screen: where, movedBy, open }: {
    screen: Screen; movedBy: MovedBy; open: (to: Destination, options?: SourceOpenOptions) => void
  }) {
    useEffect(() => { handed.push({ where, movedBy }) }, [where, movedBy])
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

function show(
  stops: Parameters<typeof guide>[0], scopes: ScopeSnapshot[] = tree(), initialProject?: ScopeSnapshot,
  held: (repositories: HeldRepositories) => HeldRepositories = (repositories) => repositories,
) {
  const repositories = held(heldRepositories(scopes))
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

  it('is the provider’s where a view with no id brings another view of the scope that is open', async () => {
    const scopes = tree()
    scopes[2].model.diagrams = [board, sheet('s1')]
    show([{ label: 'To the sheet', to: { page: 'sheet' }, options: { by: 'provider' } }], scopes, scopes[2])
    await waitFor(() => expect(told().where.open?.view?.id).toBe('d1'))
    const from = handed.length
    fireEvent.click(screen.getByRole('button', { name: 'To the sheet' }))
    await waitFor(() => expect(told().where.open?.view?.id).toBe('s1'))
    expect(movers(from)).toEqual(['provider'])
  })

  it('is the provider’s where a view the scope that is open has none of lands on its home', async () => {
    const scopes = tree()
    show([{ label: 'To a map', to: { page: 'map' }, options: { by: 'provider' } }], scopes, scopes[2])
    await waitFor(() => expect(told().where.open?.view?.id).toBe('d1'))
    const from = handed.length
    fireEvent.click(screen.getByRole('button', { name: 'To a map' }))
    await waitFor(() => expect(told().where.home?.path).toBe('acme/landscape'))
    expect(movers(from)).toEqual(['provider'])
  })

  it('leaves no mark where it opened nothing, so the person’s next move there is the person’s', async () => {
    show([
      { label: 'To a decision', to: { scope: 'acme/new', page: 'decisions', id: 'adr-1' }, options: { by: 'provider' } },
      { label: 'To its roadmap', to: { scope: 'acme/new', page: 'roadmap' } },
    ])
    await waitFor(() => expect(told().where.home?.path).toBe(''))
    // A scope with no document, asked for by a record it cannot have: nothing opens.
    fireEvent.click(screen.getByRole('button', { name: 'To a decision' }))
    fireEvent.click(screen.getByRole('button', { name: 'To its roadmap' }))
    await waitFor(() => expect(told().where).toMatchObject({ open: { path: 'acme/new' }, page: { page: 'roadmap' } }))
    expect(told().movedBy).toBe('person')
  })

  it('leaves no mark where the scope could not be read', async () => {
    let down = false
    show([
      { label: 'To the decisions', to: { scope: 'acme/landscape', page: 'decisions' }, options: { by: 'provider' } },
      { label: 'To the roadmap', to: { scope: 'acme/landscape', page: 'roadmap' } },
    ], tree(), undefined, (held) => answering(held, {
      state: (id) => (down ? Promise.reject(new Error('the store is down')) : held.scopes.state(id)),
    }))
    await waitFor(() => expect(told().where.home?.path).toBe(''))
    down = true
    fireEvent.click(screen.getByRole('button', { name: 'To the decisions' }))
    await screen.findByText(/could not be opened|could not be read/i)
    down = false
    fireEvent.click(screen.getByRole('button', { name: 'To the roadmap' }))
    await waitFor(() => expect(told().where.page).toEqual({ page: 'roadmap' }))
    expect(told().movedBy).toBe('person')
  })

  it('leaves no mark where it lands on the home that was already up, bare', async () => {
    show([
      { label: 'To the landscape’s home', to: { scope: 'acme/landscape', page: 'home' } },
      { label: 'To a map', to: { page: 'map' }, options: { by: 'provider' } },
      { label: 'The register', to: { page: 'register' } },
    ])
    await waitFor(() => expect(told().where.home?.path).toBe(''))
    fireEvent.click(screen.getByRole('button', { name: 'To the landscape’s home' }))
    await waitFor(() => expect(told().where.home?.path).toBe('acme/landscape'))
    // Nothing moves: the home the map falls back to is the one that is up.
    // Once its read is done, the register opened next is the person's.
    fireEvent.click(screen.getByRole('button', { name: 'To a map' }))
    await act(() => new Promise((resolve) => { setTimeout(resolve, 0) }))
    expect(told().where).toEqual({ home: { path: 'acme/landscape', name: 'Landscape' } })
    fireEvent.click(screen.getByText('The register'))
    await waitFor(() => expect(told().where.page).toEqual({ page: 'register' }))
    expect(told().movedBy).toBe('person')
  })
})

/**
 * A record's page picks what it shows once it has the request: the record
 * asked for, or the newest observation, or the first decision, and the tab
 * that is up. That pick is part of the provider's move, and the person's next
 * move on the same page is the person's.
 */
describe('a move a provider says is its own, onto a record’s page', () => {
  it('is the provider’s through the observation the page picks, from a home', async () => {
    show([{ label: 'To the solutions', to: { scope: 'acme/landscape', page: 'observations', tab: 'solutions' }, options: { by: 'provider' } }], withRecords())
    await waitFor(() => expect(told().where.home?.path).toBe(''))
    const from = handed.length
    fireEvent.click(screen.getByRole('button', { name: 'To the solutions' }))
    await waitFor(() => expect(told().where.page).toEqual({ page: 'observations', id: 'o2', tab: 'solutions' }))
    expect(movers(from)).not.toContain('person')
    fireEvent.click(within(await screen.findByRole('dialog')).getByTestId('observation-tab-analysis'))
    await waitFor(() => expect(told().where.page).toMatchObject({ page: 'observations', tab: 'analysis' }))
    expect(told().movedBy).toBe('person')
  })

  it('is the provider’s through the observation the page picks, in the scope that is open', async () => {
    const scopes = withRecords()
    show([{ label: 'To the observations', to: { page: 'observations' }, options: { by: 'provider' } }], scopes, scopes[2])
    await waitFor(() => expect(told().where.open?.view?.id).toBe('d1'))
    const from = handed.length
    fireEvent.click(screen.getByRole('button', { name: 'To the observations' }))
    await waitFor(() => expect(told().where.page).toEqual({ page: 'observations', id: 'o2', tab: 'register' }))
    expect(movers(from)).not.toContain('person')
    fireEvent.click(within(await screen.findByRole('dialog')).getByTestId('observation-row-o1'))
    await waitFor(() => expect(told().where.page).toMatchObject({ page: 'observations', id: 'o1' }))
    expect(told().movedBy).toBe('person')
  })

  it('is the provider’s where the page that is up picks again', async () => {
    const scopes = withRecords()
    show([
      { label: 'The older one', to: { page: 'observations', id: 'o1' } },
      { label: 'To the observations', to: { page: 'observations' }, options: { by: 'provider' } },
    ], scopes, scopes[2])
    await waitFor(() => expect(told().where.open?.view?.id).toBe('d1'))
    fireEvent.click(screen.getByRole('button', { name: 'The older one' }))
    await waitFor(() => expect(told().where.page).toEqual({ page: 'observations', id: 'o1', tab: 'register' }))
    const from = handed.length
    fireEvent.click(screen.getByText('To the observations'))
    await waitFor(() => expect(told().where.page).toEqual({ page: 'observations', id: 'o2', tab: 'register' }))
    expect(movers(from).length).toBeGreaterThan(0)
    expect(movers(from)).not.toContain('person')
  })

  it('is the provider’s through the decision the page picks', async () => {
    const scopes = withRecords()
    show([{ label: 'To the decisions', to: { page: 'decisions' }, options: { by: 'provider' } }], scopes, scopes[2])
    await waitFor(() => expect(told().where.open?.view?.id).toBe('d1'))
    const from = handed.length
    fireEvent.click(screen.getByRole('button', { name: 'To the decisions' }))
    await waitFor(() => expect(told().where.page).toMatchObject({ page: 'decisions', id: expect.any(String) }))
    expect(movers(from)).not.toContain('person')
    const picked = told().where.page
    const other = picked?.page === 'decisions' && picked.id === 'l1' ? 'Decided l2' : 'Decided l1'
    fireEvent.click(within(await screen.findByTestId('adr-list')).getByText(other))
    await waitFor(() => expect(told().where.page).not.toEqual(picked))
    expect(told().movedBy).toBe('person')
  })
})

describe('an open of a view', () => {
  it('closes the register over the home it falls back to', async () => {
    show([
      { label: 'The register', to: { scope: '', page: 'register' } },
      { label: 'To a map', to: { scope: 'acme/landscape', page: 'map' }, options: { by: 'provider' } },
    ])
    await waitFor(() => expect(told().where.home?.path).toBe(''))
    fireEvent.click(screen.getByRole('button', { name: 'The register' }))
    await screen.findByTestId('register-topbar')
    fireEvent.click(screen.getByText('To a map'))
    await waitFor(() => expect(told().where.home?.path).toBe('acme/landscape'))
    await waitFor(() => expect(told().where.page).toBeUndefined())
    await waitFor(() => expect(screen.queryByTestId('register-topbar')).toBeNull())
    expect(told().movedBy).toBe('provider')
  })

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

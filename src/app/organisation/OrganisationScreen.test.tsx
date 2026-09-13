// @vitest-environment jsdom
/**
 * The organisation's home: what it says about itself, and what its own pages
 * have in them.
 *
 * This is the screen that replaced the picker, and the difference it is here to
 * pin is not a layout: the picker showed what is filed UNDER the root and
 * nothing about the root, and this shows the root — its name, its client, its
 * links, and the four pages it holds — with the tree beneath it.
 *
 * Rendered through the whole shell rather than as a component with props, so
 * the loads the cards depend on are real ones through a real store. There is
 * exactly one thing on this screen a listing can answer; everything else comes
 * from one read of the root.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { InMemoryScopeStore } from '../../adapters/memory/InMemoryScopeStore'
import { laidOut } from '../../model/testFixtures'
import type { ScopeSnapshot } from '../../projects/scope'
import { EXAMPLES } from '../examples'
import { renderApp } from '../testing/renderShell'
import { installReactFlowMocks } from '../../editor/reactFlowTestSetup'

afterEach(() => cleanup())

const TODAY = () => '2026-09-12'

const board = () => laidOut({ id: 'l7', kind: 'layer7' as const, name: 'L7', placements: [] })

function scope(path: string, name: string, over: Partial<ScopeSnapshot> = {}): ScopeSnapshot {
  return {
    path,
    model: { name, elements: [], relations: [], diagrams: [board()] },
    activeDiagramId: 'l7',
    logoLibrary: [],
    ...over,
  }
}

/** A root with a business layer, a record and a plan on it — an organisation. */
function organisation(): ScopeSnapshot {
  return {
    path: '',
    model: {
      name: 'Acme Logistics',
      description: 'A parcel and pallet operator.',
      elements: [
        { id: 'ship', kind: 'step', name: 'Ship a consignment', lifecycle: 'live', isManaged: true, aspects: {} },
        { id: 'warehousing', kind: 'function', name: 'Warehousing', scopes: ['retail'], lifecycle: 'live', isManaged: true, aspects: {} },
        { id: 'billing', kind: 'function', name: 'Billing', lifecycle: 'live', isManaged: true, aspects: {} },
        { id: 'planner', kind: 'actor', name: 'Planner', lifecycle: 'live', isManaged: true, aspects: {} },
      ],
      relations: [],
      diagrams: [],
      decisions: [
        { id: 'a1', number: 1, title: 'One identity', status: 'accepted', date: '2026-09-01', body: '', signers: [] },
        { id: 'a2', number: 2, title: 'Federate the model', status: 'proposed', date: '2026-09-05', body: '', signers: [] },
      ],
      transitions: [
        { id: 't1', number: 1, title: 'Retire the rater', status: 'running', to: '2026-08-01', elements: [], decisions: [], milestones: [], body: '' },
      ],
    },
    activeDiagramId: '',
    logoLibrary: [],
    client: 'Acme Logistics BV',
    links: [{ label: 'Wiki', url: 'https://example.test/wiki' }],
  }
}

/** The same organisation, with two applications under it in a domain. */
function withApplications(): ScopeSnapshot[] {
  const app = (id: string, name: string, over = {}) =>
    ({ id, kind: 'application' as const, name, lifecycle: 'live' as const, isManaged: false, aspects: {}, ...over })
  return [
    organisation(),
    {
      ...scope('retail', 'Retail'),
      model: {
        name: 'Retail',
        elements: [app('wms', 'Warehouse system'), app('post', 'Post office', { outside: true })],
        relations: [],
        diagrams: [board()],
      },
    },
  ]
}

describe('the organisation screen — identity', () => {
  it('shows the root scope as the screen, name and description and links', async () => {
    renderApp({ scopes: new InMemoryScopeStore([organisation()]), today: TODAY })
    expect((await screen.findByTestId('organisation-name')).textContent).toBe('Acme Logistics')
    expect(screen.getByText('A parcel and pallet operator.')).toBeDefined()
    const link = screen.getByRole('link', { name: 'Wiki' })
    expect(link.getAttribute('href')).toBe('https://example.test/wiki')
    // The address came from a file somebody else may have written.
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('counts a domain by what is under it and a landscape by what it draws', async () => {
    renderApp({
      scopes: new InMemoryScopeStore([
        organisation(),
        { ...scope('retail', 'Retail'), model: { name: 'Retail', elements: [], relations: [], diagrams: [] } },
        scope('retail/warehouse', 'Warehouse'),
        scope('finance', 'Finance'),
      ]),
      today: TODAY,
    })
    const meta = await screen.findByTestId('organisation-meta')
    await waitFor(() => expect(meta.textContent).toContain('1 domain'))
    expect(meta.textContent).toContain('2 landscapes')
  })

  /** "For Acme Logistics" under the heading "Acme Logistics" says it twice. */
  it('names the client only when it differs from the name', async () => {
    renderApp({ scopes: new InMemoryScopeStore([organisation()]), today: TODAY })
    expect((await screen.findByTestId('organisation-meta')).textContent)
      .toContain('For Acme Logistics BV')

    cleanup()
    const same = organisation()
    same.client = 'Acme Logistics'
    renderApp({ scopes: new InMemoryScopeStore([same]), today: TODAY })
    expect((await screen.findByTestId('organisation-meta')).textContent).not.toContain('For ')
  })
})

describe('the organisation screen — its own pages', () => {
  it('counts the root’s own business layer, and says what is not yet mapped', async () => {
    renderApp({ scopes: new InMemoryScopeStore([organisation()]), today: TODAY })
    const cards = await screen.findByTestId('organisation-cards')
    await waitFor(() => expect(cards.textContent).toContain('1 journey'))
    expect(cards.textContent).toContain('2 functions')
    expect(cards.textContent).toContain('1 stakeholder')
    // `billing` has no `scopes`; `warehousing` has one.
    expect(cards.textContent).toContain('1 function not yet mapped to a domain')
  })

  it('counts the root’s records by status and names the newest', async () => {
    renderApp({ scopes: new InMemoryScopeStore([organisation()]), today: TODAY })
    const cards = await screen.findByTestId('organisation-cards')
    await waitFor(() => expect(cards.textContent).toContain('2 records'))
    expect(cards.textContent).toContain('1 proposed')
    expect(cards.textContent).toContain('1 accepted')
    expect(cards.textContent).toContain('ADR-0002 Federate the model')
  })

  it('shows the first thing the roadmap’s dates disagree about', async () => {
    renderApp({ scopes: new InMemoryScopeStore([organisation()]), today: TODAY })
    const cards = await screen.findByTestId('organisation-cards')
    await waitFor(() => expect(cards.textContent).toContain('1 plan'))
    expect(cards.textContent).toContain('was due to finish on 2026-08-01')
  })

  /**
   * The one card about the WHOLE tree (ADR-0012 §2). Its numbers come from the
   * index the shell already holds, not from a load of its own — which is why
   * it can count applications the root's own document has none of.
   */
  it('counts the register over every scope, and opens it', async () => {
    renderApp({ scopes: new InMemoryScopeStore(withApplications()), today: TODAY })
    const cards = await screen.findByTestId('organisation-cards')
    await waitFor(() => expect(cards.textContent).toContain('2 applications'))
    expect(cards.textContent).toContain('2 owned by a domain')
    expect(cards.textContent).toContain('1 outside')
    expect(cards.textContent).toContain('1 outside and unattributed')

    fireEvent.click(within(cards).getByTestId('open-register'))
    const table = await screen.findByTestId('register-table')
    expect(within(table).getByTestId('register-master-wms').textContent).toBe('retail')
    expect(table.textContent).toContain('Post office')
  })

  it('opens a register row\'s page in the scope that answers for it', async () => {
    // The row's scope draws a board, so the canvas mounts — the one place in
    // these tests where React Flow needs jsdom's missing pieces.
    installReactFlowMocks()
    renderApp({ scopes: new InMemoryScopeStore(withApplications()), today: TODAY })
    fireEvent.click(within(await screen.findByTestId('organisation-cards')).getByTestId('open-register'))
    fireEvent.click(await screen.findByTestId('register-page-post'))
    // The landscape opens, and on it the page — with the record's fields
    // there to be written, which is what the row was opened for.
    const page = await screen.findByTestId('doc-content')
    expect(page.textContent).toContain('Post office')
    expect((screen.getByLabelText('Outside the organisation') as HTMLInputElement).checked).toBe(true)
    // The whole app, a board and the page in one mount: a second alone, and
    // several under the full run, so it gets more than the default.
  }, 20_000)

  it('opens the root on the page the card was pressed for', async () => {
    renderApp({ scopes: new InMemoryScopeStore([organisation()]), today: TODAY })
    fireEvent.click(await screen.findByTestId('open-decisions'))
    // The root draws nothing at all; the decisions page is what it was opened
    // for, and is what appears.
    expect(await screen.findByText('Architecture decisions')).toBeDefined()
  })

  it('offers to make a sheet where the scope has none, and to open the one it has', async () => {
    renderApp({ scopes: new InMemoryScopeStore([organisation()]), today: TODAY })
    expect((await screen.findByTestId('open-business')).textContent).toBe('Make a sheet…')

    cleanup()
    const withSheet = organisation()
    withSheet.model.diagrams = [{
      id: 'sh', kind: 'sheet', name: 'Business architecture', members: [], geometry: { nodes: [] },
    }]
    renderApp({ scopes: new InMemoryScopeStore([withSheet]), today: TODAY })
    await waitFor(() => expect(screen.getByTestId('open-business').textContent).toBe('Open'))
  })

  it('offers to make a map beside the sheet, and to open the one it has', async () => {
    renderApp({ scopes: new InMemoryScopeStore([organisation()]), today: TODAY })
    expect((await screen.findByTestId('open-map')).textContent).toBe('Make a map…')

    cleanup()
    const withMap = organisation()
    withMap.model.diagrams = [{
      id: 'mp', kind: 'map', name: 'Enterprise map', members: [], geometry: { nodes: [] },
    }]
    renderApp({ scopes: new InMemoryScopeStore([withMap]), today: TODAY })
    await waitFor(() => expect(screen.getByTestId('open-map').textContent).toBe('Map'))
    fireEvent.click(screen.getByTestId('open-map'))
    // The root draws nothing; the map is what it was opened for.
    expect(await screen.findByTestId('map-grid', {}, { timeout: 3000 })).toBeDefined()
  })

  it('counts the initiatives of the domains on the roadmap card, off the index', async () => {
    const retail: ScopeSnapshot = {
      ...organisation(), path: 'acme/retail',
      model: {
        ...organisation().model, name: 'Retail',
        transitions: [
          { id: 'tr-1', number: 1, title: 'One warehouse system', status: 'agreed', initiative: true, elements: [], decisions: [], milestones: [], body: '' },
          { id: 'tr-2', number: 2, title: 'Not the organisation\u2019s', status: 'draft', elements: [], decisions: [], milestones: [], body: '' },
        ],
      },
    }
    renderApp({ scopes: new InMemoryScopeStore([organisation(), retail]), today: TODAY })
    const cards = await screen.findByTestId('organisation-cards')
    await waitFor(() => expect(cards.textContent).toContain('1 initiative from below'))
  })

  /** A fresh folder. Four zeroes read as a fault; a sentence reads as a start. */
  it('says nothing is here yet rather than showing zeroes', async () => {
    renderApp({ scopes: new InMemoryScopeStore([]), today: TODAY })
    const cards = await screen.findByTestId('organisation-cards')
    await waitFor(() => expect(cards.textContent).toContain('Nothing at this level yet.'))
    expect(cards.textContent).not.toContain('0 journeys')
  })
})

describe('the organisation screen — a fresh folder', () => {
  it('asks for a name where the heading would be, and takes it', async () => {
    const scopes = new InMemoryScopeStore([])
    renderApp({ scopes, today: TODAY })

    expect(screen.queryByTestId('organisation-name')).toBeNull()
    const field = await screen.findByTestId('organisation-name-field')
    fireEvent.change(field, { target: { value: 'Globex' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(async () => expect((await scopes.load(''))?.model.name).toBe('Globex'))
    expect((await screen.findByTestId('organisation-name')).textContent).toBe('Globex')
  })

  it('shows no tree, and the examples underneath', async () => {
    renderApp({
      scopes: new InMemoryScopeStore([]),
      today: TODAY,
      examples: [{
        key: 'acme', path: 'acme-logistics', label: 'Acme Logistics', description: 'an example',
        folder: {
          'scope.json': {
            type: 'lionsville-architecture', version: 5, name: 'Acme Logistics',
            kind: 'organisation', activeDiagramId: '', diagrams: [],
          },
          'model.json': { elements: [], relations: [] },
        },
      }],
    })
    expect(await screen.findByText('Examples')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Copy into this folder…' })).toBeDefined()
    expect(screen.queryByText('Domains and landscapes')).toBeNull()
  })

  it('offers no examples once the folder holds architecture of its own', async () => {
    const scopes = new InMemoryScopeStore([])
    renderApp({ scopes, today: TODAY, examples: EXAMPLES })
    fireEvent.click(await screen.findByRole('button', { name: 'Copy into this folder…' }))
    await waitFor(() => expect(screen.getByTestId('saved-indicator')).toBeDefined())
    fireEvent.click(screen.getByTestId('crumb-'))

    expect((await screen.findByTestId('organisation-name')).textContent).toBe('Acme Logistics')
    expect(screen.queryByText('Examples')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Copy into this folder…' })).toBeNull()
  })
})

/**
 * The shipped example, copied the way a person copies it.
 *
 * Over the real catalogue entry rather than a fixture: this is the first screen
 * anybody sees, and what it says about the example is the app's first
 * impression of itself.
 */
describe('the organisation screen — the shipped example', () => {
  it('becomes the organisation, with its landscape as a row beneath', async () => {
    const scopes = new InMemoryScopeStore([])
    renderApp({ scopes, today: TODAY, examples: EXAMPLES })

    fireEvent.click(await screen.findByRole('button', { name: 'Copy into this folder…' }))
    // Copying lands the person in the scope that has the work in it.
    await waitFor(() => expect(screen.getByTestId('saved-indicator')).toBeDefined())
    // The organisation's crumb is the way back to its home.
    fireEvent.click(screen.getByTestId('crumb-'))

    expect((await screen.findByTestId('organisation-name')).textContent).toBe('Acme Logistics')
    expect(screen.getByTestId('scope-application-landscape')).toBeDefined()
    await waitFor(() => expect(screen.getByTestId('organisation-meta').textContent)
      .toContain('1 landscape'))
    // The sheet is the ORGANISATION's now that a cross-scope id resolves
    // (ADR-0012 §1): the journey, the rail and the areas are what this level
    // holds, and the applications are the row beneath it.
    const cards = screen.getByTestId('organisation-cards').textContent ?? ''
    expect(cards).toContain('Business architecture')
    expect(cards).toContain('1 journey')
    expect(cards).not.toContain('Nothing at this level yet.')
  })
})

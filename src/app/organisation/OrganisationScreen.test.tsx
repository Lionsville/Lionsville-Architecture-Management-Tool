// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
import { checkOnPage, pressFound } from '../testing/findings'
import { answering, heldRepositories } from '../testing/heldRepositories'
import type { HeldRepositories } from '../testing/heldRepositories'
import { registerStrings } from '../../i18n'
import { laidOut } from '../../model/testFixtures'
import type { ScopeSnapshot } from '../../projects/scope'
import { axeFindings } from '../testing/axe'
import { EXAMPLES } from '../testing/examples'
import { renderApp } from '../testing/renderShell'
import { installReactFlowMocks } from '../../editor/reactFlowTestSetup'
import { exampleScopes } from '../../adapters/folder/format/exampleFolder'

afterEach(() => cleanup())

const TODAY = () => '2026-09-12'

// The test that copies the shipped example gets this instead of the 5s
// default; see the comment on it.

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

/** The organisation with a platform scope and a landscape leaning on it (ADR-0014). */
function withTechnology(): ScopeSnapshot[] {
  const el = (id: string, kind: 'platform' | 'platformService' | 'application' | 'actor' | 'component', name: string, over = {}) =>
    ({ id, kind, name, lifecycle: 'live' as const, isManaged: true, aspects: {}, ...over })
  const root = organisation()
  root.model.elements.push(el('platform-team', 'actor', 'Platform team'), el('warehouse-team', 'actor', 'Warehouse team'))
  return [
    root,
    {
      ...scope('platforms', 'Shared platforms'),
      model: {
        name: 'Shared platforms',
        elements: [
          el('containers', 'platformService', 'Container platform', { shared: true }),
          el('brokering', 'platformService', 'Message brokering'),
          el('openshift', 'platform', 'OpenShift', { platformArchetype: 'place' }),
        ],
        relations: [
          { id: 'a1', type: 'assigned', sourceId: 'platform-team', targetId: 'containers' },
          { id: 'a2', type: 'assigned', sourceId: 'platform-team', targetId: 'brokering' },
          { id: 'r1', type: 'realises', sourceId: 'openshift', targetId: 'containers' },
        ],
        diagrams: [],
      },
    },
    {
      ...scope('warehouse', 'Warehouse'),
      model: {
        name: 'Warehouse',
        elements: [
          el('wms', 'application', 'Warehouse system', { partyId: 'warehouse-team' }),
          el('containers', 'platformService', 'Container platform', { ref: 'platforms' }),
          el('brokering', 'platformService', 'Message brokering', { ref: 'platforms' }),
        ],
        relations: [
          { id: 'u1', type: 'uses', sourceId: 'wms', targetId: 'containers' },
          { id: 'u2', type: 'uses', sourceId: 'wms', targetId: 'brokering' },
        ],
        diagrams: [board()],
      },
    },
  ]
}

/** Named, with nothing kept and nothing filed. */
function bareOrganisation(): ScopeSnapshot {
  return { path: '', model: { name: 'Acme Logistics', elements: [], relations: [], diagrams: [] }, activeDiagramId: '', logoLibrary: [] }
}

describe('the organisation screen — identity', () => {
  it('shows the root scope as the screen, name and description and links', async () => {
    renderApp({ repositories: heldRepositories([organisation()]), today: TODAY })
    expect((await screen.findByTestId('organisation-name')).textContent).toBe('Acme Logistics')
    expect(screen.getByText('A parcel and pallet operator.')).toBeDefined()
    const link = screen.getByRole('link', { name: 'Wiki' })
    expect(link.getAttribute('href')).toBe('https://example.test/wiki')
    // The address came from a file somebody else may have written.
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('counts the scopes beneath by what each says it is, in the words of the badges', async () => {
    renderApp({
      repositories: heldRepositories([
        organisation(),
        { ...scope('retail', 'Retail', { kind: 'domain' }), model: { name: 'Retail', elements: [], relations: [], diagrams: [] } },
        scope('retail/warehouse', 'Warehouse', { kind: 'landscape' }),
        scope('retail/returns', 'Returns', { kind: 'team' }),
        scope('finance', 'Finance'),
      ]),
      today: TODAY,
    })
    const meta = await screen.findByTestId('organisation-meta')
    // The whole tree beneath, in kind order; one that says nothing is a scope.
    await waitFor(() => expect(meta.getAttribute('title')).toContain('1 domain · 1 team · 1 landscape scope · 1 scope'))
  })

  /** "For Acme Logistics" under the heading "Acme Logistics" says it twice. */
  it('names the client only when it differs from the name', async () => {
    renderApp({ repositories: heldRepositories([organisation()]), today: TODAY })
    expect((await screen.findByTestId('organisation-meta')).textContent)
      .toContain('For Acme Logistics BV')

    cleanup()
    const same = organisation()
    same.client = 'Acme Logistics'
    renderApp({ repositories: heldRepositories([same]), today: TODAY })
    expect((await screen.findByTestId('organisation-meta')).textContent).not.toContain('For ')
  })
})

describe('the organisation screen — what the listing could not read', () => {
  /** A store whose listing says it could not read these paths (`ScopeSummary.unreadable`). */
  function listingWithout(unreadable: string[]): HeldRepositories {
    const held = heldRepositories([organisation(), scope('retail', 'Retail')])
    return answering(held, { tree: async () => ({ ...await held.scopes.tree(), unreadable }) })
  }

  it('says which scopes it could not read, rather than leaving them out in silence', async () => {
    renderApp({ repositories: listingWithout(['finance', 'retail/north']), today: TODAY })
    expect((await screen.findByTestId('organisation-unreadable')).textContent).toBe(
      '2 scopes could not be read and are not shown: finance, retail/north. '
      + 'Their folders are left as they are, and nothing is created in their place.',
    )
    expect(screen.getByText('Retail')).toBeDefined()
  })

  it('says so when the folder itself could not be read', async () => {
    renderApp({ repositories: listingWithout(['']), today: TODAY })
    expect((await screen.findByTestId('organisation-unreadable')).textContent)
      .toContain('Nothing here could be read')
  })

  it('says nothing when everything read', async () => {
    renderApp({ repositories: heldRepositories([organisation()]), today: TODAY })
    await screen.findByTestId('organisation-name')
    expect(screen.queryByTestId('organisation-unreadable')).toBeNull()
  })
})

describe('the organisation screen — its own pages', () => {
  it('counts the root’s own business layer, and says what is not yet mapped', async () => {
    renderApp({ repositories: heldRepositories([organisation()]), today: TODAY })
    const cards = await screen.findByTestId('organisation-cards')
    await waitFor(() => expect(cards.textContent).toContain('1 journey'))
    expect(cards.textContent).toContain('2 functions')
    expect(cards.textContent).toContain('1 stakeholder')
    // `billing` has no `scopes`; `warehousing` has one.
    expect(cards.textContent).toContain('1 function not yet mapped to a domain')
  })

  it('counts the root’s records by status and names the newest', async () => {
    renderApp({ repositories: heldRepositories([organisation()]), today: TODAY })
    const cards = await screen.findByTestId('organisation-cards')
    await waitFor(() => expect(cards.textContent).toContain('1 proposed'))
    expect(cards.textContent).toContain('1 accepted')
    expect(within(cards).getByTestId('open-latest-decision').getAttribute('title')).toContain('ADR-0002 Federate the model')
  })

  it('shows the first thing the roadmap’s dates disagree about', async () => {
    renderApp({ repositories: heldRepositories([organisation()]), today: TODAY })
    const cards = await screen.findByTestId('organisation-cards')
    await waitFor(() => expect(cards.textContent).toContain('1 plan'))
    expect(cards.textContent).toContain('was due to finish on 2026-08-01')
  })

  /**
   * The card's two lines that name one thing each are links to it, as the
   * roadmap's findings are: the finding opens its plan, the newest record
   * opens on the decisions page.
   */
  it('opens what the roadmap card\u2019s finding is about, and the record the decisions card names', async () => {
    renderApp({ repositories: heldRepositories([organisation()]), today: TODAY })
    const cards = await screen.findByTestId('organisation-cards')
    const finding = await within(cards).findByRole('button', { name: 'What the dates disagree about' })
    fireEvent.click(finding)
    expect(await screen.findByRole('heading', { name: /Retire the rater/ })).toBeTruthy()
    cleanup()
    renderApp({ repositories: heldRepositories([organisation()]), today: TODAY })
    const again = await screen.findByTestId('organisation-cards')
    fireEvent.click(await within(again).findByRole('button', { name: 'Latest: ADR-0002' }))
    await waitFor(() => expect(document.querySelector('[data-guide="decision.record"]')?.textContent).toContain('Federate the model'))
  })

  /**
   * The one card about the WHOLE tree (ADR-0012 §2). Its numbers come from the
   * index the shell already holds, not from a load of its own — which is why
   * it can count applications the root's own document has none of.
   */
  it('counts the register over every scope, and opens it', async () => {
    renderApp({ repositories: heldRepositories(withApplications()), today: TODAY })
    const place = await screen.findByTestId('tree-place-register')
    // Filed in a domain, not owned: where a row is filed says nothing about who answers for it (`check.applicationNobodyOwns`).
    await waitFor(() => expect(place.getAttribute('title')).toContain('2 applications'))
    expect(place.getAttribute('title')).toContain('0 filed in a domain')
    expect(place.getAttribute('title')).toContain('1 outside')
    const detail = await checkOnPage('review', 'check.unattributed')
    expect(pressFound(detail, within(detail).getByRole('row', { name: /Post office/ }).dataset.testid!).textContent)
      .toContain('Post office is outside the organisation and nobody has said whose it is')
    fireEvent.keyDown(window, { key: 'Escape' })

    fireEvent.click(screen.getByTestId('tree-place-register'))
    const table = await screen.findByTestId('register-table')
    // Kept in says the scope's name, never its path.
    expect(within(table).getByRole('row', { name: /Warehouse/ }).textContent).toContain('Retail')
    expect(table.textContent).toContain('Post office')
  })

  /**
   * A finding about the operating model is about a unit type or a
   * responsibility, which no board draws: pressed, it opens the operating
   * model's page at the organisation with the item picked (ADR-0036 §2).
   */
  it('opens a finding about the operating model on its page, the item picked', async () => {
    const root = organisation()
    const withGuild: ScopeSnapshot = {
      ...root,
      model: { ...root.model, unitTypes: [{ id: 'ut-guild', name: 'Guild', within: [], slots: [] }] },
    }
    renderApp({ repositories: heldRepositories([withGuild]), today: TODAY })
    const detail = await checkOnPage('fix', 'check.unitTypeNowhere')
    fireEvent.click(within(pressFound(detail, 'attention--ut-guild')).getByRole('button', { name: /Open/ }))
    const inspector = await screen.findByTestId('operating-inspector')
    expect(within(inspector).getByDisplayValue('Guild')).toBeTruthy()
    expect(within(screen.getByTestId('tray-nowhere')).getByTestId('unit-type-ut-guild').dataset.look).toBe('picked')
  })

  /**
   * The technology beside the applications (ADR-0014 §2.6): every service
   * and platform over the tree, who maintains each, which are shared, how
   * many consume them — and the one used across a team boundary without
   * anybody saying so.
   */
  it('counts the technology over every scope, and opens it', async () => {
    renderApp({ repositories: heldRepositories(withTechnology()), today: TODAY })
    const door = await screen.findByTestId('open-technology')
    await waitFor(() => expect(door.getAttribute('title')).toContain('2 services'))
    expect(door.getAttribute('title')).toContain('1 platform')
    expect(door.getAttribute('title')).toContain('1 shared')
    // The two findings are said on the Checks page, each naming the service.
    const offered = await checkOnPage('review', 'check.offeredNotShared')
    const sentence = pressFound(offered, within(offered).getByRole('row', { name: /Message brokering/ }).dataset.testid!).textContent
    expect(sentence).toContain('Message brokering is used by')
    expect(sentence).toContain('is not marked shared — mark it shared, or move it')
    fireEvent.click(screen.getByTestId('checks-row-check.unrealised'))
    const unrealised = screen.getByTestId('checks-detail')
    expect(pressFound(unrealised, within(unrealised).getByRole('row', { name: /Message brokering/ }).dataset.testid!).textContent).toContain('Message brokering is offered, but no platform delivers it')
    fireEvent.keyDown(window, { key: 'Escape' })

    fireEvent.click(screen.getByTestId('open-technology'))
    const table = await screen.findByTestId('technology-register-table')
    const containers = within(table).getByRole('row', { name: /Container/ }).textContent
    expect(containers).toContain('Platform team')
    expect(containers).toContain('Shared')
    expect(containers).toContain('OpenShift')
    const brokering = within(table).getByRole('row', { name: /Message brokering/ }).textContent
    expect(brokering).toContain('Not marked shared')
    expect(brokering).toContain('Nothing')
    // What it delivers, on the platforms' own tab.
    fireEvent.click(screen.getByRole('tab', { name: /Platforms/ }))
    const openshift = (await screen.findByRole('row', { name: /OpenShift/ })).textContent
    expect(openshift).toContain('Container platform')
    expect(openshift).toContain('0')
  })

  it('opens a register row\'s page in the scope that answers for it', async () => {
    // The row's scope draws a board, so the canvas mounts — the one place in
    // these tests where React Flow needs jsdom's missing pieces.
    installReactFlowMocks()
    renderApp({ repositories: heldRepositories(withApplications()), today: TODAY })
    fireEvent.click(await screen.findByTestId('tree-place-register'))
    fireEvent.click(await screen.findByRole('row', { name: /Post office/ }))
    fireEvent.click(await screen.findByTestId('register-page-post'))
    // The landscape opens, and on it the page — with the record's fields
    // there to be written, which is what the row was opened for.
    await screen.findByTestId('doc-content')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Post office')
    expect(screen.getAllByTestId('record-outside').at(-1)?.textContent).toContain('Yes')
    // The whole app, a board and the page in one mount: a second alone, and
    // several under the full run, so it gets more than the default.
  }, 20_000)

  it('opens the root on the page the card was pressed for', async () => {
    renderApp({ repositories: heldRepositories([organisation()]), today: TODAY })
    fireEvent.click(await screen.findByTestId('open-decisions'))
    // The root draws nothing at all; the decisions page is what it was opened
    // for, and is what appears.
    expect(await screen.findByRole('heading', { name: 'Decisions' })).toBeDefined()
  })

  it('offers to make a sheet where the scope has none, and to open the one it has', async () => {
    renderApp({ repositories: heldRepositories([organisation()]), today: TODAY })
    expect((await screen.findByTestId('open-business')).textContent).toContain('Business architecture')

    cleanup()
    const withSheet = organisation()
    withSheet.model.diagrams = [{
      id: 'sh', kind: 'sheet', name: 'Business architecture', members: [], geometry: { nodes: [] },
    }]
    renderApp({ repositories: heldRepositories([withSheet]), today: TODAY })
    await waitFor(() => expect(screen.getByTestId('open-business').getAttribute('role')).toBe('row'))
  })

  /**
   * The card's *Make…* and *New board…* over the boards are the person's own
   * way onto a view that writes one (ADR-0019, amended): they still make it,
   * through a page of their own, where an open of a view never does.
   */
  it('makes a sheet where the card says it will, and opens it', async () => {
    renderApp({ repositories: heldRepositories([organisation()]), today: TODAY })
    fireEvent.click(await screen.findByTestId('open-business'))
    // The root had no sheet: the one drawn is the one the press made.
    expect(await screen.findByTestId('sheet-canvas', {}, { timeout: 3000 })).toBeDefined()
  })

  it('makes a sheet from a landscape\u2019s boards, beside its board', async () => {
    installReactFlowMocks()
    renderApp({ repositories: heldRepositories([organisation(), scope('retail', 'Retail')]), today: TODAY })
    fireEvent.click(await screen.findByTestId('home-retail'))
    fireEvent.click(await screen.findByTestId('new-board'))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Business architecture' }))
    expect(await screen.findByTestId('sheet-canvas', {}, { timeout: 3000 })).toBeDefined()
  })

  it('offers to make a map beside the sheet, and to open the one it has', async () => {
    renderApp({ repositories: heldRepositories([organisation()]), today: TODAY })
    expect((await screen.findByTestId('open-map')).textContent).toBe('Coverage')

    cleanup()
    const withMap = organisation()
    withMap.model.diagrams = [{
      id: 'mp', kind: 'map', name: 'Enterprise map', members: [], geometry: { nodes: [] },
    }]
    renderApp({ repositories: heldRepositories([withMap]), today: TODAY })
    await waitFor(() => expect(screen.getByTestId('open-map').getAttribute('role')).toBe('row'))
    fireEvent.click(screen.getByTestId('open-map'))
    // The root draws nothing; the map is what it was opened for.
    expect(await screen.findByTestId('map-body', {}, { timeout: 3000 })).toBeDefined()
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
    renderApp({ repositories: heldRepositories([organisation(), retail]), today: TODAY })
    const cards = await screen.findByTestId('organisation-cards')
    await waitFor(() => expect(cards.textContent).toContain('1 initiative from below'))
  })

  /** A fresh folder. Four zeroes read as a fault; a sentence reads as a start. */
  it('says nothing is here yet rather than showing zeroes', async () => {
    renderApp({ repositories: heldRepositories([]), today: TODAY })
    const first = await screen.findByTestId('organisation-first')
    expect(first.textContent).toContain('Map how your organisation works')
    expect(first.textContent).not.toContain('0 journeys')
    expect(screen.queryByTestId('scope-tree-panel')).toBeNull()
  })
})

describe('the organisation screen — a fresh folder', () => {
  it('asks for a name where the heading would be, and takes it', async () => {
    const scopes = heldRepositories([])
    renderApp({ repositories: scopes, today: TODAY })

    expect(screen.queryByTestId('organisation-name')).toBeNull()
    const field = await screen.findByTestId('organisation-name-field')
    fireEvent.change(field, { target: { value: 'Globex' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))

    await waitFor(async () => expect((await scopes.read(''))?.model.name).toBe('Globex'))
    expect((await screen.findByTestId('organisation-name')).textContent).toBe('Globex')
  })

  /** An unconsumed Enter goes on to press whatever button takes the focus next, as one reopened the roadmap's New plan dialog. */
  it('takes a name on Enter, and consumes the Enter it acts on', async () => {
    const scopes = heldRepositories([])
    renderApp({ repositories: scopes, today: TODAY })
    const field = await screen.findByTestId('organisation-name-field')
    // An empty field has nothing to take, and leaves the key alone.
    expect(fireEvent.keyDown(field, { key: 'Enter' })).toBe(true)
    fireEvent.change(field, { target: { value: 'Globex' } })
    expect(fireEvent.keyDown(field, { key: 'Enter' })).toBe(false)
    await waitFor(async () => expect((await scopes.read(''))?.model.name).toBe('Globex'))
  })

  it('offers the example beside starting your own', async () => {
    renderApp({
      repositories: heldRepositories([]),
      today: TODAY,
      onVisitExample: () => undefined,
      examples: [{
        key: 'acme', path: 'acme-logistics', label: 'Acme Logistics', description: 'an example',
        scopes: exampleScopes({
          'scope.json': {
            type: 'lionsville-architecture', version: 5, name: 'Acme Logistics',
            kind: 'organisation', activeDiagramId: '', diagrams: [],
          },
          'model.json': { elements: [], relations: [] },
        }, 'acme-logistics'),
      }],
    })
    expect(await screen.findByTestId('open-example')).toBeDefined()
    expect(screen.getByRole('region', { name: 'Start your own' })).toBeDefined()
  })

  /**
   * Named, and nothing filed: the next step in words, and where work is kept
   * said here, once, rather than on every visit to a filled home.
   */
  it('asks what to write down first, once it has a name', async () => {
    renderApp({ repositories: heldRepositories([bareOrganisation()]), today: TODAY })
    expect((await screen.findByTestId('organisation-next')).textContent).toContain('What do you want to write down first?')
    expect(screen.getByTestId('organisation-subtitle').textContent).toContain('Everything here is kept in this browser.')
    expect(screen.getByTestId('tree-empty').textContent).toBe('Nothing filed yet. A division or a team goes here.')
    expect(screen.getByRole('button', { name: 'New scope…' })).toBeDefined()
    expect(screen.queryByTestId('needs-attention')).toBeNull()
    expect(await axeFindings()).toEqual([])
  })

  /**
   * And the where-clause is the provider's own words for a registered source.
   *
   * It used to fall through the two built-in kinds it knew to the browser's
   * storage, so a build composed from this one showed *Everything here is kept
   * in this browser* about a source that is not the browser — the one sentence
   * on this screen a reader has no way to check.
   */
  it('says where work is kept in the provider’s own sentence for a registered source', async () => {
    registerStrings('en', { 'elsewhere.kept': 'Your work is kept elsewhere, and elsewhere says when.' })
    renderApp({
      repositories: heldRepositories([bareOrganisation()]),
      today: TODAY,
      source: { provider: 'elsewhere', name: 'Elsewhere', key: 'one' },
      provider: { description: 'elsewhere.kept' },
    })
    const subtitle = await screen.findByTestId('organisation-subtitle')
    expect(subtitle.textContent).toContain('Your work is kept elsewhere, and elsewhere says when.')
    expect(subtitle.textContent).not.toContain('in this browser')
  })

  /**
   * And nothing at all where the provider gave no sentence: a guess of ours
   * about somewhere this shell has never heard of could promise a copy that
   * cannot be made, which is the rule the chip's tooltip already follows.
   */
  it('drops the clause where a registered source’s provider gave no sentence', async () => {
    renderApp({
      repositories: heldRepositories([bareOrganisation()]),
      today: TODAY,
      source: { provider: 'nowords', name: 'Elsewhere', key: 'one' },
    })
    await screen.findByTestId('organisation-next')
    expect(screen.queryByTestId('organisation-subtitle')).toBeNull()
  })
})

/**
 * A source that lets this person read a scope and not change it
 * (`AppProvider.readOnlyAt`): the home offers nothing that writes, and still
 * opens every page the scope has, to read.
 */
describe('the organisation screen — for somebody who may only read', () => {
  const reading = { readOnlyAt: () => true }

  it('offers no new scope, no new board, no settings, no removal and no Make…', async () => {
    renderApp({
      repositories: heldRepositories([organisation(), scope('retail', 'Retail')]),
      today: TODAY,
      provider: reading,
    })
    await screen.findByTestId('scope-retail')
    expect(screen.queryByTestId('new-scope')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Settings for Retail' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Settings for Acme Logistics' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete Retail' })).toBeNull()
    // No sheet and no map yet, and nobody here may make one.
    await waitFor(() => expect(screen.getByTestId('open-decisions')).toBeDefined())
    expect(screen.queryByTestId('open-business')).toBeNull()
    expect(screen.queryByTestId('open-map')).toBeNull()
    // A landscape's home lists its boards and offers no new one.
    fireEvent.click(screen.getByTestId('open-retail'))
    await screen.findByTestId('boards')
    expect(screen.queryByTestId('new-board')).toBeNull()
  })

  it('still offers what a writer is offered where the source says the scope may be written', async () => {
    renderApp({
      repositories: heldRepositories([organisation(), scope('retail', 'Retail')]),
      today: TODAY,
      provider: { readOnlyAt: () => false },
    })
    await screen.findByTestId('scope-retail')
    expect(screen.getByTestId('new-scope')).toBeDefined()
    expect(screen.getByRole('button', { name: 'More for Retail' })).toBeDefined()
    expect((await screen.findByTestId('open-business')).textContent).toContain('Business architecture')
  })
})

/**
 * A page asked for on a scope that has no document: the root of a folder with
 * scopes under it and nothing of its own, say. It used to say it could not be
 * opened, twice.
 */
describe('the organisation screen — a scope with no document of its own', () => {
  it('opens the page that was asked for on it', async () => {
    const scopes = heldRepositories([scope('retail', 'Retail')])
    renderApp({ repositories: scopes, today: TODAY })
    fireEvent.click(await screen.findByTestId('open-decisions'))
    expect(await screen.findByText(/^No decisions in /)).toBeDefined()
    expect(await scopes.read('')).toBeDefined()
    expect(screen.queryByText('That scope could not be opened.')).toBeNull()
  })

  it('opens the page, and writes nothing, for somebody who may only read', async () => {
    const scopes = heldRepositories([scope('retail', 'Retail')])
    const before = (await scopes.read(''))?.revision
    renderApp({ repositories: scopes, today: TODAY, provider: { readOnlyAt: () => true } })
    fireEvent.click(await screen.findByTestId('open-decisions'))
    expect(await screen.findByText(/^No decisions in /)).toBeDefined()
    expect((await scopes.read(''))?.revision).toBe(before)
    expect(screen.queryByText('That scope could not be opened.')).toBeNull()
  })
})


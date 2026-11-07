// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * Every stable control name (`platform/controlNames.ts`) is on the rendered
 * app, on the screen that control belongs to: the same screens the axe checks
 * walk (`App.accessibility.test.tsx`), over the same shipped example, reached
 * the way a person reaches them. A name nobody draws any more fails here, and
 * so does a list entry that no screen below claims — which is what makes the
 * list a promise rather than a wish.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { cleanup, configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { heldRepositories } from './testing/heldRepositories'
import { laidOut } from '../model/testFixtures'
import { installReactFlowMocks } from '../editor/reactFlowTestSetup'
import { CONTROL_NAMES, controlSelector } from '../platform/controlNames'
import type { ControlName } from '../platform/controlNames'
import type { ScopeSnapshot } from '../projects/scope'
import { EXAMPLES, exampleScopes } from './testing/examples'
import { AlsoHere } from './frame/AppFrame'
import { renderApp, renderShell } from './testing/renderShell'
import { placePage, placePageNow } from './testing/placePage'

configure({ asyncUtilTimeout: 5_000 })
beforeAll(() => installReactFlowMocks())
afterEach(() => cleanup())

// The example as the organisation itself, as the axe checks file it — plus
// one decision on the organisation, so a landscape's decisions page has a
// record from above to show, one solution proven and not yet decided, so its
// gate offers the decision, and one outside application with no party. The
// solution being tested stays in testing: an experiment is planned for a
// shaped or testing solution only (ADR-0026), so that is where its button is.
const top = EXAMPLES[0].path
const example: ScopeSnapshot[] = exampleScopes(EXAMPLES[0]).map((scope) => {
  const path = scope.path === top ? '' : scope.path.slice(top.length + 1)
  return { ...scope, path }
})
const root = example.find((scope) => scope.path === '')!
root.model = {
  ...root.model,
  // The shipped example has an operating model, a type and two roles, for the crews on its chart; the
  // operating model's journey below starts from an organisation with none, so its empty state is met.
  unitTypes: [],
  roles: [],
  // One unit filed at the top that the sheet does not use, so its rail offers *All units*. Its type is
  // nobody's, like the crews' once the types above are gone.
  elements: [...root.model.elements, {
    id: 'back-office', kind: 'actor', name: 'Back office', unitTypeId: 'ut-office', lifecycle: 'live', isManaged: false, aspects: {},
  }],
  decisions: [{
    id: 'adr-from-above', number: 1, title: 'One register for the organisation', status: 'accepted',
    date: '2026-01-01', body: 'Context.', signers: [],
  } as never],
}
const landscape = example.find((scope) => scope.model.diagrams.some((diagram) => diagram.kind === 'layer7'))!
// One outside application nobody has said whose, which is what the record's
// *Belongs to* is for: the example names a party for every one.
landscape.model = {
  ...landscape.model,
  elements: landscape.model.elements.map((one) => (one.id === 'payments' ? { ...one, partyId: undefined } : one)),
  decisions: [...(landscape.model.decisions ?? []), {
    id: 'adr-open', number: 90, title: 'A proposal of its own', status: 'proposed', date: '2026-01-01', body: 'Why.', signers: [],
  } as never],
  solutions: (landscape.model.solutions ?? []).map((one) => (
    one.id === 'so-portal-dispatch' ? { ...one, state: 'proven', droppedFrom: undefined, dropNote: undefined } : one
  )),
}

/**
 * The organisation with its teams on a Conway map: two that say they work
 * together and run no interface, one they connect to with nothing said, and a
 * party that is no unit yet.
 */
function conwayAtTheTop(top: ScopeSnapshot): ScopeSnapshot {
  const team = (id: string, name: string, type: object = { unitTypeId: 'ut-team' }) => ({ id, kind: 'actor' as const, name, ...type, lifecycle: 'live' as const, isManaged: false, aspects: {} })
  const app = (id: string, partyId: string) => ({ id, kind: 'application' as const, name: `${id} app`, partyId, lifecycle: 'live' as const, isManaged: true, aspects: {} })
  return {
    ...top,
    activeDiagramId: 'cw',
    model: {
      ...top.model,
      unitTypes: [{ id: 'ut-team', name: 'Team', top: true, within: [], slots: [] }],
      elements: [
        ...top.model.elements, team('ops', 'Operations'), team('sales', 'Sales'), team('fin', 'Finance'), team('party', 'Carriers', {}),
        app('a-ops', 'ops'), app('a-fin', 'fin'), app('a-party', 'party'), app('a-sales', 'sales'),
        { ...app('a-loose', 'ops'), partyId: undefined },
      ],
      relations: [
        ...top.model.relations, { id: 'i-ops-sales', type: 'interacts', sourceId: 'ops', targetId: 'sales', mode: 'service' },
        { id: 'f-ops-fin', type: 'flow', sourceId: 'a-ops', targetId: 'a-fin', isBidirectional: false },
        { id: 'f-ops-party', type: 'flow', sourceId: 'a-ops', targetId: 'a-party', isBidirectional: false },
      ],
      diagrams: [...top.model.diagrams, { id: 'cw', kind: 'conway', name: 'Teams and systems', members: [] }],
    },
  }
}

/** A cell of the Conway grid that is there, by what it reads out. */
function pairCell(name: RegExp): HTMLElement {
  return within(document.querySelector<HTMLElement>('[data-guide="conway.grid"]')!).getAllByRole('gridcell', { name }).find((one) => !one.hasAttribute('data-absent'))!
}

/** The organisation open on a chart of one team that lacks the one role it must have: a finding to open. */
function chartWithAVacancy(top: ScopeSnapshot): ScopeSnapshot {
  const charted = chartAtTheTop(top)
  return {
    ...charted,
    model: {
      ...charted.model,
      roles: [{ id: 'ro-lead', name: 'Lead', duties: [] }],
      unitTypes: [{ id: 'ut-team', name: 'Team', top: true, within: ['ut-team'], slots: [{ role: 'ro-lead', min: 1 }] }],
    },
  }
}

/** The organisation open on a chart of one team, of a type a team may sit in. */
function chartAtTheTop(top: ScopeSnapshot): ScopeSnapshot {
  return {
    ...top,
    activeDiagramId: 'oc',
    model: {
      ...top.model,
      unitTypes: [{ id: 'ut-team', name: 'Team', top: true, within: ['ut-team'], slots: [] }],
      elements: [...top.model.elements, { id: 'ops', kind: 'actor' as const, name: 'Operations', unitTypeId: 'ut-team', lifecycle: 'live' as const, isManaged: false, aspects: {} }],
      diagrams: [...top.model.diagrams, { id: 'oc', kind: 'chart', name: 'Organisation', members: [] }],
    },
  }
}

/** The organisation open on a board with a division on it, a team inside: what deleting a unit asks (3.6.2). */
function divisionOnABoard(top: ScopeSnapshot): ScopeSnapshot {
  const unit = (id: string, name: string, over: object = {}) => ({ id, kind: 'actor' as const, name, lifecycle: 'live' as const, isManaged: false, aspects: {}, ...over })
  return {
    ...top,
    activeDiagramId: 'ub',
    model: {
      ...top.model,
      unitTypes: [{ id: 'ut-division', name: 'Division', top: true, within: [], slots: [] }, { id: 'ut-team', name: 'Team', within: ['ut-division'], slots: [] }],
      elements: [...top.model.elements, unit('north', 'North', { unitTypeId: 'ut-division' }), unit('booking', 'Booking', { unitTypeId: 'ut-team', parentId: 'north' })],
      diagrams: [...top.model.diagrams, laidOut({ id: 'ub', kind: 'layer7', name: 'Units', placements: [{ id: 'north', x: 0, y: 0 }] })],
    },
  }
}

/** A landscape open on a business sheet of its own: one with areas of the organisation's still to take up. */
function sheetBelow(scope: ScopeSnapshot): ScopeSnapshot {
  return {
    ...scope,
    activeDiagramId: 'sh-below',
    model: { ...scope.model, diagrams: [...scope.model.diagrams, { id: 'sh-below', kind: 'sheet', name: 'Our part', members: [] }] },
  }
}

function show(opened: boolean) {
  return renderApp({
    repositories: heldRepositories(example),
    boot: { initialProject: opened ? landscape : undefined },
  })
}

async function named(...names: ControlName[]) {
  for (const name of names) {
    await waitFor(() => expect(document.querySelector(controlSelector(name)), name).not.toBeNull())
  }
}

async function onBoard() {
  show(true)
  await waitFor(() => expect(document.querySelectorAll('.react-flow__node').length).toBeGreaterThan(0))
}

async function selectCard(id: string) {
  const card = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`)!
  card.focus()
  fireEvent.keyDown(card, { key: 'Enter' })
  return card
}

/** Open a page from the bar of the landscape that is open, by what its button says. */
async function page(label: string) {
  await onBoard()
  const bar = screen.getByTestId('frame-places')
  fireEvent.click(within(bar).getAllByRole('button').find((one) => one.textContent === label)!)
  return placePage()
}

/** An element's own page, where its record is laid out whole: Enter on the card that is selected. */
async function recordOf(id: string) {
  await onBoard()
  const card = await selectCard(id)
  fireEvent.keyDown(card, { key: 'Enter' })
  await screen.findByTestId('element-record')
}

/** A screen, the names that are on it, and how it is reached from where the journey stands. */
type Screen = readonly [string, readonly ControlName[], () => Promise<void>]

/**
 * Each journey through the app, one render apiece: the first screen of a
 * journey draws the app, and each after it is reached from the one before, by
 * the press a person makes there. A journey is what saves drawing the whole
 * example again for a screen one click away from the last (on the runner, a
 * board is seconds). The screens after the first add names the ones before
 * them do not draw, so a name held over from an earlier screen cannot answer
 * for a later one. The union is held to the list below, so a name added to
 * the list without a screen here fails as surely as a name taken off a screen.
 */
const JOURNEYS: readonly (readonly Screen[])[] = [
  [['the organisation’s home', [
    'shell.crumbs', 'org.tree', 'org.tree.row', 'org.newScope', 'org.cards', 'org.card.business', 'org.card.map',
    'org.card.decisions', 'org.card.observations', 'org.card.roadmap', 'org.card.register',
    'org.card.technology', 'org.card.landscape', 'org.card.people', 'org.card.operating', 'org.card.checks', 'org.attention',
    'org.attentionCount', 'org.card.principles', 'org.card.topics', 'org.relevantTopics', 'org.card.blocks',
  ], async () => {
    show(false)
    await screen.findByTestId('organisation-name')
  }],
  // Its findings, counted by weight: the Checks page from a count, on a check
  // whose instances may be marked as intended from where they are listed.
  ['the Checks page, from a count under Needs attention', ['checks.weight', 'checks.scope', 'checks.row', 'checks.instance', 'findings.markIntended'], async () => {
    fireEvent.click(await screen.findByTestId('attention-count-review'))
    await screen.findByTestId('checks-instances')
    const found = within(screen.getByTestId('checks-instances'))
    fireEvent.click(found.getAllByRole('row').find((row) => row.getAttribute('data-guide') === 'checks.instance')!)
  }]],
  // The topics catalogue (ADR-0042), opened from the organisation's card.
  [['the topics catalogue, from the organisation’s card', ['topics.new', 'page.seam'], async () => {
    show(false)
    fireEvent.click(await screen.findByTestId('open-topic-catalogue'))
    await screen.findByTestId('topics-catalogue', {}, { timeout: 5000 })
  }]],
  // The overflow menu's Help, and Connect an agent from it, in a browser tab: where the desktop app is had (ADR-0044 §6).
  [['the frame, on any screen', ['frame.find', 'frame.status', 'frame.home', 'frame.more', 'frame.agent', 'frame.help', 'frame.tree', 'frame.switcher'], async () => {
    show(false)
    await screen.findByTestId('frame-places')
  }], ['Your work', ['frame.yourWork'], async () => {
    fireEvent.click(await screen.findByTestId('saved-indicator'))
  }], ['Activity', ['frame.activity'], async () => {
    fireEvent.click(await screen.findByTestId('frame-activity'))
  }]],
  [['Help', ['shell.website'], async () => {
    show(false)
    fireEvent.click(await screen.findByRole('button', { name: /Help/ }))
  }], ['Connect an agent, from it', ['agent.download'], async () => {
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    fireEvent.click(await screen.findByTestId('overflow-button'))
    await screen.findByTestId('overflow-menu')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Connect an agent…' }))
    await screen.findByTestId('agent-desktop-only')
  }]],
  // The register of building blocks (ADR-0043), opened from the organisation's card.
  [['the building blocks, from the organisation’s card', ['blocks.new'], async () => {
    show(false)
    fireEvent.click(await screen.findByTestId('open-block-register'))
    await screen.findByText('Every building block in the organisation', {}, { timeout: 5000 })
  }]],
  // The organisation's principles (ADR-0041), opened from its card.
  [['the principles page, from the organisation’s card', ['principles.new'], async () => {
    show(false)
    fireEvent.click(await screen.findByTestId('open-principles'))
    await screen.findByTestId('principles-list', {}, { timeout: 5000 })
  }]],
  // Who serves a scope is said where the organisation has units: one at the
  // organisation, of a type it holds, serving a landscape by name — the
  // organisation itself is no domain, and its home has no *Served by*.
  [['a home served by a unit', ['org.servedBy'], async () => {
    const served = example.map((one) => (one.path === '' ? {
      ...one,
      model: {
        ...one.model,
        unitTypes: [{ id: 'ut-team', name: 'Team', top: true, within: [], slots: [] }],
        elements: [...one.model.elements, {
          id: 'ops', kind: 'actor' as const, name: 'Operations', unitTypeId: 'ut-team', lifecycle: 'live' as const, isManaged: false, aspects: {},
          scopes: [landscape.path],
        }],
      },
    } : one))
    renderApp({ repositories: heldRepositories(served) })
    fireEvent.click(await screen.findByTestId(`home-${landscape.path}`))
    await screen.findByTestId('served-by')
  }]],
  [['a landscape’s home', ['org.boards', 'org.newBoard'], async () => {
    show(false)
    fireEvent.click(await screen.findByTestId(`home-${landscape.path}`))
    await screen.findByTestId('boards')
  }]],
  [['the register', [
    'register.row', 'register.tabs', 'register.colMaster', 'register.colDrawn', 'register.colFindings', 'register.openRow',
  ], async () => {
    show(false)
    fireEvent.click(await screen.findByTestId('open-register'))
    const table = await screen.findByTestId('register-table')
    // Also drawn in starts hidden, and opening is the preview's.
    fireEvent.click(screen.getByRole('button', { name: /^View/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Also drawn in' }))
    fireEvent.click(within(table).getAllByRole('row', { hidden: true })[1]!)
  }]],
  [['the technology register', [
    'technologyRegister.row', 'technologyRegister.colMaster', 'technologyRegister.colFindings',
    'technologyRegister.openRow',
  ], async () => {
    show(false)
    fireEvent.click(await screen.findByTestId('open-technology'))
    const table = await screen.findByTestId('technology-register-table')
    // Kept in starts hidden there, and opening is the preview's.
    fireEvent.click(screen.getByRole('button', { name: /^View/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Kept in' }))
    fireEvent.click(within(table).getAllByRole('row', { hidden: true })[1]!)
  }]],
  [['the people register', ['people.row', 'people.add', 'people.importCsv', 'people.tabs', 'people.find', 'people.day'], async () => {
    const held = heldRepositories(example)
    await held.people.add({ name: 'Pia Schulz' })
    renderApp({ repositories: held })
    fireEvent.click(await screen.findByTestId('open-people'))
    await screen.findByTestId('people-table')
  }]],
  [['its privacy tab', ['people.policy'], async () => {
    renderApp({ repositories: heldRepositories(example) })
    fireEvent.click(await screen.findByTestId('open-people'))
    fireEvent.click(await screen.findByRole('tab', { name: 'Privacy' }))
    await screen.findByTestId('people-policy')
  }]],
  [['a person', ['people.person', 'people.correct', 'people.more'], async () => {
    const held = heldRepositories(example)
    await held.people.add({ name: 'Pia Schulz' })
    renderApp({ repositories: held })
    fireEvent.click(await screen.findByTestId('open-people'))
    await screen.findByTestId('people-table')
    fireEvent.click(document.querySelector('[data-guide="people.row"]') as HTMLElement)
    await screen.findByTestId('people-person')
  }]],
  [['its possible duplicates, reviewed', ['people.duplicates', 'people.duplicatePair', 'people.answered'], async () => {
    const held = heldRepositories(example)
    const ids: string[] = []
    for (const name of ['Pia Schulz', 'Pia Schultz', 'Yara Kok', 'Vera Kok']) {
      const added = await held.people.add({ name })
      if ('person' in added) ids.push(added.person.id)
    }
    await held.people.answerDistinct(ids[2], ids[3], '2026-10-11')
    renderApp({ repositories: held })
    fireEvent.click(await screen.findByTestId('open-people'))
    fireEvent.click(await screen.findByRole('tab', { name: /To review/ }))
    fireEvent.click(await screen.findByTestId('people-answered-toggle').catch(() => screen.getByTestId('people-duplicates')))
  }]],
  [['a landscape open on its board', [
    'shell.crumbs', 'shell.activity', 'board.canvas', 'board.palette', 'board.library', 'board.inspector',
  ], onBoard],
  ['a line being drawn', ['board.connect'], async () => {
    const card = await selectCard('billing')
    fireEvent.keyDown(card, { key: 'F10', shiftKey: true })
    const menu = await screen.findByRole('menu', { name: 'Element menu' })
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Start connection to/ }))
  }]],
  [['a landscape on its board, looked at on another day', ['board.day', 'board.look'], async () => {
    await onBoard()
    fireEvent.click(document.querySelector<HTMLElement>('[data-guide="board.day"]')!)
    fireEvent.click(await screen.findByText('Choose a day…'))
    fireEvent.change(document.querySelector('input[type="date"]')!, { target: { value: '2031-01-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Show this day' }))
    await screen.findByText(/Only on your screen/)
  }]],
  [['a landscape on its board, coloured by a reader’s own choice', ['board.keepLens'], async () => {
    await onBoard()
    fireEvent.click(await screen.findByLabelText('Colour by'))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Technology lifecycle' }))
    fireEvent.click(await screen.findByLabelText('Colour by'))
  }]],
  [['an application’s record', ['record.replace', 'record.uses'], () => recordOf('billing')]],
  [['an outside application’s record', ['record.party'], () => recordOf('payments')]],
  [['the business architecture, a capability chosen', [
    'sheet.canvas', 'sheet.unmapped', 'sheet.inspector', 'sheet.coverage', 'sheet.supportedBy', 'sheet.doneBy',
    'sheet.assignedTo', 'sheet.showResponsible', 'sheet.allUnits', 'sheet.domains',
  ], async () => {
    show(false)
    fireEvent.click(await screen.findByTestId('open-business'))
    await screen.findByTestId('sheet-canvas')
    await waitFor(() => expect(document.querySelector('[data-testid^="sheet-capability-"]')).not.toBeNull())
    fireEvent.click(document.querySelector<HTMLElement>('[data-testid^="sheet-capability-"]')!)
  }]],
  // A landscape's own sheet, which may take up what the organisation's sheet holds (ADR-0040 §5).
  [['a sheet below the organisation’s', ['sheet.fromAbove'], async () => {
    const sheeted = example.map((one) => (one.path === landscape.path ? sheetBelow(one) : one))
    renderApp({ repositories: heldRepositories(sheeted), boot: { initialProject: sheeted.find((one) => one.path === landscape.path)! } })
    await screen.findByTestId('sheet-canvas')
  }]],
  [['the enterprise map', ['map.grid', 'map.summary'], async () => {
    show(false)
    fireEvent.click(await screen.findByTestId('open-map'))
  }]],
  // The register lists the solutions under its observations, so the proven
  // one is read from there before the tabs are changed.
  [['the observations, one of them read', [
    'observations.tabRegister', 'observations.tabAnalysis', 'observations.tabSolutions', 'observations.register',
    'observations.row', 'observations.new', 'observation.seenAgain', 'observation.merge', 'observation.cause',
    'observations.filters', 'observations.filterRow', 'observations.viewLocal', 'observations.tone', 'observations.mine',
  ], async () => {
    const dialog = await page('Observations')
    fireEvent.click((await within(dialog).findAllByTestId(/^observation-row-/))[0])
  }],
  ['a solution being tested, read', ['solution.planExperiment', 'solution.move'], async () => {
    const list = await within(placePageNow()!).findByTestId('solution-list')
    fireEvent.click(within(list).getAllByRole('button').find((one) => /carrier onboarding kit/i.test(one.textContent ?? ''))!)
  }],
  ['a proven solution, read', ['solution.decide'], async () => {
    const list = within(placePageNow()!).getByTestId('solution-list')
    fireEvent.click(within(list).getAllByRole('button').find((one) => /let the portal show the estimate/i.test(one.textContent ?? ''))!)
  }]],
  // The page's other two tabs and its form, a journey of their own: as one
  // with the register's, it ran past its limit on GitHub's runner.
  [['the analysis', ['observations.picture', 'observations.size'], async () => {
    const dialog = await page('Observations')
    fireEvent.click(await within(dialog).findByTestId('observation-tab-analysis'))
  }],
  ['a cause, read', ['cause.root'], async () => {
    const picture = await within(placePageNow()!).findByTestId('analysis-picture')
    fireEvent.click((await within(picture).findAllByTestId('analysis-cause'))[0])
  }],
  ['the solutions', ['solutions.new', 'solutions.phases'], async () => {
    fireEvent.click(await within(placePageNow()!).findByTestId('observation-tab-solutions'))
  }],
  // A cause starts from what it explains: the form's New cause, not the bar's.
  ['a new observation being written', [
    'observations.newCause', 'observationForm.causes', 'observationForm.existingCause', 'observationForm.record',
    'observationForm.description', 'observationForm.tone',
  ], async () => {
    const page = placePageNow()!
    fireEvent.click(within(page).getByTestId('observation-tab-register'))
    fireEvent.click(within(page).getByRole('button', { name: 'New observation' }))
    await screen.findByRole('region', { name: 'New observation' }).catch(() => screen.findByRole('dialog', { name: 'New observation' }))
  }]],
  // The merge screen, over the observations page, on the record read.
  [['the merge screen, opened on an observation', [
    'merge.search', 'merge.across', 'merge.survivor', 'merge.what', 'merge.values', 'merge.links', 'merge.confirm',
  ], async () => {
    const dialog = await page('Observations')
    fireEvent.click((await within(dialog).findAllByTestId(/^observation-row-/))[0])
    fireEvent.click(dialog.querySelector<HTMLElement>(controlSelector('observation.merge'))!)
    await screen.findByRole('region', { name: 'Merge observations' })
  }]],
  // The move screen, over the observations page, on the record read (ADR-0038 §5).
  [['the move screen, opened on an observation', [
    'observation.move', 'move.what', 'move.target', 'move.search', 'move.cut', 'move.confirm',
  ], async () => {
    const dialog = await page('Observations')
    fireEvent.click((await within(dialog).findAllByTestId(/^observation-row-/))[0])
    fireEvent.click(dialog.querySelector<HTMLElement>(controlSelector('observation.move'))!)
    await screen.findByRole('region', { name: 'Move an observation to another scope' })
  }]],
  [['the decisions, one from above read', [
    'decisions.list', 'decisions.row', 'decisions.new', 'decisions.filter', 'decisions.fromAbove', 'decision.status', 'decision.signers', 'decision.record', 'decision.more',
  ], async () => {
    const dialog = await page('Decisions')
    const list = await within(dialog).findByTestId('adr-list')
    fireEvent.click(await within(list).findByText(/From Acme Logistics/))
    fireEvent.click((await within(list).findAllByText('One register for the organisation'))[0])
  }],
  // A record from above is read, not moved; the landscape's own accepted one
  // offers the move the state machine allows.
  ['one of its own decisions, read', ['decision.move', 'decision.next'], async () => {
    fireEvent.click(document.querySelector<HTMLElement>('[data-guide="decision.record"] [aria-label="Close"]')!)
    await waitFor(() => expect(document.querySelector('[data-guide="decision.record"]')).toBeNull())
    const dialog = placePageNow()!
    fireEvent.click((await within(dialog).findAllByText('A proposal of its own'))[0])
  }],
  ['and written', ['decision.writing'], async () => {
    fireEvent.click(await screen.findByRole('button', { name: 'Edit text' }))
  }]],
  [['the roadmap', ['roadmap.newPlan', 'roadmap.findings', 'roadmap.axis'], async () => {
    await page('Roadmap')
  }],
  ['a plan', ['plan.addElement', 'plan.milestone', 'plan.addDecision', 'plan.page', 'plan.status', 'plan.move', 'plan.editText'], async () => {
    fireEvent.click((await within(placePageNow()!).findAllByRole('button', { name: /^TR-\d+ / }))[0])
    fireEvent.click(await within(placePageNow()!).findByRole('button', { name: 'Open plan' }))
  }]],
  // The operating model, from the organisation's card, empty: a library
  // brought in from its dialog, so the matrix has a column to press.
  [['the operating model', [
    'operating.tabUnits', 'operating.tabRaci', 'operating.tabLibraries', 'operating.newUnitType', 'operating.newRole',
    'operating.rules', 'operating.structure', 'operating.startFromLibrary',
  ], async () => {
    show(false)
    fireEvent.click(await screen.findByTestId('open-operating'))
    await screen.findByRole('tab', { name: 'Units and roles' })
  }],
  ['its dialog for a library', ['operating.libraryList', 'operating.comingIn', 'operating.bringIn'], async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Start from a library' }))
    fireEvent.click(within(await screen.findByTestId('library-dialog')).getByRole('checkbox', { name: 'Scrum Team' }))
  }],
  // What came in, drawn as the structure, with a type picked.
  ['its structure', ['operating.typeCard', 'operating.typeOrder', 'operating.fromLibrary'], async () => {
    fireEvent.click(within(screen.getByTestId('library-dialog')).getByRole('button', { name: /^Bring in 8 items/ }))
    await waitFor(() => expect(screen.queryByTestId('library-dialog')).toBeNull())
    fireEvent.click(await within(screen.getByTestId('structure-lanes')).findByRole('button', { name: 'Scrum Team' }))
  }],
  ['its libraries', ['operating.compare', 'operating.cameIn'], async () => {
    fireEvent.click(screen.getByRole('tab', { name: 'Libraries' }))
    await screen.findByTestId('library-scrum')
  }],
  ['its responsibilities', [
    'operating.newResponsibility', 'operating.matrix', 'operating.cell', 'operating.filterRoles', 'operating.filterGroups', 'operating.matrixOrder',
    'operating.groupOrder',
  ], async () => {
    fireEvent.click(screen.getByRole('tab', { name: 'Responsibilities' }))
  }]],
  // A journey of its own, so the one above stays well inside its time on a slow
  // runner: Scrum brought in, then a responsibility picked in the matrix and a
  // role, each with its place in the own order.
  [['the operating model with a library in it', [], async () => {
    show(false)
    fireEvent.click(await screen.findByTestId('open-operating'))
    fireEvent.click(await screen.findByRole('button', { name: 'Start from a library' }))
    const dialog = await screen.findByTestId('library-dialog')
    fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Scrum Team' }))
    fireEvent.click(within(dialog).getByRole('button', { name: /^Bring in 8 items/ }))
    await waitFor(() => expect(screen.queryByTestId('library-dialog')).toBeNull())
  }],
  ['a responsibility picked', ['operating.responsibilityOrder'], async () => {
    fireEvent.click(screen.getByRole('tab', { name: 'Responsibilities' }))
    fireEvent.click(within(screen.getAllByRole('rowheader')[0]).getByRole('button'))
  }],
  ['a role picked', ['operating.roleOrder'], async () => {
    fireEvent.click(within(screen.getByRole('table')).getByRole('button', { name: 'Scrum Master' }))
  }]],
  // An organisation chart, made on a landscape's home: the example has no
  // units, and the outline, the bar and the summary beside it are drawn all the same.
  [['an organisation chart', [
    'chart.outline', 'chart.foldAll', 'chart.unfoldAll', 'chart.showOptional', 'chart.summary', 'chart.addAtTop', 'chart.outlineAdd', 'chart.addFirst',
    'chart.showLines',
  ], async () => {
    show(false)
    fireEvent.click(await screen.findByTestId(`home-${landscape.path}`))
    fireEvent.click(await screen.findByTestId('new-board'))
    fireEvent.click(await screen.findByTestId('new-board-chart'))
    await screen.findByTestId('chart-page')
  }]],
  // A chart of the organisation's own teams: a unit's + makes a unit inside it, in a dialog.
  [['an organisation chart with a unit', ['chart.addInside', 'chart.moveTo'], async () => {
    const charted = example.map((one) => (one.path === '' ? chartAtTheTop(one) : one))
    renderApp({ repositories: heldRepositories(charted), boot: { initialProject: charted.find((one) => one.path === '')! } })
    await screen.findAllByTestId('chart-add-inside')
  }],
  ['its dialog for a new unit', ['chart.newUnit'], async () => {
    fireEvent.click(screen.getAllByTestId('chart-add-inside')[0])
    await screen.findByTestId('new-unit-dialog')
  }]],
  // A unit picked on the chart: Move to… in the outline, Sits under in its inspector, and the dialog they open (3.7.1).
  [['a unit picked on the chart', ['chart.outlineMoveTo', 'unit.sitsUnder'], async () => {
    const charted = example.map((one) => (one.path === '' ? chartAtTheTop(one) : one))
    renderApp({ repositories: heldRepositories(charted), boot: { initialProject: charted.find((one) => one.path === '')! } })
    fireEvent.click((await screen.findAllByTestId('chart-unit-open'))[0])
    await screen.findByTestId('unit-sits-under-move')
  }],
  ['its dialog for a move', ['chart.moveUnit'], async () => {
    fireEvent.click(screen.getByTestId('chart-outline-move-to'))
    await screen.findByTestId('move-unit-dialog')
  }]],
  // Deleting a unit with a unit inside it, from its card's Remove / delete… (3.6.2).
  [['a unit asked to be deleted', ['unitDelete.end', 'unitDelete.inside'], async () => {
    const boarded = example.map((one) => (one.path === '' ? divisionOnABoard(one) : one))
    renderApp({ repositories: heldRepositories(boarded), boot: { initialProject: boarded.find((one) => one.path === '')! } })
    await waitFor(() => expect(document.querySelector('.react-flow__node[data-id="north"]')).not.toBeNull())
    await selectCard('north')
    fireEvent.click(await screen.findByRole('button', { name: 'Remove / delete…' }))
    await screen.findByTestId('unit-deletion')
  }]],
  // A Conway map: the verdict and the grid, the panel on nothing, on a pair and on a unit, and the second reading.
  [['a Conway map', ['conway.verdict', 'conway.reading', 'conway.groupBy', 'conway.findMe', 'conway.grid', 'conway.reader', 'findings.showNotes'], async () => {
    const teams = example.map((one) => (one.path === '' ? conwayAtTheTop(one) : one))
    renderApp({ repositories: heldRepositories(teams), boot: { initialProject: teams.find((one) => one.path === '')! } })
    await screen.findByTestId('conway-findings')
  }],
  ['its notes shown', ['conway.finding'], async () => {
    fireEvent.click(screen.getByTestId('conway-show-notes'))
    await screen.findByText('Operations and Sales', { exact: false })
  }],
  ['an application nobody owns', ['conway.owners'], async () => {
    fireEvent.click(await screen.findByText('a-loose app'))
    await screen.findByTestId('conway-owners')
  }],
  ['two units with nothing between their systems', ['conway.removeSaid', 'conway.modelInterface', 'findings.markIntended'], async () => {
    fireEvent.click(screen.getByTestId('conway-all'))
    await screen.findByTestId('conway-findings')
    fireEvent.click(pairCell(/Operations.*Sales|Sales.*Operations/))
    await screen.findByTestId('finding-mark')
  }],
  ['marked as intended', ['findings.accepted'], async () => {
    fireEvent.click(screen.getByTestId('finding-mark'))
    fireEvent.click(await screen.findByTestId('finding-mark-confirm'))
    fireEvent.click(await screen.findByTestId('conway-all'))
  }],
  ['what was accepted, unfolded', ['findings.takeBack'], async () => {
    fireEvent.click(await screen.findByTestId('findings-accepted-toggle'))
  }],
  ['two units that have said nothing', ['conway.sayHow', 'conway.planAway'], async () => {
    fireEvent.click(pairCell(/Finance.*Operations|Operations.*Finance/))
    await screen.findByRole('button', { name: /plan it away/ })
  }],
  ['a party that is no unit yet', ['conway.makeUnits'], async () => {
    fireEvent.click(pairCell(/Carriers.*Operations|Operations.*Carriers/))
    await screen.findByTestId('conway-make-units')
  }],
  ['a unit', ['conway.addInteraction'], async () => {
    fireEvent.click(within(document.querySelector<HTMLElement>('[data-guide="conway.grid"]')!).getByRole('rowheader', { name: /Sales/ }))
    await screen.findByTestId('unit-interaction-add')
  }],
  ['its lines', ['conway.show', 'conway.showUnowned'], async () => {
    fireEvent.click(screen.getByRole('radio', { name: 'Lines' }))
    await screen.findByTestId('conway-strip')
  }]],
  // A list of findings, on a chart whose one team lacks its role: unfolded, an instance opened.
  [['a chart with a finding, a check unfolded', ['findings.group', 'findings.instance'], async () => {
    const charted = example.map((one) => (one.path === '' ? chartWithAVacancy(one) : one))
    renderApp({ repositories: heldRepositories(charted), boot: { initialProject: charted.find((one) => one.path === '')! } })
    fireEvent.click(await within(await screen.findByTestId('chart-findings')).findByTestId('findings-group'))
  }],
  ['its finding, opened', ['findings.back', 'findings.action'], async () => {
    fireEvent.click(document.querySelector<HTMLElement>('[data-guide="findings.instance"]')!)
  }]],
  [['the technology landscape, a card chosen', [
    'landscape.servicesBand', 'landscape.sharedRow', 'landscape.inspector',
  ], async () => {
    show(false)
    fireEvent.click(await screen.findByTestId('open-technology-landscape'))
    await screen.findByTestId('landscape-shared-row')
    fireEvent.click(document.querySelector<HTMLElement>('[data-node]')!)
  }]],
]

describe('the stable control names', { timeout: 20_000 }, () => {
  it('are each claimed by a screen below, and every one claimed is on the list', () => {
    const claimed = new Set(JOURNEYS.flat().flatMap(([, names]) => names))
    claimed.add('shell.alsoHere')
    expect([...claimed].sort()).toEqual([...new Set(CONTROL_NAMES)].sort())
  })

  it.each(JOURNEYS.map((journey) => [journey.map(([label]) => label).join(', then '), journey] as const))(
    'are on %s', async (_label, journey) => {
      for (const [, names, reach] of journey) {
        await reach()
        await named(...names)
      }
    },
  )

  // Who else is here is said only while somebody is, which only a channel's
  // presence makes true: the row is drawn with a name, as the channel would.
  it('are on the row while somebody else is here', () => {
    renderShell(<AlsoHere names={['Ada']} s={(key) => key} />)
    expect(document.querySelector(controlSelector('shell.alsoHere'))?.textContent).toContain('shell.alsoHere')
  })
})

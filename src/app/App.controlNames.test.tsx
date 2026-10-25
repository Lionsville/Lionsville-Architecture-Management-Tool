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
import { ShellToolbar } from './ShellToolbar'
import { renderApp, renderShell } from './testing/renderShell'

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
  solutions: (landscape.model.solutions ?? []).map((one) => (
    one.id === 'so-portal-dispatch' ? { ...one, state: 'proven', droppedFrom: undefined, dropNote: undefined } : one
  )),
}

/** The organisation with two teams that declare they work together and run no interface, open on a Conway map. */
function conwayAtTheTop(top: ScopeSnapshot): ScopeSnapshot {
  const team = (id: string, name: string) => ({ id, kind: 'actor' as const, name, unitTypeId: 'ut-team', lifecycle: 'live' as const, isManaged: false, aspects: {} })
  return {
    ...top,
    activeDiagramId: 'cw',
    model: {
      ...top.model,
      unitTypes: [{ id: 'ut-team', name: 'Team', top: true, within: [], slots: [] }],
      elements: [...top.model.elements, team('ops', 'Operations'), team('sales', 'Sales')],
      relations: [...top.model.relations, { id: 'i-ops-sales', type: 'interacts', sourceId: 'ops', targetId: 'sales', mode: 'service' }],
      diagrams: [...top.model.diagrams, { id: 'cw', kind: 'conway', name: 'Teams and systems', members: [] }],
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
  const bar = screen.getByTestId('shell-toolbar')
  fireEvent.click(within(bar).getAllByRole('button').find((one) => one.textContent === label)!)
  return screen.findByRole('dialog')
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
    'org.attentionCount',
  ], async () => {
    show(false)
    await screen.findByTestId('organisation-name')
  }],
  // Its findings, counted by weight: the Checks page from a count, on a check
  // whose instances may be marked as intended from where they are listed.
  ['the Checks page, from a count under Needs attention', ['checks.weight', 'checks.row', 'checks.instance', 'findings.markIntended'], async () => {
    fireEvent.click(await screen.findByTestId('attention-count-review'))
    await screen.findByTestId('checks-instances')
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
    'register.row', 'register.colMaster', 'register.colDrawn', 'register.colFindings', 'register.openRow',
  ], async () => {
    show(false)
    fireEvent.click(await screen.findByTestId('open-register'))
    await screen.findByTestId('register-table')
  }]],
  [['the technology register', [
    'technologyRegister.row', 'technologyRegister.colMaster', 'technologyRegister.colFindings',
    'technologyRegister.openRow',
  ], async () => {
    show(false)
    fireEvent.click(await screen.findByTestId('open-technology'))
    await screen.findByTestId('technology-register-table')
  }]],
  [['the people register', ['people.row', 'people.add', 'people.importCsv', 'people.policy'], async () => {
    const held = heldRepositories(example)
    await held.people.add({ name: 'Pia Schulz' })
    renderApp({ repositories: held })
    fireEvent.click(await screen.findByTestId('open-people'))
    await screen.findByTestId('people-table')
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
    fireEvent.click(await screen.findByTestId('people-duplicates-review'))
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
    const list = await within(screen.getByRole('dialog')).findByTestId('solution-list')
    fireEvent.click(within(list).getAllByRole('button').find((one) => /carrier onboarding kit/i.test(one.textContent ?? ''))!)
  }],
  ['a proven solution, read', ['solution.decide'], async () => {
    const list = within(screen.getByRole('dialog')).getByTestId('solution-list')
    fireEvent.click(within(list).getAllByRole('button').find((one) => /let the portal show the estimate/i.test(one.textContent ?? ''))!)
  }],
  ['the analysis', ['observations.picture', 'observations.size'], async () => {
    fireEvent.click(await within(screen.getByRole('dialog')).findByTestId('observation-tab-analysis'))
  }],
  ['a cause, read', ['cause.root'], async () => {
    const picture = await within(screen.getByRole('dialog')).findByTestId('analysis-picture')
    fireEvent.click((await within(picture).findAllByTestId('analysis-cause'))[0])
  }],
  ['the solutions', ['solutions.new', 'solutions.phases'], async () => {
    fireEvent.click(await within(screen.getByRole('dialog')).findByTestId('observation-tab-solutions'))
  }],
  // A cause starts from what it explains: the form's New cause, not the bar's.
  ['a new observation being written', [
    'observations.newCause', 'observationForm.causes', 'observationForm.existingCause', 'observationForm.record',
    'observationForm.description', 'observationForm.tone',
  ], async () => {
    const page = screen.getByRole('dialog')
    fireEvent.click(within(page).getByTestId('observation-tab-register'))
    fireEvent.click(within(page).getByRole('button', { name: 'New observation' }))
    await screen.findByRole('dialog', { name: 'New observation' })
  }]],
  // The merge screen, over the observations page, on the record read.
  [['the merge screen, opened on an observation', [
    'merge.search', 'merge.across', 'merge.survivor', 'merge.what', 'merge.values', 'merge.links', 'merge.confirm',
  ], async () => {
    const dialog = await page('Observations')
    fireEvent.click((await within(dialog).findAllByTestId(/^observation-row-/))[0])
    fireEvent.click(dialog.querySelector<HTMLElement>(controlSelector('observation.merge'))!)
    await screen.findByRole('dialog', { name: 'Merge observations' })
  }]],
  // The move screen, over the observations page, on the record read (ADR-0038 §5).
  [['the move screen, opened on an observation', [
    'observation.move', 'move.what', 'move.target', 'move.search', 'move.cut', 'move.confirm',
  ], async () => {
    const dialog = await page('Observations')
    fireEvent.click((await within(dialog).findAllByTestId(/^observation-row-/))[0])
    fireEvent.click(dialog.querySelector<HTMLElement>(controlSelector('observation.move'))!)
    await screen.findByRole('dialog', { name: 'Move an observation to another scope' })
  }]],
  [['the decisions, one from above read', [
    'decisions.list', 'decisions.row', 'decisions.new', 'decisions.fromAbove', 'decision.status', 'decision.signers',
  ], async () => {
    const dialog = await page('Decisions')
    await within(dialog).findByTestId('adr-list')
    const scopes = within(dialog).getAllByTestId(/^adr-scope-/)
    fireEvent.click(scopes.find((one) => one.textContent?.includes('Acme Logistics'))!)
    fireEvent.click((await within(dialog).findAllByText('One register for the organisation'))[0])
  }],
  // A record from above is read, not moved; the landscape's own accepted one
  // offers the move the state machine allows.
  ['one of its own decisions, read', ['decision.move'], async () => {
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByTestId('adr-scope-landscape'))
    fireEvent.click((await within(dialog).findAllByText('One place where a price is decided'))[0])
  }]],
  [['the roadmap', ['roadmap.newPlan', 'roadmap.findings'], async () => {
    await page('Roadmap')
  }],
  ['a plan', ['plan.addElement', 'plan.milestone', 'plan.addDecision'], async () => {
    fireEvent.click((await within(screen.getByRole('dialog')).findAllByTestId('plan-band'))[0])
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
  // A list of findings, on a Conway map whose two teams declare they work
  // together and run no interface: a note, hidden until its switch shows it,
  // opened, marked as intended — kept here, through the open scope's session —
  // and listed under Accepted, where it is taken back.
  [['a Conway map', ['findings.showNotes'], async () => {
    const teams = example.map((one) => (one.path === '' ? conwayAtTheTop(one) : one))
    renderApp({ repositories: heldRepositories(teams), boot: { initialProject: teams.find((one) => one.path === '')! } })
    await screen.findByTestId('conway-findings')
  }],
  ['its notes shown, a check unfolded', ['findings.group', 'findings.instance'], async () => {
    fireEvent.click(screen.getByRole('switch', { name: /^Show notes/ }))
    fireEvent.click(await within(document.querySelector<HTMLElement>('[data-check="check.interactionUnused"]')!).findByTestId('findings-group'))
  }],
  ['an unused interaction, opened', ['findings.back', 'findings.action', 'findings.markIntended'], async () => {
    fireEvent.click(document.querySelector<HTMLElement>('[data-check="check.interactionUnused"] [data-guide="findings.instance"]')!)
  }],
  ['marked as intended', ['findings.accepted'], async () => {
    fireEvent.click(screen.getByTestId('finding-mark'))
    fireEvent.click(await screen.findByTestId('finding-mark-confirm'))
  }],
  ['what was accepted, unfolded', ['findings.takeBack'], async () => {
    fireEvent.click(await screen.findByTestId('findings-accepted-toggle'))
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
  // presence makes true: the bar is drawn with a name, as the channel would.
  it('are on the bar while somebody else is here', () => {
    renderShell(
      <ShellToolbar
        designName="Landscape" crumbs={[]} scopePath="landscape" savedAt={null} alsoHere={['Ada']}
        language="en" onGoHome={() => {}} onOpenSettings={() => {}} onOpenDocumentation={() => {}}
        onOpenDecisions={() => {}} onOpenObservations={() => {}} onOpenRoadmap={() => {}}
        onOpenSearch={() => {}} activity={() => []} s={(key) => key}
      />,
    )
    expect(document.querySelector(controlSelector('shell.alsoHere'))?.textContent).toContain('shell.alsoHere')
  })
})

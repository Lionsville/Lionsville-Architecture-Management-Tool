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
import { InMemoryScopeStore } from '../adapters/memory/InMemoryScopeStore'
import { installReactFlowMocks } from '../editor/reactFlowTestSetup'
import { CONTROL_NAMES, controlSelector } from '../platform/controlNames'
import type { ControlName } from '../platform/controlNames'
import type { ScopeSnapshot } from '../projects/scope'
import { EXAMPLES, exampleScopes } from './examples'
import { ShellToolbar } from './ShellToolbar'
import { renderApp, renderShell } from './testing/renderShell'

configure({ asyncUtilTimeout: 5_000 })
beforeAll(() => installReactFlowMocks())
afterEach(() => cleanup())

// The example as the organisation itself, as the axe checks file it — plus
// one decision on the organisation, so a landscape's decisions page has a
// record from above to show, one solution proven and not yet decided, so its
// gate offers the decision, and one outside application with no party.
const top = EXAMPLES[0].path
const example: ScopeSnapshot[] = exampleScopes(EXAMPLES[0]).map((scope) => {
  const path = scope.path === top ? '' : scope.path.slice(top.length + 1)
  return { ...scope, path }
})
const root = example.find((scope) => scope.path === '')!
root.model = {
  ...root.model,
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
  solutions: (landscape.model.solutions ?? []).map((one) => (one.state === 'testing' ? { ...one, state: 'proven' } : one)),
}

function show(opened: boolean) {
  return renderApp({
    scopes: new InMemoryScopeStore(example),
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

/**
 * Each screen, the names that are on it, and how it is reached. The union is
 * held to the list below, so a name added to the list without a screen here
 * fails as surely as a name taken off a screen.
 */
const SCREENS: readonly [string, readonly ControlName[], () => Promise<void>][] = [
  ['the organisation’s home', [
    'shell.crumbs', 'org.tree', 'org.tree.row', 'org.cards', 'org.card.business', 'org.card.map',
    'org.card.decisions', 'org.card.observations', 'org.card.roadmap', 'org.card.register',
    'org.card.technology', 'org.card.landscape', 'org.attention', 'org.attentionMore',
  ], async () => {
    show(false)
    await screen.findByTestId('organisation-name')
  }],
  ['a landscape’s home', ['org.boards', 'org.newBoard'], async () => {
    show(false)
    fireEvent.click(await screen.findByTestId(`home-${landscape.path}`))
    await screen.findByTestId('boards')
  }],
  ['the register', [
    'register.row', 'register.colMaster', 'register.colDrawn', 'register.colFindings', 'register.openRow',
  ], async () => {
    show(false)
    fireEvent.click(await screen.findByTestId('open-register'))
    await screen.findByTestId('register-table')
  }],
  ['the technology register', [
    'technologyRegister.row', 'technologyRegister.colMaster', 'technologyRegister.colFindings',
    'technologyRegister.openRow',
  ], async () => {
    show(false)
    fireEvent.click(await screen.findByTestId('open-technology'))
    await screen.findByTestId('technology-register-table')
  }],
  ['a landscape open on its board', [
    'shell.crumbs', 'shell.activity', 'board.canvas', 'board.palette', 'board.library', 'board.inspector',
  ], onBoard],
  ['a line being drawn', ['board.connect'], async () => {
    await onBoard()
    const card = await selectCard('billing')
    fireEvent.keyDown(card, { key: 'F10', shiftKey: true })
    const menu = await screen.findByRole('menu', { name: 'Element menu' })
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Start connection to/ }))
  }],
  ['an application’s record', ['record.replace', 'record.uses'], () => recordOf('billing')],
  ['an outside application’s record', ['record.party'], () => recordOf('payments')],
  ['the business architecture, a capability chosen', [
    'sheet.canvas', 'sheet.unmapped', 'sheet.inspector', 'sheet.coverage', 'sheet.supportedBy', 'sheet.doneBy',
  ], async () => {
    show(false)
    fireEvent.click(await screen.findByTestId('open-business'))
    await screen.findByTestId('sheet-canvas')
    await waitFor(() => expect(document.querySelector('[data-testid^="sheet-capability-"]')).not.toBeNull())
    fireEvent.click(document.querySelector<HTMLElement>('[data-testid^="sheet-capability-"]')!)
  }],
  ['the enterprise map', ['map.grid', 'map.summary'], async () => {
    show(false)
    fireEvent.click(await screen.findByTestId('open-map'))
  }],
  ['the observations, one of them read', [
    'observations.tabRegister', 'observations.tabAnalysis', 'observations.tabSolutions', 'observations.register',
    'observations.new', 'observations.newCause', 'observation.seenAgain', 'observation.merge',
  ], async () => {
    const dialog = await page('Observations')
    fireEvent.click((await within(dialog).findAllByTestId(/^observation-row-/))[0])
  }],
  ['the analysis', ['observations.picture'], async () => {
    const dialog = await page('Observations')
    fireEvent.click(await within(dialog).findByTestId('observation-tab-analysis'))
  }],
  ['the solutions', ['solutions.new', 'solutions.phases'], async () => {
    const dialog = await page('Observations')
    fireEvent.click(await within(dialog).findByTestId('observation-tab-solutions'))
  }],
  ['a proven solution, read', ['solution.planExperiment', 'solution.decide'], async () => {
    const dialog = await page('Observations')
    const list = await within(dialog).findByTestId('solution-list')
    fireEvent.click(within(list).getAllByRole('button').find((one) => /carrier onboarding kit/i.test(one.textContent ?? ''))!)
  }],
  ['the decisions, one from above read', [
    'decisions.list', 'decisions.new', 'decisions.fromAbove', 'decision.status', 'decision.signers',
  ], async () => {
    const dialog = await page('Decisions')
    await within(dialog).findByTestId('adr-list')
    const scopes = within(dialog).getAllByTestId(/^adr-scope-/)
    fireEvent.click(scopes.find((one) => one.textContent?.includes('Acme Logistics'))!)
    fireEvent.click((await within(dialog).findAllByText('One register for the organisation'))[0])
  }],
  ['the roadmap', ['roadmap.newPlan', 'roadmap.findings'], async () => {
    await page('Roadmap')
  }],
  ['a plan', ['plan.addElement', 'plan.milestone', 'plan.addDecision'], async () => {
    const dialog = await page('Roadmap')
    fireEvent.click((await within(dialog).findAllByTestId('plan-band'))[0])
  }],
  ['the technology landscape, a card chosen', [
    'landscape.servicesBand', 'landscape.sharedRow', 'landscape.inspector',
  ], async () => {
    show(false)
    fireEvent.click(await screen.findByTestId('open-technology-landscape'))
    await screen.findByTestId('landscape-shared-row')
    fireEvent.click(document.querySelector<HTMLElement>('[data-node]')!)
  }],
]

describe('the stable control names', { timeout: 20_000 }, () => {
  it('are each claimed by a screen below, and every one claimed is on the list', () => {
    const claimed = new Set(SCREENS.flatMap(([, names]) => names))
    claimed.add('shell.alsoHere')
    expect([...claimed].sort()).toEqual([...new Set(CONTROL_NAMES)].sort())
  })

  it.each(SCREENS)('are on %s', async (_screen, names, reach) => {
    await reach()
    await named(...names)
  })

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

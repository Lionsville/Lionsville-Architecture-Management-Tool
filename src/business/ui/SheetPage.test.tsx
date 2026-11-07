// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The sheet, on screen (ADR-0012 §6).
 *
 * The layout itself is pinned in `sheet.test.ts`, in rows and depths; what is
 * pinned here is what the page promises a reader — the four bands, a lane that
 * passes through rather than stopping, a step somebody outside does, what a
 * capability's footer says, and that nothing on it can be changed under
 * `readOnly`.
 *
 * And, since step 3c, that every band can be authored: each *+* dispatches the
 * action it should, what it made is selected with the cursor in its name, and
 * under `readOnly` there is not one of them on the page.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { SheetPage } from './SheetPage'
import type { SheetClaims } from './SheetPage'
import type { SheetActions, SheetResponsible } from './FunctionInspector'
import { renderShell } from '../../app/testing/renderShell'
import { axeFindings } from '../../app/testing/axe'
import { actor, shippingScope } from '../testFixtures'
import type { DesignDiagram, DesignModel, Relation } from '../../model'

afterEach(() => cleanup())

const SHEET: DesignDiagram = {
  id: 'sh-1',
  kind: 'sheet',
  name: 'Business architecture',
  journeyId: 'ship',
  lanes: ['key-account', 'partner'],
  areas: ['fulfilment', 'billing'],
  members: [],
  geometry: { nodes: [] },
}

function model(over: Partial<DesignModel> = {}): DesignModel {
  const { elements, relations } = shippingScope()
  return {
    name: 'Acme Logistics', diagrams: [SHEET], elements, relations, ...over,
  }
}

/** Every gesture, recorded; the four that make something answer with an id. */
function actions(): SheetActions {
  return {
    updateElement: vi.fn(),
    moveElement: vi.fn(),
    updateSheet: vi.fn(),
    onOpenElement: vi.fn(),
    addElement: vi.fn(() => 'made'),
    addJourney: vi.fn(() => 'made'),
    addArea: vi.fn(() => 'made'),
    addLane: vi.fn(() => 'made'),
    removeElement: vi.fn(),
    setCoverage: vi.fn(),
  }
}

function open(over: {
  sheet?: DesignDiagram
  readOnly?: boolean
  model?: DesignModel
  elsewhere?: readonly Relation[]
  onOpenDocumentation?: (id: string) => void
  onSave?: (doc: { name: string; bytes: Uint8Array }) => void
  select?: { id: string; nonce: number }
  onHandle?: (handle: unknown) => void
  responsible?: SheetResponsible
  takenUp?: ReadonlySet<string>
  claims?: SheetClaims
} = {}) {
  const acts = actions()
  const result = renderShell(
    <SheetPage
      open
      model={over.model ?? model()}
      sheet={over.sheet ?? SHEET}
      readOnly={over.readOnly ?? false}
      actions={acts}
      elsewhere={over.elsewhere}
      onOpenDocumentation={over.onOpenDocumentation}
      onSave={over.onSave}
      {...(over.select ? { select: over.select } : {})}
      {...(over.onHandle ? { onHandle: over.onHandle } : {})}
      {...(over.responsible ? { responsible: over.responsible } : {})}
      {...(over.takenUp ? { takenUp: over.takenUp } : {})}
      {...(over.claims ? { claims: over.claims } : {})}
      onClose={() => {}}
    />,
  )
  return { ...result, actions: acts }
}

/** The journey and the rail are one press away each: a first look is the areas. */
function bands() {
  fireEvent.click(screen.getByRole('button', { name: 'Journey' }))
  fireEvent.click(screen.getByRole('button', { name: 'Stakeholders' }))
}

/** A capability's panel: its name is the panel's heading. */
const panelName = () => within(screen.getByTestId('sheet-inspector')).getByRole('heading', { level: 2 }).textContent ?? ''

describe('the sheet, as axe reads it', () => {
  it('finds nothing on the page, nor with the finder open on a word nothing matches', async () => {
    open()
    expect(await axeFindings()).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Find' }))
    fireEvent.change(screen.getByLabelText('Find on the page', { selector: 'input' }), { target: { value: 'zzz' } })
    expect(await axeFindings()).toEqual([])
    bands()
    fireEvent.click(screen.getByTestId('sheet-capability-picking'))
    expect(await axeFindings()).toEqual([])
  })

  it('finds nothing read-only', async () => {
    open({ readOnly: true })
    expect(await axeFindings()).toEqual([])
  })
})

describe('the stakeholder rail', () => {
  it('opens from the bar, names the parties, and says outside on the ones who are', () => {
    open()
    expect(screen.queryByTestId('sheet-rail')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Stakeholders' }))
    const rail = screen.getByTestId('sheet-rail')
    expect(within(rail).getByText('Warehouse team')).toBeTruthy()
    expect(within(rail).getByText(/Marketplace partner · outside/)).toBeTruthy()
  })

  it('is not offered when the sheet says the rail is off', () => {
    open({ sheet: { ...SHEET, showActors: false } })
    expect(screen.queryByRole('button', { name: 'Stakeholders' })).toBeNull()
  })

  it('is the page’s own state, and offered under readOnly, because it changes nothing', () => {
    const { actions: acts } = open({ readOnly: true })
    bands()
    expect(screen.getByTestId('sheet-rail')).toBeTruthy()
    expect(acts.updateSheet).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Stakeholders' }))
    expect(screen.queryByTestId('sheet-rail')).toBeNull()
  })

  it('has a seam to drag, and so does the panel', () => {
    open()
    bands()
    fireEvent.click(screen.getByTestId('sheet-capability-picking'))
    const rail = screen.getByRole('separator', { name: 'Resize the stakeholder rail' })
    fireEvent.keyDown(rail, { key: 'ArrowRight' })
    expect(rail.getAttribute('aria-valuenow')).toBe('208')
    const details = screen.getByRole('separator', { name: 'Resize the details' })
    fireEvent.keyDown(details, { key: 'ArrowLeft' })
    expect(details.getAttribute('aria-valuenow')).toBe('328')
  })
})

describe('finding something on the page', () => {
  const start = () => fireEvent.click(screen.getByRole('button', { name: 'Find' }))
  const field = () => screen.getByLabelText('Find on the page', { selector: 'input' })

  it('stays open, says how many, lights the hits and quiets the rest', () => {
    open()
    start()
    fireEvent.change(field(), { target: { value: 'pick' } })
    expect(within(screen.getByTestId('sheet-finder')).getByRole('status').textContent).toBe('3 found')
    expect(screen.getByTestId('sheet-canvas').hasAttribute('data-finding')).toBe(true)
    expect(screen.getByTestId('sheet-capability-picking').closest('.sheet-row')?.hasAttribute('data-hit')).toBe(true)
    expect(screen.getByTestId('sheet-capability-packing').closest('.sheet-row')?.hasAttribute('data-hit')).toBe(false)
    fireEvent.change(field(), { target: { value: 'nothing here' } })
    expect(within(screen.getByTestId('sheet-finder')).getByText('Nothing on this page matches.')).toBeTruthy()
  })

  it('walks the hits with the arrows and Enter, selecting and ringing each, and opens the band one sits in', () => {
    open()
    start()
    fireEvent.change(field(), { target: { value: 'rate' } })
    fireEvent.keyDown(field(), { key: 'Enter' })
    expect(panelName()).toBe('Apply the standard rate')
    expect(screen.getByTestId('sheet-step-standard-rate')).toBeTruthy()
    fireEvent.keyDown(field(), { key: 'ArrowDown' })
    expect(panelName()).toBe('Negotiate the rate')
    expect(within(screen.getByTestId('sheet-finder')).getByRole('status').textContent).toBe('2 of 2')
    const rules = Array.from(document.querySelectorAll('style')).map((style) => style.textContent ?? '').join('\n')
    expect(rules).toContain('[data-element-id="negotiate"]')
    fireEvent.keyDown(field(), { key: 'Escape' })
    expect(screen.queryByTestId('sheet-finder')).toBeNull()
  })

  it('is offered under readOnly, because looking changes nothing', () => {
    open({ readOnly: true })
    start()
    expect(field()).toBeTruthy()
  })
})

describe('the grid', () => {
  it('reflows in the window: paper says nothing about the screen', () => {
    open({ sheet: { ...SHEET, paper: 'A0', columns: 9 } })
    expect(screen.getByTestId('sheet-canvas').hasAttribute('data-width')).toBe(false)
    expect(screen.getByTestId('sheet-areas').className).toBe('sheet-areas')
  })

  it('moves an area’s width in print to its panel, as a change to the sheet', () => {
    const { actions: acts } = open({ sheet: { ...SHEET, areaSpans: { billing: 2 } } })
    fireEvent.click(within(screen.getByTestId('sheet-area-fulfilment')).getByRole('button', { name: 'Fulfilment' }))
    fireEvent.change(screen.getByLabelText('Width in print, in columns'), { target: { value: '2' } })
    expect(acts.updateSheet).toHaveBeenCalledWith({ areaSpans: { billing: 2, fulfilment: 2 } })
  })

  it('offers no width under readOnly', () => {
    open({ readOnly: true })
    fireEvent.click(within(screen.getByTestId('sheet-area-fulfilment')).getByRole('button', { name: 'Fulfilment' }))
    expect(screen.queryByLabelText('Width in print, in columns')).toBeNull()
  })
})

describe('the rows', () => {
  it('folds a parent with its caret, keeping its count, and the arrows do the same', () => {
    open()
    const group = screen.getByTestId('sheet-grouping-warehousing')
    expect(group.closest('.sheet-row')?.textContent).toMatch(/\d+\/\d+/)
    fireEvent.click(screen.getByRole('button', { name: 'Fold Warehousing' }))
    expect(screen.queryByTestId('sheet-capability-picking')).toBeNull()
    fireEvent.keyDown(group, { key: 'ArrowRight' })
    expect(screen.getByTestId('sheet-capability-picking')).toBeTruthy()
    fireEvent.keyDown(group, { key: 'ArrowLeft' })
    expect(screen.queryByTestId('sheet-capability-picking')).toBeNull()
  })

  it('walks the rows with the arrows', () => {
    open()
    const group = screen.getByTestId('sheet-grouping-warehousing')
    group.focus()
    fireEvent.keyDown(group, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(screen.getByTestId('sheet-capability-picking'))
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(group)
  })

  it('rings the row that is selected, and keeps a pick from reflowing anything', () => {
    open()
    fireEvent.click(screen.getByTestId('sheet-capability-picking'))
    expect(screen.getByTestId('sheet-capability-picking').closest('.sheet-row')?.hasAttribute('data-selected')).toBe(true)
    expect(screen.getByTestId('sheet-capability-picking').getAttribute('aria-current')).toBe('true')
  })
})

describe('the readings', () => {
  it('offers the poster, whose far distance is what Overview was, and every tile is there', () => {
    open()
    fireEvent.click(screen.getByRole('radio', { name: 'Poster' }))
    expect(screen.queryByTestId('sheet-areas')).toBeNull()
    expect(screen.getByTestId('sheet-poster')).toBeTruthy()
    expect(screen.getByTestId('poster-tile-picking').textContent).toContain('Picking')
    fireEvent.click(screen.getByRole('radio', { name: 'Names' }))
    expect(screen.getByTestId('sheet-areas')).toBeTruthy()
  })

  it('offers Coverage only where there is a way there', () => {
    open()
    expect(screen.queryByRole('radio', { name: 'Coverage' })).toBeNull()
  })
})

describe('one Colour lens', () => {
  const colour = () => screen.getByRole('button', { name: /^Colour/ })
  const pick = (name: string) => { fireEvent.click(colour()); fireEvent.click(screen.getByRole('menuitemcheckbox', { name })) }

  it('opens on Covered by, with the key counting what is drawn, and writes nothing', () => {
    const { actions: acts } = open()
    const key = screen.getByRole('group', { name: 'Key' })
    expect(within(key).getByRole('button', { name: /Nothing yet/ })).toBeTruthy()
    pick('Lifecycle')
    expect(acts.updateSheet).not.toHaveBeenCalled()
    expect(within(screen.getByRole('group', { name: 'Key' })).getByRole('button', { name: /Keep/ })).toBeTruthy()
  })

  it('keeps a lens with the view only when asked, and offers that to nobody who only reads', () => {
    const { actions: acts } = open()
    pick('Lifecycle')
    fireEvent.click(within(screen.getByRole('group', { name: 'Key' })).getByRole('button', { name: /Keep/ }))
    expect(acts.updateSheet).toHaveBeenCalledWith({ colourBy: 'lifecycle' })
    cleanup()
    open({ readOnly: true })
    pick('Lifecycle')
    expect(within(screen.getByRole('group', { name: 'Key' })).queryByRole('button', { name: /Keep/ })).toBeNull()
  })

  it('goes quiet on the rest when a value on the key is pressed', () => {
    open()
    fireEvent.click(within(screen.getByRole('group', { name: 'Key' })).getByRole('button', { name: /Nothing yet/ }))
    expect(screen.getByTestId('sheet-capability-picking').closest('.sheet-row')?.hasAttribute('data-dim')).toBe(true)
    expect(screen.getByTestId('sheet-capability-dunning').closest('.sheet-row')?.hasAttribute('data-dim')).toBe(false)
  })

  it('takes a numeric scale as a question, drawn in steps with its number, leaving an unrated row blank', () => {
    const held = model()
    const rated = { ...held, elements: held.elements.map((one) => (one.id === 'picking' ? { ...one, ratings: { maturity: 5 } } : one)) }
    renderShell(
      <SheetPage open model={rated} sheet={SHEET} readOnly={false} actions={actions()} onClose={() => {}} scales={[{ key: 'maturity', label: 'Maturity', min: 1, max: 5 }]} />,
    )
    pick('Maturity')
    const row = screen.getByTestId('sheet-capability-picking').closest('.sheet-row')
    expect(row?.getAttribute('data-heat')).toBe('5')
    expect(row?.textContent).toContain('5')
    expect(screen.getByTestId('sheet-capability-dunning').closest('.sheet-row')?.hasAttribute('data-heat')).toBe(false)
  })
})

describe('the day', () => {
  const dated = (): DesignModel => {
    const { elements, relations } = shippingScope()
    return { name: 'Acme Logistics', diagrams: [SHEET], elements, relations: relations.map((row) => (row.targetId === 'invoice' && row.type === 'supports' ? { ...row, validUntil: '2027-01-01' } as Relation : row)) }
  }

  it('reads coverage on the day looked at, and puts away every write until one press back', () => {
    open({ model: dated() })
    expect(screen.getByTestId('sheet-coverage-invoice').textContent).toBe('1 app')
    fireEvent.click(screen.getByRole('button', { name: 'Day' }))
    fireEvent.click(screen.getByRole('menuitem', { name: /Choose/ }))
    fireEvent.change(screen.getByLabelText('The day to look at'), { target: { value: '2028-01-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Show this day' }))
    expect(screen.getByText(/Looking at/)).toBeTruthy()
    expect(screen.queryByLabelText('New area')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Back to today' }))
    expect(screen.getByLabelText('New area')).toBeTruthy()
  })
})

describe('the way out', () => {
  it('opens a capability’s own page from the details', () => {
    const onOpenDocumentation = vi.fn()
    open({ onOpenDocumentation })
    fireEvent.click(screen.getByTestId('sheet-capability-picking'))
    fireEvent.click(screen.getByRole('button', { name: /Open the page of/ }))
    expect(onOpenDocumentation).toHaveBeenCalledWith('picking')
  })

  it('offers a picture only where the host can take one, under the ⋯', () => {
    open()
    fireEvent.click(screen.getByRole('button', { name: 'More for this sheet' }))
    expect(screen.queryByRole('menuitem', { name: 'Save as a picture…' })).toBeNull()
    cleanup()
    open({ onSave: vi.fn() })
    fireEvent.click(screen.getByRole('button', { name: 'More for this sheet' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Save as a picture…' }))
    expect(screen.getByRole('dialog', { name: 'Save the business architecture as a picture' })).toBeTruthy()
  })
})

describe('the journey band', () => {
  it('is one line until asked, saying the phases and how much it holds', () => {
    open()
    const band = screen.getByTestId('sheet-journey')
    expect(within(band).getByText(/Order · .*Deliver/)).toBeTruthy()
    expect(within(band).queryByTestId('sheet-phase-order')).toBeNull()
  })

  it('draws the phases across the top, in the journey’s order, once opened', () => {
    open()
    bands()
    const band = screen.getByTestId('sheet-journey')
    expect(within(band).getByTestId('sheet-phase-order').textContent).toBe('Order')
    expect(within(band).getByTestId('sheet-phase-deliver').textContent).toBe('Deliver')
  })

  it('gives the common path the first row and names it, and marks what is done outside', () => {
    open()
    bands()
    expect(within(screen.getByTestId('sheet-lane-common')).getByText('All customers')).toBeTruthy()
    expect(screen.getByLabelText('Partner fulfils — done outside the organisation')).toBeTruthy()
  })

  it('draws a row per lane, named after the actor whose path it is', () => {
    open()
    bands()
    expect(within(screen.getByTestId('sheet-lane-key-account')).getByText(/Key account/)).toBeTruthy()
    expect(screen.getByTestId('sheet-step-negotiate')).toBeTruthy()
  })

  it('says as above where a lane passes through, not a gap', () => {
    open()
    bands()
    expect(screen.getByTestId('sheet-passthrough-key-account-pick').textContent).toBe('as above')
    // Before the fork there is no line either: that row is not drawn there at all.
    expect(screen.queryByTestId('sheet-passthrough-key-account-order')).toBeNull()
  })

  it('offers a journey where the sheet has none yet, and only to who may make one', () => {
    open({ sheet: { ...SHEET, journeyId: undefined } })
    expect(screen.getByRole('button', { name: 'New journey' })).toBeTruthy()
    cleanup()
    open({ sheet: { ...SHEET, journeyId: undefined }, readOnly: true })
    expect(screen.queryByRole('button', { name: 'New journey' })).toBeNull()
  })
})

describe('the areas', () => {
  it('draws an area per column, with its groupings and capabilities inside', () => {
    open()
    const fulfilment = screen.getByTestId('sheet-area-fulfilment')
    expect(within(fulfilment).getByText('Fulfilment')).toBeTruthy()
    expect(within(fulfilment).getByTestId('sheet-grouping-warehousing')).toBeTruthy()
    expect(within(fulfilment).getByTestId('sheet-capability-picking')).toBeTruthy()
  })

  it('says under each capability what covers it', () => {
    open()
    expect(screen.getByTestId('sheet-coverage-picking').textContent).toBe('2 apps')
    expect(screen.getByTestId('sheet-coverage-invoice').textContent).toBe('1 app')
    expect(screen.getByTestId('sheet-coverage-packing').textContent).toBe('people')
    expect(screen.getByTestId('sheet-coverage-dunning').textContent).toBe('nothing yet')
  })

  /**
   * The organisation's own sheet, after ADR-0012 §2: the capabilities are
   * this scope's and the applications supporting them are a landscape's, so
   * the rows behind "2 apps" are not in the model this page was handed.
   */
  it('counts the rows another scope wrote about a capability this one defines', () => {
    const { elements, relations } = shippingScope()
    const ours = relations.filter((row) => row.type !== 'supports')
    // Without them, every capability on the organisation's page is people or
    // nothing; with them, the numbers are the ones the whole tree says.
    open({ model: model({ elements, relations: ours }) })
    expect(screen.getByTestId('sheet-coverage-picking').textContent).toBe('nothing yet')
    cleanup()

    const elsewhere = relations.filter((row) => row.type === 'supports')
    open({ model: model({ elements, relations: ours }), elsewhere })
    expect(screen.getByTestId('sheet-coverage-picking').textContent).toBe('2 apps')
  })

  it('counts a row it also holds itself once, not twice', () => {
    const { relations } = shippingScope()
    open({ elsewhere: relations })
    expect(screen.getByTestId('sheet-coverage-picking').textContent).toBe('2 apps')
  })

  it('marks an area handed to a domain no scope is, on its heading and in plain words', () => {
    const { elements, relations } = shippingScope()
    renderShell(
      <SheetPage
        open sheet={SHEET} readOnly={false} actions={actions()} onClose={() => {}}
        model={model({ elements: elements.map((e) => (e.id === 'billing' ? { ...e, scopes: ['finance'] } : e)), relations })}
        domains={{ choices: () => [], name: (scope) => `The ${scope}`, known: () => false, takenUpBy: () => [] }}
      />,
    )
    expect(within(screen.getByTestId('sheet-area-billing')).getByText('No scope is called The finance')).toBeTruthy()
  })
})

describe('a domain’s own sheet', () => {
  it('tells what it took up from above from what it owns, each saying where it is defined', () => {
    renderShell(
      <SheetPage
        open model={model()} sheet={SHEET} readOnly={false} actions={actions()} onClose={() => {}}
        ownerOf={(id) => (id === 'billing' ? { label: 'Acme', fields: ['name'] } : undefined)}
      />,
    )
    const own = screen.getByTestId('sheet-areas')
    expect(within(own).getByTestId('sheet-area-fulfilment')).toBeTruthy()
    expect(within(own).queryByTestId('sheet-area-billing')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Taken up from above' })).toBeTruthy()
    expect(screen.getByTestId('sheet-area-billing').hasAttribute('data-standin')).toBe(true)
    expect(screen.getByTestId('sheet-area-billing').textContent).toContain('Acme')
  })
})

describe('what is not yet mapped', () => {
  it('is a band of its own, with how many are waiting', () => {
    open({ sheet: { ...SHEET, areas: ['fulfilment'] } })
    const band = screen.getByTestId('sheet-unmapped')
    expect(within(band).getByText(/Not yet mapped to a domain/)).toBeTruthy()
    expect(within(band).getByText(/1 waiting/)).toBeTruthy()
    expect(within(band).getByTestId('sheet-unmapped-billing')).toBeTruthy()
  })

  it('is absent when every root is drawn', () => {
    open()
    expect(screen.queryByTestId('sheet-unmapped')).toBeNull()
  })

  it('leaves out a root a scope below has taken up (ADR-0040 §6)', () => {
    open({ sheet: { ...SHEET, areas: ['fulfilment'] }, takenUp: new Set(['invoice']) })
    expect(screen.queryByTestId('sheet-unmapped')).toBeNull()
  })
})

describe('taking a function up from a sheet above (ADR-0040 §5)', () => {
  const claims = (): SheetClaims => ({
    choices: [
      { id: 'returns', label: 'Returns', group: 'Acme' },
      { id: 'refunds', label: 'Refunds', group: 'Acme', note: 'in Returns' },
      { id: 'yard', label: 'Yard', group: 'Acme › Operations' },
    ],
    claim: vi.fn(),
  })

  it('offers From above… beside + area, grouped by the scope that defines each, and a pick takes one up', async () => {
    const offered = claims()
    open({ claims: offered })
    fireEvent.click(screen.getByRole('button', { name: 'From above…' }))
    const list = screen.getByRole('listbox')
    expect(within(list).getAllByRole('group').map((one) => one.firstChild?.textContent)).toEqual(['Acme', 'Acme › Operations'])
    expect(await axeFindings()).toEqual([])
    fireEvent.click(within(list).getByRole('option', { name: /Refunds/ }))
    expect(offered.claim).toHaveBeenCalledWith('refunds')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('is offered on a sheet with no areas yet, and not where there is nothing to take up or the page is only read', () => {
    open({ claims: claims(), sheet: { ...SHEET, areas: [] }, model: model({ elements: [] }) })
    expect(screen.getByTestId('sheet-from-above')).toBeTruthy()
    cleanup()
    open({ claims: { choices: [], claim: vi.fn() } })
    expect(screen.queryByTestId('sheet-from-above')).toBeNull()
    cleanup()
    open({ claims: claims(), readOnly: true })
    expect(screen.queryByTestId('sheet-from-above')).toBeNull()
  })
})

describe('the handle the agent reaches the page through', () => {
  it('is handed over while a sheet is up, naming which one', () => {
    const onHandle = vi.fn()
    renderShell(
      <SheetPage
        open model={model()} sheet={SHEET} readOnly={false} actions={actions()}
        onClose={() => {}} onHandle={onHandle}
      />,
    )
    expect(onHandle).toHaveBeenCalledWith(expect.objectContaining({ diagramId: 'sh-1' }))
  })

  it('is withdrawn when the page is not up, so nothing asks a closed page for a picture', () => {
    const onHandle = vi.fn()
    renderShell(
      <SheetPage
        open={false} model={model()} sheet={SHEET} readOnly={false} actions={actions()}
        onClose={() => {}} onHandle={onHandle}
      />,
    )
    expect(onHandle).toHaveBeenCalledWith(undefined)
    expect(onHandle).not.toHaveBeenCalledWith(expect.objectContaining({ diagramId: 'sh-1' }))
  })
})

describe('choosing something', () => {
  it('opens the panel on what you choose, and draws no panel until you do', () => {
    open()
    expect(screen.queryByTestId('sheet-inspector')).toBeNull()
    fireEvent.click(screen.getByTestId('sheet-capability-picking'))
    expect(panelName()).toBe('Picking')
    fireEvent.click(within(screen.getByTestId('sheet-inspector')).getByRole('button', { name: 'Close' }))
    expect(screen.queryByTestId('sheet-inspector')).toBeNull()
    bands()
    fireEvent.click(screen.getByTestId('sheet-step-negotiate'))
    expect(panelName()).toBe('Negotiate the rate')
  })
})

/** A sheet of nothing: what a person sees on a project that has just begun. */
const BARE: DesignDiagram = { ...SHEET, journeyId: undefined, lanes: [], areas: [] }

const empty = (): DesignModel => ({
  name: 'Acme Logistics', diagrams: [BARE], elements: [], relations: [],
})

describe('making something', () => {
  it('offers a journey and an area on an empty sheet, and nothing else to read', () => {
    const { actions: acts } = open({ sheet: BARE, model: empty() })
    fireEvent.click(screen.getByRole('button', { name: 'New journey' }))
    expect(acts.addJourney).toHaveBeenCalledWith({ journey: 'New journey', phase: 'Start' })
    fireEvent.click(screen.getByRole('button', { name: 'New area' }))
    expect(acts.addArea).toHaveBeenCalledWith('New area')
  })

  it('says what the two buttons do where the hint used to stop', () => {
    open({ sheet: BARE, model: empty() })
    expect(screen.getByText('Start with a journey across the top, or an area to keep capabilities in.'))
      .toBeTruthy()
  })

  it('adds a phase, a step on the common path or a lane, a capability and an area', () => {
    const { actions: acts } = open()
    bands()
    fireEvent.click(screen.getByLabelText('Add a phase to Ship a consignment'))
    expect(acts.addElement).toHaveBeenCalledWith({
      kind: 'step', name: 'New phase', parentId: 'ship',
    })
    cleanup()
    const { actions: acts2 } = open()
    bands()
    fireEvent.click(screen.getByLabelText('Add a step in Order, All customers'))
    expect(acts2.addElement).toHaveBeenCalledWith({
      kind: 'step', name: 'New step', parentId: 'order',
    })
    cleanup()
    const { actions: acts3 } = open()
    bands()
    fireEvent.click(screen.getByLabelText('Add a step in Quote, Key account'))
    expect(acts3.addElement).toHaveBeenCalledWith({
      kind: 'step', name: 'New step', parentId: 'quote', lane: 'key-account',
    })
    cleanup()
    const { actions: acts4 } = open()
    fireEvent.click(screen.getByLabelText('Add a capability to Warehousing'))
    expect(acts4.addElement).toHaveBeenCalledWith({
      kind: 'function', name: 'New capability', parentId: 'warehousing',
    })
    cleanup()
    const { actions: acts5 } = open()
    fireEvent.click(screen.getByLabelText('New area'))
    expect(acts5.addArea).toHaveBeenCalledWith('New area')
  })

  it('adds a capability to an area, at its heading', () => {
    const { actions: acts } = open()
    fireEvent.click(screen.getByLabelText('Add a capability to Fulfilment'))
    expect(acts.addElement).toHaveBeenCalledWith({
      kind: 'function', name: 'New capability', parentId: 'fulfilment',
    })
  })

  it('adds a stakeholder to a group, once, after its last member', () => {
    // The fixture's rail is all leaves; a group is a row with something under
    // it, and only a group offers the add — after its members, not on each row.
    const grouped = { ...model(), elements: [...model().elements, actor('floor-staff', 'Floor staff', { parentId: 'warehouse-team' })] }
    const { actions: acts } = open({ model: grouped })
    bands()
    expect(screen.getAllByLabelText(/^Add a stakeholder under/)).toHaveLength(1)
    fireEvent.click(screen.getByLabelText('Add a stakeholder under Warehouse team'))
    expect(acts.addElement).toHaveBeenCalledWith({
      kind: 'actor', name: 'New stakeholder', parentId: 'warehouse-team',
    })
    fireEvent.click(screen.getByLabelText('Add a stakeholder group'))
    expect(acts.addElement).toHaveBeenCalledWith({ kind: 'actor', name: 'New group' })
  })

  it('draws the rail on an empty scope, so the first stakeholder can be made', () => {
    open({ sheet: BARE, model: empty() })
    fireEvent.click(screen.getByRole('button', { name: 'Stakeholders' }))
    expect(within(screen.getByTestId('sheet-rail')).getByText('No stakeholders yet.')).toBeTruthy()
    expect(screen.getByLabelText('Add a stakeholder group')).toBeTruthy()
  })

  it('selects what it just made with the cursor in its name, where Enter adds the next and Tab files it under the one above', () => {
    // The action answers with an id the model holds, as in the app: the command has landed when the page reads it back.
    const acts = actions()
    acts.addElement = vi.fn(() => 'packing')
    renderShell(<SheetPage open model={model()} sheet={SHEET} readOnly={false} actions={acts} onClose={() => {}} />)
    fireEvent.click(screen.getByLabelText('Add a capability to Warehousing'))
    const name = screen.getByLabelText('Name') as HTMLInputElement
    expect(name.value).toBe('Packing')
    expect(document.activeElement).toBe(name)
    fireEvent.change(name, { target: { value: 'Packed' } })
    fireEvent.keyDown(name, { key: 'Tab' })
    expect(acts.updateElement).toHaveBeenCalledWith('packing', { name: 'Packed' })
    expect(acts.updateElement).toHaveBeenCalledWith('packing', { parentId: 'picking' })
    fireEvent.click(screen.getByLabelText('Add a capability to Warehousing'))
    fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Enter' })
    expect(acts.addElement).toHaveBeenCalledTimes(3)
  })

  it('offers not one of them under readOnly', () => {
    open({ readOnly: true })
    bands()
    for (const label of [
      'Add a phase to Ship a consignment',
      'Add a step in Order, All customers',
      'Add a grouping to Fulfilment',
      'Add a capability to Warehousing',
      'New area',
      'Add a stakeholder under Warehouse team',
      'Add a stakeholder group',
      '+ lane…',
      'What this sheet draws',
    ]) {
      expect(screen.queryByLabelText(label), label).toBeNull()
    }
  })
})

describe('the dialogs the page opens', () => {
  it('asks for a lane, and makes one out of the answer', () => {
    const { actions: acts } = open()
    bands()
    fireEvent.click(screen.getByRole('button', { name: '+ lane…' }))
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /Whose path it is/ }))
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Marketplace partner' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add the lane' }))
    expect(acts.addLane).toHaveBeenCalledWith({
      actorId: 'partner', phaseId: 'order', stepName: 'New step',
    })
  })

  it('opens what the sheet draws, and changes one thing at a time', () => {
    const { actions: acts } = open()
    fireEvent.click(screen.getByRole('button', { name: 'More for this sheet' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'What this sheet draws' }))
    fireEvent.click(screen.getByLabelText('Draw Billing'))
    expect(acts.updateSheet).toHaveBeenCalledWith({ areas: ['fulfilment'] })
  })
})

/** ADR-0033, amended 11 October 2026: a link's selection, located on the sheet; and what the sheet says it has selected. */
describe('a link to a card', () => {
  it('rings the card a select request names, and says it in the handle for a link to select again', () => {
    const onHandle = vi.fn()
    open({ select: { id: 'dunning', nonce: 1 }, onHandle })
    expect(panelName()).toBe('Chase a late payment')
    const rules = Array.from(document.querySelectorAll('style')).map((style) => style.textContent ?? '').join('\n')
    expect(rules).toContain('[data-element-id="dunning"]')
    expect((onHandle.mock.calls.at(-1)?.[0] as { selectedId?: string } | undefined)?.selectedId).toBe('dunning')
  })
})

/**
 * *Who answers* (ADR-0036, amended; the owner's decision 8): a question of the one
 * Colour menu. Each row names who answers, those nobody answers for are marked, and
 * a unit outside the domain is drawn as the check says it.
 */
describe('who answers, as a lens', () => {
  const responsible: SheetResponsible = {
    choices: [{ id: 'robotics', label: 'Robotics', group: 'Team' }],
    name: (id) => (id === 'robotics' ? 'Robotics' : undefined),
    serves: (actor) => actor !== 'robotics',
  }
  const assigned: readonly Relation[] = [
    { id: 'a9', type: 'assigned', sourceId: 'robotics', targetId: 'invoice' },
    { id: 'a8', type: 'assigned', sourceId: 'warehouse-team', targetId: 'fulfilment' },
  ]
  const who = () => {
    fireEvent.click(screen.getByRole('button', { name: /^Colour/ }))
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Who answers' }))
  }

  it('is a question only where the host says who is, with the rows silent until then', () => {
    open({ responsible })
    expect(screen.queryByTestId('sheet-responsible-packing')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^Colour/ }))
    expect(screen.getByRole('menuitemcheckbox', { name: 'Who answers' })).toBeTruthy()
    cleanup()
    open()
    fireEvent.click(screen.getByRole('button', { name: /^Colour/ }))
    expect(screen.queryByRole('menuitemcheckbox', { name: 'Who answers' })).toBeNull()
  })

  it('names who answers on each row, marks the ones nobody answers for, and the ones outside', async () => {
    open({ responsible, elsewhere: assigned })
    who()
    expect(screen.getByTestId('sheet-responsible-packing').textContent).toBe('Warehouse team')
    expect(screen.getByTestId('sheet-responsible-dunning').textContent).toBe('nobody')
    expect(screen.getByTestId('sheet-responsible-invoice').textContent).toBe('Robotics · outside this domain')
    expect(await axeFindings()).toEqual([])
  })
})

/**
 * The unit's label (ADR-0036, amended 13 October 2026): always there on a
 * function a unit answers for, a button beside the card's own, opening where
 * the unit serves — a menu where there are several — or the unit where it is
 * kept where it serves nothing. The toggle keeps the rest.
 */
describe('the unit on each function, a way to where it serves', () => {
  const opened: string[] = []
  const responsible: SheetResponsible = {
    choices: [],
    name: (id) => ({ robotics: 'Robotics', data: 'Data' } as Record<string, string>)[id],
    serves: (actor) => actor !== 'robotics',
    unit: (id) => ({
      'warehouse-team': { name: 'Warehouse team', serves: [{ scope: 'warehouse', name: 'Warehouse' }] },
      robotics: { name: 'Robotics', serves: [] },
      data: { name: 'Data', serves: [{ scope: 'shipping', name: 'Shipping' }, { scope: 'billing', name: 'Billing' }] },
    } as Record<string, { name: string; serves: { scope: string; name: string }[] }>)[id],
    openScope: (scope) => opened.push(`home:${scope}`),
    openUnit: (id) => opened.push(`unit:${id}`),
  }
  const assigned: readonly Relation[] = [
    { id: 'a9', type: 'assigned', sourceId: 'robotics', targetId: 'invoice' },
    { id: 'a8', type: 'assigned', sourceId: 'warehouse-team', targetId: 'fulfilment' },
    { id: 'a7', type: 'assigned', sourceId: 'data', targetId: 'warehousing' },
    { id: 'a6', type: 'assigned', sourceId: 'robotics', targetId: 'warehousing' },
  ]

  it('names the unit without the toggle, and opens the home of the scope it serves without choosing the card', async () => {
    opened.length = 0
    const onHandle = vi.fn()
    open({ responsible, elsewhere: assigned, onHandle })
    // On an area always; on a row only under Who answers (decision 8).
    expect(screen.getByTestId('sheet-unit-fulfilment').textContent).toBe('Warehouse team')
    expect(screen.queryByTestId('sheet-unit-packing')).toBeNull()
    expect(screen.getByTestId('sheet-unit-fulfilment').getAttribute('aria-label')).toBe('Responsible: Warehouse team. Open where they serve')
    fireEvent.click(screen.getByTestId('sheet-unit-fulfilment'))
    expect(opened).toEqual(['home:warehouse'])
    // The area's header was not chosen by it.
    expect((onHandle.mock.calls.at(-1)?.[0] as { selectedId?: string } | undefined)?.selectedId).toBeUndefined()
    // A unit that serves nothing opens where it is kept, and is drawn as outside here.
    fireEvent.click(screen.getByRole('button', { name: /^Colour/ }))
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Who answers' }))
    fireEvent.click(screen.getByTestId('sheet-unit-invoice'))
    expect(opened).toEqual(['home:warehouse', 'unit:robotics'])
    expect(screen.getByTestId('sheet-unit-invoice').getAttribute('data-sheet-unit')).toBe('outside')
    expect(await axeFindings()).toEqual([])
  })

  it('says +N where several answer, every name in its title, and offers each place in a menu', () => {
    opened.length = 0
    open({ responsible, elsewhere: assigned })
    fireEvent.click(screen.getByRole('button', { name: /^Colour/ }))
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Who answers' }))
    const label = screen.getByTestId('sheet-unit-warehousing')
    expect(label.textContent).toBe('Data +1')
    expect(label.getAttribute('title')).toBe('Data, Robotics (outside this domain)')
    fireEvent.click(label)
    expect(screen.getAllByRole('menuitem').map((one) => one.textContent?.trim())).toEqual(['Shipping · Data', 'Billing · Data', 'Robotics · where it is kept'])
    fireEvent.click(screen.getByRole('menuitem', { name: /Billing/ }))
    expect(opened).toEqual(['home:billing'])
  })
})

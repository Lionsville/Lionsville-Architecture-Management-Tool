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
import type { SheetActions } from './FunctionInspector'
import { renderShell } from '../../app/testing/renderShell'
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
      onClose={() => {}}
    />,
  )
  return { ...result, actions: acts }
}

describe('the stakeholder rail', () => {
  it('names the parties, and marks the ones from outside', () => {
    open()
    const rail = screen.getByTestId('sheet-rail')
    expect(within(rail).getByText('Warehouse team')).toBeTruthy()
    expect(within(rail).getByText('Marketplace partner')).toBeTruthy()
    expect(within(rail).getAllByText('Outside')).toHaveLength(1)
  })

  it('is not drawn at all when the sheet says the rail is off', () => {
    open({ sheet: { ...SHEET, showActors: false } })
    expect(screen.queryByTestId('sheet-rail')).toBeNull()
  })

  it('goes with the details behind one eye, as the page’s own state', () => {
    // Was a change to the sheet, and only the rail: "give me the whole width"
    // is one wish, and it says nothing about what the sheet is of.
    const { actions: acts } = open()
    expect(screen.getByTestId('sheet-inspector')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Hide the stakeholders and the details'))
    expect(screen.queryByTestId('sheet-rail')).toBeNull()
    expect(screen.queryByTestId('sheet-inspector')).toBeNull()
    expect(acts.updateSheet).not.toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText('Show the stakeholders and the details'))
    expect(screen.getByTestId('sheet-rail')).toBeTruthy()
    expect(screen.getByTestId('sheet-inspector')).toBeTruthy()
  })

  it('still offers the eye under readOnly, because it changes nothing', () => {
    open({ readOnly: true })
    expect(screen.getByLabelText('Hide the stakeholders and the details')).toBeTruthy()
    expect(screen.queryByLabelText('What this sheet draws')).toBeNull()
  })

  it('has a seam to drag, and so do the details', () => {
    open()
    const rail = screen.getByRole('separator', { name: 'Resize the stakeholder rail' })
    fireEvent.keyDown(rail, { key: 'ArrowRight' })
    expect(rail.getAttribute('aria-valuenow')).toBe('186')
    const details = screen.getByRole('separator', { name: 'Resize the details' })
    fireEvent.keyDown(details, { key: 'ArrowLeft' })
    expect(details.getAttribute('aria-valuenow')).toBe('308')
  })
})

describe('the grid', () => {
  it('is one column where nothing has been measured, and what the sheet fixes otherwise', () => {
    open()
    expect(screen.getByTestId('sheet-areas').getAttribute('data-columns')).toBe('1')
    cleanup()
    open({ sheet: { ...SHEET, columns: 3 } })
    expect(screen.getByTestId('sheet-areas').getAttribute('data-columns')).toBe('3')
  })

  it('gives an area the columns the sheet says, clamped to the grid', () => {
    open({ sheet: { ...SHEET, columns: 3, areaSpans: { fulfilment: 2, billing: 9 } } })
    expect(screen.getByTestId('sheet-area-fulfilment').getAttribute('data-span')).toBe('2')
    expect(screen.getByTestId('sheet-area-billing').getAttribute('data-span')).toBe('3')
  })

  it('widens and narrows an area as a change to the sheet', () => {
    const { actions: acts } = open({ sheet: { ...SHEET, columns: 3, areaSpans: { billing: 2 } } })
    fireEvent.click(screen.getByLabelText('Make Fulfilment wider'))
    expect(acts.updateSheet).toHaveBeenCalledWith({ areaSpans: { billing: 2, fulfilment: 2 } })
    fireEvent.click(screen.getByLabelText('Make Billing narrower'))
    // Back to one column is nothing written about it.
    expect(acts.updateSheet).toHaveBeenCalledWith({ areaSpans: undefined })
  })

  it('offers no width on a one-column grid, nor under readOnly', () => {
    open()
    expect(screen.queryByLabelText('Make Fulfilment wider')).toBeNull()
    cleanup()
    open({ readOnly: true, sheet: { ...SHEET, columns: 3 } })
    expect(screen.queryByLabelText('Make Fulfilment wider')).toBeNull()
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

  it('offers a picture only where the host can take one', () => {
    open()
    expect(screen.queryByLabelText('Save as a picture…')).toBeNull()
    cleanup()
    open({ onSave: vi.fn() })
    fireEvent.click(screen.getByLabelText('Save as a picture…'))
    expect(screen.getByRole('dialog', { name: 'Save the business architecture as a picture' })).toBeTruthy()
  })
})

describe('the journey band', () => {
  it('draws the phases across the top, in the journey’s order', () => {
    open()
    const band = screen.getByTestId('sheet-journey')
    expect(within(band).getByTestId('sheet-phase-order').textContent).toBe('Order')
    expect(within(band).getByTestId('sheet-phase-deliver').textContent).toBe('Deliver')
  })

  it('gives the common path the first row and names it', () => {
    open()
    expect(within(screen.getByTestId('sheet-lane-common')).getByText('All customers')).toBeTruthy()
  })

  it('draws a row per lane, named after the actor whose path it is', () => {
    open()
    expect(within(screen.getByTestId('sheet-lane-key-account')).getByText('Key account')).toBeTruthy()
    expect(screen.getByTestId('sheet-step-negotiate')).toBeTruthy()
  })

  it('draws a phase a lane passes through as a line, not as a gap', () => {
    open()
    expect(screen.getByTestId('sheet-passthrough-key-account-pick')).toBeTruthy()
    // Before the fork there is no line either — that row is not drawn there at all.
    expect(screen.queryByTestId('sheet-passthrough-key-account-order')).toBeNull()
  })

  it('says of a step somebody outside does that it is done outside', () => {
    open()
    expect(screen.getByLabelText('Partner fulfils — done outside the organisation')).toBeTruthy()
  })

  it('says so plainly when the sheet has no journey yet', () => {
    open({ sheet: { ...SHEET, journeyId: undefined } })
    expect(screen.getByText('No journey on this sheet yet.')).toBeTruthy()
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

  it('carries the domain an area is assigned to', () => {
    const { elements, relations } = shippingScope()
    open({
      model: model({
        elements: elements.map((e) => (e.id === 'billing' ? { ...e, scopes: ['finance'] } : e)),
        relations,
      }),
    })
    expect(within(screen.getByTestId('sheet-area-billing')).getByText('finance')).toBeTruthy()
  })
})

describe('what is not yet mapped', () => {
  it('is a band of its own, with how many are waiting', () => {
    open({ sheet: { ...SHEET, areas: ['fulfilment'] } })
    const band = screen.getByTestId('sheet-unmapped')
    expect(within(band).getByText('Not yet mapped to a domain')).toBeTruthy()
    expect(within(band).getByText('1 waiting')).toBeTruthy()
    expect(within(band).getByTestId('sheet-unmapped-billing')).toBeTruthy()
  })

  it('is absent when every root is drawn', () => {
    open()
    expect(screen.queryByTestId('sheet-unmapped')).toBeNull()
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
  it('puts a capability in the inspector', () => {
    open()
    fireEvent.click(screen.getByTestId('sheet-capability-picking'))
    const inspector = screen.getByTestId('sheet-inspector')
    expect(within(inspector).getByDisplayValue('Picking')).toBeTruthy()
  })

  it('puts a step in the inspector, from its chevron', () => {
    open()
    fireEvent.click(screen.getByTestId('sheet-step-negotiate'))
    expect(within(screen.getByTestId('sheet-inspector')).getByDisplayValue('Negotiate the rate')).toBeTruthy()
  })

  it('says what the inspector is for until something is chosen', () => {
    open()
    expect(screen.getByText('Choose something on the sheet to see it here.')).toBeTruthy()
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
    fireEvent.click(screen.getByLabelText('New journey'))
    expect(acts.addJourney).toHaveBeenCalledWith({ journey: 'New journey', phase: 'Start' })
    fireEvent.click(screen.getByLabelText('New area'))
    expect(acts.addArea).toHaveBeenCalledWith('New area')
  })

  it('says what the two buttons do where the hint used to stop', () => {
    open({ sheet: BARE, model: empty() })
    expect(screen.getByText('Start with a journey across the top, or an area to keep capabilities in.'))
      .toBeTruthy()
  })

  it('adds a phase at the end of the journey', () => {
    const { actions: acts } = open()
    fireEvent.click(screen.getByLabelText('Add a phase to Ship a consignment'))
    expect(acts.addElement).toHaveBeenCalledWith({
      kind: 'step', name: 'New phase', parentId: 'ship',
    })
  })

  it('adds a step to the path everybody takes', () => {
    const { actions: acts } = open()
    fireEvent.click(screen.getByLabelText('Add a step in Order, All customers'))
    expect(acts.addElement).toHaveBeenCalledWith({
      kind: 'step', name: 'New step', parentId: 'order',
    })
  })

  it('adds a step to a lane, on that lane', () => {
    const { actions: acts } = open()
    fireEvent.click(screen.getByLabelText('Add a step in Quote, Key account'))
    expect(acts.addElement).toHaveBeenCalledWith({
      kind: 'step', name: 'New step', parentId: 'quote', lane: 'key-account',
    })
  })

  it('adds a grouping and a capability to an area', () => {
    const { actions: acts } = open()
    fireEvent.click(screen.getByLabelText('Add a grouping to Fulfilment'))
    expect(acts.addElement).toHaveBeenCalledWith({
      kind: 'function', name: 'New grouping', parentId: 'fulfilment',
    })
    fireEvent.click(screen.getByLabelText('Add a capability to Fulfilment'))
    expect(acts.addElement).toHaveBeenCalledWith({
      kind: 'function', name: 'New capability', parentId: 'fulfilment',
    })
  })

  it('adds a capability inside a grouping', () => {
    const { actions: acts } = open()
    fireEvent.click(screen.getByLabelText('Add a capability to Warehousing'))
    expect(acts.addElement).toHaveBeenCalledWith({
      kind: 'function', name: 'New capability', parentId: 'warehousing',
    })
  })

  it('adds an area after the last one', () => {
    const { actions: acts } = open()
    fireEvent.click(screen.getByLabelText('New area'))
    expect(acts.addArea).toHaveBeenCalledWith('New area')
  })

  it('adds a stakeholder to a group, once, after its last member', () => {
    // The fixture's rail is all leaves; a group is a row with something under
    // it, and only a group offers the add — after its members, not on each row.
    const grouped = { ...model(), elements: [...model().elements, actor('floor-staff', 'Floor staff', { parentId: 'warehouse-team' })] }
    const { actions: acts } = open({ model: grouped })
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
    expect(within(screen.getByTestId('sheet-rail')).getByText('No stakeholders yet.')).toBeTruthy()
    expect(screen.getByLabelText('Add a stakeholder group')).toBeTruthy()
  })

  it('selects what it just made and puts the cursor in its name', () => {
    // The action answers with an id the model holds, which is what it does in
    // the app: the command has landed by the time the page reads it back.
    const acts = actions()
    acts.addElement = vi.fn(() => 'dunning')
    renderShell(
      <SheetPage
        open model={model()} sheet={SHEET} readOnly={false} actions={acts} onClose={() => {}}
      />,
    )
    fireEvent.click(screen.getByLabelText('Add a capability to Warehousing'))
    const name = within(screen.getByTestId('sheet-inspector')).getByLabelText('Name')
    expect((name as HTMLInputElement).value).toBe('Chase a late payment')
    expect(document.activeElement).toBe(name)
  })

  it('offers not one of them under readOnly', () => {
    open({ readOnly: true })
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
    fireEvent.click(screen.getByLabelText('+ lane…'))
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /Whose path it is/ }))
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Marketplace partner' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add the lane' }))
    expect(acts.addLane).toHaveBeenCalledWith({
      actorId: 'partner', phaseId: 'order', stepName: 'New step',
    })
  })

  it('opens what the sheet draws, and changes one thing at a time', () => {
    const { actions: acts } = open()
    fireEvent.click(screen.getByLabelText('What this sheet draws'))
    fireEvent.click(screen.getByLabelText('Draw Billing'))
    expect(acts.updateSheet).toHaveBeenCalledWith({ areas: ['fulfilment'] })
  })
})

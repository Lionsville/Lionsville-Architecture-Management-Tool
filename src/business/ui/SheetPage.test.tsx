// @vitest-environment jsdom
/**
 * The sheet, on screen (ADR-0012 §6).
 *
 * The layout itself is pinned in `sheet.test.ts`, in rows and depths; what is
 * pinned here is what the page promises a reader — the four bands, a lane that
 * passes through rather than stopping, a step somebody outside does, what a
 * capability's footer says, and that nothing on it can be changed under
 * `readOnly`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { SheetPage } from './SheetPage'
import type { SheetActions } from './FunctionInspector'
import { renderShell } from '../../app/testing/renderShell'
import { shippingScope } from '../testFixtures'
import type { DesignDiagram, DesignModel } from '../../model'

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
    name: 'Acme Logistics', customerName: 'Acme', diagrams: [SHEET], elements, relations, ...over,
  }
}

function actions(): SheetActions {
  return {
    updateElement: vi.fn(),
    moveElement: vi.fn(),
    updateSheet: vi.fn(),
    onOpenElement: vi.fn(),
  }
}

function open(over: { sheet?: DesignDiagram; readOnly?: boolean; model?: DesignModel } = {}) {
  const acts = actions()
  const result = renderShell(
    <SheetPage
      open
      model={over.model ?? model()}
      sheet={over.sheet ?? SHEET}
      readOnly={over.readOnly ?? false}
      actions={acts}
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

  it('offers to hide the rail, as a change to the sheet', () => {
    const { actions: acts } = open()
    fireEvent.click(screen.getByLabelText('Hide the stakeholders'))
    expect(acts.updateSheet).toHaveBeenCalledWith({ showActors: false })
  })

  it('offers nothing to press under readOnly', () => {
    open({ readOnly: true })
    expect(screen.queryByLabelText('Hide the stakeholders')).toBeNull()
    expect(screen.queryByLabelText('Show the stakeholders')).toBeNull()
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

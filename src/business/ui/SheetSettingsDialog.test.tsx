// @vitest-environment jsdom
/**
 * What a sheet draws, as four questions.
 *
 * What is pinned here is that each answer is its own command — a dialog that
 * batched them would make one ⌘Z take back three decisions — and that the
 * lists it shows are derived: the areas fall back to every root when the
 * sheet names none, and the lanes are the rows the steps actually make.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { SheetSettingsDialog } from './SheetSettingsDialog'
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

function open(sheet: DesignDiagram = SHEET, over: Partial<DesignModel> = {}) {
  const actions = {
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
  } satisfies SheetActions
  const result = renderShell(
    <SheetSettingsDialog model={model(over)} sheet={sheet} actions={actions} onClose={vi.fn()} />,
  )
  return { ...result, actions }
}

describe('the journey it draws', () => {
  it('offers every journey the scope holds, and none', () => {
    open()
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /The journey across the top/ }))
    const list = within(screen.getByRole('listbox'))
    expect(list.getByRole('option', { name: 'Ship a consignment' })).toBeTruthy()
    expect(list.getByRole('option', { name: 'None' })).toBeTruthy()
  })

  it('points the sheet at the one that is chosen', () => {
    // A scope with two journeys seeds none, which is the case this exists for.
    const { actions } = open({ ...SHEET, journeyId: undefined })
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /The journey across the top/ }))
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Ship a consignment' }))
    expect(actions.updateSheet).toHaveBeenCalledWith({ journeyId: 'ship' })
  })

  it('clears it again', () => {
    const { actions } = open()
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /The journey across the top/ }))
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'None' }))
    expect(actions.updateSheet).toHaveBeenCalledWith({ journeyId: undefined })
  })
})

describe('the areas, in order', () => {
  it('takes one off the sheet', () => {
    const { actions } = open()
    fireEvent.click(screen.getByLabelText('Draw Billing'))
    expect(actions.updateSheet).toHaveBeenCalledWith({ areas: ['fulfilment'] })
  })

  it('puts one that is not drawn back on, at the end', () => {
    const { actions } = open({ ...SHEET, areas: ['fulfilment'] })
    fireEvent.click(screen.getByLabelText('Draw Billing'))
    expect(actions.updateSheet).toHaveBeenCalledWith({ areas: ['fulfilment', 'billing'] })
  })

  it('moves one past its neighbour', () => {
    const { actions } = open()
    fireEvent.click(screen.getByRole('button', { name: 'Billing: Move up' }))
    expect(actions.updateSheet).toHaveBeenCalledWith({ areas: ['billing', 'fulfilment'] })
  })

  it('writes the list down the first time it is touched, when the sheet named none', () => {
    // An absent list means every root; the moment somebody decides, it is a
    // decision and is stored as one.
    const { actions } = open({ ...SHEET, areas: undefined })
    fireEvent.click(screen.getByLabelText('Draw Fulfilment'))
    expect(actions.updateSheet).toHaveBeenCalledWith({ areas: ['billing'] })
  })
})

describe('the lanes, in order', () => {
  it('lists the rows the steps make, in the order they are drawn', () => {
    const { actions } = open()
    fireEvent.click(screen.getByRole('button', { name: 'Marketplace partner: Move up' }))
    expect(actions.updateSheet).toHaveBeenCalledWith({ lanes: ['partner', 'key-account'] })
  })

  it('says a lane is a thing a step makes, when there are none', () => {
    // No step names a lane, and the sheet names no order either — so there is
    // no row to put in an order.
    open(
      { ...SHEET, lanes: undefined },
      { elements: shippingScope().elements.map((held) => ({ ...held, lane: undefined })) },
    )
    expect(screen.getByText('No row of its own yet — a lane appears when a step is on it.'))
      .toBeTruthy()
  })
})

describe('the rail', () => {
  it('is drawn unless the sheet says otherwise', () => {
    const { actions } = open()
    fireEvent.click(screen.getByLabelText('Draw the stakeholder rail'))
    expect(actions.updateSheet).toHaveBeenCalledWith({ showActors: false })
  })

  it('comes back', () => {
    const { actions } = open({ ...SHEET, showActors: false })
    fireEvent.click(screen.getByLabelText('Draw the stakeholder rail'))
    expect(actions.updateSheet).toHaveBeenCalledWith({ showActors: true })
  })
})

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { SheetSettingsDialog } from './SheetSettingsDialog'
import type { SheetActions } from './FunctionInspector'
import { renderShell } from '../../app/testing/renderShell'
import { shippingScope } from '../testFixtures'
import type { DesignDiagram, DesignModel } from '../../model'
import { chooseValue, optionLabels } from '../../widgets/kit/testing/select'

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
  const field = () => screen.getByLabelText('The journey across the top')

  it('offers every journey the scope holds, and none', () => {
    open()
    expect(optionLabels(field())).toEqual(['None', 'Ship a consignment'])
  })

  it('points the sheet at the journey that is chosen, and clears it again', () => {
    // A scope with two journeys seeds none, which is the case this exists for.
    const { actions } = open({ ...SHEET, journeyId: undefined })
    chooseValue(field(), 'ship')
    expect(actions.updateSheet).toHaveBeenCalledWith({ journeyId: 'ship' })
    cleanup()
    const { actions: actions2 } = open()
    chooseValue(field(), '')
    expect(actions2.updateSheet).toHaveBeenCalledWith({ journeyId: undefined })
  })
})

describe('the areas, in order', () => {
  it('takes an area off, puts one back at the end, and moves one past its neighbour', () => {
    const { actions } = open()
    fireEvent.click(screen.getByLabelText('Draw Billing'))
    expect(actions.updateSheet).toHaveBeenCalledWith({ areas: ['fulfilment'] })
    cleanup()
    const { actions: actions2 } = open({ ...SHEET, areas: ['fulfilment'] })
    fireEvent.click(screen.getByLabelText('Draw Billing'))
    expect(actions2.updateSheet).toHaveBeenCalledWith({ areas: ['fulfilment', 'billing'] })
    cleanup()
    const { actions: actions3 } = open()
    fireEvent.click(screen.getByRole('button', { name: 'Billing: Move up' }))
    expect(actions3.updateSheet).toHaveBeenCalledWith({ areas: ['billing', 'fulfilment'] })
    cleanup()
    // An absent list means every root; the moment somebody decides, it is a
    // decision and is stored as one.
    const { actions: actions4 } = open({ ...SHEET, areas: undefined })
    fireEvent.click(screen.getByLabelText('Draw Fulfilment'))
    expect(actions4.updateSheet).toHaveBeenCalledWith({ areas: ['billing'] })
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
  it('is drawn unless the sheet says otherwise, and comes back', () => {
    const { actions } = open()
    fireEvent.click(screen.getByLabelText('Draw the stakeholder rail'))
    expect(actions.updateSheet).toHaveBeenCalledWith({ showActors: false })
    cleanup()
    const { actions: actions2 } = open({ ...SHEET, showActors: false })
    fireEvent.click(screen.getByLabelText('Draw the stakeholder rail'))
    expect(actions2.updateSheet).toHaveBeenCalledWith({ showActors: true })
  })

})


// @vitest-environment jsdom
/**
 * The inspector docked to the sheet.
 *
 * What is pinned here is the contract it has with the session: every change is
 * an action, a run of keystrokes carries a coalesce key so it is one undo step,
 * a parent that would make a loop is offered and refused rather than hidden,
 * and `readOnly` leaves nothing to press.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { FunctionInspector } from './FunctionInspector'
import type { SheetActions } from './FunctionInspector'
import { renderShell } from '../../app/testing/renderShell'
import { shippingScope } from '../testFixtures'
import type { DesignElement, DesignModel } from '../../model'

afterEach(() => cleanup())

function model(): DesignModel {
  const { elements, relations } = shippingScope()
  return { name: 'Acme Logistics', customerName: 'Acme', diagrams: [], elements, relations }
}

const held = (id: string): DesignElement => model().elements.find((e) => e.id === id)!

function open(id: string, readOnly = false) {
  const actions: SheetActions = {
    updateElement: vi.fn(),
    moveElement: vi.fn(),
    updateSheet: vi.fn(),
    onOpenElement: vi.fn(),
  }
  const result = renderShell(
    <FunctionInspector element={held(id)} model={model()} readOnly={readOnly} actions={actions} />,
  )
  return { ...result, actions }
}

describe('the fields', () => {
  it('renames as one step, so a run of keystrokes is one undo', () => {
    const { actions } = open('picking')
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Order picking' } })
    expect(actions.updateElement).toHaveBeenCalledWith(
      'picking', { name: 'Order picking' }, 'sheet.name:picking',
    )
  })

  it('writes a lifecycle date onto the element, and takes it off again', () => {
    const { actions } = open('picking')
    fireEvent.change(screen.getByLabelText('Picking: Live from'), { target: { value: '2026-03-01' } })
    expect(actions.updateElement).toHaveBeenCalledWith(
      'picking', { lifecycleDates: { live: '2026-03-01' } },
    )
  })

  it('writes the description through the documentation page’s own field', () => {
    const { actions } = open('picking')
    const field = screen.getByRole('textbox', { name: /description/i })
    fireEvent.change(field, { target: { value: 'Goods off the shelf.' } })
    expect(actions.updateElement).toHaveBeenCalledWith(
      'picking', { description: 'Goods off the shelf.' }, 'sheet.description:picking',
    )
  })
})

describe('re-parenting', () => {
  it('offers the other members of its own tree', () => {
    open('picking')
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /Sits under/ }))
    const list = within(screen.getByRole('listbox'))
    expect(list.getByRole('option', { name: 'Fulfilment' })).toBeTruthy()
    // A journey is a tree of its own: a capability never belongs under one.
    expect(list.queryByRole('option', { name: 'Ship a consignment' })).toBeNull()
  })

  it('writes the new parent as a change to the element', () => {
    const { actions } = open('picking')
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /Sits under/ }))
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Invoicing' }))
    expect(actions.updateElement).toHaveBeenCalledWith('picking', { parentId: 'invoicing' })
  })

  it('shows the parent that would make a loop, refused, with the reason', () => {
    // Refused rather than hidden: "why can I not do that" should be answered
    // in the list rather than by the option's absence.
    open('warehousing')
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /Sits under/ }))
    const loop = within(screen.getByRole('listbox')).getByRole('option', { name: /Picking/ })
    expect(loop.getAttribute('aria-disabled')).toBe('true')
    expect(loop.textContent).toContain('Already inside this one')
  })

  it('lets a thing go back to the top of its tree', () => {
    const { actions } = open('warehousing')
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /Sits under/ }))
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /top-level/ }))
    expect(actions.updateElement).toHaveBeenCalledWith('warehousing', { parentId: undefined })
  })
})

describe('order among its neighbours', () => {
  it('moves one down, and cannot move the last one further', () => {
    const { actions } = open('picking')
    fireEvent.click(screen.getByRole('button', { name: 'Move down' }))
    expect(actions.moveElement).toHaveBeenCalledWith('picking', 1)
    expect(screen.getByRole('button', { name: 'Move up' }).getAttribute('disabled')).not.toBeNull()
  })

  it('offers nothing to move when a thing has no neighbours', () => {
    open('ship')
    expect(screen.queryByRole('button', { name: 'Move down' })).toBeNull()
  })
})

describe('what the two kinds each add', () => {
  it('gives a step the lane it is on, over the organisation’s actors', () => {
    const { actions } = open('negotiate')
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /Whose path/ }))
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Marketplace partner' }))
    expect(actions.updateElement).toHaveBeenCalledWith('negotiate', { lane: 'partner' })
  })

  it('puts a step back on the path everybody takes', () => {
    const { actions } = open('negotiate')
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /Whose path/ }))
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /everybody/ }))
    expect(actions.updateElement).toHaveBeenCalledWith('negotiate', { lane: undefined })
  })

  it('gives a function what covers it, with a way to each system', () => {
    const { actions } = open('picking')
    const coverage = screen.getByTestId('sheet-inspector-coverage')
    fireEvent.click(within(coverage).getByText('Warehouse system'))
    expect(actions.onOpenElement).toHaveBeenCalledWith('wms')
  })

  it('says of a capability that people do, that people do it', () => {
    open('packing')
    const coverage = screen.getByTestId('sheet-inspector-coverage')
    expect(coverage.textContent).toContain('Warehouse team')
    expect(coverage.textContent).toContain('People, without a system')
  })

  it('says of a capability nothing and nobody covers, that nothing does', () => {
    open('dunning')
    expect(screen.getByTestId('sheet-inspector-coverage').textContent).toContain('Nothing and nobody yet')
  })

  it('gives a step no coverage row — a journey is not covered, it is walked', () => {
    open('negotiate')
    expect(screen.queryByTestId('sheet-inspector-coverage')).toBeNull()
  })
})

describe('readOnly', () => {
  it('leaves every field disabled and offers no move', () => {
    open('picking', true)
    expect(screen.getByLabelText('Name').getAttribute('disabled')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Move up' })).toBeNull()
    expect(screen.getByRole('combobox', { name: /Sits under/ }).getAttribute('aria-disabled')).toBe('true')
  })
})

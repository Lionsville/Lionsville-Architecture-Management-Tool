// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { FunctionInspector } from './FunctionInspector'
import type { FunctionInspectorProps, SheetActions } from './FunctionInspector'
import { renderShell } from '../../app/testing/renderShell'
import { shippingScope } from '../testFixtures'
import type { DesignElement, DesignModel } from '../../model'

afterEach(() => cleanup())

function model(): DesignModel {
  const { elements, relations } = shippingScope()
  return { name: 'Acme Logistics', diagrams: [], elements, relations }
}

const held = (id: string): DesignElement => model().elements.find((e) => e.id === id)!

function open(
  id: string,
  readOnly = false,
  onRemoved = vi.fn(),
  ownerOf?: (id: string) => { label: string; fields: readonly string[]; onOpen?: () => void } | undefined,
  over: Pick<FunctionInspectorProps, 'applications' | 'onOpenDocumentation' | 'elsewhere' | 'responsible'> = {},
) {
  const actions: SheetActions = {
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
  const result = renderShell(
    <FunctionInspector
      element={held(id)} model={model()} readOnly={readOnly} actions={actions}
      onRemoved={onRemoved} ownerOf={ownerOf} {...over}
    />,
  )
  return { ...result, actions, onRemoved }
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

  it('writes the new parent as a change, and lets a thing go back to the top of its tree', () => {
    const { actions } = open('picking')
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /Sits under/ }))
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Invoicing' }))
    expect(actions.updateElement).toHaveBeenCalledWith('picking', { parentId: 'invoicing' })
    cleanup()
    const { actions: actions2 } = open('warehousing')
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /Sits under/ }))
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /top-level/ }))
    expect(actions2.updateElement).toHaveBeenCalledWith('warehousing', { parentId: undefined })
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
  it('gives a step its lane and puts it back on the path everybody takes', () => {
    const { actions } = open('negotiate')
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /Whose path/ }))
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Marketplace partner' }))
    expect(actions.updateElement).toHaveBeenCalledWith('negotiate', { lane: 'partner' })
    cleanup()
    const { actions: actions2 } = open('negotiate')
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /Whose path/ }))
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /everybody/ }))
    expect(actions2.updateElement).toHaveBeenCalledWith('negotiate', { lane: undefined })
  })

  it('gives a function what covers it with a way to each system, and says so when nothing does', () => {
    const { actions } = open('picking')
    // The link, not the chip in the picker below it that says the same name.
    fireEvent.click(screen.getByRole('button', { name: 'Open Warehouse system' }))
    expect(actions.onOpenElement).toHaveBeenCalledWith('wms')
    cleanup()
    open('dunning')
    expect(screen.getByTestId('sheet-inspector-coverage').textContent).toContain('Nothing and nobody yet')
    cleanup()
    open('negotiate')
    expect(screen.queryByTestId('sheet-inspector-coverage')).toBeNull()
  })

  it('says of a capability that people do, that people do it', () => {
    open('packing')
    const coverage = screen.getByTestId('sheet-inspector-coverage')
    expect(coverage.textContent).toContain('Warehouse team')
    expect(coverage.textContent).toContain('People, without a system')
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

describe('what covers a capability, as something to tick', () => {
  it('ticks a supporter in and out, an application or an actor, held or not', () => {
    const { actions } = open('dunning')
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /Supported by/ }))
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Finance system' }))
    expect(actions.setCoverage).toHaveBeenCalledWith({
      type: 'supports', sourceId: 'erp', functionId: 'dunning', on: true,
    })
    cleanup()
    const { actions: actions2 } = open('picking')
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /Supported by/ }))
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Warehouse system' }))
    expect(actions2.setCoverage).toHaveBeenCalledWith({
      type: 'supports', sourceId: 'wms', functionId: 'picking', on: false,
    })
    cleanup()
    const { actions: actions3 } = open('dunning')
    fireEvent.click(screen.getByRole('button', { name: '+ Unit' }))
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Warehouse team' }))
    expect(actions3.setCoverage).toHaveBeenCalledWith({
      type: 'assigned', sourceId: 'warehouse-team', functionId: 'dunning', on: true,
    })
    cleanup()
    open('picking', false, undefined, undefined, {
      applications: [{ id: 'wms', name: 'Warehouse system, as the landscape calls it', where: 'ops' }],
    })
    expect(screen.getByRole('button', { name: 'Open Warehouse system, as the landscape calls it' })).toBeTruthy()
    cleanup()
    open('negotiate')
    expect(screen.queryByRole('combobox', { name: /Supported by/ })).toBeNull()
  })

  it('shows what is already ticked, as chips', () => {
    open('picking')
    const field = screen.getByRole('combobox', { name: /Supported by/ }).closest('.MuiAutocomplete-root')
    expect(field?.textContent).toContain('Handheld scanners')
    expect(field?.textContent).toContain('Warehouse system')
  })

  it('offers every application in the organisation, with where it is defined', () => {
    // An organisation's sheet holds no applications of its own: what
    // supports its capabilities is a landscape's, handed in as the register.
    const { actions } = open('dunning', false, undefined, undefined, {
      applications: [
        { id: 'erp', name: 'Finance system' },
        { id: 'crm', name: 'Customer system', where: 'acme/sales' },
      ],
    })
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /Supported by/ }))
    const list = within(screen.getByRole('listbox'))
    expect(list.getByRole('option', { name: 'Customer system' }).textContent).toContain('acme/sales')
    fireEvent.click(list.getByRole('option', { name: 'Customer system' }))
    expect(actions.setCoverage).toHaveBeenCalledWith({
      type: 'supports', sourceId: 'crm', functionId: 'dunning', on: true,
    })
  })

  it('is found by typing, because a register runs to hundreds', () => {
    open('dunning', false, undefined, undefined, {
      applications: [
        { id: 'erp', name: 'Finance system' },
        { id: 'crm', name: 'Customer system', where: 'acme/sales' },
      ],
    })
    const box = screen.getByRole('combobox', { name: /Supported by/ })
    fireEvent.focus(box)
    fireEvent.change(box, { target: { value: 'cust' } })
    const list = within(screen.getByRole('listbox'))
    expect(list.getByRole('option', { name: 'Customer system' })).toBeTruthy()
    expect(list.queryByRole('option', { name: 'Finance system' })).toBeNull()
  })

  it('counts a landscape’s rows in the line, and offers to take away only its own', () => {
    const { actions } = open('dunning', false, undefined, undefined, {
      applications: [{ id: 'crm', name: 'Customer system', where: 'acme/sales' }],
      elsewhere: [
        { id: 'r-x', type: 'supports', sourceId: 'crm', targetId: 'dunning' },
        { id: 'r-x', type: 'supports', sourceId: 'crm', targetId: 'dunning' },
      ],
    })
    expect(screen.getByRole('button', { name: 'Open Customer system' })).toBeTruthy()
    expect(screen.queryByText('Nothing and nobody yet')).toBeNull()
    // This scope's own saved rows are in the tree's list too: once, not twice.
    expect(screen.getAllByRole('button', { name: /^Open / })).toHaveLength(1)
    // Not a chip: the row is the landscape's, and unpicking it here would find nothing to delete.
    const field = screen.getByRole('combobox', { name: /Supported by/ }).closest('.MuiAutocomplete-root')
    expect(field?.textContent).not.toContain('Customer system')
    expect(actions.setCoverage).not.toHaveBeenCalled()
  })

})

describe('the way to the page', () => {
  it('opens the element’s own documentation beside the heading, where the host has a page', () => {
    const onOpenDocumentation = vi.fn()
    open('dunning', false, undefined, undefined, { onOpenDocumentation })
    fireEvent.click(screen.getByRole('button', { name: 'Open the page of Chase a late payment' }))
    expect(onOpenDocumentation).toHaveBeenCalledWith('dunning')
    cleanup()
    open('dunning')
    expect(screen.queryByTestId('sheet-open-page')).toBeNull()
  })

})

describe('a stakeholder', () => {
  it('says whether a stakeholder is part of this organisation, and takes the mark off again', () => {
    const { actions } = open('warehouse-team')
    fireEvent.click(screen.getByLabelText('Outside the organisation'))
    expect(actions.updateElement).toHaveBeenCalledWith('warehouse-team', { outside: true })
    cleanup()
    const { actions: actions2 } = open('partner')
    fireEvent.click(screen.getByLabelText('Outside the organisation'))
    expect(actions2.updateElement).toHaveBeenCalledWith('partner', { outside: undefined })
    cleanup()
    open('picking')
    expect(screen.queryByLabelText('Outside the organisation')).toBeNull()
  })

})

describe('deleting', () => {
  it('takes a leaf, and leaves nothing chosen behind it', () => {
    const { actions, onRemoved } = open('packing')
    fireEvent.click(screen.getByRole('button', { name: 'Delete Packing' }))
    expect(actions.removeElement).toHaveBeenCalledWith('packing')
    expect(onRemoved).toHaveBeenCalled()
  })

  it('refuses while something is inside it, and says how much', () => {
    // Refused in place rather than hidden: the answer to "why can I not
    // delete this" belongs next to the thing that will not delete.
    const { actions } = open('warehousing')
    const button = screen.getByRole('button', { name: 'Delete Warehousing' })
    expect(button.getAttribute('disabled')).not.toBeNull()
    expect(screen.getByText('2 things are inside it')).toBeTruthy()
    fireEvent.click(button)
    expect(actions.removeElement).not.toHaveBeenCalled()
  })

  // A unit's assignments go with it (ADR-0036, amended 12 October 2026): the host draws who stops being what.
  it('asks first where the actor is a unit with people, saying what the host says, and deletes only on yes', async () => {
    const responsible = {
      choices: [], name: () => undefined, serves: () => true,
      rolesEnded: (id: string) => (id === 'warehouse-team' ? <p data-testid="said">Ada Lovelace stops being Team lead in Warehouse team.</p> : undefined),
    }
    const { actions, onRemoved } = open('warehouse-team', false, vi.fn(), undefined, { responsible })
    fireEvent.click(screen.getByRole('button', { name: 'Delete Warehouse team' }))
    expect(actions.removeElement).not.toHaveBeenCalled()
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByTestId('said').textContent).toBe('Ada Lovelace stops being Team lead in Warehouse team.')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(actions.removeElement).not.toHaveBeenCalled()
    // A closing dialog keeps the page hidden from role queries until it has gone.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Delete Warehouse team' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    expect(actions.removeElement).toHaveBeenCalledWith('warehouse-team')
    expect(onRemoved).toHaveBeenCalled()
    cleanup()
    // An actor that ends no role is deleted as it always was.
    const plain = open('key-account', false, vi.fn(), undefined, { responsible })
    fireEvent.click(screen.getByRole('button', { name: 'Delete Key account' }))
    expect(plain.actions.removeElement).toHaveBeenCalledWith('key-account')
  })

  it('is not offered under readOnly', () => {
    open('packing', true)
    expect(screen.queryByRole('button', { name: 'Delete Packing' })).toBeNull()
  })
})

/**
 * A refinement (ADR-0012 §3): a capability the organisation defines, drawn on
 * a domain's sheet as a stand-in with the domain's own functions under it. Its
 * detail is the organisation's; its description here is the domain's.
 */
describe('a capability another scope answers for', () => {
  const owned = {
    label: 'the organisation',
    fields: ['name', 'ref', 'lifecycle', 'lifecycleDates', 'outside'],
  }

  it('says where it is defined, and offers to open that scope', () => {
    const onOpen = vi.fn()
    open('picking', false, vi.fn(), () => ({ ...owned, onOpen }))
    expect(screen.getByTestId('owned-elsewhere').textContent).toContain('the organisation')
    fireEvent.click(screen.getByRole('button', { name: 'Open the organisation' }))
    expect(onOpen).toHaveBeenCalled()
  })

  it('locks the cached name and the owner\'s dates, and leaves the account of it', () => {
    open('picking', false, vi.fn(), () => owned)
    expect((screen.getByLabelText('Name') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByLabelText('Picking: Live from') as HTMLInputElement).disabled).toBe(true)
    expect((screen.getByLabelText('Description') as HTMLTextAreaElement).disabled).toBe(false)
  })

  it('says nothing about a record this scope defines', () => {
    open('picking')
    expect(screen.queryByTestId('owned-elsewhere')).toBeNull()
    expect((screen.getByLabelText('Name') as HTMLInputElement).disabled).toBe(false)
  })
})

/**
 * Who is responsible for it (ADR-0036, amended 11 October 2026): the units
 * of the whole organisation, picked as a scope's *Served by* picks them, and
 * the row kept here with a unit filed elsewhere as its far end.
 */
describe('who is responsible for a capability', () => {
  const responsible = {
    choices: [
      { id: 'shipping', label: 'Shipping', group: 'Domain', note: 'filed in Shipping' },
      { id: 'robotics', label: 'Robotics', group: 'Team', note: 'filed in Warehouse' },
      { id: 'warehouse-team', label: 'Warehouse team', group: 'Others in this scope' },
    ],
    name: (id: string) => ({ shipping: 'Shipping', robotics: 'Robotics' } as Record<string, string>)[id],
    serves: (actor: string) => actor !== 'robotics',
  }

  it('lists the units grouped by type, each saying where it is filed, and writes the row here', async () => {
    const { actions } = open('dunning', false, undefined, undefined, { responsible })
    expect(screen.getByTestId('sheet-assigned-to').textContent).toContain('Nobody yet')
    fireEvent.click(screen.getByRole('button', { name: '+ Unit' }))
    const list = screen.getByRole('listbox')
    expect(within(list).getAllByRole('group').map((one) => one.getAttribute('aria-labelledby') && one.firstChild?.textContent))
      .toEqual(['Domain', 'Team', 'Others in this scope'])
    expect(within(list).getByRole('option', { name: /Robotics/ }).textContent).toBe('Roboticsfiled in Warehouse')
    expect(await axeFindings()).toEqual([])
    fireEvent.click(within(list).getByRole('option', { name: /Robotics/ }))
    expect(actions.setCoverage).toHaveBeenCalledWith({ type: 'assigned', sourceId: 'robotics', functionId: 'dunning', on: true })
  })

  it('names a unit kept elsewhere, marks one outside the domain, and takes a row off only where it is kept here', () => {
    const { actions } = open('packing', false, undefined, undefined, {
      responsible,
      elsewhere: [{ id: 'far', type: 'assigned', sourceId: 'robotics', targetId: 'packing' }],
    })
    const chips = screen.getAllByTestId('sheet-assigned')
    expect(chips.map((one) => one.textContent)).toEqual(['Warehouse team', 'Robotics · outside this domain'])
    expect(chips[1].getAttribute('data-outside')).toBe('true')
    expect(within(chips[1]).queryByTestId('CancelIcon')).toBeNull()
    fireEvent.click(within(chips[0]).getByTestId('CancelIcon'))
    expect(actions.setCoverage).toHaveBeenCalledWith({ type: 'assigned', sourceId: 'warehouse-team', functionId: 'packing', on: false })
  })

  it('offers nothing to add where the sheet is only read, and still says who', () => {
    open('packing', true, undefined, undefined, { responsible })
    expect(screen.queryByRole('button', { name: '+ Unit' })).toBeNull()
    expect(screen.getByTestId('sheet-assigned-to').textContent).toContain('Warehouse team')
  })
})

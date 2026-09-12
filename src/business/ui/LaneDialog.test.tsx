// @vitest-environment jsdom
/**
 * The three things a lane needs.
 *
 * What is pinned here is that the dialog writes nothing and answers with a
 * request, that a lane always comes with the step that makes its row appear,
 * and that a stakeholder nobody has written down yet can be made on the spot.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { LaneDialog } from './LaneDialog'
import { renderShell } from '../../app/testing/renderShell'
import { shippingScope } from '../testFixtures'
import type { DesignModel } from '../../model'

afterEach(() => cleanup())

function model(): DesignModel {
  const { elements, relations } = shippingScope()
  return { name: 'Acme Logistics', customerName: 'Acme', diagrams: [], elements, relations }
}

function open() {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  const phases = model().elements.filter((held) => held.parentId === 'ship')
  const result = renderShell(
    <LaneDialog model={model()} phases={phases} onCancel={onCancel} onConfirm={onConfirm} />,
  )
  return { ...result, onConfirm, onCancel }
}

const pick = (field: RegExp, option: string | RegExp) => {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: field }))
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: option }))
}

describe('a lane out of a stakeholder the scope holds', () => {
  it('starts on the first party and the first phase', () => {
    const { onConfirm } = open()
    fireEvent.click(screen.getByRole('button', { name: 'Add the lane' }))
    expect(onConfirm).toHaveBeenCalledWith({
      actorId: 'warehouse-team', phaseId: 'order', stepName: 'New step',
    })
  })

  it('takes the party and the phase the person chose', () => {
    const { onConfirm } = open()
    pick(/Whose path it is/, 'Marketplace partner')
    pick(/Forks at/, 'Deliver')
    fireEvent.click(screen.getByRole('button', { name: 'Add the lane' }))
    expect(onConfirm).toHaveBeenCalledWith({
      actorId: 'partner', phaseId: 'deliver', stepName: 'New step',
    })
  })
})

describe('a lane for somebody not on the rail yet', () => {
  it('makes the party as well, and marks it outside when it is', () => {
    const { onConfirm } = open()
    pick(/Whose path it is/, /not on the rail/)
    fireEvent.change(screen.getByLabelText('Their name'), { target: { value: 'Auditor' } })
    fireEvent.click(screen.getByLabelText('Outside the organisation'))
    fireEvent.click(screen.getByRole('button', { name: 'Add the lane' }))
    expect(onConfirm).toHaveBeenCalledWith({
      name: 'Auditor', outside: true, phaseId: 'order', stepName: 'New step',
    })
  })

  it('says nothing about outside when the tick is not made', () => {
    const { onConfirm } = open()
    pick(/Whose path it is/, /not on the rail/)
    fireEvent.change(screen.getByLabelText('Their name'), { target: { value: 'Auditor' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add the lane' }))
    expect(onConfirm).toHaveBeenCalledWith({
      name: 'Auditor', phaseId: 'order', stepName: 'New step',
    })
  })

  it('will not be added without a name', () => {
    const { onConfirm } = open()
    pick(/Whose path it is/, /not on the rail/)
    const add = screen.getByRole('button', { name: 'Add the lane' })
    expect(add.getAttribute('disabled')).not.toBeNull()
    fireEvent.click(add)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})

describe('changing your mind', () => {
  it('writes nothing', () => {
    const { onCancel, onConfirm } = open()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})

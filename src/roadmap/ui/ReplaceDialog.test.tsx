// @vitest-environment jsdom
/**
 * Replace… (ADR-0010). What is pinned: the three inputs become one request
 * and nothing is written here; the shape and the extra retirees land as
 * roles; a new one is suggested a name; and the dates must run forwards.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { ReplaceDialog } from './ReplaceDialog'
import { renderShell } from '../../app/testing/renderShell'
import type { DesignElement, DesignModel } from '../../model'

afterEach(() => cleanup())

function element(id: string, name: string, over: Partial<DesignElement> = {}): DesignElement {
  return { id, kind: 'application', name, lifecycle: 'live', isManaged: true, aspects: {}, ...over }
}

const MODEL = {
  name: 'Acme', diagrams: [], connections: [],
  elements: [element('wms', 'Warehouse Management'), element('erp', 'ERP'), element('scanner', 'Scanner', { kind: 'component' })],
} as unknown as DesignModel

function setup() {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  renderShell(<ReplaceDialog subject={MODEL.elements[0]} model={MODEL} onCancel={onCancel} onConfirm={onConfirm} />)
  return { onConfirm, onCancel }
}

const dates = () => {
  fireEvent.change(screen.getByLabelText('Shadow run from'), { target: { value: '2027-03-01' } })
  fireEvent.change(screen.getByLabelText('Cutover'), { target: { value: '2027-09-01' } })
}

describe('Replace…', () => {
  it('suggests a name for the new one and asks for nothing but the two days', () => {
    const { onConfirm } = setup()
    expect(screen.getByDisplayValue('Warehouse Management (new)')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Start the plan' }) as HTMLButtonElement).disabled).toBe(true)
    dates()
    fireEvent.click(screen.getByRole('button', { name: 'Start the plan' }))
    expect(onConfirm).toHaveBeenCalledWith({
      from: [{ elementId: 'wms', role: 'retires' }],
      to: { name: 'Warehouse Management (new)' },
      shadowFrom: '2027-03-01',
      cutover: '2027-09-01',
    })
  })

  it('refuses a cutover before the shadow run', () => {
    setup()
    fireEvent.change(screen.getByLabelText('Shadow run from'), { target: { value: '2027-09-01' } })
    fireEvent.change(screen.getByLabelText('Cutover'), { target: { value: '2027-03-01' } })
    expect((screen.getByRole('button', { name: 'Start the plan' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('can replace with one that exists, of the same kind only', () => {
    const { onConfirm } = setup()
    fireEvent.click(screen.getByLabelText('One that already exists'))
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /Which one/ }))
    const offered = within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent)
    // Not itself, and not a component.
    expect(offered).toEqual(['ERP'])
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'ERP' }))
    dates()
    fireEvent.click(screen.getByRole('button', { name: 'Start the plan' }))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ to: { elementId: 'erp' } }))
  })

  it('says a split as the source staying, and a merge as more sources retiring', () => {
    const { onConfirm } = setup()
    fireEvent.click(screen.getByLabelText(/Part of it moves/))
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /Another application/ }))
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'ERP' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    dates()
    fireEvent.click(screen.getByRole('button', { name: 'Start the plan' }))
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({
      from: [{ elementId: 'wms', role: 'changes' }, { elementId: 'erp', role: 'retires' }],
    }))
  })

  it('writes nothing on cancel', () => {
    const { onConfirm, onCancel } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})

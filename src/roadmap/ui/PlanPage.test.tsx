// @vitest-environment jsdom
/**
 * A plan on its own page (ADR-0010).
 *
 * The rules of a plan are pinned in `model/transition.test.ts`; what is pinned
 * here is what the page promises: every field writes through the action it is
 * given and nothing else, an element's dates are written to the element and
 * not into the plan, the status offers only the moves the machine allows, the
 * body renders and is edited beside its rendering, and read-only hides every
 * way of writing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { PlanPage } from './PlanPage'
import type { PlanActions, PlanPageProps } from './PlanPage'
import { renderShell } from '../../app/testing/renderShell'
import type { DesignElement, DesignModel, Transition } from '../../model'
import type { Adr } from '../../model/adr'

afterEach(() => cleanup())

function element(id: string, name: string, over: Partial<DesignElement> = {}): DesignElement {
  return { id, kind: 'application', name, lifecycle: 'live', isManaged: true, aspects: {}, ...over }
}

const PLAN: Transition = {
  id: 'tr-1', number: 1, title: 'Replace the warehouse system', status: 'agreed',
  from: '2027-01-15', to: '2028-01-31', owner: 'Logistics IT',
  elements: [{ elementId: 'wms-old', role: 'retires' }, { elementId: 'wms-new', role: 'introduces' }],
  decisions: ['adr-1'], milestones: [{ date: '2027-04-01', name: 'Cutover begins' }],
  body: '## Goal\n\nOne warehouse system.',
}

const ADRS: Adr[] = [
  { id: 'adr-1', number: 1, title: 'One warehouse system', status: 'accepted', date: '2026-01-01', body: '', signers: [] },
  { id: 'adr-2', number: 2, title: 'Keep the old scanners', status: 'proposed', date: '2026-02-01', body: '', signers: [] },
]

const MODEL = {
  name: 'Acme', customerName: 'Acme', diagrams: [], connections: [],
  elements: [
    element('wms-old', 'Warehouse Management', { lifecycleDates: { retiring: '2027-04-01', retired: '2028-01-31' } }),
    element('wms-new', 'Warehouse Management (new)', { lifecycle: 'planned', lifecycleDates: { live: '2027-04-01' } }),
    element('billing', 'Billing'),
  ],
} as unknown as DesignModel

function setup(over: Partial<PlanPageProps> = {}) {
  const actions: PlanActions = {
    updateTransition: vi.fn(),
    removeTransition: vi.fn(),
    shiftTransition: vi.fn(),
    updateElementDates: vi.fn(),
    onOpenElement: vi.fn(),
    onOpenDecision: vi.fn(),
    ...over.actions,
  }
  const view = renderShell(
    <PlanPage
      open
      plan={PLAN}
      model={MODEL}
      decisions={ADRS}
      readOnly={false}
      onClose={vi.fn()}
      renderMarkdown={(md) => <div data-testid="rendered">{md}</div>}
      {...over}
      actions={actions}
    />,
  )
  return { ...view, actions }
}

describe('the facts', () => {
  it('shows the plan and writes every field through one action', () => {
    const { actions } = setup()
    expect(screen.getByDisplayValue('Replace the warehouse system')).toBeTruthy()
    fireEvent.change(screen.getByDisplayValue('Logistics IT'), { target: { value: 'Warehouse IT' } })
    expect(actions.updateTransition).toHaveBeenCalledWith('tr-1', { owner: 'Warehouse IT' })
  })

  it('labels the window as a window', () => {
    setup()
    expect(screen.getByLabelText('From')).toBeTruthy()
    expect(screen.getByLabelText('To')).toBeTruthy()
  })

  it('offers only the moves its status machine allows', () => {
    setup()
    fireEvent.mouseDown(screen.getAllByRole('combobox')[0])
    const offered = within(screen.getByRole('listbox')).getAllByRole('option').map((o) => o.textContent)
    // From `agreed`: running, draft, abandoned — and where it already is.
    expect(offered).toEqual(['Draft', 'Agreed', 'Running', 'Abandoned'])
  })

  it('moves by a number of days as one action', () => {
    const { actions } = setup()
    fireEvent.change(screen.getByLabelText('Days to move it, forwards or back'), { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Move by…' }))
    expect(actions.shiftTransition).toHaveBeenCalledWith('tr-1', 30)
  })
})

describe('what it changes', () => {
  it('lists the elements with their role', () => {
    setup()
    const row = screen.getByTestId('plan-element-wms-old')
    expect(within(row).getByText('Warehouse Management')).toBeTruthy()
    expect(within(row).getByText('Retires')).toBeTruthy()
  })

  it('adds an element with a role', () => {
    const { actions } = setup()
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /Application/ }))
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Billing' }))
    fireEvent.click(within(screen.getByTestId('plan-add-element')).getByRole('button', { name: 'Add' }))
    expect(actions.updateTransition).toHaveBeenCalledWith('tr-1', {
      elements: [...PLAN.elements, { elementId: 'billing', role: 'introduces' }],
    })
  })

  it('writes an element\'s dates to the element, never into the plan', () => {
    const { actions } = setup()
    fireEvent.change(screen.getByLabelText('Warehouse Management (new): Live from'), { target: { value: '2027-06-01' } })
    expect(actions.updateElementDates).toHaveBeenCalledWith('wms-new', { live: '2027-06-01' })
    expect(actions.updateTransition).not.toHaveBeenCalled()
  })

  it('clears the dates when the last one is emptied', () => {
    const { actions } = setup()
    fireEvent.change(screen.getByLabelText('Warehouse Management (new): Live from'), { target: { value: '' } })
    expect(actions.updateElementDates).toHaveBeenCalledWith('wms-new', undefined)
  })

  it('offers no dates on an element the plan only changes', () => {
    setup({ plan: { ...PLAN, elements: [{ elementId: 'billing', role: 'changes' }] } })
    expect(screen.queryByLabelText('Billing: Live from')).toBeNull()
  })
})

describe('milestones and decisions', () => {
  it('adds a milestone on the plan\'s end day and edits it in place', () => {
    const { actions } = setup()
    fireEvent.click(screen.getByRole('button', { name: '+ Milestone' }))
    expect(actions.updateTransition).toHaveBeenCalledWith('tr-1', {
      milestones: [...PLAN.milestones, { date: '2028-01-31', name: '' }],
    })
    fireEvent.change(screen.getByLabelText('Milestone'), { target: { value: 'Cutover done' } })
    expect(actions.updateTransition).toHaveBeenLastCalledWith('tr-1', {
      milestones: [{ date: '2027-04-01', name: 'Cutover done' }],
    })
  })

  it('names the decisions it rests on and offers the rest', () => {
    const { actions } = setup()
    expect(screen.getByText('ADR-0001 One warehouse system')).toBeTruthy()
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /Decision/ }))
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /Keep the old scanners/ }))
    fireEvent.click(within(screen.getByTestId('plan-add-decision')).getByRole('button', { name: 'Add' }))
    expect(actions.updateTransition).toHaveBeenCalledWith('tr-1', { decisions: ['adr-1', 'adr-2'] })
  })

  it('opens a decision through the caller', () => {
    const { actions } = setup()
    fireEvent.click(screen.getByText('ADR-0001 One warehouse system'))
    expect(actions.onOpenDecision).toHaveBeenCalledWith('adr-1')
  })
})

describe('the body', () => {
  it('renders the document and edits its source beside it', () => {
    const { actions } = setup()
    expect(screen.getByTestId('rendered').textContent).toContain('One warehouse system')
    expect(screen.queryByLabelText('Plan source (markdown)')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Plan source (markdown)'), { target: { value: '## Goal\n\nTwo.' } })
    expect(actions.updateTransition).toHaveBeenCalledWith('tr-1', { body: '## Goal\n\nTwo.' })
  })
})

describe('deleting', () => {
  it('asks first, then removes and closes', () => {
    const onClose = vi.fn()
    const { actions } = setup({ onClose })
    fireEvent.click(screen.getByRole('button', { name: 'Delete this plan' }))
    expect(actions.removeTransition).not.toHaveBeenCalled()
    fireEvent.click(within(screen.getByRole('dialog', { name: /Delete/ })).getByRole('button', { name: 'Delete this plan' }))
    expect(actions.removeTransition).toHaveBeenCalledWith('tr-1')
    expect(onClose).toHaveBeenCalled()
  })
})

describe('read-only', () => {
  it('offers no way to write anything', () => {
    setup({ readOnly: true })
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete this plan' })).toBeNull()
    expect(screen.queryAllByRole('button', { name: 'Add' })).toEqual([])
    expect(screen.queryByRole('button', { name: 'Move by…' })).toBeNull()
    expect((screen.getByDisplayValue('Logistics IT') as HTMLInputElement).disabled).toBe(true)
  })
})

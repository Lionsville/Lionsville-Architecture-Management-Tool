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
  name: 'Acme', diagrams: [],
  relations: [
    { id: 'c-orders', type: 'flow', sourceId: 'wms-old', targetId: 'billing', isBidirectional: false, protocol: 'REST', label: 'orders' },
    { id: 'c-stock', type: 'flow', sourceId: 'billing', targetId: 'wms-old', isBidirectional: false, protocol: 'file' },
    // The stock feed has moved already: a twin on the new end, dated.
    { id: 'c-stock-2', type: 'flow', sourceId: 'billing', targetId: 'wms-new', isBidirectional: false, protocol: 'file', validFrom: '2026-06-01' },
  ],
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
    port: vi.fn(),
    portAll: vi.fn(),
    unport: vi.fn(),
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
      today="2026-09-08"
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

  it('flags a plan as an initiative through the one action, only where there is a scope above', () => {
    const { actions } = setup({ initiativeToggle: true })
    const toggle = screen.getByLabelText('Initiative') as HTMLInputElement
    expect(toggle.checked).toBe(false)
    fireEvent.click(toggle)
    expect(actions.updateTransition).toHaveBeenCalledWith('tr-1', { initiative: true })
    cleanup()
    setup({ plan: { ...PLAN, initiative: true }, initiativeToggle: true })
    fireEvent.click(screen.getByLabelText('Initiative'))
    expect(actions.updateTransition).toHaveBeenCalledTimes(1)
    cleanup()
    setup()
    expect(screen.queryByLabelText('Initiative')).toBeNull()
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

describe('the interfaces', () => {
  it('lists every line on what the plan retires, with where it has gone', () => {
    setup()
    expect(screen.getByText('1 of 2 interfaces ported')).toBeTruthy()
    const orders = screen.getByTestId('port-c-orders')
    expect(orders.textContent).toContain('Billing · orders')
    expect(orders.textContent).toContain('Not yet planned')
    // Its day has come: moved, not merely planned.
    expect(screen.getByTestId('port-c-stock').textContent).toContain('Moved')
  })

  it('ports one line on a day, onto the only place it can go', () => {
    const { actions } = setup()
    fireEvent.change(screen.getByLabelText('Billing · orders: On'), { target: { value: '2027-03-01' } })
    expect(actions.port).toHaveBeenCalledWith('tr-1', 'c-orders', 'wms-new', '2027-03-01')
  })

  it('ports everything remaining on one day as one step, defaulting to the plan\'s end', () => {
    const { actions } = setup()
    expect((screen.getByLabelText('Port all remaining: On') as HTMLInputElement).value).toBe('2028-01-31')
    fireEvent.click(screen.getByRole('button', { name: 'Port all remaining' }))
    expect(actions.portAll).toHaveBeenCalledWith('tr-1', 'wms-new', '2028-01-31')
  })

  it('takes a port back', () => {
    const { actions } = setup()
    fireEvent.click(within(screen.getByTestId('port-c-stock')).getByRole('button', { name: 'Take back' }))
    expect(actions.unport).toHaveBeenCalledWith('tr-1', 'c-stock')
  })

  it('asks where each line goes when the plan introduces more than one thing', () => {
    const { actions } = setup({
      plan: { ...PLAN, elements: [...PLAN.elements, { elementId: 'billing-new', role: 'introduces' }] },
      model: { ...MODEL, elements: [...MODEL.elements, element('billing-new', 'Billing (new)')] } as DesignModel,
    })
    // No target chosen yet for the orders line: its day cannot be set.
    expect((screen.getByLabelText('Billing · orders: On') as HTMLInputElement).disabled).toBe(true)
    fireEvent.mouseDown(within(screen.getByTestId('port-c-orders')).getByRole('combobox'))
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Warehouse Management (new)' }))
    fireEvent.change(screen.getByLabelText('Billing · orders: On'), { target: { value: '2027-03-01' } })
    expect(actions.port).toHaveBeenCalledWith('tr-1', 'c-orders', 'wms-new', '2027-03-01')
  })

  it('says so when there is nothing to move', () => {
    setup({ plan: { ...PLAN, elements: [] } })
    expect(screen.getByText(/Nothing to move yet/)).toBeTruthy()
  })
})

describe('the body', () => {
  it('takes the whole page while editing, and gives the facts back on request', () => {
    setup()
    expect(screen.getByDisplayValue('Logistics IT')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    // Full page: the facts and the interfaces are out of the way.
    expect(screen.queryByDisplayValue('Logistics IT')).toBeNull()
    expect(screen.queryByText('1 of 2 interfaces ported')).toBeNull()
    expect(screen.getByLabelText('Plan source (markdown)')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show the facts' }))
    expect(screen.getByDisplayValue('Logistics IT')).toBeTruthy()
    // Still editing.
    expect(screen.getByLabelText('Plan source (markdown)')).toBeTruthy()
    // And back to reading brings the facts regardless.
    fireEvent.click(screen.getByRole('button', { name: 'Full page' }))
    fireEvent.click(screen.getByRole('button', { name: 'Read' }))
    expect(screen.getByDisplayValue('Logistics IT')).toBeTruthy()
  })

  it('lets the interface list be resized from the seam under it', () => {
    setup()
    const seam = screen.getByRole('separator', { name: 'Resize the interface list' })
    const before = Number(seam.getAttribute('aria-valuenow'))
    fireEvent.keyDown(seam, { key: 'ArrowDown' })
    expect(Number(seam.getAttribute('aria-valuenow'))).toBe(before + 24)
    fireEvent.doubleClick(seam)
    expect(Number(seam.getAttribute('aria-valuenow'))).toBe(before)
  })

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
    expect(screen.queryByRole('button', { name: 'Port all remaining' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Take back' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Move by…' })).toBeNull()
    expect((screen.getByDisplayValue('Logistics IT') as HTMLInputElement).disabled).toBe(true)
  })
})

describe('the document', () => {
  it('turns [[Name]] into a link to the element, followed through the actions', () => {
    const { actions } = setup({
      plan: { ...PLAN, body: 'Retire [[Warehouse Management]] for good.' },
      renderMarkdown: (md, options) => (
        <button data-testid="rendered" onClick={() => options?.onElementLink?.('wms-old')}>{md}</button>
      ),
    })
    expect(screen.getByTestId('rendered').textContent).toContain('[Warehouse Management](element:wms-old)')
    fireEvent.click(screen.getByTestId('rendered'))
    expect(actions.onOpenElement).toHaveBeenCalledWith('wms-old')
  })

  it('is written in the shared source pane, which takes a picture in', async () => {
    const onAddImage = vi.fn(async () => 'screenshot-k1.png')
    const { actions } = setup({ onAddImage })
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const area = screen.getByLabelText('Plan source (markdown)') as HTMLTextAreaElement
    const file = new File([new Uint8Array([1, 2])], 'Screenshot.png', { type: 'image/png' })
    fireEvent.paste(area, { clipboardData: { files: [file], items: [], types: ['Files'], getData: () => '' } })
    await vi.waitFor(() => expect(actions.updateTransition).toHaveBeenCalledWith('tr-1', {
      body: expect.stringContaining('![Screenshot](../images/screenshot-k1.png)'),
    }))
  })

  it('sends the preview away while writing, and brings it back', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByTestId('rendered')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Hide preview' }))
    expect(screen.queryByTestId('rendered')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show preview' }))
    expect(screen.getByTestId('rendered')).toBeTruthy()
  })
})

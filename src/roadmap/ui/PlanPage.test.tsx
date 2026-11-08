// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A plan on its own page (ADR-0010).
 *
 * The rules of a plan are pinned in `model/transition.test.ts`; what is pinned
 * here is what the page promises: a fact reads as words and a press makes that
 * one row a form, every field writes through the action it is given and nothing
 * else, an element's dates are written to the element and not into the plan, the
 * status offers only the moves the machine allows, the text is edited in a focused
 * window, and read-only hides every way of writing.
 */
import { RecordChangesProvider } from '../../comments/ui/RecordChanges'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { PlanPage } from './PlanPage'
import type { PlanActions, PlanPageProps } from './PlanPage'
import { renderShell } from '../../app/testing/renderShell'
import type { DesignElement, DesignModel, Transition } from '../../model'
import type { Adr } from '../../model/adr'
import { chooseValue } from '../../widgets/kit/testing/select'

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

const pressRow = (label: string, value: string | RegExp) => {
  const name = typeof value === 'string' ? `Edit ${label}: ${value}` : value
  fireEvent.click(screen.getByRole('button', { name }))
}
const openStatus = (word: string) => fireEvent.click(screen.getByRole('button', { name: word }))
const section = (name: string) => screen.getByRole('region', { name })
const outlineTo = (name: RegExp) => fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name }))

describe('a plan, as axe reads it', () => {
  it('finds nothing, reading or with a row pressed', async () => {
    setup()
    expect(await axeFindings()).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: /^Edit .*Cutover begins/ }))
    expect(await axeFindings()).toEqual([])
  })
})

describe('one document', () => {
  it('holds an outline of its moves, its text and what is around it, the text\'s own headings among them', () => {
    setup()
    const outline = screen.getByRole('navigation')
    for (const name of [/What it changes/, /Interfaces/, /Milestones/, /Decisions it rests on/, /Goal/, /Boards/, /Principles/, /Changes/, /Comments/]) {
      expect(within(outline).getByRole('button', { name })).toBeTruthy()
    }
    expect(section('Document').textContent).toContain('One warehouse system.')
  })

  it('has no Read and Edit: a fact is words until it is pressed', () => {
    setup()
    expect(screen.queryByRole('button', { name: 'Read' })).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('names each milestone with its day in a strip under the head, and a press opens that row', () => {
    setup()
    fireEvent.click(within(screen.getByRole('group', { name: 'The plan over time' })).getByRole('button', { name: /Cutover begins/ }))
    expect((screen.getByRole('textbox', { name: 'Milestone' }) as HTMLInputElement).value).toBe('Cutover begins')
  })

  it('goes back by name', () => {
    const onClose = vi.fn()
    setup({ onClose })
    fireEvent.click(screen.getByRole('button', { name: 'Roadmap' }))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('the head', () => {
  it('renames on a press of the title, through the one action', () => {
    const { actions } = setup()
    fireEvent.click(screen.getByRole('button', { name: /Replace the warehouse system/ }))
    const field = screen.getByRole('textbox')
    fireEvent.change(field, { target: { value: 'Another name' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(actions.updateTransition).toHaveBeenCalledWith('tr-1', { title: 'Another name' })
  })

  it('offers the initiative in ⋯ only where there is a scope above, and says it when on', () => {
    const { actions } = setup({ initiativeToggle: true })
    fireEvent.click(screen.getByRole('button', { name: 'Plan' }))
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /Follow on the roadmaps above/ }))
    expect(actions.updateTransition).toHaveBeenCalledWith('tr-1', { initiative: true })
    cleanup()
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Plan' }))
    expect(screen.queryByRole('menuitemcheckbox')).toBeNull()
    cleanup()
    setup({ initiativeToggle: true, plan: { ...PLAN, initiative: true } })
    expect(screen.getByText('Also on the roadmaps above')).toBeTruthy()
  })

  it('offers only the moves its status machine allows', () => {
    setup({ plan: { ...PLAN, status: 'abandoned' } })
    openStatus('Abandoned')
    expect(screen.getAllByRole('menuitemcheckbox').map((row) => row.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('Abandoned')]))
    expect(screen.queryByRole('menuitemcheckbox', { name: /Running/ })).toBeNull()
  })

  it('says one line on where it stands, and what holds a move only in the menu, each a way to what clears it', () => {
    setup({ plan: { ...PLAN, status: 'draft', owner: undefined } })
    expect(screen.getByTestId('plan-standing').textContent).toContain('1 thing holds it from Agreed')
    openStatus('Draft')
    const agreed = screen.getByRole('menuitemcheckbox', { name: /Agreed/ })
    expect(agreed.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Somebody answers for it' }))
    expect(screen.getByTestId('plan-owner')).toBeTruthy()
  })

  it('records the day a plan is done, and clears it when the plan is reopened', () => {
    const body = { ...PLAN, status: 'running' as const, from: '2026-01-01', elements: [], decisions: [] }
    const { actions } = setup({ plan: body, model: { ...MODEL, relations: [] } as DesignModel })
    openStatus('Running')
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /Done/ }))
    expect(actions.updateTransition).toHaveBeenCalledWith('tr-1', expect.objectContaining({ status: 'done', doneOn: '2026-09-08' }))
  })

  it('will not write a window that runs backwards, and says why in place', () => {
    const { actions } = setup()
    pressRow('Window', /^Edit Window/)
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-01-01' } })
    expect(actions.updateTransition).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain('To cannot be before From.')
  })

  it('says what a move will do before it does it, what stays too, and moves as one action', () => {
    const { actions } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Move by…' }))
    const dialog = screen.getByRole('dialog', { name: 'Move this plan' })
    expect(dialog.textContent).toContain('14 Feb 2027 to 1 Mar 2028')
    expect(dialog.textContent).toMatch(/Warehouse Management \(new\) goes live on 1 May 2027/)
    expect(dialog.textContent).toContain('Interfaces with a day stay on theirs.')
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Earlier' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Move by 30 days' }))
    expect(actions.shiftTransition).toHaveBeenCalledWith('tr-1', -30)
  })
})

describe('what it changes', () => {
  it('lists the elements one line each, with the date that matters', () => {
    setup()
    const here = section('What it changes')
    expect(within(here).getByText('Retires')).toBeTruthy()
    expect(within(here).getByText('gone on 31 Jan 2028')).toBeTruthy()
    expect(within(here).getByText('live from 1 Apr 2027')).toBeTruthy()
  })

  it('makes a pressed row a form: its role, its dates to the element and never into the plan, and Remove', () => {
    const { actions } = setup()
    pressRow('Retires', 'Warehouse Management')
    fireEvent.change(screen.getByLabelText('Warehouse Management: Gone on'), { target: { value: '2028-02-01' } })
    expect(actions.updateElementDates).toHaveBeenCalledWith('wms-old', expect.objectContaining({ retired: '2028-02-01' }))
    chooseValue(screen.getByLabelText('Role'), 'changes')
    expect(actions.updateTransition).toHaveBeenCalledWith('tr-1', { elements: [{ elementId: 'wms-old', role: 'changes' }, PLAN.elements[1]] })
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(actions.updateTransition).toHaveBeenLastCalledWith('tr-1', { elements: [PLAN.elements[1]] })
  })

  it('keeps a day that would run the dates backwards in its field, says why, and writes nothing', () => {
    const { actions } = setup()
    pressRow('Retires', 'Warehouse Management')
    fireEvent.change(screen.getByLabelText('Warehouse Management: Gone on'), { target: { value: '2026-01-01' } })
    expect(actions.updateElementDates).not.toHaveBeenCalled()
  })

  it('adds an element after +, grouped by kind, and introduces only what has a lifecycle', () => {
    const model = { ...MODEL, elements: [...MODEL.elements, element('cap', 'A capability', { kind: 'function' })] } as DesignModel
    const { actions } = setup({ model })
    expect(screen.queryByTestId('plan-add-element')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '+ Element' }))
    const adding = screen.getByTestId('plan-add-element')
    const field = within(adding).getByRole('combobox', { name: /Add what it introduces/ })
    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: 'capab' } })
    expect(screen.queryByRole('option', { name: /A capability/ })).toBeNull()
    chooseValue(within(adding).getByLabelText('Role'), 'changes')
    // Choosing took the focus to the role's list and back; the search's own list comes with the focus.
    fireEvent.focus(field)
    fireEvent.click(screen.getByRole('option', { name: /A capability/ }))
    expect(actions.updateTransition).toHaveBeenCalledWith('tr-1', { elements: [...PLAN.elements, { elementId: 'cap', role: 'changes' }] })
  })

  it('says an element deleted since is no longer here, and offers no dates for it', () => {
    setup({ plan: { ...PLAN, elements: [{ elementId: 'gone', role: 'retires' }] } })
    expect(section('What it changes').querySelector('[data-gone]')?.textContent).toBe('An element no longer here')
    pressRow('Retires', 'An element no longer here')
    expect(screen.queryByLabelText(/Gone on/)).toBeNull()
  })

  it('dates a stand-in by the scope that defines it', () => {
    const model = { ...MODEL, elements: [...MODEL.elements, element('crm', 'Customer Hub', { ref: 'sales' }), element('portal', 'Partner Portal', { ref: 'sales', lifecycle: 'planned' })] } as DesignModel
    const plan: Transition = { ...PLAN, status: 'running', elements: [{ elementId: 'crm', role: 'retires' }, { elementId: 'portal', role: 'introduces' }] }
    const describe = (id: string) => (id === 'crm' ? { where: 'Sales', retired: '2027-06-30' } : id === 'portal' ? { where: 'Sales' } : undefined)
    setup({ plan, model, describe })
    expect(screen.getByTestId('plan-standin-crm').textContent).toBe('Gone on 30 Jun 2027, as Sales says.')
    expect(screen.getByTestId('plan-standin-portal').textContent).toBe('Its dates are kept in Sales, which defines it; set them there.')
    pressRow('Introduces', 'Partner Portal')
    expect(screen.queryByLabelText(/Live from/)).toBeNull()
  })
})

describe('milestones and decisions', () => {
  it('adds a milestone after +, on the plan\'s end day, and edits one in place, kept on leaving', () => {
    const { actions } = setup()
    fireEvent.click(screen.getAllByRole('button', { name: '+ Milestone' })[0])
    const name = screen.getByRole('textbox', { name: 'Milestone' })
    expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe('2028-01-31')
    fireEvent.change(name, { target: { value: 'The end' } })
    fireEvent.keyDown(name, { key: 'Enter' })
    expect(actions.updateTransition).toHaveBeenCalledWith('tr-1', { milestones: [...PLAN.milestones, { date: '2028-01-31', name: 'The end' }] })
  })

  it('drops what was typed on Escape', () => {
    const { actions } = setup()
    fireEvent.click(screen.getByRole('button', { name: /^Edit .*Cutover begins/ }))
    const name = screen.getByRole('textbox', { name: 'Milestone' })
    fireEvent.change(name, { target: { value: 'Other' } })
    fireEvent.keyDown(name, { key: 'Escape' })
    expect(actions.updateTransition).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox', { name: 'Milestone' })).toBeNull()
  })

  it('says a milestone outside the window, and allows it', () => {
    setup({ plan: { ...PLAN, milestones: [{ date: '2028-03-01', name: 'Late' }, { date: '2027-01-01', name: 'Early' }] } })
    const here = section('Milestones')
    expect(within(here).getByText('after the plan’s last day')).toBeTruthy()
    expect(within(here).getByText('before the plan’s first day')).toBeTruthy()
  })

  it('names the decisions it rests on, says one not accepted, and offers the rest', () => {
    const { actions } = setup({ plan: { ...PLAN, decisions: ['adr-1'] } })
    fireEvent.click(screen.getByRole('button', { name: '+ Decision' }))
    const field = within(screen.getByTestId('plan-add-decision')).getByRole('combobox')
    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: 'scanners' } })
    fireEvent.click(screen.getByRole('option', { name: /Keep the old scanners/ }))
    expect(actions.updateTransition).toHaveBeenCalledWith('tr-1', { decisions: ['adr-1', 'adr-2'] })
  })

  it('takes a record deleted since off the plan, and opens one that is there', () => {
    const { actions } = setup({ plan: { ...PLAN, decisions: ['adr-1', 'adr-gone'] } })
    expect(section('Decisions it rests on').querySelector('[data-gone]')?.textContent).toBe('A decision record no longer here')
    pressRow('—', /A decision record no longer here/)
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(actions.updateTransition).toHaveBeenCalledWith('tr-1', { decisions: ['adr-1'] })
    fireEvent.click(screen.getByRole('button', { name: /One warehouse system/ }))
    fireEvent.click(within(section('Decisions it rests on')).getByRole('button', { name: 'One warehouse system' }))
    expect(actions.onOpenDecision).toHaveBeenCalledWith('adr-1')
  })
})

describe('the interfaces', () => {
  const opened = () => { outlineTo(/Interfaces/); return section('Interfaces') }

  it('wait to be asked for, and say where they all go once', () => {
    setup()
    expect(screen.queryByRole('region', { name: 'Interfaces' })).toBeNull()
    expect(within(section('What it changes')).getByText('1 of 2 have a day')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Set days/ }))
    expect(screen.getByTestId('plan-interfaces-said').textContent).toBe('All move to Warehouse Management (new). 1 of 2 have a day.')
  })

  it('narrow by state, and say no day in words', () => {
    setup()
    const here = opened()
    expect(within(here).getByText('No day yet')).toBeTruthy()
    fireEvent.change(within(here).getByRole('searchbox'), { target: { value: 'orders' } })
    expect(within(here).getAllByRole('row').filter((row) => row.textContent?.includes('Billing'))).toHaveLength(1)
  })

  it('open a large preview that reads a label whole, sets a day and takes one back', () => {
    const { actions } = setup()
    const here = opened()
    fireEvent.click(within(here).getByRole('row', { name: /orders/ }))
    const preview = screen.getByRole('dialog', { name: 'Billing' })
    fireEvent.change(within(preview).getByLabelText('Moves on'), { target: { value: '2027-05-01' } })
    expect(actions.port).toHaveBeenCalledWith('tr-1', 'c-orders', 'wms-new', '2027-05-01')
    fireEvent.keyDown(preview, { key: 'Escape' })
  })

  it('give the rest a day as one step', () => {
    const { actions } = setup()
    const here = opened()
    fireEvent.click(within(here).getByRole('button', { name: 'Give the rest a day…' }))
    const dialog = screen.getByRole('dialog', { name: 'Give the rest a day…' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Move 1 on this day' }))
    expect(actions.portAll).toHaveBeenCalledWith('tr-1', 'wms-new', '2028-01-31')
  })

  it('say when there is nothing to move', () => {
    setup({ plan: { ...PLAN, elements: [] } })
    outlineTo(/Interfaces/)
    expect(section('Interfaces').textContent).toContain('Nothing to move yet')
  })
})

describe('the boards it changes', () => {
  const boards = {
    ...MODEL,
    diagrams: [
      { id: 'b1', name: 'Landscape', kind: 'layer7', members: [{ id: 'wms-old' }, { id: 'wms-new' }] },
      { id: 'b2', name: 'In 2027', kind: 'layer7', members: [{ id: 'wms-old' }], asOf: '2027-01-01' },
    ],
  } as unknown as DesignModel

  it('are worked out from what the plan names, and open on the plan\'s next day, looking only', () => {
    const onOpenBoard = vi.fn()
    const { actions } = setup({ model: boards, actions: { onOpenBoard } as never })
    void actions
    const here = section('Boards')
    expect(within(here).getByText('all 2')).toBeTruthy()
    fireEvent.click(within(here).getByRole('button', { name: 'Open on 1 Apr 2027' }))
    expect(onOpenBoard).toHaveBeenCalledWith('tr-1', 'b1', '2027-04-01')
    fireEvent.click(within(here).getByRole('button', { name: 'Open' }))
    expect(onOpenBoard).toHaveBeenLastCalledWith('tr-1', 'b2', undefined)
  })

  it('can be duplicated as of the plan\'s last day', () => {
    const onDuplicateBoard = vi.fn()
    setup({ model: boards, actions: { onDuplicateBoard, onOpenBoard: vi.fn() } as never })
    fireEvent.click(within(section('Boards')).getAllByRole('button', { name: 'Duplicate as of 31 Jan 2028…' })[0])
    expect(onDuplicateBoard).toHaveBeenCalledWith('b1', '2028-01-31')
  })
})

describe('the text', () => {
  it('turns [[Name]] into a link through the renderer, and is edited with nothing else on screen, saved as one step', () => {
    const { actions } = setup({ plan: { ...PLAN, body: 'See [[Billing]].' } })
    expect(screen.getByTestId('rendered').textContent).toContain('element:billing')
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const area = screen.getByLabelText('Plan source (markdown)') as HTMLTextAreaElement
    fireEvent.change(area, { target: { value: 'Other words' } })
    expect(actions.updateTransition).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(actions.updateTransition).toHaveBeenCalledWith('tr-1', { body: 'Other words' })
    expect(screen.queryByLabelText('Plan source (markdown)')).toBeNull()
  })

  it('asks before Cancel drops what was typed', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Plan source (markdown)'), { target: { value: 'Other words' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByRole('button', { name: 'Leave and drop changes' })).toBeTruthy()
  })

  it('takes a picture in', async () => {
    const onAddImage = vi.fn(async () => 'screenshot-k1.png')
    setup({ onAddImage })
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const area = screen.getByLabelText('Plan source (markdown)') as HTMLTextAreaElement
    const file = new File([new Uint8Array([1, 2])], 'Screenshot.png', { type: 'image/png' })
    fireEvent.paste(area, { clipboardData: { files: [file], items: [], types: ['Files'], getData: () => '' } })
    await vi.waitFor(() => expect(area.value).toContain('![Screenshot](image:screenshot-k1.png)'))
  })
})

describe('a plan\'s changes (ADR-0038, amended §11)', () => {
  it('says who proposed it and who changed it, read from the history by the plan', async () => {
    const entriesOf = vi.fn(async () => ({ entries: [{ id: 'e2', at: Date.UTC(2026, 9, 20, 9), by: 'Bo Example' }, { id: 'e1', at: Date.UTC(2026, 9, 1, 9), by: 'Ada Example' }], more: false }))
    renderShell(
      <RecordChangesProvider value={{ entriesOf, whatOf: async () => ['changed the window', 'Created'] }}>
        <PlanPage open plan={PLAN} model={MODEL} decisions={ADRS} today="2026-09-08" readOnly={false} onClose={vi.fn()} actions={{} as PlanActions} />
      </RecordChangesProvider>,
    )
    expect((await screen.findByTestId('record-changes-line')).textContent).toContain('Proposed by Ada Example')
    expect(entriesOf).toHaveBeenCalledWith({ kind: 'transition', id: PLAN.id }, undefined)
  })
})

describe('deleting', () => {
  it('asks first in ⋯, then removes and closes', () => {
    const onClose = vi.fn()
    const { actions } = setup({ onClose })
    fireEvent.click(screen.getByRole('button', { name: 'Plan' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete this plan…' }))
    expect(actions.removeTransition).not.toHaveBeenCalled()
    fireEvent.click(within(screen.getByRole('dialog', { name: /Delete/ })).getByRole('button', { name: 'Delete this plan' }))
    expect(actions.removeTransition).toHaveBeenCalledWith('tr-1')
    expect(onClose).toHaveBeenCalled()
  })
})

describe('read-only', () => {
  it('offers no + and nothing to press, and still opens what it names', () => {
    const { actions } = setup({ readOnly: true })
    expect(screen.queryByRole('button', { name: /^\+/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Move by…' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Edit / })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Plan' })).toBeNull()
    fireEvent.click(within(section('What it changes')).getByRole('button', { name: 'Warehouse Management' }))
    expect(actions.onOpenElement).toHaveBeenCalledWith('wms-old')
  })
})

describe('a link to the plan', () => {
  it('is offered under the head’s ⋯, read-only too, and only where the host makes links', () => {
    const onCopyLink = vi.fn()
    setup({ readOnly: true, onCopyLink })
    fireEvent.click(screen.getByRole('button', { name: 'Plan' }))
    fireEvent.click(screen.getByTestId('plan-copy-link'))
    expect(onCopyLink).toHaveBeenCalled()
    cleanup()
    setup()
    expect(screen.queryByTestId('plan-copy-link')).toBeNull()
  })
})

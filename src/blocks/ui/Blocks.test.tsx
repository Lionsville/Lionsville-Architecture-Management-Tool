// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The building-block screens (ADR-0043 §6–§8): the register, a block's page
 * tab by tab — the requirements' grid, the catalogue, where it is used and
 * one scope's evaluation with its fit — and the changes each asks the access
 * for, with nothing a person who may only read could press.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderShell } from '../../app/testing/renderShell'
import { axeFindings } from '../../app/testing/axe'
import { translator } from '../../i18n'
import type { Evaluation } from '../../model/evaluation'
import type { DesignElement } from '../../model/types'
import { NO_WINDOW_CHROME } from '../../platform/windowChrome'
import { BlockPage } from './BlockPage'
import { BlocksProvider } from './BlocksContext'
import type { BlocksAccess, BlockRow, EvaluationRow } from './BlocksContext'
import { BlocksRegisterPage } from './BlocksRegisterPage'
import { askToEdit } from '../../widgets/kit/editOnArrival'
import { chooseValue } from '../../widgets/kit/testing/select'

afterEach(cleanup)

const s = translator('en')

const GATEWAY: DesignElement = {
  id: 'blk-gw', kind: 'buildingBlock', name: 'Message gateway', lifecycle: 'live', isManaged: false, aspects: {},
  description: 'What it is.\n\n## Many partners\n\nEvery day.\n',
  capabilities: [{ id: 'cap-route', text: 'Routes by content' }, { id: 'cap-audit', text: 'Keeps an audit trail', must: true }],
  contexts: [{ id: 'cx-partners', name: 'Many partners', needs: { 'cap-route': 4, 'cap-audit': 2 } }, { id: 'cx-filings', name: 'Filings', needs: { 'cap-audit': 4 } }],
  sbbs: [{ id: 'sb-a', name: 'Broker A', sort: 'product', status: 'candidate', elements: ['app-broker'] }, { id: 'sb-b', name: 'Managed bus', sort: 'service', status: 'evaluated' }],
}

const SALES: Evaluation = {
  id: 'topics.integration~blk-gw', block: { scope: 'topics/integration', id: 'blk-gw' }, contexts: ['cx-partners'], options: ['sb-a', 'sb-b'],
  coverage: { 'sb-a': { 'cap-route': { level: 4 }, 'cap-audit': { level: 2, how: 'Logs only' } }, 'sb-b': { 'cap-route': { level: 2 }, 'cap-audit': { level: 4 } } },
  chosen: 'sb-b', decidedBy: 'adr-2',
}

const NAMES: Record<string, string> = { '': 'Acme', 'topics/integration': 'Integration', sales: 'Sales', stock: 'Stock' }

/** The block as the tree's index has it: without its document, which is read from its scope. */
const { description: _document, ...INDEXED } = GATEWAY

function accessOver(over: Partial<BlocksAccess> = {}): BlocksAccess {
  const row: BlockRow = { scope: 'topics/integration', block: INDEXED }
  const evaluations: EvaluationRow[] = [{ scope: 'sales', evaluation: SALES }]
  return {
    version: 1,
    blocks: () => [row], block: (id) => (id === 'blk-gw' ? row : undefined),
    evaluationsOf: () => evaluations,
    blocksAt: () => ({ kept: [row], evaluated: [] }),
    mayWrite: () => true,
    scopeLabel: (path) => NAMES[path] ?? path,
    aspectLabel: () => ({ label: 'PR-0001.1', title: 'Least privilege' }),
    citationsOf: () => [{ label: 'PR-0001 Least privilege', stance: 'supports' }],
    aspectChoices: () => [{ aspect: { scope: '', id: 'pr-1', number: 1 }, label: 'PR-0001.1 One role per task' }],
    elementName: (id) => (id === 'app-broker' ? 'Broker' : id),
    elementChoices: () => [{ id: 'app-broker', name: 'Broker' }],
    placeChoices: () => [{ path: 'topics/integration', name: 'Integration', depth: 0, topic: true }, { path: '', name: 'Acme', depth: 0 }],
    evaluateChoices: () => [{ path: 'stock', name: 'Stock', depth: 1 }],
    document: vi.fn(async () => GATEWAY.description), create: vi.fn(async () => 'blk-new'), update: vi.fn(), evaluate: vi.fn(async () => true), updateEvaluation: vi.fn(), removeEvaluation: vi.fn(),
    propose: vi.fn(async () => 'adr-9'), openDecision: vi.fn(), openScope: vi.fn(), openBlock: vi.fn(),
    makeId: (prefix) => `${prefix}-new`, today: () => '2026-11-02',
    ...over,
  }
}

/** The last change to the block, worked out over the block as its scope holds it where it was handed as a function. */
const patchOf = (access: BlocksAccess) => {
  const patch = vi.mocked(access.update).mock.lastCall![1]
  return typeof patch === 'function' ? patch(GATEWAY) : patch
}

const page = (access: BlocksAccess, extra: { evaluation?: string } = {}) => renderShell(
  <BlocksProvider value={access}><BlockPage open id="blk-gw" {...extra} onClose={() => {}} windowChrome={NO_WINDOW_CHROME} /></BlocksProvider>,
)

describe('the register of building blocks', () => {
  it('lists each block under where it is kept, reads it large on selecting it, and opens its workbench from there', async () => {
    const access = accessOver()
    renderShell(<BlocksProvider value={access}><BlocksRegisterPage open at="" onClose={() => {}} windowChrome={NO_WINDOW_CHROME} /></BlocksProvider>)
    expect(screen.getByRole('row', { name: /Kept in Integration/ })).toBeTruthy()
    const row = screen.getByRole('row', { name: /Message gateway/ })
    expect(row.textContent).toContain('Chosen in 1 scope')
    expect(await axeFindings()).toEqual([])
    fireEvent.click(row)
    const reader = screen.getByRole('dialog')
    expect(reader.textContent).toContain('Many partners, Filings')
    expect(reader.textContent).toContain('Sales ✓')
    expect(reader.textContent).toContain('Broker A, Managed bus')
    fireEvent.click(within(reader).getByRole('button', { name: 'Open full record' }))
    expect(access.openBlock).toHaveBeenCalledWith('blk-gw')
  })

  it('says what a block is for and which of the three is wanted where there are none, with New only for who may write', async () => {
    renderShell(<BlocksProvider value={accessOver({ blocks: () => [] })}><BlocksRegisterPage open at="" onClose={() => {}} windowChrome={NO_WINDOW_CHROME} /></BlocksProvider>)
    expect(screen.getByText(s('guidance.empty.blocksTitle'))).toBeTruthy()
    expect(screen.getByRole('table')).toBeTruthy()
    expect(screen.getByRole('button', { name: s('blocks.new') })).toBeTruthy()
    expect(await axeFindings()).toEqual([])
    cleanup()
    renderShell(<BlocksProvider value={accessOver({ blocks: () => [], mayWrite: () => false })}><BlocksRegisterPage open at="" onClose={() => {}} windowChrome={NO_WINDOW_CHROME} /></BlocksProvider>)
    expect(screen.queryByRole('button', { name: s('blocks.new') })).toBeNull()
  })

  it('keeps a new block in a topic first, and opens it', async () => {
    const access = accessOver()
    renderShell(<BlocksProvider value={access}><BlocksRegisterPage open at="" onClose={() => {}} windowChrome={NO_WINDOW_CHROME} /></BlocksProvider>)
    fireEvent.click(screen.getByTestId('blocks-new'))
    fireEvent.change(screen.getByTestId('block-name'), { target: { value: 'Identity service' } })
    fireEvent.click(screen.getByTestId('block-create'))
    await waitFor(() => expect(access.openBlock).toHaveBeenCalledWith('blk-new'))
    expect(access.create).toHaveBeenCalledWith('topics/integration', 'Identity service')
  })

  it('says nothing matched a search, and offers no new block to a person who may write nowhere', () => {
    renderShell(<BlocksProvider value={accessOver({ mayWrite: () => false })}><BlocksRegisterPage open at="" onClose={() => {}} windowChrome={NO_WINDOW_CHROME} /></BlocksProvider>)
    expect(screen.queryByTestId('blocks-new')).toBeNull()
    fireEvent.change(screen.getByRole('searchbox', { name: s('blocks.search') }), { target: { value: 'nothing like it' } })
    expect(screen.getByText(s('blocks.searchEmpty', { query: 'nothing like it' }))).toBeTruthy()
  })
})

describe('a building block\'s page', () => {
  /** The Requirements tab's cell, the matrix's way: selected by a press, written by a key. */
  const onRequirements = () => fireEvent.click(screen.getByRole('tab', { name: s('blocks.requirements') }))
  const cellOf = (text: RegExp) => screen.getByRole('gridcell', { name: text })

  it('opens on About', () => {
    page(accessOver())
    expect(screen.getByRole('tab', { name: s('blocks.about') }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('block-document')).toBeTruthy()
  })

  it('draws the requirements as balls with a legend: a press moves one a quarter, ⇧-press back, and Space from the keyboard', async () => {
    const access = accessOver()
    page(access)
    onRequirements()
    expect(screen.getByText(s('blocks.setBall'))).toBeTruthy()
    const cell = cellOf(/Routes by content, Many partners/)
    // Essential, and a press more is not needed: after full, back to none.
    fireEvent.click(cell)
    expect(access.update).toHaveBeenLastCalledWith('blk-gw', { contexts: [{ id: 'cx-partners', name: 'Many partners', needs: { 'cap-audit': 2 } }, GATEWAY.contexts![1]] })
    fireEvent.click(cellOf(/Keeps an audit trail, Filings/), { shiftKey: true })
    expect(access.update).toHaveBeenLastCalledWith('blk-gw', { contexts: [{ id: 'cx-partners', name: 'Many partners', needs: { 'cap-audit': 2 } }, { ...GATEWAY.contexts![1], needs: { 'cap-audit': 3 } }] })
    const other = cellOf(/Keeps an audit trail, Many partners/)
    fireEvent.focus(other)
    fireEvent.keyDown(other, { key: '0' })
    expect(access.update).toHaveBeenLastCalledWith('blk-gw', { contexts: [{ id: 'cx-partners', name: 'Many partners', needs: {} }, { ...GATEWAY.contexts![1], needs: { 'cap-audit': 3 } }] })
    expect(await axeFindings()).toEqual([])
  })

  it('offers a need\'s five levels by name on the cell\'s menu', async () => {
    const access = accessOver()
    page(access)
    onRequirements()
    fireEvent.contextMenu(cellOf(/Routes by content, Filings/))
    expect(screen.getByRole('menuitemradio', { name: s('blocks.need0') }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByRole('menuitemradio', { name: s('blocks.need3') }))
    expect(access.update).toHaveBeenLastCalledWith('blk-gw', { contexts: [GATEWAY.contexts![0], { ...GATEWAY.contexts![1], needs: { 'cap-audit': 4, 'cap-route': 3 } }] })
  })

  it('writes nothing on a press where the person may only read', () => {
    const access = accessOver({ mayWrite: () => false })
    page(access)
    onRequirements()
    fireEvent.click(cellOf(/Routes by content, Many partners/))
    fireEvent.contextMenu(cellOf(/Routes by content, Many partners/))
    expect(screen.queryByRole('menu')).toBeNull()
    expect(access.update).not.toHaveBeenCalled()
    expect(screen.queryByText(s('blocks.setBall'))).toBeNull()
  })

  it('builds a second key on the first, before the tree has been read again', () => {
    const access = accessOver()
    page(access)
    onRequirements()
    const cell = cellOf(/Keeps an audit trail, Many partners/)
    fireEvent.focus(cell)
    fireEvent.keyDown(cell, { key: ' ' })
    fireEvent.keyDown(cell, { key: ' ' })
    expect(access.update).toHaveBeenLastCalledWith('blk-gw', { contexts: [{ id: 'cx-partners', name: 'Many partners', needs: { 'cap-route': 4, 'cap-audit': 4 } }, GATEWAY.contexts![1]] })
  })

  it('adds a usage context with its chapter in the document, in one change', () => {
    const access = accessOver()
    page(access)
    onRequirements()
    fireEvent.click(screen.getByTestId('block-add-context'))
    fireEvent.change(screen.getByTestId('context-name'), { target: { value: 'Regulators' } })
    fireEvent.click(screen.getByTestId('context-add'))
    // Worked out over the document the scope keeps, which the page's row does not carry.
    const patch = vi.mocked(access.update).mock.lastCall![1]
    expect(typeof patch === 'function' ? patch(GATEWAY) : patch).toEqual({
      contexts: [...GATEWAY.contexts!, { id: 'cx-new', name: 'Regulators', needs: {} }],
      description: 'What it is.\n\n## Many partners\n\nEvery day.\n\n## Regulators\n',
    })
  })

  it('adds a capability that answers to a principle\'s aspect, and takes one off its contexts\' needs too', async () => {
    const access = accessOver()
    page(access)
    onRequirements()
    fireEvent.click(screen.getByTestId('block-add-capability'))
    fireEvent.change(screen.getByTestId('capability-text'), { target: { value: 'Signs every message' } })
    fireEvent.click(screen.getByTestId('capability-add'))
    expect(patchOf(access)).toEqual({ capabilities: [...GATEWAY.capabilities!, { id: 'cap-new', text: 'Signs every message' }] })
    fireEvent.click(screen.getByRole('button', { name: s('blocks.moreOf', { name: 'Routes by content' }) }))
    fireEvent.click(await screen.findByRole('menuitem', { name: s('blocks.remove') }))
    expect(access.update).toHaveBeenLastCalledWith('blk-gw', {
      capabilities: [GATEWAY.capabilities![1]],
      contexts: [{ id: 'cx-partners', name: 'Many partners', needs: { 'cap-audit': 2 } }, GATEWAY.contexts![1]],
    })
  })

  it('adds capabilities one after another: Enter adds and the dialog stays for the next, each onto what the scope holds', () => {
    const access = accessOver()
    page(access)
    onRequirements()
    fireEvent.click(screen.getByTestId('block-add-capability'))
    fireEvent.change(screen.getByTestId('capability-text'), { target: { value: 'Signs every message' } })
    fireEvent.submit(screen.getByTestId('capability-text').closest('form')!)
    expect(patchOf(access)).toEqual({ capabilities: [...GATEWAY.capabilities!, { id: 'cap-new', text: 'Signs every message' }] })
    expect(screen.getByRole('status').textContent).toBe(s('blocks.added', { name: 'Signs every message' }))
    expect(screen.getByTestId('capability-text')).toHaveProperty('value', '')
    fireEvent.change(screen.getByTestId('capability-text'), { target: { value: 'Retries' } })
    fireEvent.click(screen.getByTestId('capability-add-next'))
    expect(access.update).toHaveBeenCalledTimes(2)
  })

  it('takes a pasted list as one step, a ! a must, and none the block has twice', () => {
    const access = accessOver()
    page(access)
    onRequirements()
    fireEvent.click(screen.getByTestId('block-add-capability'))
    fireEvent.click(screen.getByTestId('capability-list-toggle'))
    fireEvent.change(screen.getByTestId('capability-list'), { target: { value: '- Signs every message!\nRoutes by content\n! Retries' } })
    expect(screen.getByRole('status').textContent).toBe(s('blocks.listedMusts', { count: 2, musts: 2 }))
    fireEvent.click(screen.getByTestId('capability-add-list'))
    expect(access.update).toHaveBeenCalledTimes(1)
    expect(patchOf(access)).toEqual({ capabilities: [...GATEWAY.capabilities!, { id: 'cap-new', text: 'Signs every message', must: true }, { id: 'cap-new', text: 'Retries', must: true }] })
    expect(screen.queryByTestId('capability-list')).toBeNull()
  })

  it('says what a need is called under the need grid, not how far something is covered', () => {
    page(accessOver())
    onRequirements()
    const legend = screen.getByRole('list', { name: s('blocks.needLegend') })
    expect(legend.textContent).toContain(s('blocks.need4'))
    expect(legend.textContent).not.toContain(s('blocks.level4'))
  })

  it('reads its document, opens a context\'s chapter from its head, and lists the principles it cites', async () => {
    const access = accessOver()
    page(access)
    onRequirements()
    fireEvent.click(screen.getByRole('button', { name: 'Many partners' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: s('blocks.chapterOf', { name: 'Many partners' }) }))
    expect(await within(screen.getByTestId('block-document')).findByRole('heading', { name: 'Many partners' })).toBeTruthy()
    expect(access.document).toHaveBeenCalledWith('blk-gw')
    expect(screen.getByText('PR-0001 Least privilege')).toBeTruthy()
  })

  it('writes its document in a focused window from what was read, and reads what was written', async () => {
    const access = accessOver()
    page(access)
    const edit = screen.getByTestId('block-document-edit')
    await waitFor(() => expect(edit).toHaveProperty('disabled', false))
    fireEvent.click(edit)
    const source = screen.getByRole('textbox', { name: s('blocks.document') })
    expect(source).toHaveProperty('value', GATEWAY.description)
    fireEvent.change(source, { target: { value: 'Written again.' } })
    fireEvent.click(screen.getByRole('button', { name: s('blocks.save') }))
    await waitFor(() => expect(screen.getByTestId('block-document').textContent).toBe('Written again.'))
    expect(access.update).toHaveBeenCalledTimes(1)
    expect(access.update).toHaveBeenCalledWith('blk-gw', { description: 'Written again.' })
  })

  it('opens already writing when ✎ Edit on its preview asked, and only for who may write', async () => {
    const access = accessOver()
    renderShell(<BlocksProvider value={access}><BlocksRegisterPage open at="" onClose={() => {}} windowChrome={NO_WINDOW_CHROME} /></BlocksProvider>)
    fireEvent.click(screen.getByRole('row', { name: /Message gateway/ }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Edit' }))
    expect(access.openBlock).toHaveBeenCalledWith('blk-gw')
    cleanup()
    page(access)
    expect(await screen.findByRole('textbox', { name: s('blocks.document') })).toHaveProperty('value', GATEWAY.description)
    cleanup()
    askToEdit('blocks', 'blk-gw')
    page(accessOver({ mayWrite: () => false }))
    await waitFor(() => expect(screen.getByTestId('block-document').textContent).toContain('What it is.'))
    expect(screen.queryByRole('textbox', { name: s('blocks.document') })).toBeNull()
  })

  it('offers the way to the scope where its principles are cited', () => {
    const access = accessOver()
    page(access)
    fireEvent.click(screen.getByRole('button', { name: s('blocks.openIn', { scope: 'Integration' }) }))
    expect(access.openScope).toHaveBeenCalledWith('topics/integration')
  })

  it('starts no draft of its document before it has been read, so nothing is saved over it', () => {
    page(accessOver({ document: () => new Promise(() => {}) }))
    fireEvent.click(screen.getByTestId('block-document-edit'))
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  })

  const onOptions = () => fireEvent.click(screen.getByRole('tab', { name: s('blocks.solutions') }))

  it('writes its text from the tab it is on, and leaves the person there after Cancel', async () => {
    page(accessOver())
    onOptions()
    fireEvent.click(screen.getByTestId('block-document-edit'))
    await screen.findByRole('textbox', { name: s('blocks.document') })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.getByRole('tab', { name: s('blocks.solutions') }).getAttribute('aria-selected')).toBe('true'))
  })

  it('lists its options with where each is weighed and chosen, and the elements that are it', () => {
    page(accessOver({ mayWrite: () => false }))
    onOptions()
    const cells = within(screen.getByRole('row', { name: /Broker A/ })).getAllByRole('gridcell').map((cell) => cell.textContent)
    expect(cells).toEqual(['Broker A', '—', 'product', 'Candidate', 'Sales', '—', 'Broker'])
    expect(screen.getByRole('row', { name: /Managed bus/ }).textContent).toContain('Sales')
  })

  it('links an option to the landscape element that is it, from its row', async () => {
    const access = accessOver()
    page(access)
    onOptions()
    fireEvent.click(screen.getByRole('button', { name: s('blocks.elementsOf', { name: 'Managed bus' }) }))
    const field = await screen.findByRole('combobox', { name: s('blocks.isElement') })
    fireEvent.keyDown(field, { key: 'ArrowDown' })
    fireEvent.click(await screen.findByRole('option', { name: 'Broker' }))
    fireEvent.click(screen.getByTestId('sbb-elements-save'))
    expect(access.update).toHaveBeenCalledWith('blk-gw', { sbbs: [GATEWAY.sbbs![0], { ...GATEWAY.sbbs![1], elements: ['app-broker'] }] })
  })

  it('opens a scope\'s evaluation: what is needed there, each option\'s fit, a failed must, and the choice', async () => {
    const access = accessOver()
    page(access, { evaluation: 'sales' })
    const view = screen.getByTestId('evaluation-view')
    expect(within(view).getByRole('heading', { name: 'Message gateway in Sales' })).toBeTruthy()
    // Route 2 of 4 and audit 2 of 2: 4 of 6. Broker A covers audit at 2, a must needed at 2 — not fully.
    expect(within(screen.getByRole('row', { name: /Fit here/ })).getAllByRole('gridcell').map((cell) => cell.textContent).filter(Boolean)).toEqual(expect.arrayContaining(['fails a must', '67 % ✓']))
    expect(within(view).getByText(/Chosen here: Managed bus/)).toBeTruthy()
    fireEvent.click(within(view).getByRole('button', { name: 'Open the decision' }))
    expect(access.openDecision).toHaveBeenCalledWith('sales', 'adr-2')
    expect(await axeFindings()).toEqual([])
  })

  it('shows its answer: the options in rank order with rank and fit on top, a gap marked by how much, harder on a must', () => {
    page(accessOver(), { evaluation: 'sales' })
    const heads = screen.getAllByRole('columnheader').map((one) => one.textContent)
    expect(heads.findIndex((one) => one?.includes('Managed bus'))).toBeLessThan(heads.findIndex((one) => one?.includes('Broker A')))
    expect(heads.find((one) => one?.includes('Managed bus'))).toContain('No. 1, 67 %')
    expect(heads.find((one) => one?.includes('Broker A'))).toContain('No. 2, fails a must')
    const audit = within(screen.getByRole('row', { name: /Keeps an audit trail/ })).getAllByRole('gridcell')
    const brokerAudit = audit.find((one) => /Broker A/.test(one.getAttribute('aria-label') ?? ''))!
    expect(brokerAudit.hasAttribute('data-attention')).toBe(true)
    expect(brokerAudit.textContent).toContain('−2')
    expect(brokerAudit.getAttribute('aria-label')).toContain(s('blocks.shortOfMust'))
    const busRoute = within(screen.getByRole('row', { name: /Routes by content/ })).getAllByRole('gridcell').find((one) => /Managed bus/.test(one.getAttribute('aria-label') ?? ''))!
    expect(busRoute.hasAttribute('data-short')).toBe(true)
    expect(busRoute.textContent).toContain('−2')
  })

  it('keeps to the gaps where asked, and leaves out what is not needed here until asked for it', () => {
    const covered: Evaluation = { ...SALES, coverage: { 'sb-a': { 'cap-route': { level: 4 }, 'cap-audit': { level: 4 } }, 'sb-b': { 'cap-route': { level: 4 }, 'cap-audit': { level: 2 } } } }
    const block = { ...INDEXED, capabilities: [...GATEWAY.capabilities!, { id: 'cap-spare', text: 'Speaks a spare protocol' }] }
    page(accessOver({ block: () => ({ scope: 'topics/integration', block }), evaluationsOf: () => [{ scope: 'sales', evaluation: covered }] }), { evaluation: 'sales' })
    expect(screen.queryByRole('row', { name: /Speaks a spare protocol/ })).toBeNull()
    fireEvent.click(screen.getByRole('switch', { name: s('blocks.showNotNeeded', { count: 1 }) }))
    expect(screen.getByRole('row', { name: /Speaks a spare protocol/ }).textContent).toContain(s('blocks.notNeededRow'))
    fireEvent.click(screen.getByRole('switch', { name: s('blocks.gapsOnly') }))
    expect(screen.queryByRole('row', { name: /Routes by content/ })).toBeNull()
    expect(screen.queryByRole('row', { name: /Speaks a spare protocol/ })).toBeNull()
    expect(screen.getByRole('row', { name: /Keeps an audit trail/ })).toBeTruthy()
  })

  it('changes a scope\'s evaluation: a context, an option dropped with the choice on it, a ball', () => {
    const access = accessOver()
    page(access, { evaluation: 'sales' })
    fireEvent.click(screen.getByTestId('evaluation-context-cx-filings'))
    expect(access.updateEvaluation).toHaveBeenLastCalledWith('sales', { ...SALES, contexts: ['cx-partners', 'cx-filings'] })
    fireEvent.click(screen.getByTestId('evaluation-option-sb-b'))
    expect(access.updateEvaluation).toHaveBeenLastCalledWith('sales', { ...SALES, options: ['sb-a'], chosen: undefined, decidedBy: undefined })
    const cell = within(screen.getByRole('row', { name: /Keeps an audit trail/ })).getAllByRole('gridcell').find((one) => one.textContent?.includes(s('blocks.note')))!
    fireEvent.focus(cell)
    fireEvent.keyDown(cell, { key: ' ' })
    expect(access.updateEvaluation).toHaveBeenLastCalledWith('sales', { ...SALES, coverage: { ...SALES.coverage, 'sb-a': { ...SALES.coverage['sb-a'], 'cap-audit': { level: 3, how: 'Logs only' } } } })
  })

  it('rates a comparison with the mouse alone: presses in a row, a level by name and a note from the cell\'s menu', async () => {
    const access = accessOver()
    page(access, { evaluation: 'sales' })
    const ball = (row: RegExp, option: RegExp) => within(screen.getByRole('row', { name: row })).getAllByRole('gridcell').find((one) => option.test(one.getAttribute('aria-label') ?? ''))!
    fireEvent.click(ball(/Routes by content/, /Managed bus/))
    fireEvent.click(ball(/Routes by content/, /Managed bus/))
    expect(access.updateEvaluation).toHaveBeenLastCalledWith('sales', { ...SALES, coverage: { ...SALES.coverage, 'sb-b': { ...SALES.coverage['sb-b'], 'cap-route': { level: 4 } } } })
    fireEvent.contextMenu(ball(/Keeps an audit trail/, /Broker A/))
    fireEvent.click(await screen.findByRole('menuitem', { name: s('blocks.noteMenu') }))
    const note = await screen.findByRole('textbox', { name: s('blocks.note') })
    fireEvent.change(note, { target: { value: 'Signed logs' } })
    fireEvent.click(screen.getByRole('button', { name: s('blocks.save') }))
    expect(vi.mocked(access.updateEvaluation).mock.lastCall![1].coverage['sb-a']!['cap-audit']).toEqual({ level: 2, how: 'Signed logs' })
  })

  it('carries a comparison out as the grid reads it: copied as a table, saved as CSV, also by who may only read', async () => {
    const access = accessOver({ mayWrite: () => false, copyText: vi.fn(), saveCsv: vi.fn() })
    page(access, { evaluation: 'sales' })
    const more = () => within(screen.getByTestId('evaluation-view')).getAllByRole('button', { name: 'More' })[0]!
    fireEvent.click(more())
    fireEvent.click(await screen.findByRole('menuitem', { name: s('blocks.copyTable') }))
    const copied = vi.mocked(access.copyText!).mock.lastCall![0]
    expect(copied.split('\n')[0]).toBe('Capability\tmust\tNeeded here\tManaged bus\tManaged bus: note\tBroker A\tBroker A: note')
    expect(copied).toContain('Keeps an audit trail\tmust\t2/4 Useful\t4/4 Fully covered\t\t2/4 Half covered, 2 short of what is needed here\tLogs only')
    fireEvent.click(more())
    fireEvent.click(await screen.findByRole('menuitem', { name: s('blocks.saveCsv') }))
    expect(vi.mocked(access.saveCsv!).mock.lastCall![0]).toBe('message-gateway-sales.csv')
    expect(vi.mocked(access.saveCsv!).mock.lastCall![1]).toContain('Keeps an audit trail,must,2/4 Useful,4/4 Fully covered,,"2/4 Half covered, 2 short of what is needed here",Logs only')
    expect(screen.queryByRole('menuitem', { name: s('blocks.removeEvaluation') })).toBeNull()
  })

  it('proposes a decision choosing the best option that fails no must, and opens it', async () => {
    const access = accessOver()
    page(access, { evaluation: 'sales' })
    fireEvent.click(screen.getByTestId('block-propose'))
    expect(screen.getByTestId('propose-option')).toHaveProperty('value', 'sb-b')
    fireEvent.click(screen.getByTestId('propose-submit'))
    await waitFor(() => expect(screen.getByTestId('propose-open')).toBeTruthy())
    expect(access.propose).toHaveBeenCalledWith('sales', 'blk-gw', 'sb-b')
    fireEvent.click(screen.getByTestId('propose-open'))
    expect(access.openDecision).toHaveBeenCalledWith('sales', 'adr-9')
  })

  it('evaluates it for another scope, starting from a scope\'s ratings', async () => {
    const access = accessOver()
    page(access)
    fireEvent.click(screen.getByRole('tab', { name: s('blocks.whereUsed') }))
    expect(screen.getByRole('row', { name: /Sales/ }).textContent).toContain('Managed bus')
    fireEvent.click(screen.getByTestId('block-evaluate'))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Filings' }))
    chooseValue(screen.getByRole('combobox', { name: s('blocks.copyFrom') }), 'sales')
    fireEvent.click(screen.getByTestId('evaluate-start'))
    await waitFor(() => expect(access.evaluate).toHaveBeenCalledWith('blk-gw', 'stock', ['cx-filings'], 'sales'))
  })

  it('reads one block across scopes: on each scope\'s row, each option weighed with its fit, best first, the chosen marked', async () => {
    page(accessOver())
    fireEvent.click(screen.getByRole('tab', { name: s('blocks.whereUsed') }))
    const row = screen.getByRole('row', { name: /Sales/ })
    const fits = [...row.querySelectorAll('.blocks-fits__one')].map((one) => one.textContent)
    expect(fits).toEqual(['Managed bus 67 %', 'Broker A fails a must'])
    expect(within(row).getByRole('img', { name: s('blocks.chosen') })).toBeTruthy()
    expect(await axeFindings()).toEqual([])
  })

  it('offers no evaluation for a scope this person may not write', () => {
    page(accessOver({ mayWrite: (scope) => scope !== 'stock' }))
    fireEvent.click(screen.getByRole('tab', { name: s('blocks.whereUsed') }))
    expect(screen.queryByTestId('block-evaluate')).toBeNull()
  })

  it('offers no change at all to a person who may only read it', () => {
    page(accessOver({ mayWrite: () => false }), { evaluation: 'sales' })
    expect(screen.queryByTestId('block-propose')).toBeNull()
    expect(screen.getByTestId('evaluation-context-cx-filings')).toHaveProperty('disabled', true)
    onRequirements()
    expect(screen.queryByTestId('block-add-capability')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: s('blocks.about') }))
    expect(screen.queryByTestId('block-document-edit')).toBeNull()
  })
})

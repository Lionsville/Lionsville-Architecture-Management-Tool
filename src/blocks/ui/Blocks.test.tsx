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
    propose: vi.fn(async () => 'adr-9'), openDecision: vi.fn(), openBlock: vi.fn(),
    makeId: (prefix) => `${prefix}-new`, today: () => '2026-11-02',
    ...over,
  }
}

const page = (access: BlocksAccess, extra: { evaluation?: string } = {}) => renderShell(
  <BlocksProvider value={access}><BlockPage open id="blk-gw" {...extra} onClose={() => {}} windowChrome={NO_WINDOW_CHROME} /></BlocksProvider>,
)

describe('the register of building blocks', () => {
  it('lists each block with where it is kept, its contexts, where it is evaluated with ✓, and its solutions', async () => {
    const access = accessOver()
    renderShell(<BlocksProvider value={access}><BlocksRegisterPage open at="" onClose={() => {}} windowChrome={NO_WINDOW_CHROME} /></BlocksProvider>)
    const row = screen.getByTestId('block-row-blk-gw')
    expect([...row.querySelectorAll('td')].map((cell) => cell.textContent)).toEqual(['Message gateway', 'Integration', '2', 'Many partners, Filings', 'Sales ✓', 'Broker A · Managed bus'])
    fireEvent.click(within(row).getByRole('button', { name: 'Message gateway' }))
    expect(access.openBlock).toHaveBeenCalledWith('blk-gw')
    expect(await axeFindings()).toEqual([])
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
    fireEvent.change(screen.getByRole('textbox', { name: s('blocks.search') }), { target: { value: 'nothing like it' } })
    expect(screen.getByText(s('blocks.searchEmpty', { query: 'nothing like it' }))).toBeTruthy()
  })
})

describe('a building block\'s page', () => {
  it('draws the requirements as balls, and a press moves one a quarter, as a change of the block\'s contexts', async () => {
    const access = accessOver()
    page(access)
    const ball = screen.getByRole('spinbutton', { name: 'How much Many partners needs Routes by content: 4/4' })
    fireEvent.click(ball)
    expect(access.update).toHaveBeenCalledWith('blk-gw', { contexts: [{ id: 'cx-partners', name: 'Many partners', needs: { 'cap-audit': 2 } }, GATEWAY.contexts![1]] })
    expect(await axeFindings()).toEqual([])
  })

  it('builds a second press on the first, before the tree has been read again', () => {
    const access = accessOver()
    page(access)
    const ball = () => screen.getByRole('spinbutton', { name: /^How much Many partners needs Keeps an audit trail/ })
    fireEvent.click(ball())
    fireEvent.click(ball())
    expect(ball().getAttribute('aria-valuenow')).toBe('4')
    expect(access.update).toHaveBeenLastCalledWith('blk-gw', { contexts: [{ id: 'cx-partners', name: 'Many partners', needs: { 'cap-route': 4, 'cap-audit': 4 } }, GATEWAY.contexts![1]] })
  })

  it('adds a usage context with its chapter in the document, in one change', () => {
    const access = accessOver()
    page(access)
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

  it('adds a capability that answers to a principle\'s aspect, and takes one off its contexts\' needs too', () => {
    const access = accessOver()
    page(access)
    fireEvent.click(screen.getByTestId('block-add-capability'))
    fireEvent.change(screen.getByTestId('capability-text'), { target: { value: 'Signs every message' } })
    fireEvent.click(screen.getByTestId('capability-add'))
    expect(access.update).toHaveBeenLastCalledWith('blk-gw', { capabilities: [...GATEWAY.capabilities!, { id: 'cap-new', text: 'Signs every message' }] })
    fireEvent.click(screen.getByRole('button', { name: 'Remove Routes by content' }))
    expect(access.update).toHaveBeenLastCalledWith('blk-gw', {
      capabilities: [GATEWAY.capabilities![1]],
      contexts: [{ id: 'cx-partners', name: 'Many partners', needs: { 'cap-audit': 2 } }, GATEWAY.contexts![1]],
    })
  })

  it('reads its document, opens a context\'s chapter from its head, and lists the principles it cites', async () => {
    const access = accessOver()
    page(access)
    fireEvent.click(screen.getByTestId('context-head-cx-partners'))
    expect(await within(screen.getByTestId('block-document')).findByRole('heading', { name: 'Many partners' })).toBeTruthy()
    expect(access.document).toHaveBeenCalledWith('blk-gw')
    expect(screen.getByText('PR-0001 Least privilege')).toBeTruthy()
  })

  it('writes its document from what was read, and reads what was written on going back', async () => {
    const access = accessOver()
    page(access)
    fireEvent.click(screen.getByTestId('block-tab-about'))
    const edit = screen.getByTestId('block-document-edit')
    await waitFor(() => expect(edit).toHaveProperty('disabled', false))
    fireEvent.click(edit)
    const source = screen.getByRole('textbox', { name: s('blocks.document') })
    expect(source).toHaveProperty('value', GATEWAY.description)
    fireEvent.change(source, { target: { value: 'Written again.' } })
    fireEvent.blur(source)
    fireEvent.click(screen.getByRole('button', { name: s('blocks.read') }))
    expect(screen.getByTestId('block-document').textContent).toBe('Written again.')
    // The blur kept it; the press on *Read* had nothing more to keep.
    expect(access.update).toHaveBeenCalledTimes(1)
    expect(access.update).toHaveBeenCalledWith('blk-gw', { description: 'Written again.' })
  })

  it('offers no editing of its document before it has been read', () => {
    page(accessOver({ document: () => new Promise(() => {}) }))
    fireEvent.click(screen.getByTestId('block-tab-about'))
    expect(screen.getByTestId('block-document-edit')).toHaveProperty('disabled', true)
  })

  it('lists its solutions with where each is weighed and chosen, and the elements that are it', () => {
    page(accessOver({ mayWrite: () => false }))
    fireEvent.click(screen.getByTestId('block-tab-solutions'))
    expect([...screen.getByTestId('sbb-sb-a').querySelectorAll('td')].map((cell) => cell.textContent)).toEqual(['Broker A', '—', 'product', 'Candidate', 'Sales', '', 'Broker'])
    expect(screen.getByTestId('sbb-sb-b').textContent).toContain('Sales')
  })

  it('links a solution to the landscape element that is it, in its row', () => {
    const access = accessOver()
    page(access)
    fireEvent.click(screen.getByTestId('block-tab-solutions'))
    const field = screen.getByRole('combobox', { name: 'What Managed bus is in the landscape' })
    fireEvent.keyDown(field, { key: 'ArrowDown' })
    fireEvent.click(screen.getByRole('option', { name: 'Broker' }))
    expect(access.update).toHaveBeenCalledWith('blk-gw', { sbbs: [GATEWAY.sbbs![0], { ...GATEWAY.sbbs![1], elements: ['app-broker'] }] })
  })

  it('opens a scope\'s evaluation: what is needed there, each option\'s fit, a failed must, and the choice', async () => {
    const access = accessOver()
    page(access, { evaluation: 'sales' })
    const view = screen.getByTestId('evaluation-view')
    expect(within(view).getByRole('heading', { name: 'Message gateway in Sales' })).toBeTruthy()
    // Route 2 of 4 and audit 2 of 2: 4 of 6. Broker A covers audit at 2, a must needed at 2 — not fully.
    expect(within(screen.getByTestId('fit-row')).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Fit here', '', 'fails a must', '67 %✓'])
    expect(within(view).getByText(/Chosen here: Managed bus/)).toBeTruthy()
    fireEvent.click(within(view).getByRole('button', { name: 'Open the decision' }))
    expect(access.openDecision).toHaveBeenCalledWith('sales', 'adr-2')
    expect(await axeFindings()).toEqual([])
  })

  it('changes a scope\'s evaluation: a context, an option dropped with the choice on it, a ball', () => {
    const access = accessOver()
    page(access, { evaluation: 'sales' })
    fireEvent.click(screen.getByTestId('evaluation-context-cx-filings'))
    expect(access.updateEvaluation).toHaveBeenLastCalledWith('sales', { ...SALES, contexts: ['cx-partners', 'cx-filings'] })
    fireEvent.click(screen.getByTestId('evaluation-option-sb-b'))
    expect(access.updateEvaluation).toHaveBeenLastCalledWith('sales', { ...SALES, options: ['sb-a'], chosen: undefined, decidedBy: undefined })
    fireEvent.click(screen.getByRole('spinbutton', { name: 'How far Broker A covers Keeps an audit trail: 2/4' }))
    expect(access.updateEvaluation).toHaveBeenLastCalledWith('sales', { ...SALES, coverage: { ...SALES.coverage, 'sb-a': { ...SALES.coverage['sb-a'], 'cap-audit': { level: 3, how: 'Logs only' } } } })
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
    fireEvent.click(screen.getByTestId('block-tab-used'))
    expect(screen.getByTestId('evaluation-row-sales').textContent).toContain('Managed bus')
    fireEvent.click(screen.getByTestId('block-evaluate'))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Filings' }))
    fireEvent.mouseDown(screen.getByRole('combobox', { name: s('blocks.copyFrom') }))
    fireEvent.click(screen.getByRole('option', { name: 'Copy the ratings from Sales' }))
    fireEvent.click(screen.getByTestId('evaluate-start'))
    await waitFor(() => expect(access.evaluate).toHaveBeenCalledWith('blk-gw', 'stock', ['cx-filings'], 'sales'))
  })

  it('offers no change at all to a person who may only read it', () => {
    page(accessOver({ mayWrite: () => false }), { evaluation: 'sales' })
    expect(screen.queryByTestId('block-propose')).toBeNull()
    expect(screen.queryByRole('spinbutton')).toBeNull()
    expect(screen.getByTestId('evaluation-context-cx-filings').getAttribute('role')).not.toBe('button')
    fireEvent.click(screen.getByTestId('block-tab-requirements'))
    expect(screen.queryByTestId('block-add-capability')).toBeNull()
    fireEvent.click(screen.getByTestId('block-tab-about'))
    expect(screen.queryByTestId('block-document-edit')).toBeNull()
  })
})

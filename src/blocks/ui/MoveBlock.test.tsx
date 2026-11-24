// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * *Move to…* on a building block (ADR-0043, amended 24 November 2026): the
 * dialog — where it is kept, where it may go, what goes with it — and its two
 * ways in, under ⋯ on the block's page and on its preview, with nothing
 * offered to a person who may not change the scope that keeps it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderShell } from '../../app/testing/renderShell'
import { axeFindings } from '../../app/testing/axe'
import { translator } from '../../i18n'
import type { DesignElement } from '../../model/types'
import { NO_WINDOW_CHROME } from '../../platform/windowChrome'
import { chooseValue, optionLabels } from '../../widgets/kit/testing/select'
import { BlockPage } from './BlockPage'
import { BlocksProvider } from './BlocksContext'
import type { BlocksAccess, BlockRow } from './BlocksContext'
import { BlocksRegisterPage } from './BlocksRegisterPage'
import { MoveBlockDialog } from './MoveBlockDialog'

afterEach(cleanup)

const s = translator('en')

const GATEWAY: DesignElement = { id: 'blk-gw', kind: 'buildingBlock', name: 'Message gateway', lifecycle: 'live', isManaged: false, aspects: {} }
const ROW: BlockRow = { scope: 'topics/integration', block: GATEWAY }
const NAMES: Record<string, string> = { '': 'Acme', 'topics/integration': 'Integration', 'topics/security': 'Security', sales: 'Sales' }

function accessOver(over: Partial<BlocksAccess> = {}): BlocksAccess {
  return {
    version: 1,
    blocks: () => [ROW], block: (id) => (id === 'blk-gw' ? ROW : undefined),
    evaluationsOf: () => [],
    blocksAt: () => ({ kept: [ROW], evaluated: [] }),
    mayWrite: () => true,
    scopeLabel: (path) => NAMES[path] ?? path,
    aspectLabel: () => undefined, citationsOf: () => [], aspectChoices: () => [],
    elementName: (id) => id, elementChoices: () => [],
    placeChoices: () => [
      { path: 'topics/integration', name: 'Integration', depth: 0, topic: true }, { path: 'topics/security', name: 'Security', depth: 0, topic: true },
      { path: '', name: 'Acme', depth: 0 }, { path: 'sales', name: 'Sales', depth: 1 },
    ],
    evaluateChoices: () => [],
    document: vi.fn(async () => ''), create: vi.fn(async () => undefined), update: vi.fn(), evaluate: vi.fn(async () => true),
    updateEvaluation: vi.fn(), removeEvaluation: vi.fn(), move: vi.fn(async () => true),
    propose: vi.fn(async () => undefined), openDecision: vi.fn(), openScope: vi.fn(), openBlock: vi.fn(),
    makeId: (prefix) => `${prefix}-new`, today: () => '2026-11-24',
    ...over,
  }
}

const dialog = (access: BlocksAccess, onClose = vi.fn()) => {
  renderShell(<BlocksProvider value={access}><MoveBlockDialog row={ROW} onClose={onClose} /></BlocksProvider>)
  return { onClose, shown: screen.getByTestId('block-move-dialog') }
}

const page = (access: BlocksAccess) => renderShell(
  <BlocksProvider value={access}><BlockPage open id="blk-gw" onClose={() => {}} windowChrome={NO_WINDOW_CHROME} /></BlocksProvider>,
)

const preview = (access: BlocksAccess) => renderShell(
  <BlocksProvider value={access}><BlocksRegisterPage open at="" select="blk-gw" onClose={() => {}} windowChrome={NO_WINDOW_CHROME} /></BlocksProvider>,
)

describe('the Move to… dialog of a building block', () => {
  it('says where it is kept and what goes with it, and offers the topics first, never the scope it is in', async () => {
    const { shown } = dialog(accessOver())
    expect(within(shown).getByRole('heading', { name: s('blocks.moveTitle', { name: 'Message gateway' }) })).toBeTruthy()
    expect(shown.textContent).toContain(s('blocks.moveKeptNow', { scope: 'Integration' }))
    expect(shown.textContent).toContain(s('blocks.moveWith'))
    expect(optionLabels(screen.getByTestId('block-move-to')).map((label) => label?.trim())).toEqual([`Security (${s('blocks.placeTopic')})`, 'Acme', 'Sales'])
    expect(await axeFindings()).toEqual([])
  })

  it('moves to the first topic on Enter, which Move holds as it opens, and closes once it has landed', async () => {
    const access = accessOver()
    const { onClose, shown } = dialog(access)
    const move = within(shown).getByRole('button', { name: s('blocks.moveAction') })
    await waitFor(() => expect(document.activeElement).toBe(move))
    fireEvent.submit(shown.querySelector('form')!)
    // A second Enter while it lands writes nothing more.
    fireEvent.submit(shown.querySelector('form')!)
    expect(access.move).toHaveBeenCalledWith('blk-gw', 'topics/security')
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(access.move).toHaveBeenCalledTimes(1)
  })

  it('moves to the place picked, the organisation among them', async () => {
    const access = accessOver()
    const { onClose } = dialog(access)
    chooseValue(screen.getByTestId('block-move-to'), '')
    fireEvent.click(screen.getByTestId('block-move'))
    expect(access.move).toHaveBeenCalledWith('blk-gw', '')
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it('stays up where the move did not land, so another place can be picked, and leaves on Cancel', async () => {
    const access = accessOver({ move: vi.fn(async () => false) })
    const { onClose } = dialog(access)
    fireEvent.click(screen.getByTestId('block-move'))
    await waitFor(() => expect(screen.getByTestId('block-move')).toHaveProperty('disabled', false))
    expect(onClose).not.toHaveBeenCalled()
    chooseValue(screen.getByTestId('block-move-to'), 'sales')
    fireEvent.click(screen.getByTestId('block-move'))
    expect(access.move).toHaveBeenLastCalledWith('blk-gw', 'sales')
    await waitFor(() => expect(screen.getByTestId('block-move')).toHaveProperty('disabled', false))
    fireEvent.click(screen.getByRole('button', { name: s('common.cancel') }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('offers only the scopes the person may change, and says so where there is none', async () => {
    dialog(accessOver({ mayWrite: (scope) => scope === 'topics/integration' || scope === 'sales' }))
    expect(optionLabels(screen.getByTestId('block-move-to')).map((label) => label?.trim())).toEqual(['Sales'])
    cleanup()
    const access = accessOver({ mayWrite: (scope) => scope === 'topics/integration' })
    const { shown } = dialog(access)
    expect(within(shown).getByRole('status').textContent).toBe(s('blocks.moveNowhere'))
    expect(screen.queryByTestId('block-move-to')).toBeNull()
    expect(screen.getByTestId('block-move')).toHaveProperty('disabled', true)
    fireEvent.submit(shown.querySelector('form')!)
    expect(access.move).not.toHaveBeenCalled()
    expect(await axeFindings()).toEqual([])
  })
})

describe('the ways in to Move to…', () => {
  const more = (within_: HTMLElement) => within(within_).getAllByRole('button', { name: s('kit.menu.more') }).at(-1)!

  it('is under ⋯ on the block\'s page, and the page stays on the block once it has moved', async () => {
    const access = accessOver()
    page(access)
    fireEvent.click(more(screen.getByTestId('block-page')))
    fireEvent.click(await screen.findByRole('menuitem', { name: s('blocks.move') }))
    fireEvent.click(await screen.findByTestId('block-move'))
    expect(access.move).toHaveBeenCalledWith('blk-gw', 'topics/security')
    await waitFor(() => expect(screen.queryByTestId('block-move-dialog')).toBeNull())
    expect(screen.getByRole('heading', { name: 'Message gateway', level: 1 })).toBeTruthy()
    expect(access.openBlock).not.toHaveBeenCalled()
  })

  it('is under ⋯ on the block\'s large preview, which stays on the block', async () => {
    const access = accessOver()
    preview(access)
    const reader = screen.getByRole('dialog')
    fireEvent.click(more(reader))
    fireEvent.click(await screen.findByRole('menuitem', { name: s('blocks.move') }))
    chooseValue(await screen.findByTestId('block-move-to'), 'sales')
    fireEvent.click(screen.getByTestId('block-move'))
    expect(access.move).toHaveBeenCalledWith('blk-gw', 'sales')
    await waitFor(() => expect(screen.queryByTestId('block-move-dialog')).toBeNull())
    expect(within(reader).getByText('Message gateway')).toBeTruthy()
  })

  it('is offered to nobody who may not change the scope that keeps the block', async () => {
    const closed = accessOver({ mayWrite: (scope) => scope !== 'topics/integration' })
    page(closed)
    fireEvent.click(more(screen.getByTestId('block-page')))
    expect(await screen.findByRole('menuitem', { name: s('blocks.openIn', { scope: 'Integration' }) })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: s('blocks.move') })).toBeNull()
    cleanup()
    preview(closed)
    fireEvent.click(more(screen.getByRole('dialog')))
    expect(await screen.findByRole('menuitem', { name: s('blocks.openIn', { scope: 'Integration' }) })).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: s('blocks.move') })).toBeNull()
  })
})

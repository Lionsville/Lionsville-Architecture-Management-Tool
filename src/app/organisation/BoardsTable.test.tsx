// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The boards on a scope's home, as the table draws them: a glyph per kind,
 * and each container diagram as a short row under the landscape its
 * application is on.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { axeFindings } from '../testing/axe'
import { renderShell } from '../testing/renderShell'
import { translator } from '../../i18n'
import { laidOut } from '../../model/testFixtures'
import type { DesignDiagram } from '../../model'
import { BoardsTable } from './BoardsTable'

afterEach(() => cleanup())

const s = translator('en')

const at = (id: string) => ({ id, x: 0, y: 0 })

const BOARDS = (): DesignDiagram[] => [
  laidOut({ id: 'now', kind: 'layer7' as const, name: 'Finance today', placements: [at('ledger'), at('billing')] }),
  laidOut({ id: 'sheet', kind: 'sheet' as const, name: 'Business', placements: [] }),
  laidOut({ id: 'cd-ledger', kind: 'container' as const, name: 'Ledger', applicationElementId: 'ledger', placements: [] }),
  laidOut({ id: 'cd-gone', kind: 'container' as const, name: 'Archive', applicationElementId: 'archive', placements: [] }),
  laidOut({ id: 'cd-billing', kind: 'container' as const, name: 'Billing', applicationElementId: 'billing', placements: [] }),
]

function show(boards = BOARDS(), readOnly = false) {
  const onOpen = vi.fn<(id: string) => void>()
  const onDelete = vi.fn<(board: { id: string; name: string }) => void>()
  const shell = renderShell(
    <BoardsTable
      boards={boards}
      onOpen={onOpen}
      onAdd={vi.fn()}
      onAddSheet={vi.fn()}
      onAddMap={vi.fn()}
      onAddTechnology={vi.fn()}
      onDelete={onDelete}
      readOnly={readOnly}
      language="en"
      s={s}
    />,
  )
  return { ...shell, onOpen, onDelete }
}

/** Every row's id, in document order — which is also the order Tab walks. */
const rowOrder = () =>
  [...screen.getByTestId('boards').querySelectorAll<HTMLElement>('[data-testid^="board-"][data-kind]')]
    .map((row) => row.dataset.testid)

describe('BoardsTable, as axe reads it', () => {
  it('finds nothing, with container diagrams nested and loose', async () => {
    show()
    expect(await axeFindings()).toEqual([])
  })
})

describe('BoardsTable', () => {
  it('lists each container diagram right after the landscape its application is on, and the loose one last', () => {
    show()
    expect(rowOrder()).toEqual(['board-now', 'board-cd-ledger', 'board-cd-billing', 'board-sheet', 'board-cd-gone'])
  })

  it('draws a container diagram under its landscape as a compact sub-row, in a group named for the landscape', () => {
    show()
    const group = screen.getByRole('group', { name: 'Container diagrams on Finance today' })
    const row = within(group).getByTestId('board-cd-ledger')
    expect(row.dataset.compact).toBe('true')
    expect(row.dataset.under).toBe('now')
    // The landscape itself is a full row, and comes first in the document.
    const landscape = screen.getByTestId('board-now')
    expect(landscape.dataset.compact).toBeUndefined()
    expect(landscape.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('draws a container diagram on no landscape compactly, in a group of its own, under none', () => {
    show()
    const group = screen.getByRole('group', { name: 'Container diagrams of applications on no landscape here' })
    const row = within(group).getByTestId('board-cd-gone')
    expect(row.dataset.compact).toBe('true')
    expect(row.dataset.under).toBeUndefined()
  })

  it('keeps Open and Delete on a sub-row, each about its own diagram', () => {
    const { onOpen, onDelete } = show()
    const row = screen.getByTestId('board-cd-billing')
    fireEvent.click(within(row).getByRole('button', { name: 'Open' }))
    expect(onOpen).toHaveBeenCalledWith('cd-billing')
    fireEvent.click(within(row).getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledWith({ id: 'cd-billing', name: 'Billing' })
    fireEvent.click(screen.getByTestId('board-name-cd-ledger'))
    expect(onOpen).toHaveBeenLastCalledWith('cd-ledger')
  })

  it('puts a glyph for its kind on every row, hidden from a screen reader that hears the kind in words', () => {
    show()
    for (const id of ['now', 'sheet', 'cd-ledger', 'cd-gone']) {
      const glyph = screen.getByTestId(`board-${id}`).querySelector('svg')
      expect(glyph?.getAttribute('aria-hidden')).toBe('true')
    }
    expect(screen.getByTestId('board-cd-ledger').textContent).toContain('Containers')
  })

  it('draws no group under a landscape with no container diagram', () => {
    show([laidOut({ id: 'now', kind: 'layer7' as const, name: 'Finance today', placements: [at('ledger')] })])
    expect(screen.queryByRole('group')).toBeNull()
    expect(screen.queryByTestId('boards-empty')).toBeNull()
  })

  it('offers neither a new board nor a removal to somebody who may only read the scope', () => {
    show(BOARDS(), true)
    expect(screen.queryByTestId('new-board')).toBeNull()
    expect(within(screen.getByTestId('board-cd-billing')).queryByRole('button', { name: 'Delete' })).toBeNull()
    expect(within(screen.getByTestId('board-cd-billing')).getByRole('button', { name: 'Open' })).toBeDefined()
  })

  it('says the day a board shows as that day, wherever the clock is', () => {
    show([laidOut({ id: 'then', kind: 'layer7' as const, name: 'Finance in 2027', placements: [], asOf: '2027-01-01' })])
    expect(screen.getByTestId('board-then').textContent).toContain('1 Jan 2027')
  })

  it('says a scope with no board has none, and still offers the first one', () => {
    show([])
    expect(screen.getByTestId('boards-empty')).toBeDefined()
    expect(screen.getByTestId('new-board').dataset.guide).toBe('org.newBoard')
    expect(screen.getByTestId('boards').dataset.guide).toBe('org.boards')
  })
})

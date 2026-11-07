// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The crossing: a press only selects, a key writes where keys write, one focus
 * walks by the arrows through the headings too, and the line says where you are.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { Matrix } from './Matrix'
import type { MatrixCell, MatrixProps } from './Matrix'

afterEach(() => cleanup())

const CELLS: Record<string, MatrixCell> = {
  'order:plan': { show: 'A', meaning: 'Scrum master is accountable', tone: 'solid' },
  'order:run': { show: 'R', meaning: 'responsible', tone: 'soft' },
  'team:run': { show: 'A', meaning: 'two are accountable', attention: true },
}

const BASE: Omit<MatrixProps, 'label'> = {
  rows: [{ id: 'group', label: 'Way of working' }, { id: 'order', label: 'Order the backlog', parent: 'group' }, { id: 'team', label: 'Warehouse team' }],
  columns: [{ id: 'plan', label: 'Plan' }, { id: 'run', label: 'Run' }, { id: 'own', label: 'Own', group: 'more' }, { id: 'fund', label: 'Fund', group: 'more' }],
  columnGroups: [{ id: 'more', label: 'Others' }],
  cellOf: (row, column) => CELLS[`${row}:${column}`] ?? null,
}

const cell = (name: string | RegExp) => screen.getByRole('gridcell', { name })

describe('the matrix', () => {
  it('has one stop for Tab', () => {
    renderShell(<Matrix label="RACI" {...BASE} />)
    expect(document.querySelectorAll('[data-kit-cell][tabindex="0"]')).toHaveLength(1)
  })

  it('selects on a press and writes nothing', () => {
    const onSelect = vi.fn()
    const onKey = vi.fn()
    renderShell(<Matrix label="RACI" {...BASE} onSelect={onSelect} onKey={onKey} keys={['r']} />)
    fireEvent.click(cell(/Order the backlog, Run/))
    expect(onSelect).toHaveBeenCalledWith({ row: 'order', column: 'run' })
    expect(onKey).not.toHaveBeenCalled()
  })

  it('walks by the arrows, naming the row, the column and the meaning on its line', () => {
    renderShell(<Matrix label="RACI" {...BASE} hint="Press R or Space." keys={['r', ' ']} />)
    const first = cell(/Way of working, Plan/)
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowDown' })
    const next = cell(/Order the backlog, Plan/)
    expect(document.activeElement).toBe(next)
    expect(screen.getByRole('status').textContent).toBe('Order the backlog × Plan: Scrum master is accountable. Press R or Space.')
    fireEvent.keyDown(next, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(cell(/Order the backlog, Run/))
    fireEvent.keyDown(document.activeElement as Element, { key: 'End' })
    expect(document.activeElement).toBe(cell(/Order the backlog, Fund/))
    fireEvent.keyDown(document.activeElement as Element, { key: 'Home', ctrlKey: true })
    expect(document.activeElement).toBe(cell(/Way of working, Plan/))
  })

  it('says an empty cell is empty, and says nothing of keys where none write', () => {
    renderShell(<Matrix label="RACI" {...BASE} hint="Press R." />)
    expect(screen.getByRole('status').textContent).toBe('Way of working × Plan: nothing.')
    expect(cell('Way of working, Plan: nothing').textContent).toBe('')
  })

  it('writes on a key it was told about, and only that', () => {
    const onKey = vi.fn()
    renderShell(<Matrix label="RACI" {...BASE} keys={['r', ' ']} onKey={onKey} />)
    const here = cell(/Way of working, Plan/)
    fireEvent.keyDown(here, { key: 'R' })
    expect(onKey).toHaveBeenLastCalledWith({ row: 'group', column: 'plan' }, 'r')
    fireEvent.keyDown(here, { key: ' ' })
    expect(onKey).toHaveBeenLastCalledWith({ row: 'group', column: 'plan' }, ' ')
    onKey.mockClear()
    fireEvent.keyDown(here, { key: 'x' })
    fireEvent.keyDown(here, { key: 'r', metaKey: true })
    expect(onKey).not.toHaveBeenCalled()
  })

  it('writes nothing where no keys were handed in', () => {
    const onKey = vi.fn()
    renderShell(<Matrix label="RACI" {...BASE} onKey={onKey} />)
    fireEvent.keyDown(cell(/Way of working, Plan/), { key: 'r' })
    expect(onKey).not.toHaveBeenCalled()
  })

  it('selects by Enter', () => {
    const onSelect = vi.fn()
    renderShell(<Matrix label="RACI" {...BASE} onSelect={onSelect} />)
    fireEvent.keyDown(cell(/Way of working, Plan/), { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledWith({ row: 'group', column: 'plan' })
  })

  it('marks attention by a shape as well as a fill, and tone and pick by attribute', () => {
    renderShell(<Matrix label="RACI" {...BASE} selected={{ row: 'order', column: 'run' }} />)
    const asks = cell(/Warehouse team, Run/)
    expect(asks.dataset.attention).toBe('true')
    expect(asks.querySelector('.kit-mark')).toBeTruthy()
    expect(cell(/Order the backlog, Plan/).dataset.tone).toBe('solid')
    expect(cell(/Order the backlog, Run/).getAttribute('aria-selected')).toBe('true')
    expect(cell(/Order the backlog, Plan/).getAttribute('aria-selected')).toBe('false')
  })

  it('draws the crosshair on the row and the column of the focus', () => {
    const { container } = renderShell(<Matrix label="RACI" {...BASE} />)
    fireEvent.keyDown(cell(/Way of working, Plan/), { key: 'ArrowDown' })
    expect(cell(/Order the backlog, Plan/).closest('tr')?.dataset.crossed).toBe('true')
    expect(container.querySelectorAll('tbody tr[data-crossed]')).toHaveLength(1)
    expect(container.querySelectorAll('col[data-crossed]')).toHaveLength(1)
  })

  it('folds a row from its heading, by a press and by the keyboard', () => {
    const onFoldRow = vi.fn()
    renderShell(<Matrix label="RACI" {...BASE} onFoldRow={onFoldRow} />)
    const head = screen.getByRole('rowheader', { name: /Way of working/ })
    expect(head.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(head)
    expect(screen.queryByText('Order the backlog')).toBeNull()
    expect(onFoldRow).toHaveBeenCalledWith('group', true)
    const again = screen.getByRole('rowheader', { name: /Way of working/ })
    fireEvent.keyDown(again, { key: 'Enter' })
    expect(screen.getByText('Order the backlog')).toBeTruthy()
  })

  it('reaches a row heading by the arrows, and opens one that does not fold', () => {
    const onOpenRow = vi.fn()
    renderShell(<Matrix label="RACI" {...BASE} onOpenRow={onOpenRow} />)
    const here = cell(/Way of working, Plan/)
    fireEvent.keyDown(here, { key: 'ArrowDown' })
    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowDown' })
    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowLeft' })
    const head = screen.getByRole('rowheader', { name: 'Warehouse team' })
    expect(document.activeElement).toBe(head)
    fireEvent.keyDown(head, { key: 'Enter' })
    expect(onOpenRow).toHaveBeenCalledWith('team')
  })

  it('folds a group of columns to one that says what it holds, and back', () => {
    const onFoldGroup = vi.fn()
    renderShell(<Matrix label="RACI" {...BASE} onFoldGroup={onFoldGroup} />)
    fireEvent.click(screen.getByRole('columnheader', { name: 'Own' }))
    expect(screen.queryByRole('columnheader', { name: 'Fund' })).toBeNull()
    expect(onFoldGroup).toHaveBeenCalledWith('more', true)
    const folded = screen.getByRole('columnheader', { name: 'Others, 2' })
    expect(folded.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(folded)
    expect(screen.getByRole('columnheader', { name: 'Fund' })).toBeTruthy()
  })

  it('starts folded where the screen remembers it', () => {
    renderShell(<Matrix label="RACI" {...BASE} defaultFoldedRows={['group']} defaultFoldedGroups={['more']} />)
    expect(screen.queryByText('Order the backlog')).toBeNull()
    expect(screen.getByRole('columnheader', { name: 'Others, 2' })).toBeTruthy()
  })

  it('pins an answer column beside the row name', () => {
    renderShell(<Matrix label="RACI" {...BASE} answer={{ label: 'Comes to', of: (row) => `answer ${row}` }} />)
    expect(screen.getByRole('columnheader', { name: 'Comes to' })).toBeTruthy()
    expect(screen.getByText('answer team').className).toContain('kit-matrix__answer')
  })

  it('opens what a column heading names, and says a heading\'s mark beside its name', () => {
    const onOpenColumn = vi.fn()
    const columns = [{ id: 'one', label: 'One', mark: <em>you</em> }]
    renderShell(<Matrix label="Pairs" rows={[{ id: 'r', label: 'Row', mark: <em>over</em> }]} columns={columns} cellOf={() => null} onOpenColumn={onOpenColumn} />)
    fireEvent.click(screen.getByRole('columnheader', { name: /One/ }))
    expect(onOpenColumn).toHaveBeenCalledWith('one')
    expect(screen.getByRole('columnheader', { name: /One/ }).textContent).toContain('you')
    expect(screen.getByRole('rowheader', { name: /Row/ }).textContent).toContain('over')
  })

  it('draws a crossing that is not there as nothing: a press and Enter select nothing, and the line does not read it out', () => {
    const onSelect = vi.fn()
    renderShell(<Matrix label="Pairs" rows={[{ id: 'r', label: 'Row' }]} columns={[{ id: 'one', label: 'One' }]} cellOf={() => ({ meaning: 'something' })} absent={() => true} onSelect={onSelect} />)
    const gone = screen.getByRole('gridcell', { name: 'Row, One' })
    expect(gone.hasAttribute('data-absent')).toBe(true)
    fireEvent.click(gone)
    fireEvent.keyDown(gone, { key: 'Enter' })
    expect(onSelect).not.toHaveBeenCalled()
    expect(screen.getByRole('status').textContent).not.toContain('something')
  })

  it('passes axe, with answer, attention and a fold', async () => {
    renderShell(<Matrix label="RACI" rowHeading="Responsibility" {...BASE} answer={{ label: 'Comes to', of: () => 'ok' }} defaultFoldedGroups={['more']} selected={{ row: 'order', column: 'run' }} />)
    expect(await axeFindings()).toEqual([])
  })
})

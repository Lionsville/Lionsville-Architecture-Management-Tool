// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The one list: a row is the item and nothing else, groups fold, the keyboard
 * walks and ticks, and focus comes back to the row a preview was open on and
 * stays in place when the row holding it leaves.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { List } from './List'
import type { ListGroup, ListProps } from './List'

afterEach(() => cleanup())

const GROUPS: ListGroup[] = [
  { id: 'waiting', label: 'Waiting for a why', count: 17, rows: [
    { id: 'a', text: 'The portal and the planning screen differ', unread: true },
    { id: 'b', text: 'Finance reconciles by hand' },
  ] },
  { id: 'done', label: 'Has a why', rows: [{ id: 'c', text: 'Onboarding stalls', note: 'Left 7 Nov' }] },
]

function Ticking(props: Partial<ListProps>) {
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set())
  return <List label="Observations" groups={GROUPS} checked={checked} onCheckedChange={setChecked} {...props} />
}

const row = (name: RegExp | string) => screen.getByText(name).closest<HTMLElement>('[role="row"]') as HTMLElement
const key = (element: Element, k: string, init: object = {}) => fireEvent.keyDown(element, { key: k, ...init })

describe('a list', () => {
  it('shows the item and no more, and has no header without columns', () => {
    renderShell(<List label="Observations" groups={GROUPS} />)
    expect(screen.queryAllByRole('columnheader')).toEqual([])
    expect(row(/Finance reconciles/).textContent).toBe('Finance reconciles by hand')
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('says a group with its real number, and an unread row in words', () => {
    renderShell(<List label="Observations" groups={GROUPS} />)
    expect(screen.getByText('Waiting for a why · 17')).toBeTruthy()
    expect(screen.getByText('Has a why · 1')).toBeTruthy()
    expect(row(/portal and the planning/).textContent).toContain('Not read yet')
    expect(row(/portal and the planning/).dataset.unread).toBe('true')
  })

  it('wraps only when asked to, and a clipped line can still be read', () => {
    const { container, rerender } = renderShell(<List label="L" groups={GROUPS} />)
    expect(container.querySelector('.kit-list')?.hasAttribute('data-wrap')).toBe(false)
    expect(screen.getByTitle('Finance reconciles by hand')).toBeTruthy()
    rerender(<List label="L" groups={GROUPS} wrap />)
    expect(container.querySelector('.kit-list')?.hasAttribute('data-wrap')).toBe(true)
  })

  it('folds a group by a press and by the keyboard, and tells the screen', () => {
    const onFold = vi.fn()
    renderShell(<List label="L" groups={GROUPS} onFold={onFold} />)
    const head = row(/Has a why/)
    expect(head.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(head)
    expect(screen.queryByText('Onboarding stalls')).toBeNull()
    expect(onFold).toHaveBeenLastCalledWith('done', true)
    key(head, 'ArrowRight')
    expect(screen.getByText('Onboarding stalls')).toBeTruthy()
    key(head, 'ArrowLeft')
    expect(screen.queryByText('Onboarding stalls')).toBeNull()
    key(head, 'Enter')
    expect(screen.getByText('Onboarding stalls')).toBeTruthy()
  })

  it('opens a folded default shut', () => {
    renderShell(<List label="L" groups={GROUPS} defaultFolded={['waiting']} />)
    expect(screen.queryByText('Finance reconciles by hand')).toBeNull()
    expect(screen.getByText('Onboarding stalls')).toBeTruthy()
  })

  it('opens a row by a press and by Enter, and marks the one selected', () => {
    const onOpen = vi.fn()
    renderShell(<List label="L" groups={GROUPS} onOpen={onOpen} selectedId="b" />)
    fireEvent.click(screen.getByText('Onboarding stalls'))
    expect(onOpen).toHaveBeenLastCalledWith('c')
    key(row(/Finance/), 'Enter')
    expect(onOpen).toHaveBeenLastCalledWith('b')
    expect(row(/Finance/).getAttribute('aria-selected')).toBe('true')
    expect(row('Onboarding stalls').getAttribute('aria-selected')).toBe('false')
  })

  it('has one stop for Tab, and the arrows walk rows and heads', () => {
    renderShell(<List label="L" groups={GROUPS} />)
    expect(document.querySelectorAll('[role="row"][tabindex="0"]')).toHaveLength(1)
    const first = row(/portal and the planning/)
    expect(first.tabIndex).toBe(0)
    first.focus()
    key(first, 'ArrowDown')
    expect(document.activeElement).toBe(row(/Finance/))
    key(row(/Finance/), 'ArrowDown')
    expect(document.activeElement).toBe(row(/Has a why/))
    key(row(/Has a why/), 'End')
    expect(document.activeElement).toBe(row('Onboarding stalls'))
    key(row('Onboarding stalls'), 'Home')
    expect(document.activeElement).toBe(row(/Waiting/))
    expect(document.querySelectorAll('[role="row"][tabindex="0"]')).toHaveLength(1)
  })

  it('hands the focus back to the row last selected when the preview lets go', () => {
    function Host() {
      const [selected, setSelected] = useState<string | null>('b')
      return (
        <>
          <button type="button" onClick={() => setSelected('c')}>walk</button>
          <button type="button" onClick={() => setSelected(null)}>let go</button>
          <List label="L" groups={GROUPS} selectedId={selected} />
        </>
      )
    }
    renderShell(<Host />)
    fireEvent.click(screen.getByText('walk'))
    fireEvent.click(screen.getByText('let go'))
    expect(document.activeElement).toBe(row('Onboarding stalls'))
  })

  it('keeps the place when the row with the focus leaves the list', () => {
    const three: ListGroup[] = [{ id: 'g', label: '', rows: ['one', 'two', 'three'].map((text) => ({ id: text, text })) }]
    const { rerender } = renderShell(<List label="L" groups={three} />)
    const two = row('two')
    two.focus()
    fireEvent.focus(two)
    rerender(<List label="L" groups={[{ id: 'g', label: '', rows: [{ id: 'one', text: 'one' }, { id: 'three', text: 'three' }] }]} />)
    expect(document.activeElement).toBe(row('three'))
  })

  it('draws what is handed in as empty where there are no rows, with no grid over nothing', () => {
    renderShell(<List label="L" groups={[]} empty={<p>Nothing here yet</p>} />)
    expect(screen.getByText('Nothing here yet')).toBeTruthy()
    expect(screen.queryByRole('grid')).toBeNull()
  })

  it('draws the actions on the selected row only, and they do not open it', () => {
    const onOpen = vi.fn()
    const groups: ListGroup[] = [{ id: 'g', label: '', rows: [
      { id: 'x', text: 'x', actions: <button type="button">Fix x</button> },
      { id: 'y', text: 'y', actions: <button type="button">Fix y</button> },
    ] }]
    renderShell(<List label="L" groups={groups} selectedId="x" onOpen={onOpen} />)
    fireEvent.click(screen.getByText('Fix x'))
    expect(screen.queryByText('Fix y')).toBeNull()
    expect(onOpen).not.toHaveBeenCalled()
  })
})

describe('bulk selection', () => {
  it('has no boxes unless the screen wants ticks', () => {
    renderShell(<Ticking />)
    expect(screen.getAllByRole('checkbox').length).toBe(5)
  })

  it('ticks by Space and says how many, with the actions handed in', () => {
    renderShell(<Ticking bulkActions={<button type="button">Merge…</button>} />)
    expect(screen.queryByText('Merge…')).toBeNull()
    key(row(/Finance/), ' ')
    expect(screen.getByText('1 selected')).toBeTruthy()
    expect(screen.getByText('Merge…')).toBeTruthy()
    expect(within(row(/Finance/)).getByRole<HTMLInputElement>('checkbox').checked).toBe(true)
  })

  it('ticks a range with shift on the box, and a group from its head', () => {
    renderShell(<Ticking />)
    fireEvent.click(within(row(/portal/)).getByRole('checkbox'))
    fireEvent.click(within(row('Onboarding stalls')).getByRole('checkbox'), { shiftKey: true })
    expect(screen.getByText('3 selected')).toBeTruthy()
    fireEvent.click(screen.getByText('Clear selection'))
    fireEvent.click(within(row(/Waiting/)).getByRole('checkbox'))
    expect(screen.getByText('2 selected')).toBeTruthy()
    fireEvent.click(within(row(/Waiting/)).getByRole('checkbox'))
    expect(screen.queryByText(/selected$/)).toBeNull()
  })

  it('says a group part-ticked as neither, and a box does not open the row', () => {
    const onOpen = vi.fn()
    renderShell(<Ticking onOpen={onOpen} />)
    fireEvent.click(within(row(/Finance/)).getByRole('checkbox'))
    expect(within(row(/Waiting/)).getByRole<HTMLInputElement>('checkbox').indeterminate).toBe(true)
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('ticks along the way with shift and an arrow, all with ⌘A, and lets go on Esc', () => {
    renderShell(<Ticking />)
    const first = row(/portal/)
    first.focus()
    key(first, 'ArrowDown', { shiftKey: true })
    expect(screen.getByText('2 selected')).toBeTruthy()
    key(first, 'a', { metaKey: true })
    expect(screen.getByText('3 selected')).toBeTruthy()
    key(first, 'Escape')
    expect(screen.queryByText(/selected$/)).toBeNull()
  })
})

describe('columns', () => {
  const COLS: ListGroup[] = [{ id: 'g', label: '', rows: [{ id: 'a', text: 'Billing', cells: { life: 'Live' } }] }]

  it('are drawn only when asked for, under a heading that sorts and says so', () => {
    const onSort = vi.fn()
    renderShell(
      <List
        label="L" groups={COLS} itemLabel="Application" itemSortable columns={[{ id: 'life', label: 'Lifecycle', sortable: true }]}
        sort={{ column: 'life', descending: false }} onSort={onSort}
      />,
    )
    expect(screen.getByText('Live')).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: /Lifecycle/ }).getAttribute('aria-sort')).toBe('ascending')
    fireEvent.click(screen.getByRole('button', { name: /Lifecycle/ }))
    expect(onSort).toHaveBeenLastCalledWith({ column: 'life', descending: true })
    fireEvent.click(screen.getByRole('button', { name: /Application/ }))
    expect(onSort).toHaveBeenLastCalledWith({ column: '', descending: false })
  })
})

describe('the list as a whole', () => {
  it('passes axe, grouped, ticked, with columns and a selected row', async () => {
    renderShell(
      <Ticking
        selectedId="b" itemLabel="Item" columns={[{ id: 'life', label: 'Lifecycle', sortable: true }]} onSort={() => undefined}
        onOpen={() => undefined}
      />,
    )
    act(() => { fireEvent.keyDown(row(/Finance/), { key: ' ' }) })
    expect(await axeFindings()).toEqual([])
  })

  it('carries the names a guide points at', () => {
    renderShell(<List label="L" groups={GROUPS} dataGuide="register.list" rowGuide="register.row" />)
    expect(document.querySelector('[data-guide="register.list"]')).toBeTruthy()
    expect(document.querySelectorAll('[data-guide="register.row"]')).toHaveLength(3)
  })

  it('says a fact after the name, keeps a press on the end control its own, and names a row of its own', () => {
    const onOpen = vi.fn()
    const onMenu = vi.fn()
    renderShell(<List label="Views" onOpen={onOpen} groups={[{ id: 'g', label: '', rows: [
      { id: 'a', text: 'Landscape', fact: '56 elements', testId: 'row-a', guide: 'one.row', indent: 1, end: <button type="button" onClick={onMenu}>More</button> },
    ] }]} />)
    const row = screen.getByTestId('row-a')
    expect(row.getAttribute('data-guide')).toBe('one.row')
    expect(row.textContent).toContain('56 elements')
    fireEvent.click(within(row).getByRole('button', { name: 'More' }))
    expect(onMenu).toHaveBeenCalledOnce()
    expect(onOpen).not.toHaveBeenCalled()
    fireEvent.click(row)
    expect(onOpen).toHaveBeenCalledWith('a')
  })
})

describe('a list row and a column say what points at them', () => {
  it('puts a row\'s attributes on the row, and a column\'s name on its heading', () => {
    renderShell(<List
      label="L" columns={[{ id: 'a', label: 'A', guide: 'x.colA' }]} itemLabel="Item"
      groups={[{ id: '', label: '', rows: [{ id: '1', text: 'One', attributes: { 'data-testid': 'row-one', 'data-check': 'c' } }] }]}
    />)
    expect(screen.getByTestId('row-one').getAttribute('data-check')).toBe('c')
    expect(screen.getByRole('columnheader', { name: 'A' }).getAttribute('data-guide')).toBe('x.colA')
  })
})

describe('a list a screen draws more on', () => {
  const groups = [{ id: 'g', label: 'Group', rows: [{ id: 'a', text: 'A', depth: 2, state: 'outside' }, { id: 'b', text: 'B' }] }]
  it('says how deep a row sits and what its stylesheet may read', () => {
    renderShell(<List label="L" groups={groups} />)
    const row = document.querySelector<HTMLElement>('[data-kit-row="row:a"]')!
    expect(row.dataset.state).toBe('outside')
    expect(row.getAttribute('style')).toContain('--kit-list-depth: 2')
  })
  it('opens a group from its head and folds it from its caret, where a group is a thing of its own', () => {
    const onOpenGroup = vi.fn()
    const onFold = vi.fn()
    renderShell(<List label="L" groups={groups} onOpenGroup={onOpenGroup} onFold={onFold} folded={new Set()} />)
    const head = document.querySelector<HTMLElement>('[data-kit-row="head:g"]')!
    fireEvent.click(head.querySelector('.kit-list__headCell span:last-child')!)
    expect(onOpenGroup).toHaveBeenCalledWith('g')
    expect(onFold).not.toHaveBeenCalled()
    fireEvent.click(head.querySelector('.kit-list__caret')!)
    expect(onFold).toHaveBeenCalledWith('g', true)
  })
  it('folds what it is told is folded, and rows may be picked up', () => {
    const onRowDragStart = vi.fn()
    renderShell(<List label="L" groups={groups} folded={new Set()} onRowDragStart={onRowDragStart} />)
    const row = document.querySelector<HTMLElement>('[data-kit-row="row:a"]')!
    expect(row.draggable).toBe(true)
    fireEvent.dragStart(row)
    expect(onRowDragStart.mock.calls[0]![0]).toBe('a')
  })
  it('indents a row that nests under the one before it, and says how deep', () => {
    render(<List label="Topics" groups={[{ id: '', label: '', rows: [{ id: 'a', text: 'Security' }, { id: 'b', text: 'Identity', depth: 1 }] }]} />)
    expect(screen.getByRole('row', { name: 'Identity' }).getAttribute('aria-level')).toBe('2')
    expect(screen.getByRole('row', { name: 'Security' }).getAttribute('aria-level')).toBeNull()
  })
})

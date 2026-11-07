// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { TreeList } from './TreeList'

afterEach(() => cleanup())

const NODES = [
  { id: 'plan', label: 'Plan', count: 2, children: [{ id: 'a', label: 'A row' }, { id: 'b', label: 'B row' }] },
  { id: 'run', label: 'Run', note: '1 needs one A' },
]

function Harness({ onSelect = () => {} }: { onSelect?: (id: string) => void }) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  return (
    <TreeList
      label="Parts" nodes={NODES} selectedId="plan" onSelect={onSelect} open={open}
      onOpen={(id, on) => setOpen((held) => { const next = new Set(held); if (on) next.add(id); else next.delete(id); return next })}
    />
  )
}

describe('the tree list', () => {
  it('picks a node on a press and says what is picked', () => {
    const onSelect = vi.fn()
    render(<Harness onSelect={onSelect} />)
    expect(screen.getByRole('treeitem', { name: /Plan/ }).getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByRole('treeitem', { name: /Run/ }))
    expect(onSelect).toHaveBeenCalledWith('run')
  })

  it('opens with the arrow, walks in, and has one tab stop', () => {
    render(<Harness />)
    const plan = screen.getByRole('treeitem', { name: /Plan/ })
    plan.focus()
    expect(screen.queryByRole('treeitem', { name: 'A row' })).toBeNull()
    fireEvent.keyDown(plan, { key: 'ArrowRight' })
    expect(plan.getAttribute('aria-expanded')).toBe('true')
    fireEvent.keyDown(plan, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(screen.getByRole('treeitem', { name: 'A row' }))
    expect(screen.getAllByRole('treeitem').filter((one) => one.tabIndex === 0)).toHaveLength(1)
    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(plan)
  })

  it('folds on the caret without picking', () => {
    const onSelect = vi.fn()
    render(<Harness onSelect={onSelect} />)
    const plan = screen.getByRole('treeitem', { name: /Plan/ })
    fireEvent.click(plan.querySelector('.kit-tree__caret') as Element)
    expect(onSelect).not.toHaveBeenCalled()
    expect(screen.getByRole('treeitem', { name: 'A row' })).toBeTruthy()
  })
})

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { Menu, MenuButton, MoreMenu, orderedEntries } from './Menu'
import type { MenuEntry } from './Menu'

afterEach(cleanup)

/** As a press does: the focus on the button, which is where it must come back to. */
const open = (name: string) => {
  const button = screen.getByRole('button', { name })
  button.focus()
  fireEvent.click(button)
}

describe('orderedEntries', () => {
  const act = (label: string, final = false): MenuEntry => ({ label, final, onSelect: () => {} })
  const labels = (entries: readonly MenuEntry[]) => entries.map((entry) => ('label' in entry ? entry.label : '—'))

  it('moves final acts to the end behind one line, wherever they were listed', () => {
    expect(labels(orderedEntries([act('Delete', true), act('Move'), act('Copy')]))).toEqual(['Move', 'Copy', '—', 'Delete'])
  })

  it('does not draw a second line, or a line over nothing', () => {
    expect(labels(orderedEntries([act('Move'), { line: true }, act('Delete', true)]))).toEqual(['Move', '—', 'Delete'])
    expect(labels(orderedEntries([act('Delete', true)]))).toEqual(['Delete'])
  })

  it('leaves a list with no final act as it was', () => {
    const entries = [act('Move'), { heading: 'Others' }, act('Copy')]
    expect(orderedEntries(entries)).toBe(entries)
  })
})

describe('Menu', () => {
  it('opens from ⋯ with the focus inside, shows a key cap, runs an act and closes', async () => {
    const moved = vi.fn()
    renderShell(<MoreMenu data-guide="more" items={[{ label: 'Move to…', shortcut: 'M', onSelect: moved }, { label: 'History', onSelect: () => {} }]} />)
    const more = screen.getByRole('button', { name: 'More' })
    expect(more.dataset.guide).toBe('more')
    expect(more.getAttribute('aria-expanded')).toBe('false')
    open('More')
    expect(screen.getByRole('button', { hidden: true, name: 'More' }).getAttribute('aria-expanded')).toBe('true')
    const item = screen.getByRole('menuitem', { name: 'Move to… M' })
    expect(document.activeElement).toBe(item)
    expect(item.querySelector('kbd')?.textContent).toBe('M')
    expect(await axeFindings()).toEqual([])
    fireEvent.click(item)
    expect(moved).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    expect(document.activeElement).toBe(more)
  })

  it('walks with the arrows, and Escape closes and puts the focus back', async () => {
    renderShell(<MenuButton label="Colour" items={[{ label: 'One', onSelect: () => {} }, { label: 'Two', onSelect: () => {} }]} />)
    const button = screen.getByRole('button', { name: 'Colour' })
    open('Colour')
    const menu = screen.getByRole('menu', { name: 'Colour' })
    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(within(menu).getByRole('menuitem', { name: 'Two' }))
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    expect(document.activeElement).toBe(button)
  })

  it('keeps a refused act, with its reason, reachable by the arrows, and pressing it does nothing', async () => {
    const deleted = vi.fn()
    renderShell(<MoreMenu items={[
      { label: 'History', onSelect: () => {} },
      { label: 'Delete', final: true, refused: 'Three views draw it: remove it there first.', onSelect: deleted },
    ]} />)
    open('More')
    expect(screen.getByRole('separator')).toBeTruthy()
    const item = screen.getByRole('menuitem', { name: /^Delete/ })
    expect(item.getAttribute('aria-disabled')).toBe('true')
    expect(document.getElementById(item.getAttribute('aria-describedby') ?? '')?.textContent).toBe('Three views draw it: remove it there first.')
    fireEvent.keyDown(document.activeElement as Element, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(item)
    fireEvent.click(item)
    expect(deleted).not.toHaveBeenCalled()
    expect(screen.getByRole('menu')).toBeTruthy()
    expect(await axeFindings()).toEqual([])
  })

  it('draws a choice with its state, and a heading over a group', async () => {
    renderShell(<MoreMenu label="Show" items={[
      { heading: 'On the board' },
      { label: 'Key', checked: true, onSelect: () => {} },
      { label: 'Grid', checked: false, onSelect: () => {} },
    ]} />)
    open('Show')
    expect(screen.getByRole('menuitemcheckbox', { name: 'Key' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('menuitemcheckbox', { name: 'Grid' }).getAttribute('aria-checked')).toBe('false')
    expect(screen.getByText('On the board')).toBeTruthy()
    expect(await axeFindings()).toEqual([])
  })

  it('goes one level down and back by the arrows, and a leaf closes both', async () => {
    const picked = vi.fn()
    renderShell(<MoreMenu items={[{ label: 'Move to', items: [{ label: 'North', onSelect: picked }, { label: 'South', onSelect: () => {} }] }, { label: 'History', onSelect: () => {} }]} />)
    open('More')
    const parent = screen.getByRole('menuitem', { name: 'Move to' })
    expect(parent.getAttribute('aria-haspopup')).toBe('menu')
    fireEvent.keyDown(parent, { key: 'ArrowRight' })
    const north = await screen.findByRole('menuitem', { name: 'North' })
    await waitFor(() => expect(document.activeElement).toBe(north))
    fireEvent.keyDown(north, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'South' }))
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'North' })).toBeNull())
    expect(screen.getByRole('menuitem', { name: 'Move to' })).toBeTruthy()
    fireEvent.keyDown(screen.getByRole('menuitem', { name: 'Move to' }), { key: 'ArrowRight' })
    fireEvent.keyDown(await screen.findByRole('menuitem', { name: 'North' }), { key: 'ArrowLeft' })
    await waitFor(() => expect(screen.queryByRole('menuitem', { name: 'North' })).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Move to' })))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move to' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'North' }))
    expect(picked).toHaveBeenCalledOnce()
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  })

  it('will not open a refused submenu', () => {
    renderShell(<MoreMenu items={[{ label: 'Move to', refused: 'Nowhere to go', items: [{ label: 'North', onSelect: () => {} }] }]} />)
    open('More')
    const parent = screen.getByRole('menuitem', { name: /^Move to/ })
    fireEvent.keyDown(parent, { key: 'ArrowRight' })
    fireEvent.click(parent)
    expect(screen.queryByRole('menuitem', { name: 'North' })).toBeNull()
  })

  it('speaks the language that is on', () => {
    renderShell(<MoreMenu items={[]} />, { language: 'nl' })
    expect(screen.getByRole('button', { name: 'Meer' })).toBeTruthy()
  })
})

describe('what holds a refused choice', () => {
  it('is listed under it, each a way to what clears it', () => {
    const onSelect = vi.fn()
    renderShell(<Menu open anchorEl={document.body} label="Status" onClose={() => undefined} items={[
      { label: 'Done', refused: 'Not yet', onSelect: () => undefined, holds: [{ label: 'Give it an owner', onSelect }, { label: 'Has a window', ok: true }] },
    ]} />)
    fireEvent.click(screen.getByRole('menuitem', { name: /Give it an owner/ }))
    expect(onSelect).toHaveBeenCalled()
    expect(screen.getByRole('menuitem', { name: /Has a window/ }).getAttribute('aria-disabled')).toBe('true')
  })
})


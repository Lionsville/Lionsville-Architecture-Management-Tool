// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { Toast, TOAST_MS } from './Toast'

afterEach(cleanup)

describe('Toast, its time', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('goes after six seconds', () => {
    const closed = vi.fn()
    renderShell(<Toast toast={{ message: 'Marked 61 as intended' }} onClose={closed} />)
    act(() => { vi.advanceTimersByTime(TOAST_MS - 1) })
    expect(closed).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(closed).toHaveBeenCalledOnce()
    expect(TOAST_MS).toBe(6000)
  })

  it('stays while the pointer or the focus is on it, and takes its time again after', () => {
    const closed = vi.fn()
    renderShell(<Toast toast={{ message: 'Saved' }} onClose={closed} />)
    const toast = screen.getByTestId('kit-toast')
    fireEvent.pointerEnter(toast)
    act(() => { vi.advanceTimersByTime(TOAST_MS * 3) })
    expect(closed).not.toHaveBeenCalled()
    fireEvent.pointerLeave(toast)
    fireEvent.focus(toast)
    act(() => { vi.advanceTimersByTime(TOAST_MS * 3) })
    expect(closed).not.toHaveBeenCalled()
    fireEvent.blur(toast)
    act(() => { vi.advanceTimersByTime(TOAST_MS) })
    expect(closed).toHaveBeenCalledOnce()
  })

  it('starts over for a new key, with the same words', () => {
    const closed = vi.fn()
    const view = renderShell(<Toast toast={{ key: 1, message: 'Saved' }} onClose={closed} />)
    act(() => { vi.advanceTimersByTime(TOAST_MS - 1) })
    view.rerender(<Toast toast={{ key: 2, message: 'Saved' }} onClose={closed} />)
    act(() => { vi.advanceTimersByTime(TOAST_MS - 1) })
    expect(closed).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(closed).toHaveBeenCalledOnce()
  })

  it('does not hold the next toast for a pointer the last one was left with', () => {
    const closed = vi.fn()
    const view = renderShell(<Toast toast={{ message: 'First' }} onClose={closed} />)
    fireEvent.pointerEnter(screen.getByTestId('kit-toast'))
    view.rerender(<Toast toast={null} onClose={closed} />)
    view.rerender(<Toast toast={{ message: 'Second' }} onClose={closed} />)
    act(() => { vi.advanceTimersByTime(TOAST_MS) })
    expect(closed).toHaveBeenCalledOnce()
  })
})

describe('Toast', () => {
  it('says its words in a live region that is always there', async () => {
    const view = renderShell(<Toast toast={null} onClose={() => {}} />)
    const region = screen.getByRole('status')
    expect(region.textContent).toBe('')
    view.rerender(<Toast toast={{ message: 'Saved acme-logistics.lvarch' }} onClose={() => {}} />)
    expect(screen.getByRole('status')).toBe(region)
    expect(region.textContent).toBe('Saved acme-logistics.lvarch')
    expect(await axeFindings()).toEqual([])
  })

  it('offers Undo with its key, closes, and takes it once', () => {
    const closed = vi.fn()
    const undone = vi.fn()
    renderShell(<Toast toast={{ message: 'Marked 61', undo: { onPress: undone, shortcut: '⌘Z' } }} onClose={closed} />)
    expect(screen.getByRole('status').textContent).toContain('⌘Z')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(closed).toHaveBeenCalledOnce()
    expect(undone).toHaveBeenCalledOnce()
  })

  it('says Put back in a shared log, where ⌘Z is not its key', () => {
    renderShell(<Toast toast={{ message: 'Marked 61', undo: { onPress: () => {}, shared: true, shortcut: '⌘Z' } }} onClose={() => {}} />)
    expect(screen.getByRole('button', { name: 'Put back' })).toBeTruthy()
    expect(screen.getByRole('status').textContent).not.toContain('⌘Z')
  })

  it('says it in the language that is on', () => {
    renderShell(<Toast toast={{ message: 'x', undo: { onPress: () => {} } }} onClose={() => {}} />, { language: 'de' })
    expect(screen.getByRole('button', { name: 'Rückgängig' })).toBeTruthy()
  })

  it('goes when a dialog opens, and not for anything else that lands on the page', async () => {
    const closed = vi.fn()
    renderShell(<Toast toast={{ message: 'Saved' }} onClose={closed} />)
    const other = document.createElement('div')
    document.body.append(other)
    await new Promise((settled) => { setTimeout(settled, 0) })
    expect(closed).not.toHaveBeenCalled()
    const dialog = document.createElement('div')
    dialog.innerHTML = '<div role="dialog" aria-label="Question"></div>'
    document.body.append(dialog)
    await waitFor(() => expect(closed).toHaveBeenCalledOnce())
    other.remove()
    dialog.remove()
  })
})

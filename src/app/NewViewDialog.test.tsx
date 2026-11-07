// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { translator } from '../i18n'
import { NewViewDialog } from './NewViewDialog'
import { axeFindings } from './testing/axe'
import { renderShell } from './testing/renderShell'

afterEach(() => cleanup())

const s = translator('en')
const elements = [{ id: 'billing', name: 'Billing' }]

describe('choosing a new view', () => {
  it('splits on who draws it, and makes a view the model draws on the press', () => {
    const sheet = vi.fn()
    const onClose = vi.fn()
    renderShell(<NewViewDialog open canDraw make={{ sheet }} onMakeDrawing={vi.fn()} onClose={onClose} s={s} />)
    expect(screen.getByText('The model draws these, and they follow it')).toBeTruthy()
    expect(screen.getByText('You draw this one')).toBeTruthy()
    fireEvent.click(screen.getByTestId('new-view-sheet'))
    expect(sheet).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('asks a drawing for its name before anything is made', () => {
    const onMakeDrawing = vi.fn()
    renderShell(<NewViewDialog open canDraw elements={elements} make={{}} onMakeDrawing={onMakeDrawing} onClose={vi.fn()} s={s} />)
    fireEvent.click(screen.getByTestId('new-view-drawing'))
    expect((screen.getByTestId('new-drawing-make') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByTestId('new-drawing-name'), { target: { value: 'Sketch' } })
    fireEvent.click(screen.getByTestId('new-drawing-make'))
    expect(onMakeDrawing).toHaveBeenCalledWith('Sketch', undefined)
  })

  it('opens on the name, with what it is about, from an element', () => {
    const onMakeDrawing = vi.fn()
    renderShell(<NewViewDialog open naming about="billing" canDraw elements={elements} make={{}} onMakeDrawing={onMakeDrawing} onClose={vi.fn()} s={s} />)
    expect(screen.getByTestId('new-drawing-about').textContent).toContain('Billing')
    expect((screen.getByTestId('new-drawing-name') as HTMLInputElement).value).toBe('Billing · drawing')
    fireEvent.click(screen.getByTestId('new-drawing-make'))
    expect(onMakeDrawing).toHaveBeenCalledWith('Billing · drawing', 'billing')
  })

  it('says the limit before anybody commits, where no editor is at hand, and keeps Drawing on offer', async () => {
    renderShell(<NewViewDialog open canDraw={false} make={{}} onMakeDrawing={vi.fn()} onClose={vi.fn()} s={s} />)
    expect(screen.getByTestId('new-view-drawing').textContent).toContain('you can make one, not draw on it')
    fireEvent.click(screen.getByTestId('new-view-drawing'))
    expect(screen.getByText(/You need the desktop app or a shared server/)).toBeTruthy()
    expect(await axeFindings(document.body)).toEqual([])
  })
})

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The one choice the picture needs — the width it is laid out for — and what
 * the dialog does while the browser draws it and when it will not.
 */
import type { DesignDiagram } from '../../model'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { SheetExportDialog } from './SheetExportDialog'
import { renderShell } from '../../app/testing/renderShell'
import { chooseValue, optionLabels } from '../../widgets/kit/testing/select'

afterEach(() => cleanup())

describe('SheetExportDialog', () => {
  it('offers the window and the five paper sizes, A1 first', () => {
    renderShell(<SheetExportDialog name="Business architecture" onExport={vi.fn(async () => {})} onClose={vi.fn()} />)
    const field = screen.getByLabelText('Laid out for') as HTMLButtonElement
    expect(optionLabels(field)).toContain('The window as it is')
    expect(optionLabels(field)).toContain('A0 · 4494 × 3179 px')
    expect(field.value).toBe('A1')
  })

  it('asks for the picture at the chosen layout, and closes once it is handed over', async () => {
    let finish!: () => void
    const onExport = vi.fn(() => new Promise<void>((resolve) => { finish = resolve }))
    const onClose = vi.fn()
    renderShell(<SheetExportDialog name="Business architecture" onExport={onExport} onClose={onClose} />)
    chooseValue(screen.getByLabelText('Laid out for'), 'A0')
    fireEvent.click(screen.getByRole('button', { name: 'Save picture' }))
    expect(onExport).toHaveBeenCalledWith('A0')
    // Drawing: said so, and nothing else to press meanwhile.
    expect(screen.getByRole('button', { name: /Drawing/ }).getAttribute('aria-busy') ?? screen.getByRole('button', { name: /Drawing/ }).getAttribute('aria-disabled')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
    await act(async () => { finish(); await Promise.resolve() })
    expect(onClose).toHaveBeenCalled()
  })

  it('says why when the browser declined, and stays open', async () => {
    const onClose = vi.fn()
    renderShell(
      <SheetExportDialog name="Business architecture" onExport={vi.fn(async () => { throw new Error('no bitmap') })} onClose={onClose} />,
    )
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save picture' })); await Promise.resolve() })
    expect(screen.getByRole('alert').textContent).toBe('The picture could not be drawn: no bitmap')
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('where the picture’s own layout lives', () => {
  it('keeps the sheet’s canvas and columns here, as changes to the sheet, for who may write them', () => {
    const updateSheet = vi.fn()
    const sheet: DesignDiagram = { id: 's', kind: 'sheet', name: 'S', members: [], geometry: { nodes: [] } }
    renderShell(<SheetExportDialog name="Business architecture" onExport={vi.fn(async () => {})} onClose={vi.fn()} sheet={sheet} actions={{ updateSheet }} />)
    chooseValue(screen.getByLabelText('Canvas'), 'fit')
    expect(updateSheet).toHaveBeenCalledWith({ paper: 'fit' })
    chooseValue(screen.getByLabelText('Columns'), '3')
    expect(updateSheet).toHaveBeenCalledWith({ columns: 3 })
  })
})

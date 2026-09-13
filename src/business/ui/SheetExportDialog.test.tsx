// @vitest-environment jsdom
/**
 * The one choice the picture needs — the width it is laid out for — and what
 * the dialog does while the browser draws it and when it will not.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react'
import { SheetExportDialog } from './SheetExportDialog'
import { renderShell } from '../../app/testing/renderShell'

afterEach(() => cleanup())

describe('SheetExportDialog', () => {
  it('offers the window and the five paper sizes, A1 first', () => {
    renderShell(<SheetExportDialog onExport={vi.fn(async () => {})} onClose={vi.fn()} />)
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /Laid out for/ }))
    const list = within(screen.getByRole('listbox'))
    expect(list.getByRole('option', { name: 'The window as it is' })).toBeTruthy()
    expect(list.getByRole('option', { name: 'A0 · 4494 px' })).toBeTruthy()
    expect(list.getByRole('option', { name: 'A1 · 3179 px' }).getAttribute('aria-selected')).toBe('true')
  })

  it('asks for the picture at the chosen layout, and closes once it is handed over', async () => {
    let finish!: () => void
    const onExport = vi.fn(() => new Promise<void>((resolve) => { finish = resolve }))
    const onClose = vi.fn()
    renderShell(<SheetExportDialog onExport={onExport} onClose={onClose} />)
    fireEvent.mouseDown(screen.getByRole('combobox', { name: /Laid out for/ }))
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'A0 · 4494 px' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onExport).toHaveBeenCalledWith('A0')
    // Drawing: said so, and nothing else to press meanwhile.
    expect(screen.getByRole('button', { name: /Drawing/ }).hasAttribute('disabled')).toBe(true)
    expect(onClose).not.toHaveBeenCalled()
    await act(async () => { finish(); await Promise.resolve() })
    expect(onClose).toHaveBeenCalled()
  })

  it('says why when the browser declined, and stays open', async () => {
    const onClose = vi.fn()
    renderShell(
      <SheetExportDialog onExport={vi.fn(async () => { throw new Error('no bitmap') })} onClose={onClose} />,
    )
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save' })); await Promise.resolve() })
    expect(screen.getByRole('alert').textContent).toBe('The picture could not be drawn: no bitmap')
    expect(onClose).not.toHaveBeenCalled()
  })
})

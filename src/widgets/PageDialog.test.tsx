// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A page under the shell's toolbar leaves the toolbar alone: it starts below
 * it, draws no backdrop over it, and does not trap focus away from it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { PageDialog } from './PageDialog'

afterEach(() => cleanup())

function mount(topInset?: number) {
  render(
    <ThemeProvider theme={createTheme()}>
      <button>toolbar</button>
      <PageDialog open topInset={topInset} aria-label="page"><div>page</div></PageDialog>
    </ThemeProvider>,
  )
  return screen.getByText('page').closest('.MuiDialog-root') as HTMLElement
}

describe('PageDialog', () => {
  it('covers the window when the host keeps nothing', () => {
    const root = mount()
    expect(getComputedStyle(root).top).toBe('0px')
    expect(root.querySelector('.MuiBackdrop-root')).not.toBeNull()
  })

  it('starts below the shell toolbar, without a backdrop over it', () => {
    const root = mount(44)
    expect(getComputedStyle(root).top).toBe('44px')
    expect(root.querySelector('.MuiBackdrop-root')).toBeNull()
  })

  it('leaves a field that picks from a list on Escape, and closes on the next', () => {
    const onClose = vi.fn()
    render(
      <ThemeProvider theme={createTheme()}>
        <PageDialog open topInset={44} onClose={onClose} aria-label="page">
          <Autocomplete options={['Retail', 'Stores']} renderInput={(params) => <TextField {...params} label="Scope" />} />
        </PageDialog>
      </ThemeProvider>,
    )
    const field = screen.getByRole('combobox', { name: 'Scope' })
    field.focus()
    fireEvent.keyDown(field, { key: 'ArrowDown' })
    expect(screen.getByRole('listbox')).toBeTruthy()
    // The list first: the autocomplete closes it and the page never hears it.
    fireEvent.keyDown(field, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    // Then the field: left, the page still up.
    fireEvent.keyDown(field, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    // The page has the focus, so the next Escape reaches it.
    expect(document.activeElement).toBe(screen.getByRole('dialog'))
    // Then the page.
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledWith(expect.anything(), 'escapeKeyDown')
  })

  it('closes on Escape from anywhere else on it', () => {
    const onClose = vi.fn()
    render(
      <ThemeProvider theme={createTheme()}>
        <PageDialog open onClose={onClose} aria-label="page"><TextField label="Name" /></PageDialog>
      </ThemeProvider>,
    )
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Name' }), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

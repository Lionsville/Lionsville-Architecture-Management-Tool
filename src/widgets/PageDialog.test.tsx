// @vitest-environment jsdom
/**
 * A page under the shell's toolbar leaves the toolbar alone: it starts below
 * it, draws no backdrop over it, and does not trap focus away from it.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
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
})

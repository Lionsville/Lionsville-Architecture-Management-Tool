// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderShell } from '../../app/testing/renderShell'
import { axeFindings } from '../../app/testing/axe'
import { PageDialog } from '../PageDialog'
import { PageClose } from '../PageClose'
import { Frame } from './Frame'
import type { ReactNode } from 'react'

afterEach(() => cleanup())

const inFrame = (children: ReactNode) => renderShell(
  <Frame pageUp={false} rowOne={<button type="button">Find</button>} rowTwoStart={<button type="button">Home</button>} rowTwoEnd={null}>
    {children}
  </Frame>,
)

describe('a page in the frame', () => {
  it('is a place in the main column and no dialog, with the rows beside it to press', () => {
    inFrame(<PageDialog open onClose={() => {}} aria-label="Decisions"><p>body</p></PageDialog>)
    const page = screen.getByRole('region', { name: 'Decisions' })
    expect(page.closest('main')).not.toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: 'Find' })).toBeDefined()
  })

  it('takes the focus as it opens, and draws nothing while it is shut', () => {
    const { rerender } = inFrame(<PageDialog open={false} aria-label="Decisions"><p>body</p></PageDialog>)
    expect(screen.queryByRole('region')).toBeNull()
    rerender(
      <Frame pageUp rowOne={null} rowTwoStart={null} rowTwoEnd={null}>
        <PageDialog open aria-label="Decisions"><p>body</p></PageDialog>
      </Frame>,
    )
    expect(document.activeElement).toBe(screen.getByRole('region'))
  })

  it('closes on Escape from wherever the focus is, the page on top first', () => {
    const under = vi.fn()
    const top = vi.fn()
    inFrame(
      <>
        <PageDialog open onClose={under} aria-label="Roadmap"><p>a</p></PageDialog>
        <PageDialog open onClose={top} aria-label="Plan"><p>b</p></PageDialog>
      </>,
    )
    fireEvent.keyDown(screen.getByRole('button', { name: 'Find' }), { key: 'Escape' })
    expect(top).toHaveBeenCalledTimes(1)
    expect(under).not.toHaveBeenCalled()
  })

  it('leaves Escape to a dialog over it', () => {
    const close = vi.fn()
    inFrame(
      <>
        <PageDialog open onClose={close} aria-label="Roadmap"><p>a</p></PageDialog>
        <div role="dialog" aria-label="Asking" />
      </>,
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(close).not.toHaveBeenCalled()
  })

  it('draws no × of its own: it is left by Esc, Home, a tab or Back', () => {
    inFrame(<PageDialog open aria-label="Roadmap"><PageClose onClose={() => {}} /></PageDialog>)
    expect(screen.queryByTestId('page-close')).toBeNull()
  })

  it('is still the dialog it was, with no frame above it', () => {
    renderShell(<PageDialog open aria-label="Roadmap"><p>a</p></PageDialog>)
    expect(screen.getByRole('dialog')).toBeDefined()
  })

  it('reads clean to axe, the rows included', async () => {
    inFrame(<PageDialog open aria-label="Roadmap"><p>a</p></PageDialog>)
    expect(await axeFindings()).toEqual([])
  })
})

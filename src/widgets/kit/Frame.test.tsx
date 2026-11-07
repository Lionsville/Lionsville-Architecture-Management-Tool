// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderShell } from '../../app/testing/renderShell'
import { axeFindings } from '../../app/testing/axe'
import { PageDialog } from '../PageDialog'
import { PageClose } from '../PageClose'
import { SeamWidthsProvider } from '../useSeamWidth'
import type { SeamWidths } from '../useSeamWidth'
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

describe('the docked tree', () => {
  const docked = (widths?: SeamWidths) => renderShell(
    <SeamWidthsProvider value={widths}>
      <Frame pageUp={false} rowOne={null} rowTwoStart={null} rowTwoEnd={null} tree={<p>A long scope name that goes on and on and on</p>}>
        <p>page</p>
      </Frame>
    </SeamWidthsProvider>,
  )
  const seam = () => screen.getByRole('separator', { name: /tree/i })
  const width = () => screen.getByTestId('frame-tree').style.width

  it('starts at the sensible width whatever it holds', () => {
    docked()
    expect(width()).toBe('300px')
    expect(seam().getAttribute('aria-valuenow')).toBe('300')
  })

  it('is made wider and narrower from the keyboard, within its limits, and Home puts it back', () => {
    docked()
    fireEvent.keyDown(seam(), { key: 'ArrowRight' })
    expect(width()).toBe('308px')
    fireEvent.keyDown(seam(), { key: 'ArrowLeft', shiftKey: true })
    expect(width()).toBe('276px')
    for (let step = 0; step < 10; step += 1) fireEvent.keyDown(seam(), { key: 'ArrowLeft', shiftKey: true })
    expect(width()).toBe('220px')
    fireEvent.keyDown(seam(), { key: 'Home' })
    expect(width()).toBe('300px')
  })

  it('comes back as it was left, kept per person with the other widths', () => {
    const held = new Map<string, number>([['frame.tree', 410]])
    const keep = vi.fn((key: string, next: number) => { held.set(key, next) })
    docked({ widthOf: (key) => held.get(key), keep })
    expect(width()).toBe('410px')
    fireEvent.keyDown(seam(), { key: 'ArrowRight' })
    expect(keep).toHaveBeenCalledWith('frame.tree', 418)
  })

  it('has no seam with no tree', () => {
    renderShell(<Frame pageUp={false} rowOne={null} rowTwoStart={null} rowTwoEnd={null}><p>page</p></Frame>)
    expect(screen.queryByRole('separator')).toBeNull()
  })

  it('is clean to axe', async () => {
    docked()
    expect(await axeFindings()).toEqual([])
  })
})

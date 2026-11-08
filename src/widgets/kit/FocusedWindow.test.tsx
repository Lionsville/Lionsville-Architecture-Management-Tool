// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { FocusedWindow, useInFocusedWindow } from './FocusedWindow'
import type { FocusedWindowProps } from './FocusedWindow'
import { WINDOW_BAR } from './windowArea'

afterEach(cleanup)

function Editing(props: Partial<FocusedWindowProps>) {
  return (
    <FocusedWindow
      open title="Editing an observation" number="OB-0021" changed={false}
      saveLabel="Save changes" onSave={() => {}} onCancel={() => {}} {...props}
    >
      <p>The writing</p>
    </FocusedWindow>
  )
}

describe('FocusedWindow', () => {
  it('fills the window, named by what is being done, with Cancel, the number and Save in its bar', async () => {
    renderShell(<Editing middle={<span>Write or preview</span>} aside={<p>Facts</p>} data-guide="edit" />)
    const dialog = screen.getByRole('dialog', { name: 'Editing an observation' })
    expect(dialog.dataset.guide).toBe('edit')
    expect(screen.getByRole('button', { name: 'Cancel' }).dataset.guide).toBe('edit-cancel')
    expect(screen.getByRole('button', { name: 'Save changes' }).dataset.guide).toBe('edit-save')
    expect(screen.getByText('OB-0021')).toBeTruthy()
    expect(screen.getByText('Write or preview')).toBeTruthy()
    expect(screen.getByText('Facts')).toBeTruthy()
    expect(await axeFindings()).toEqual([])
  })

  it('wears the window’s bar, which keeps clear of the traffic lights and moves the window where the host asks', () => {
    renderShell(<Editing />)
    const bar = document.querySelector<HTMLElement>('.kit-focused__bar')
    expect(bar?.classList.contains(WINDOW_BAR)).toBe(true)
    // Its own style says nothing of the window: that is the root's to say (`windowArea`).
    expect(bar?.getAttribute('style')).toBeNull()
  })

  it('leaves at once on Cancel and on Escape with nothing changed', () => {
    const left = vi.fn()
    renderShell(<Editing onCancel={left} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(left).toHaveBeenCalledOnce()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(left).toHaveBeenCalledTimes(2)
    expect(screen.queryByText('Leave without saving?')).toBeNull()
  })

  it('asks first with something changed, and keeps the work on no', async () => {
    const left = vi.fn()
    renderShell(<Editing changed onCancel={left} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    const asked = await screen.findByRole('dialog', { name: 'Leave without saving?' })
    expect(left).not.toHaveBeenCalled()
    expect(await axeFindings(asked)).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Leave without saving?' })).toBeNull())
    expect(left).not.toHaveBeenCalled()
  })

  it('asks on Escape too, Escape then means no to the question, and leaving drops the work', async () => {
    const left = vi.fn()
    renderShell(<Editing changed onCancel={left} />)
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Editing an observation' }), { key: 'Escape' })
    const asked = await screen.findByRole('dialog', { name: 'Leave without saving?' })
    fireEvent.keyDown(asked, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Leave without saving?' })).toBeNull())
    expect(left).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Leave and drop changes' }))
    expect(left).toHaveBeenCalledOnce()
  })

  it('saves, and says what holds a save in the button and not by removing it', async () => {
    const saved = vi.fn()
    const view = renderShell(<Editing onSave={saved} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(saved).toHaveBeenCalledOnce()
    saved.mockClear()
    view.rerender(<Editing onSave={saved} saveRefused="A title is needed." />)
    const save = screen.getByRole('button', { name: 'Save changes' })
    expect(save.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(save)
    expect(saved).not.toHaveBeenCalled()
    fireEvent.mouseOver(save)
    expect((await screen.findByRole('tooltip')).textContent).toBe('A title is needed.')
  })

  it('cannot be left while saving, and says a failure in its bar', () => {
    const left = vi.fn()
    const view = renderShell(<Editing onCancel={left} working />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(left).not.toHaveBeenCalled()
    view.rerender(<Editing onCancel={left} error="Not saved: the server did not answer." />)
    expect(screen.getByRole('alert').textContent).toBe('Not saved: the server did not answer.')
  })

  it('offers to fold the facts where there are any, and leaves them open until asked', () => {
    const view = renderShell(<Editing aside={<p>Facts</p>} />)
    const fold = screen.getByRole('button', { name: 'Details' })
    const aside = document.querySelector<HTMLElement>('.kit-focused__aside')
    expect(fold.getAttribute('aria-expanded')).toBe('true')
    expect(aside?.dataset.folded).toBeUndefined()
    fireEvent.click(fold)
    expect(fold.getAttribute('aria-expanded')).toBe('false')
    expect(aside?.dataset.folded).toBeDefined()
    view.rerender(<Editing />)
    expect(screen.queryByRole('button', { name: 'Details' })).toBeNull()
  })

  it('tells what stands in it, and nothing outside it, that it is in a full window', () => {
    const Says = () => <span>{useInFocusedWindow() ? 'inside' : 'outside'}</span>
    renderShell(
      <>
        <Says />
        <FocusedWindow open title="Editing" changed={false} saveLabel="Save" onSave={() => {}} onCancel={() => {}}><Says /></FocusedWindow>
      </>,
    )
    expect(screen.getByText('outside')).toBeTruthy()
    expect(screen.getByText('inside')).toBeTruthy()
  })

  // jsdom draws nothing, so the sheet itself is what can be held to this: the owner's "wasting the entire screen".
  it('caps the writing at no width, and scrolls by column rather than as a window', () => {
    const sheet = readFileSync('src/widgets/kit/FocusedWindow.css', 'utf8')
    const rule = (name: string) => sheet.match(new RegExp(`\\.kit-focused__${name} \\{([^}]*)\\}`))?.[1] ?? ''
    expect(rule('main')).toMatch(/flex: 1;/)
    expect(rule('main')).toMatch(/overflow-y: auto/)
    expect(rule('main')).not.toMatch(/max-width|760px/)
    expect(rule('aside')).toMatch(/overflow-y: auto/)
    expect(rule('body')).not.toMatch(/overflow|justify-content/)
  })

  it('speaks the language that is on', () => {
    renderShell(<Editing />, { language: 'de' })
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toBeTruthy()
  })
})

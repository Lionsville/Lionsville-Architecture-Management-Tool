// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The home's line under the cards (3.6.1): what the checks find, counted by
 * weight in the marks the lists use, each count a button to the Checks page
 * on its weight — and nothing at all where nothing is found. Until the
 * Checks page it listed every finding; those tests are the page's now
 * (`ChecksPage.test.tsx`, `treeChecks.test.ts`).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { translator } from '../../i18n'
import { axeFindings } from '../testing/axe'
import { renderShell } from '../testing/renderShell'
import { NeedsAttention, weightCount } from './NeedsAttention'

afterEach(() => cleanup())

const s = translator('en')

describe('NeedsAttention', () => {
  it('counts what is found by weight, fix first, and leaves out a weight with nothing', async () => {
    renderShell(<NeedsAttention counts={{ fix: 1, review: 31, note: 0 }} onOpen={vi.fn()} s={s} />)
    const counts = screen.getAllByRole('button')
    expect(counts.map((one) => one.textContent)).toEqual(['●1 to fix', '▲31 to review'])
    expect(counts.map((one) => one.getAttribute('data-weight'))).toEqual(['fix', 'review'])
    expect(screen.getByTestId('needs-attention').getAttribute('data-guide')).toBe('org.attention')
    expect(await axeFindings()).toEqual([])
  })

  it('opens the Checks page on the weight pressed, from the keyboard as from the pointer', () => {
    const onOpen = vi.fn()
    renderShell(<NeedsAttention counts={{ fix: 0, review: 2, note: 13 }} onOpen={onOpen} s={s} />)
    const notes = screen.getByRole('button', { name: /13 notes/ })
    // A button of its own: reached by Tab, pressed by Enter or Space.
    expect(notes.tagName).toBe('BUTTON')
    notes.focus()
    expect(document.activeElement).toBe(notes)
    fireEvent.click(notes)
    expect(onOpen).toHaveBeenCalledWith('note')
  })

  it('is not drawn where nothing is found', () => {
    renderShell(<NeedsAttention counts={{ fix: 0, review: 0, note: 0 }} onOpen={vi.fn()} s={s} />)
    expect(screen.queryByTestId('needs-attention')).toBeNull()
  })

  it('says each weight in the words of the page it opens, one and many', () => {
    expect([weightCount('fix', 1, s), weightCount('review', 2, s), weightCount('note', 1, s), weightCount('note', 44, s)])
      .toEqual(['1 to fix', '2 to review', '1 note', '44 notes'])
    const nl = translator('nl')
    expect(weightCount('note', 44, nl)).toBe('44 notities')
  })
})

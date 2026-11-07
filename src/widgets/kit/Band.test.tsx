// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/** A state of the window said in words with one way out; never two at once. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { Band, BandStack } from './Band'

afterEach(() => cleanup())

describe('a band', () => {
  it('says what is true in words, with its way out', () => {
    renderShell(<Band tone="looking" title="As it stood on 1 Jun 2026." detail="Only you see this." action={<button type="button">Back to today</button>} dataGuide="band.day" />)
    const band = screen.getByRole('status')
    expect(band.textContent).toContain('As it stood on 1 Jun 2026.')
    expect(band.textContent).toContain('Only you see this.')
    expect(screen.getByRole('button', { name: 'Back to today' })).toBeTruthy()
    expect(document.querySelector('[data-guide="band.day"]')).toBe(band)
  })

  it('has a shape as well as a colour for each state that has a mark', () => {
    const { container, rerender } = renderShell(<Band tone="agent" title="T" />)
    expect(container.querySelector('.kit-mark')?.getAttribute('data-kind')).toBe('agent')
    rerender(<Band tone="finding" title="T" />)
    expect(container.querySelector('.kit-mark')?.getAttribute('data-kind')).toBe('review')
    rerender(<Band tone="looking" title="T" />)
    expect(container.querySelector('.kit-mark')?.getAttribute('data-kind')).toBe('look')
  })

  it('walks a set, and offers only the steps there are', () => {
    const onNext = vi.fn()
    renderShell(<Band tone="finding" title="Nobody owns this." position={{ at: 1, total: 10, onNext }} />)
    expect(screen.getByText(/1 of 10/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Previous' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(onNext).toHaveBeenCalled()
  })
})

describe('more than one', () => {
  const BANDS = [
    { id: 'a', tone: 'agent' as const, title: 'An agent is working.' },
    { id: 'b', tone: 'looking' as const, title: 'Another day.' },
    { id: 'c', tone: 'readOnly' as const, title: 'Read only here.' },
  ]

  it('shows the first and counts the rest, which open on a press', () => {
    renderShell(<BandStack bands={BANDS} />)
    expect(screen.getByText('An agent is working.')).toBeTruthy()
    expect(screen.queryByText('Another day.')).toBeNull()
    const more = screen.getByRole('button', { name: '2 more' })
    expect(more.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(more)
    expect(screen.getByText('Another day.')).toBeTruthy()
    expect(screen.getByText('Read only here.')).toBeTruthy()
  })

  it('draws no count for one, and nothing for none', () => {
    const { container, rerender } = renderShell(<BandStack bands={[BANDS[0]!]} />)
    expect(screen.queryByRole('button')).toBeNull()
    rerender(<BandStack bands={[]} />)
    expect(container.querySelector('.kit-bands')).toBeNull()
  })

  it('passes axe', async () => {
    renderShell(<BandStack bands={BANDS} />)
    fireEvent.click(screen.getByRole('button', { name: '2 more' }))
    expect(await axeFindings()).toEqual([])
  })
})

describe('a band carrying something with a mark of its own', () => {
  it('draws the mark it is handed in place of the state\'s', () => {
    const { container } = renderShell(<Band tone="finding" mark="fix" title="A row outlives its end" />)
    expect(container.querySelector('circle')).not.toBeNull()
    expect(container.querySelector('path')).toBeNull()
  })
})

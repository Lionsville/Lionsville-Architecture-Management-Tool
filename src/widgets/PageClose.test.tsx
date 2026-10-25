// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The two ends of a page's bar (ADR-0044 §2): × closes, ‹ says what it does,
 * and a page written over its whole width goes back to reading first.
 */
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderShell } from '../app/testing/renderShell'
import { PageBack, PageClose, useBackToReading } from './PageClose'

afterEach(() => cleanup())

/** A page that is read or written, with both ends of its bar. */
function Editor({ onClose }: { onClose: () => void }) {
  const [writing, setWriting] = useState(true)
  const leaving = useBackToReading(writing, () => setWriting(false), onClose, 'Close the page')
  return (
    <div>
      <PageBack onBack={leaving.leave} label={leaving.said} />
      <span>{writing ? 'writing' : 'reading'}</span>
      <PageClose onClose={leaving.leave} label={leaving.closeSaid} />
    </div>
  )
}

describe('the ends of a page’s bar', () => {
  it('closes from ×, which says Close where nothing else is said', () => {
    const onClose = vi.fn()
    renderShell(<PageClose onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('goes back to reading from either end while the page is written, and closes on the next press', () => {
    const onClose = vi.fn()
    renderShell(<Editor onClose={onClose} />)
    expect(screen.getByTestId('page-back').getAttribute('aria-label')).toBe('Back to reading')
    expect(screen.getByTestId('page-close').getAttribute('aria-label')).toBe('Back to reading')
    fireEvent.click(screen.getByTestId('page-close'))
    expect(screen.getByText('reading')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
    // Read now: ‹ says it closes, × is the plain close, and either closes.
    expect(screen.getByTestId('page-back').getAttribute('aria-label')).toBe('Close the page')
    expect(screen.getByTestId('page-close').getAttribute('aria-label')).toBe('Close')
    fireEvent.click(screen.getByTestId('page-back'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A home card is low (ADR-0044 §5): its title, two lines of what the page
 * is, its counts; and its ways in come up over it, under the title, on hover
 * and on keyboard focus — one button filling it, or one per way, stacked.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { renderShell } from '../testing/renderShell'
import { OnePage, WAYS } from './OnePage'

afterEach(() => cleanup())

/** The style rules Emotion wrote, as text: jsdom computes neither `:hover` nor `:has`. */
const styles = () => Array.from(document.querySelectorAll('style')).map((one) => one.textContent ?? '').join('\n')

describe('a home card', () => {
  it('says what the page is, and puts its ways in over it, each a press away', () => {
    const open = vi.fn()
    const latest = vi.fn()
    renderShell(
      <OnePage
        icon={null} title="Decisions" description="What was decided here and why." count="3 records" finding="Latest: ADR-0003 One warehouse"
        actions={[
          { label: 'Open', onClick: open, ariaLabel: 'Open Decisions', testId: 'open-decisions', guide: 'org.card.decisions' },
          { label: 'Latest: ADR-0003', onClick: latest, testId: 'open-latest-decision' },
        ]}
      />,
    )
    expect(screen.getByTestId('card-description').textContent).toBe('What was decided here and why.')
    const ways = screen.getByRole('group', { name: 'Decisions' })
    expect(within(ways).getAllByRole('button').map((one) => one.textContent)).toEqual(['Open', 'Latest: ADR-0003'])
    fireEvent.click(within(ways).getByRole('button', { name: 'Open Decisions' }))
    fireEvent.click(within(ways).getByRole('button', { name: 'Latest: ADR-0003' }))
    expect(open).toHaveBeenCalledTimes(1)
    expect(latest).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('open-decisions').getAttribute('data-guide')).toBe('org.card.decisions')
  })

  it('raises its ways in on hover and for the keyboard only, never for focus a closed page handed back', () => {
    renderShell(<OnePage icon={null} title="Roadmap" description="Plans over time." actions={[{ label: 'Open', onClick: () => {} }]} />)
    const written = styles()
    expect(written).toContain(`:hover .${WAYS}`)
    expect(written).toContain(`:has(.Mui-focusVisible) .${WAYS}`)
    // Focus within the card is what a page that closed hands back after a press of the mouse.
    expect(written).not.toContain(`:focus-within .${WAYS}`)
  })

  it('has no ways to raise where it opens nothing', () => {
    renderShell(<OnePage icon={null} title="Operating model" description="Units, roles and who answers for what." />)
    expect(screen.queryByRole('group')).toBeNull()
  })
})

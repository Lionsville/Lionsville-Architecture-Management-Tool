// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { NothingDash } from './NothingDash'

afterEach(() => cleanup())

describe('a nothing, as a dash', () => {
  it('shows a dash to the eye and keeps the words for a reader and the pointer', () => {
    render(<NothingDash says="Nowhere else" />)
    const dash = screen.getByTestId('nothing-dash')
    expect(dash.getAttribute('title')).toBe('Nowhere else')
    expect(dash.textContent).toBe('–Nowhere else')
    expect(screen.getByText('–').getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByText('Nowhere else').getAttribute('aria-hidden')).toBeNull()
  })
})

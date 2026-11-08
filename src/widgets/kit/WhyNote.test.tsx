// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { WhyNote } from './WhyNote'

afterEach(cleanup)

describe('WhyNote', () => {
  it('keeps its explanation folded until asked, and says so to a reader', async () => {
    renderShell(<WhyNote>Two statements by two scopes.</WhyNote>)
    const press = screen.getByRole('button', { name: /why\?/ })
    expect(press.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('Two statements by two scopes.')).toBeNull()
    fireEvent.click(press)
    expect(press.getAttribute('aria-expanded')).toBe('true')
    const note = screen.getByText('Two statements by two scopes.')
    expect(press.getAttribute('aria-controls')).toBe(note.id)
    expect(await axeFindings()).toEqual([])
    fireEvent.click(press)
    expect(screen.queryByText('Two statements by two scopes.')).toBeNull()
  })

  it('asks its own question where why? is not it', () => {
    renderShell(<WhyNote label="What this does">It stays on this poster.</WhyNote>)
    expect(screen.getByRole('button', { name: /What this does/ })).toBeTruthy()
  })
})

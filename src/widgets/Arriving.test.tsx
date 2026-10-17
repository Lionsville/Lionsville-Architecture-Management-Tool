// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { renderShell } from '../app/testing/renderShell'
import { ArrivingDialog, ArrivingPage, arrivingDialog, arrivingPage } from './Arriving'

afterEach(() => cleanup())

describe('the frame a part draws while it arrives', () => {
  it('is a page under the host’s bar, saying it is loading', () => {
    renderShell(<ArrivingPage topInset={38} />)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('Loading…')
  })

  it('is a small dialog, likewise', () => {
    renderShell(<ArrivingDialog />)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe('Loading…')
  })

  it('is nothing for a part that is not open, and the frame where it is or says nothing', () => {
    expect(arrivingPage({ open: false })).toBeNull()
    expect(arrivingDialog({ open: false })).toBeNull()
    expect(arrivingPage({ open: true, windowChrome: { topInset: 38 } })).not.toBeNull()
    expect(arrivingDialog({})).not.toBeNull()
  })
})

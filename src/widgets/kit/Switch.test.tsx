// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { Switch } from './Switch'

afterEach(() => cleanup())

describe('Switch', () => {
  it('is a switch named by its words, and says the other state when pressed', async () => {
    const onChange = vi.fn()
    renderShell(<Switch checked={false} onChange={onChange} label="Accept agent connections" data-guide="agent.switch" />)
    const toggle = screen.getByRole('switch', { name: 'Accept agent connections' }) as HTMLInputElement
    expect(toggle.checked).toBe(false)
    expect(document.querySelector('.MuiSwitch-root')).toBeNull()
    expect(await axeFindings()).toEqual([])
    fireEvent.click(toggle)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('takes nothing while it is off limits', () => {
    const onChange = vi.fn()
    renderShell(<Switch checked onChange={onChange} label="Notes" disabled />)
    expect((screen.getByRole('switch', { name: 'Notes' }) as HTMLInputElement).disabled).toBe(true)
  })
})

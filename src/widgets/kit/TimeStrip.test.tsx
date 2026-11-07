// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TimeStrip } from './TimeStrip'

afterEach(cleanup)

const ITEMS = [
  { id: 'a', day: '2026-06-01', label: 'Contract signed' },
  { id: 'b', day: '2026-09-01', label: 'Pilot' },
]

describe('TimeStrip', () => {
  it('names each milestone with its day, and hands a press back', () => {
    const onPick = vi.fn()
    render(<TimeStrip label="Time" today="2026-11-07" from="2026-06-01" to="2027-03-31" items={ITEMS} onPick={onPick} />)
    fireEvent.click(screen.getByRole('button', { name: /Pilot/ }))
    expect(onPick).toHaveBeenCalledWith('b')
  })

  it('reads for somebody who may not press', () => {
    render(<TimeStrip label="Time" today="2026-11-07" items={ITEMS} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByRole('img', { name: /Contract signed/ })).toBeTruthy()
  })
})

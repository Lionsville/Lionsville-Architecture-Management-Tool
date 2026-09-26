// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { clockTime } from './clockTime'

describe('clockTime', () => {
  it('says the hour and the minute the way the chosen language writes a clock', () => {
    const at = new Date('2026-09-26T21:05:00Z')
    expect(clockTime(at, 'en')).toBe('21:05')
    expect(clockTime(at, 'nl')).toBe('21:05')
    expect(clockTime(at, 'de')).toBe('21:05')
  })
})

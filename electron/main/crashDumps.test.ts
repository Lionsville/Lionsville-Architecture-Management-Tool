// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { keepsCrashDumps } from './crashDumps'

describe('whether a run keeps crash dumps', () => {
  it('keeps them in a development run, unless told not to', () => {
    expect(keepsCrashDumps(false, {})).toBe(true)
    expect(keepsCrashDumps(false, { LVARCH_CRASH_DUMPS: '0' })).toBe(false)
  })

  it('keeps none in an installed app unless asked', () => {
    expect(keepsCrashDumps(true, {})).toBe(false)
    expect(keepsCrashDumps(true, { LVARCH_CRASH_DUMPS: '1' })).toBe(true)
  })
})

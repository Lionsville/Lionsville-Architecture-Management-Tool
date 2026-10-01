// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { isObservationTab, OBSERVATION_TABS } from './tabs'

describe('the observations page’s tabs', () => {
  it('are the register, the analysis and the solutions, in that order', () => {
    expect(OBSERVATION_TABS).toEqual(['register', 'analysis', 'solutions'])
  })

  it('recognises one of the three, and nothing else', () => {
    expect(OBSERVATION_TABS.every(isObservationTab)).toBe(true)
    expect(isObservationTab('Register')).toBe(false)
    expect(isObservationTab('roadmap')).toBe(false)
    expect(isObservationTab(undefined)).toBe(false)
    expect(isObservationTab(1)).toBe(false)
  })
})

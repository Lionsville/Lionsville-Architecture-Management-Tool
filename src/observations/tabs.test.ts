// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { hasMap, isObservationTab, OBSERVATION_STAGES, OBSERVATION_TABS, stageOfTab } from './tabs'

describe('the observations page’s stages', () => {
  it('are Seen, Why, Solve and Did it work, in the words an address has always said the first three in', () => {
    expect(OBSERVATION_STAGES).toEqual(['register', 'analysis', 'solutions', 'results'])
  })

  it('recognises a stage or a stage with its lens, and nothing else', () => {
    expect(OBSERVATION_TABS.every(isObservationTab)).toBe(true)
    expect(isObservationTab('Register')).toBe(false)
    expect(isObservationTab('roadmap')).toBe(false)
    expect(isObservationTab(undefined)).toBe(false)
    expect(isObservationTab(1)).toBe(false)
  })

  it('reads a tab as its stage and, where it names one, its lens', () => {
    expect(stageOfTab('analysis')).toEqual({ stage: 'analysis' })
    expect(stageOfTab('solutions-map')).toEqual({ stage: 'solutions', lens: 'map' })
    expect(stageOfTab('analysis-list')).toEqual({ stage: 'analysis', lens: 'list' })
  })

  it('draws only Why and Solve', () => {
    expect(OBSERVATION_STAGES.filter(hasMap)).toEqual(['analysis', 'solutions'])
  })
})

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV
import { describe, expect, it } from 'vitest'
import { inSentence, standingAlone } from './languages'

describe('a label inside a sentence', () => {
  it('is lower case in English and Dutch', () => {
    expect(inSentence('Root causes with no solution', 'en')).toBe('root causes with no solution')
    expect(inSentence('Wacht op een waarom', 'nl')).toBe('wacht op een waarom')
  })

  it('keeps the capitals of German nouns', () => {
    expect(inSentence('Grundursachen ohne Lösung', 'de')).toBe('Grundursachen ohne Lösung')
  })
})

describe('a phrase standing alone', () => {
  it('starts with a capital and keeps the rest as said', () => {
    expect(standingAlone('the same family name and initial', 'en')).toBe('The same family name and initial')
    expect(standingAlone('dezelfde naam', 'nl')).toBe('Dezelfde naam')
    expect(standingAlone('', 'de')).toBe('')
  })
})

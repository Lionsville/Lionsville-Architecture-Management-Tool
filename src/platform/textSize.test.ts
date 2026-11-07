// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { applyTextSize, movedTextSize, readTextSize, textScale } from './textSize'

describe('the text size', () => {
  afterEach(() => applyTextSize(100))

  it('reads a step out of the preferences, and anything else as the default', () => {
    expect(readTextSize({ textSize: 125 })).toBe(125)
    expect(readTextSize({ textSize: 113 })).toBe(100)
    expect(readTextSize({ textSize: '125' })).toBe(100)
    expect(readTextSize(undefined)).toBe(100)
  })

  it('moves a step at a time, stays at an end, and goes back to the default', () => {
    expect(movedTextSize(100, 'larger')).toBe(112)
    expect(movedTextSize(100, 'smaller')).toBe(90)
    expect(movedTextSize(150, 'larger')).toBe(150)
    expect(movedTextSize(90, 'smaller')).toBe(90)
    expect(movedTextSize(150, 'default')).toBe(100)
  })

  it('lands on the root as a percentage, and the default leaves the browser alone', () => {
    applyTextSize(125)
    expect(document.documentElement.style.fontSize).toBe('125%')
    expect(textScale()).toBe(1.25)
    applyTextSize(100)
    expect(document.documentElement.style.fontSize).toBe('')
    expect(textScale()).toBe(1)
  })
})

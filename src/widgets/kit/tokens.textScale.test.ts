// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { textScale } from './tokens'

describe('the text size, for the few widths a script works out', () => {
  it('is what the root says, and the browser’s own where it says nothing', () => {
    document.documentElement.dataset.textSize = '125'
    expect(textScale()).toBe(1.25)
    delete document.documentElement.dataset.textSize
    expect(textScale()).toBe(1)
  })
})

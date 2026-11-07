// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { wrapTitle } from './ChainMarks'

describe('a title on a card', () => {
  it('keeps words whole, line by line', () => {
    expect(wrapTitle('The nightly batch runs into office hours', 20, 3)).toEqual(['The nightly batch', 'runs into office', 'hours'])
  })

  it('cuts the last line where there are more words than lines', () => {
    const lines = wrapTitle('The nightly batch runs into office hours and nobody is told about it', 20, 2)
    expect(lines).toHaveLength(2)
    expect(lines[1].endsWith('…')).toBe(true)
    expect(lines[1].length).toBeLessThanOrEqual(21)
  })

  it('cuts a word longer than a line', () => {
    expect(wrapTitle('Onderhoudsverantwoordelijkheid', 10, 2)[0].length).toBeLessThanOrEqual(11)
  })
})

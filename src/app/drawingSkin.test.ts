// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { coloursOf } from '../widgets/kit/tokens'
import { drawingSkin } from './drawingSkin'

describe('drawingSkin', () => {
  it('sends a palette group title its dark ink inverted, since draw.io inverts that title in its dark look', () => {
    const dark = coloursOf('dark').ink
    const inverted = `#${(0xffffff - parseInt(dark.slice(1), 16)).toString(16).padStart(6, '0')}`
    const title = drawingSkin().split('\n').find((line) => line.startsWith('.geTitle, .geTitle:hover'))
    expect(title).toContain(`light-dark(${coloursOf('light').ink}, ${inverted})`)
  })
})

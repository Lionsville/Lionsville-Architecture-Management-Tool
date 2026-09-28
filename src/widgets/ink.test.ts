// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The ink for a ground worked out while drawing. What each pair measures on
 * the real palette is `app/theme.contrast.test.ts`'s; this pins the arithmetic
 * the drawing relies on, on colours chosen to sit where it could go wrong.
 */
import { describe, expect, it } from 'vitest'
import { createTheme, getContrastRatio } from '@mui/material/styles'
import { TEXT_CONTRAST, contrast, dangerInk, flatten, inkOn, legibleOn, mix } from './ink'

const light = createTheme({ palette: { mode: 'light' } })
const dark = createTheme({ palette: { mode: 'dark' } })

describe('a colour as drawn', () => {
  it('lays a translucent colour over its ground, and leaves an opaque one as it is', () => {
    expect(flatten('rgba(0, 0, 0, 0.5)', '#ffffff')).toBe('rgb(128, 128, 128)')
    expect(flatten('#336699', '#ffffff')).toBe('rgb(51, 102, 153)')
  })

  it('mixes a share of a colour into a ground the way color-mix in srgb does', () => {
    expect(mix('#000000', 0.25, '#ffffff')).toBe('rgb(191, 191, 191)')
    expect(mix('#4f5bd5', 1, '#ffffff')).toBe('rgb(79, 91, 213)')
    expect(mix('#4f5bd5', 0, '#ffffff')).toBe('rgb(255, 255, 255)')
  })

  it('measures a translucent ink by what it looks like, not by its colour with the alpha dropped', () => {
    expect(contrast('rgba(0, 0, 0, 0.5)', '#ffffff')).toBeCloseTo(getContrastRatio('#808080', '#ffffff'), 1)
    expect(contrast('rgba(0, 0, 0, 0.5)', '#ffffff')).toBeLessThan(getContrastRatio('#000000', '#ffffff'))
  })
})

describe('the ink for words on a fill', () => {
  it('keeps the page’s own ink where it reads', () => {
    expect(inkOn(light, '#ffffff')).toBe(light.palette.text.primary)
    expect(inkOn(dark, '#121212')).toBe(dark.palette.text.primary)
  })

  it('falls back to whichever of black and white reads, and that one always clears 4.5:1', () => {
    for (const fill of ['#6369a9', '#8e96f2', '#777777', '#e53935', '#1e88e5', '#43a047', '#ffeb3b']) {
      const ink = inkOn(light, fill, 'rgba(0, 0, 0, 0.87)')
      expect(contrast(ink, fill), fill).toBeGreaterThanOrEqual(TEXT_CONTRAST)
    }
    expect(inkOn(dark, '#8e96f2', '#e4e7ee')).toBe(dark.palette.common.black)
    expect(inkOn(light, '#303f9f', 'rgba(0, 0, 0, 0.87)')).toBe(light.palette.common.white)
  })
})

describe('a picked colour stepped until it reads', () => {
  it('returns a colour that already reads as it is', () => {
    expect(legibleOn('#1f2733', '#f4f5f7')).toBe('rgb(31, 39, 51)')
  })

  it('darkens on a light ground and lightens on a dark one, until 4.5:1', () => {
    const onLight = legibleOn('#888888', '#f4f5f7')
    const onDark = legibleOn('#1f2733', '#15171b')
    expect(getContrastRatio(onLight, '#f4f5f7')).toBeGreaterThanOrEqual(TEXT_CONTRAST)
    expect(getContrastRatio(onDark, '#15171b')).toBeGreaterThanOrEqual(TEXT_CONTRAST)
    expect(getContrastRatio(onLight, '#000000')).toBeLessThan(getContrastRatio('#888888', '#000000'))
    expect(getContrastRatio(onDark, '#ffffff')).toBeLessThan(getContrastRatio('#1f2733', '#ffffff'))
  })

  it('reads even for the ground’s own colour, by going all the way', () => {
    expect(getContrastRatio(legibleOn('#f4f5f7', '#f4f5f7'), '#f4f5f7')).toBeGreaterThanOrEqual(TEXT_CONTRAST)
    expect(getContrastRatio(legibleOn('#15171b', '#15171b'), '#15171b')).toBeGreaterThanOrEqual(TEXT_CONTRAST)
  })

  it('counts a translucent pick as it looks over the ground', () => {
    expect(getContrastRatio(legibleOn('#00000022', '#ffffff'), '#ffffff')).toBeGreaterThanOrEqual(TEXT_CONTRAST)
  })
})

describe('the red of a destructive menu item', () => {
  it('is a step further from the ground than error.main in each mode', () => {
    expect(getContrastRatio(dangerInk(light), '#ffffff')).toBeGreaterThan(getContrastRatio(light.palette.error.main, '#ffffff'))
    expect(dangerInk(dark)).toBe(dark.palette.error.light)
  })
})

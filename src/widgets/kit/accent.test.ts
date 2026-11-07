// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { deriveAccent } from './accent'
import { contrastRatio, hexToOklch, hueDistance, oklchToHex } from './oklch'
import { coloursOf, DARK, LIGHT } from './tokens'
import type { AccentShades, ColourToken, Mode } from './tokens'

const shadesOf = (input: string): AccentShades => {
  const answer = deriveAccent(input)
  if (!answer.ok) throw new Error(`${input} was refused: ${answer.why}`)
  return answer.shades
}

/** Hues all round the circle that are clear of a status: a magenta, a teal, a violet, a lime and the petrol. */
const ACCEPTED = ['#a0186b', '#00796b', '#6a2fb0', '#5f7a00', '#015d74', '#0a8']

describe('oklch', () => {
  it('comes back to the colour it left', () => {
    for (const hex of ['#015d74', '#a52520', '#6fcee4', '#171f28', '#fefdfb']) {
      expect(oklchToHex(hexToOklch(hex)!)).toBe(hex)
    }
  })

  it('agrees with the values the tokens were picked at', () => {
    const accent = hexToOklch(LIGHT.accent)!
    expect(accent.l).toBeCloseTo(0.445, 2)
    expect(accent.c).toBeCloseTo(0.082, 2)
    expect(hueDistance(accent.h, 222)).toBeLessThan(1)
  })

  it('gives way on chroma when sRGB cannot show a colour, and keeps the hue', () => {
    const hex = oklchToHex({ l: 0.9, c: 0.4, h: 222 })
    expect(hueDistance(hexToOklch(hex)!.h, 222)).toBeLessThan(3)
  })
})

describe('deriveAccent', () => {
  it('refuses what is not a colour', () => {
    for (const input of ['', 'petrol', '#12', '#12345', 'rgb(1,2,3)', '#gggggg']) {
      expect(deriveAccent(input)).toEqual({ ok: false, why: 'not-a-colour' })
    }
  })

  it('refuses a colour with no hue to speak of', () => {
    for (const input of ['#000000', '#ffffff', '#808080', '#7f8185']) {
      expect(deriveAccent(input)).toEqual({ ok: false, why: 'no-hue' })
    }
  })

  it('refuses each status’s own colour, in both modes, and says which', () => {
    for (const table of [LIGHT, DARK]) {
      for (const status of ['ok', 'warn', 'bad', 'info'] as const) {
        expect(deriveAccent(table[status])).toEqual({ ok: false, why: 'status-hue', status })
      }
    }
  })

  it('refuses a hue near a status and takes one clear of it', () => {
    const bad = hexToOklch(LIGHT.bad)!
    const near = oklchToHex({ l: 0.5, c: 0.15, h: bad.h + 10 })
    const clear = oklchToHex({ l: 0.5, c: 0.15, h: bad.h - 45 })
    expect(deriveAccent(near)).toMatchObject({ ok: false, why: 'status-hue', status: 'bad' })
    expect(deriveAccent(clear)).toMatchObject({ ok: true })
  })

  it('keeps the hue it was given in every shade', () => {
    for (const input of ACCEPTED) {
      const hue = hexToOklch(input)!.h
      const shades = shadesOf(input)
      for (const mode of ['light', 'dark'] as const) {
        expect(hueDistance(hexToOklch(shades[mode].accent!)!.h, hue), `${input} ${mode}`).toBeLessThan(6)
      }
    }
  })

  it('draws the accent at 4.5:1 or more as words on every ground and under its own ink, in both modes', () => {
    for (const input of ['#ffd400', '#ff5ec4', '#00ffd0', '#2a0a5e', ...ACCEPTED]) {
      if (!deriveAccent(input).ok) continue
      const shades = shadesOf(input)
      for (const mode of ['light', 'dark'] as Mode[]) {
        const colours = coloursOf(mode, shades)
        const grounds: ColourToken[] = ['ground', 'surface', 'surface-2', 'surface-raised', 'canvas-ground', 'card-surface']
        for (const ground of grounds) {
          expect(contrastRatio(colours.accent, colours[ground]), `${input} ${mode} on ${ground}`).toBeGreaterThanOrEqual(4.5)
        }
        expect(contrastRatio(colours.accent, colours['on-accent']), `${input} ${mode}`).toBeGreaterThanOrEqual(4.5)
        for (const soft of ['accent-soft', 'selected-soft', 'crosshair', 'editing-bar', 'raci-r'] as const) {
          expect(contrastRatio(colours.ink, colours[soft]), `${input} ${mode} ink on ${soft}`).toBeGreaterThanOrEqual(4.5)
        }
      }
    }
  })

  it('carries through what names the accent, and leaves everything else alone', () => {
    const shades = shadesOf('#a0186b')
    const colours = coloursOf('light', shades)
    expect(colours['line-reports-to']).toBe(colours.accent)
    expect(colours['link-outline']).toBe(colours['focus-ring'])
    for (const token of ['ground', 'ink', 'ok', 'warn', 'bad', 'info', 'line'] as const) {
      expect(colours[token]).toBe(coloursOf('light')[token])
    }
    expect(Object.keys(shades.light).sort()).toEqual(Object.keys(shades.dark).sort())
  })

  it('leaves core’s own builds on the petrol: no shades, no change', () => {
    expect(coloursOf('light').accent).toBe('#015d74')
    expect(coloursOf('dark').accent).toBe('#6fcee4')
  })
})

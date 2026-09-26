// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The contrast of the palette's own pairs, measured (WCAG 2.1, 1.4.3).
 *
 * axe cannot do this in jsdom, which paints nothing (`testing/axe.ts`), so the
 * pairs the screens are built from are measured here instead, in both modes:
 * the inks on the two grounds, the accent a link and a selected tab are drawn
 * in, the text on a contained button, a card's name and its second line, and
 * the badges a card carries.
 *
 * What falls below 4.5:1 is listed, not hidden: {@link KNOWN_BELOW} is the
 * set the accessibility statement names as not yet conforming, and the test
 * holds the measurement to exactly that set. A pair fixed leaves the list,
 * which fails here until the list — and the statement — say so; a pair that
 * slips below fails the other way.
 */
import { describe, expect, it } from 'vitest'
import { decomposeColor } from '@mui/material/styles'
import { shellTheme } from './theme'
import { getNodeTokens } from '../editor/theme/tokens'

type Rgb = { r: number; g: number; b: number }

function parse(colour: string): Rgb & { a: number } {
  if (colour === 'transparent') return { r: 0, g: 0, b: 0, a: 0 }
  const { values } = decomposeColor(colour)
  const [r, g, b, a] = values as number[]
  return { r, g, b, a: a ?? 1 }
}

/** A colour as drawn over an opaque ground: what the eye gets from an alpha. */
function over(colour: string, ground: Rgb): Rgb {
  const c = parse(colour)
  const mix = (top: number, bottom: number) => top * c.a + bottom * (1 - c.a)
  return { r: mix(c.r, ground.r), g: mix(c.g, ground.g), b: mix(c.b, ground.b) }
}

function luminance({ r, g, b }: Rgb): number {
  const [lr, lg, lb] = [r, g, b].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
}

/** The WCAG ratio of `ink` over `fill`, both laid over `ground` first. */
function ratio(ink: string, fill: string, ground: string): number {
  const base = over(ground, { r: 0, g: 0, b: 0 })
  const behind = over(fill, base)
  const a = luminance(over(ink, behind))
  const b = luminance(behind)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/** Every pair the screens are drawn with, by a name the statement can quote. */
function pairs(mode: 'light' | 'dark'): [string, number][] {
  const theme = shellTheme(mode)
  const { text, background, primary } = theme.palette
  const tokens = getNodeTokens(theme)
  const paper = background.paper
  const out: [string, number][] = []
  for (const [ground, fill] of [['ground', background.default], ['paper', paper]] as const) {
    out.push([`${mode} text on ${ground}`, ratio(text.primary, fill, paper)])
    out.push([`${mode} secondary text on ${ground}`, ratio(text.secondary, fill, paper)])
    out.push([`${mode} accent on ${ground}`, ratio(primary.main, fill, paper)])
    out.push([`${mode} error text on ${ground}`, ratio(theme.palette.error.main, fill, paper)])
  }
  out.push([`${mode} button text on accent`, ratio(primary.contrastText, primary.main, paper)])
  out.push([`${mode} card name`, ratio(tokens.card.title, tokens.card.bg, paper)])
  out.push([`${mode} card second line`, ratio(tokens.card.subtitle, tokens.card.bg, paper)])
  for (const [state, token] of Object.entries(tokens.aspects)) {
    out.push([`${mode} aspect badge ${state}`, ratio(token.fg, token.bg, paper)])
  }
  for (const [state, token] of Object.entries(tokens.lifecycle)) {
    out.push([`${mode} lifecycle badge ${state}`, ratio(token.fg, token.bg, paper)])
  }
  return out
}

/**
 * Below 4.5:1 today, and said so in the statement: badge states on a card,
 * each also said in words (the badge's accessible name, and the record in the
 * inspector), and the error red on paper in the dark mode.
 */
const KNOWN_BELOW = [
  'light aspect badge partial',
  'light aspect badge none',
  'light lifecycle badge retiring',
  'light lifecycle badge retired',
  'dark error text on paper',
  'dark aspect badge atRisk',
  'dark lifecycle badge retired',
]

describe('the palette’s contrast', () => {
  it('holds the inks, the accent, a button and a card’s text at 4.5:1 or more, in both modes', () => {
    const all = [...pairs('light'), ...pairs('dark')]
    const text = all.filter(([name]) => !name.includes('badge') && !name.includes('error'))
    expect(text.filter(([, value]) => value < 4.5)).toEqual([])
  })

  it('has exactly the badge states the statement names below 4.5:1', () => {
    const below = [...pairs('light'), ...pairs('dark')]
      .filter(([, value]) => value < 4.5)
      .map(([name]) => name)
    expect(below).toEqual(KNOWN_BELOW)
  })
})

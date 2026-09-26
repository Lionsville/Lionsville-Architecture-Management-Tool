// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The contrast of every pair the screens are drawn with, measured (WCAG 2.1,
 * 1.4.3 and 1.4.11).
 *
 * axe cannot do this in jsdom, which paints nothing (`testing/axe.ts`), so the
 * pairs are measured here instead, in both modes, from the theme production
 * runs on: text on the ground it is drawn on at 4.5:1, and what identifies a
 * control or a line — a focus ring, a field's outline, a line on the board —
 * at 3:1 against what is beside it.
 *
 * A pair is a stack of layers, bottom first, because most of what the board
 * draws is translucent: a badge's tint over a card over a zone's tint over the
 * ground. The ink is laid over the whole stack, as the eye gets it.
 *
 * The list is the theme's and the board's tokens, not a sample: a token that
 * carries text and is missing here is a token nobody measured, which is how six
 * badge states and a red came to be below the line. `text.disabled` is not in it
 * on purpose — it is for a control that is off, which 1.4.3 exempts — and the
 * last test holds the source to that.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { decomposeColor, darken, lighten } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { fieldOutline, shellTheme } from './theme'
import { getNodeTokens } from '../editor/theme/tokens'
import type { AspectToken } from '../editor/theme/tokens'

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

/** The WCAG ratio of `ink` over a stack of layers, the first one the bottom. */
function ratio(ink: string, ...layers: string[]): number {
  const behind = layers.reduce((ground, layer) => over(layer, ground), { r: 0, g: 0, b: 0 })
  const a = luminance(over(ink, behind))
  const b = luminance(behind)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

type Pair = { name: string; value: number }

const STATUS = ['primary', 'secondary', 'error', 'warning', 'info', 'success'] as const
/** What an alert can be; its colour is one of these four and nothing else. */
const SEVERITY = ['error', 'warning', 'info', 'success'] as const

/**
 * Text, by a name the statement can quote. Everything the shell draws in a
 * palette colour, on each ground it is drawn on; every contained button and
 * every alert MUI paints, computed the way MUI computes it; and every token
 * the board draws words in, over the layers it sits on.
 */
function textPairs(mode: 'light' | 'dark'): Pair[] {
  const theme = shellTheme(mode)
  const { palette } = theme
  const out: Pair[] = []
  const add = (name: string, value: number) => out.push({ name: `${mode} ${name}`, value })
  const grounds = [['ground', palette.background.default], ['paper', palette.background.paper]] as const

  for (const [ground, fill] of grounds) {
    add(`text on ${ground}`, ratio(palette.text.primary, fill))
    add(`secondary text on ${ground}`, ratio(palette.text.secondary, fill))
    for (const colour of STATUS) add(`${colour} text on ${ground}`, ratio(palette[colour].main, fill))
  }
  for (const colour of STATUS) {
    const tone = palette[colour]
    add(`contained ${colour} button`, ratio(tone.contrastText, tone.main))
  }
  for (const colour of SEVERITY) {
    const tone = palette[colour]
    add(`filled ${colour} alert`, ratio(palette.getContrastText(tone.main), mode === 'dark' ? tone.dark : tone.main))
    add(`standard ${colour} alert`, ratio(...standardAlert(theme, colour), palette.background.paper))
  }
  out.push(...boardText(theme))
  return out
}

/** MUI's standard alert, as `Alert.js` derives it from the colour's light step. */
function standardAlert(theme: Theme, colour: (typeof SEVERITY)[number]): [string, string] {
  const light = theme.palette[colour].light
  return theme.palette.mode === 'light'
    ? [darken(light, 0.6), lighten(light, 0.9)]
    : [lighten(light, 0.6), darken(light, 0.9)]
}

function boardText(theme: Theme): Pair[] {
  const mode = theme.palette.mode
  const tokens = getNodeTokens(theme)
  const ground = theme.palette.background.default
  const out: Pair[] = []
  const add = (name: string, ink: string, ...layers: string[]) =>
    out.push({ name: `${mode} ${name}`, value: ratio(ink, ground, ...layers) })

  // Every zone a card may stand in, the landscape's own being no tint at all.
  for (const [zone, fill] of Object.entries(tokens.zone.fill)) {
    add(`zone label ${zone}`, tokens.zone.label, fill)
    add(`domain group label in ${zone}`, tokens.domainGroup.label, fill, tokens.domainGroup.fill)
    add(`card name in ${zone}`, tokens.card.title, fill, tokens.card.bg, tokens.card.headerBg)
    add(`card second line in ${zone}`, tokens.card.subtitle, fill, tokens.card.bg, tokens.card.headerBg)
    add(`card description in ${zone}`, tokens.card.description, fill, tokens.card.bg)
    for (const [kind, surface] of Object.entries(surfaces(theme))) {
      add(`${kind} name in ${zone}`, surface.fg, fill, surface.bg)
      add(`${kind} second line in ${zone}`, tokens.card.subtitle, fill, surface.bg)
    }
    add(`line label in ${zone}`, tokens.edge.labelFg, fill, tokens.edge.labelBg)
  }
  const badges: [string, Record<string, AspectToken>][] = [['aspect', tokens.aspects], ['lifecycle', tokens.lifecycle]]
  for (const [family, states] of badges) {
    for (const [state, token] of Object.entries(states)) {
      add(`${family} badge ${state}`, token.fg, tokens.card.bg, token.bg)
    }
  }
  return out
}

function surfaces(theme: Theme) {
  const tokens = getNodeTokens(theme)
  return {
    actor: tokens.actor,
    'external system': tokens.externalSystem,
    'input channel': tokens.inputChannel,
    'management tool': tokens.managementTool,
    component: tokens.component,
    boundary: tokens.boundary,
  }
}

/**
 * What is not text but has to be seen (1.4.11): the focus ring MUI draws on
 * every control, the ring a card draws, a text field's outline, and a line on
 * the board — each against every ground it sits on.
 */
function nonTextPairs(mode: 'light' | 'dark'): Pair[] {
  const theme = shellTheme(mode)
  const { palette } = theme
  const tokens = getNodeTokens(theme)
  const out: Pair[] = []
  const add = (name: string, value: number) => out.push({ name: `${mode} ${name}`, value })
  const ring = theme.focusVisible ? String(theme.focusVisible.outlineColor) : 'transparent'
  for (const [ground, fill] of [['ground', palette.background.default], ['paper', palette.background.paper]] as const) {
    add(`focus ring on ${ground}`, ratio(ring, fill))
    add(`field outline on ${ground}`, ratio(fieldOutline(theme), fill))
    add(`focused field outline on ${ground}`, ratio(palette.primary.main, fill))
  }
  for (const [zone, fill] of Object.entries(tokens.zone.fill)) {
    const board = palette.background.default
    add(`card focus ring in ${zone}`, ratio(tokens.card.focusRing, board, fill))
    add(`card selection ring in ${zone}`, ratio(tokens.card.selectedRing, board, fill))
    add(`line in ${zone}`, ratio(tokens.edge.stroke, board, fill))
    add(`selected line in ${zone}`, ratio(tokens.edge.strokeSelected, board, fill))
  }
  return out
}

const below = (pairs: Pair[], floor: number) =>
  pairs.filter(({ value }) => value < floor).map(({ name, value }) => `${name}: ${value.toFixed(2)}`)

describe('the palette’s contrast', () => {
  it('draws every text at 4.5:1 or more on its ground, in both modes', () => {
    expect(below([...textPairs('light'), ...textPairs('dark')], 4.5)).toEqual([])
  })

  it('draws every focus ring, field outline and line at 3:1 or more beside it, in both modes', () => {
    expect(below([...nonTextPairs('light'), ...nonTextPairs('dark')], 3)).toEqual([])
  })

  it('measures the six badge states the audit found below 4.5:1, and they are not', () => {
    const measured = new Map([...textPairs('light'), ...textPairs('dark')].map(({ name, value }) => [name, value]))
    for (const name of [
      'light aspect badge partial', 'light aspect badge none', 'light lifecycle badge retiring',
      'light lifecycle badge retired', 'dark aspect badge atRisk', 'dark lifecycle badge retired',
      'dark error text on paper',
    ]) {
      expect(measured.get(name), name).toBeGreaterThanOrEqual(4.5)
    }
  })
})

/**
 * `text.disabled` is a control that is off: 1.4.3 exempts it, and it measures
 * well under 4.5:1 on purpose. Words that mean something — an empty list's
 * sentence, a name nobody defined, a shortcut in a menu — are drawn in
 * `text.secondary`. The files below use it for what the exemption covers and
 * nothing else; a new use fails here until it is one of those, or is changed.
 */
const DISABLED_INK: Record<string, [uses: number, what: string]> = {
  // The breadcrumb's separator glyph, hidden from the tree: a divider, not a word.
  'src/app/ShellToolbar.tsx': [1, 'separator'],
  // The same separator between a container diagram and its application.
  'src/editor/EditorToolbar.tsx': [1, 'separator'],
  // The chevron on a palette row, whose name says what it is, and the comment
  // above the palette that says why its words are not in this ink.
  'src/editor/canvas/ElementPalette.tsx': [2, 'chevron, comment'],
  // A retired element's bar on the roadmap, whose name and dates are words.
  'src/roadmap/ui/RoadmapPage.tsx': [1, 'retired bar'],
  // The edge of a platform card, beside a name that says it is one.
  'src/technology/ui/TechnologyLandscapePage.tsx': [1, 'platform edge'],
  // A logo tile's border when it is not the one picked; the logo is the tile.
  'src/editor/nodes/LogoGrid.tsx': [1, 'unpicked border'],
  // What the none band of an overlay is tinted with, under a card that names it.
  'src/editor/theme/overlayColors.ts': [1, 'none band tint'],
}

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

describe('the ink for a control that is off', () => {
  it('draws no word in `text.disabled` outside the uses the exemption covers', () => {
    const root = join(__dirname, '..', '..')
    const uses = Object.fromEntries(sources(join(root, 'src'))
      .map((path) => [relative(root, path), readFileSync(path, 'utf8').match(/text\.disabled/g)?.length ?? 0] as const)
      .filter(([, count]) => count > 0))
    const allowed = Object.fromEntries(Object.entries(DISABLED_INK).map(([path, [count]]) => [path, count]))
    expect(uses).toEqual(allowed)
  })
})

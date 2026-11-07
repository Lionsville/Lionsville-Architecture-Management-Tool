// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * An accent somebody chose, as the shades the two modes draw it in (ADR-0045).
 *
 * What is chosen is a hue and roughly how strong; lightness is not anybody's to
 * choose, because lightness is what makes a button's label and a selected row
 * readable. So each mode fixes the lightness of every shade to what the petrol
 * uses, in OKLCH where equal lightness reads as an equal step, and then walks
 * the main shade away from its grounds until it measures what it must.
 *
 * Two colours are refused rather than bent. One close to a status hue, because a
 * selected row must never read as a warning, a success or an error; and one with
 * no hue to speak of, which would be an accent nobody could see beside the inks.
 * Refused, the caller keeps the default and says why.
 */
import { contrastRatio, hexToOklch, hueDistance, oklchToHex } from './oklch'
import { DARK, LIGHT } from './tokens'
import type { AccentShades, ColourToken, Mode } from './tokens'

/** A status colour's name, as a refusal says which one was too close. */
export type StatusHue = 'ok' | 'warn' | 'bad' | 'info'

export type AccentAnswer =
  | { ok: true; shades: AccentShades }
  | { ok: false; why: 'not-a-colour' }
  | { ok: false; why: 'no-hue' }
  | { ok: false; why: 'status-hue'; status: StatusHue }

/** Below this chroma a colour reads as grey beside the blue-black inks. */
const LEAST_CHROMA = 0.03
/** How close to a status's hue, in either mode, is too close. */
const STATUS_MARGIN = 15
/** Words on and in the accent. */
const TEXT = 4.5

const STATUS: readonly StatusHue[] = ['ok', 'warn', 'bad', 'info']

/** The status a hue is too close to, read off the tokens so a new status hue moves the line with it. */
function statusNear(hue: number): StatusHue | undefined {
  return STATUS.find((status) => [LIGHT, DARK].some((table) => {
    const own = hexToOklch(table[status])
    return own !== undefined && hueDistance(hue, own.h) <= STATUS_MARGIN
  }))
}

/** The shades each mode fixes, at the lightness and chroma the petrol has them. */
const SOFT: Record<Mode, Partial<Record<ColourToken, [l: number, c: number]>>> = {
  light: {
    'accent-soft': [0.93, 0.028], 'selected-soft': [0.925, 0.032], crosshair: [0.955, 0.016],
    'editing-bar': [0.93, 0.028], 'raci-r': [0.88, 0.035],
  },
  dark: {
    'accent-soft': [0.335, 0.05], 'selected-soft': [0.345, 0.05], crosshair: [0.285, 0.032],
    'editing-bar': [0.335, 0.05], 'raci-r': [0.37, 0.05],
  },
}

/** Where the main shade starts, its strongest chroma, and which way it walks to read better. */
const MAIN: Record<Mode, { l: number; c: number; step: number }> = {
  light: { l: 0.445, c: 0.12, step: -0.01 },
  dark: { l: 0.8, c: 0.11, step: 0.01 },
}

/** The grounds an accent is drawn on as words, and the ink a filled control letters it with. */
const GROUNDS: readonly ColourToken[] = ['ground', 'surface', 'surface-2', 'surface-raised', 'canvas-ground', 'card-surface']

function mainShade(mode: Mode, hue: number, chroma: number): string {
  const table = mode === 'light' ? LIGHT : DARK
  const { l: start, c, step } = MAIN[mode]
  const reads = (hex: string) =>
    contrastRatio(hex, table['on-accent']) >= TEXT && GROUNDS.every((ground) => contrastRatio(hex, table[ground]) >= TEXT)
  for (let l = start; l > 0.1 && l < 0.98; l += step) {
    const hex = oklchToHex({ l, c: Math.min(chroma, c), h: hue })
    if (reads(hex)) return hex
  }
  // Ink and paper are themselves on the far side of every ground, so the walk ends before this does.
  return table.ink
}

function shadesFor(mode: Mode, hue: number, chroma: number): Partial<Record<ColourToken, string>> {
  const main = mainShade(mode, hue, chroma)
  const soft = Object.entries(SOFT[mode]).map(([token, [l, c]]) => [token, oklchToHex({ l, c, h: hue })])
  return {
    accent: main, 'selected-edge': main, 'focus-ring': main, 'progress-fill': main,
    ...Object.fromEntries(soft),
  }
}

/** The shades of `input`, a `#rgb` or `#rrggbb`, or why it cannot be an accent. Pure. */
export function deriveAccent(input: string): AccentAnswer {
  const chosen = hexToOklch(input)
  if (!chosen) return { ok: false, why: 'not-a-colour' }
  if (chosen.c < LEAST_CHROMA) return { ok: false, why: 'no-hue' }
  const status = statusNear(chosen.h)
  if (status) return { ok: false, why: 'status-hue', status }
  return { ok: true, shades: { light: shadesFor('light', chosen.h, chosen.c), dark: shadesFor('dark', chosen.h, chosen.c) } }
}

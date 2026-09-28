// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The ink a word is drawn in when its ground is not one the palette names: a
 * circle mixed from the accent, a label in a colour somebody picked, a menu
 * row under the pointer.
 *
 * The palette's own pairs are measured once, in `app/theme.contrast.test.ts`.
 * These are the grounds that are worked out while drawing, so the ink has to
 * be worked out against them there too — measured with the same WCAG
 * arithmetic, against the colour that is actually painted, rather than chosen
 * once for a ground that is only sometimes there.
 */
import { darken, decomposeColor, getContrastRatio, getLuminance as luminance, lighten, recomposeColor } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'

/** What text must reach against its ground (WCAG 2.1, 1.4.3). */
export const TEXT_CONTRAST = 4.5

/**
 * `colour` laid over an opaque `ground`, as the eye gets it: an alpha is a
 * mix, and a ratio read off the colour with its alpha ignored is a ratio of
 * something nobody sees.
 */
export function flatten(colour: string, ground: string): string {
  const top = decomposeColor(colour).values
  const bottom = decomposeColor(ground).values
  const a = top[3] ?? 1
  const channel = (i: number) => Math.round(top[i] * a + bottom[i] * (1 - a))
  return recomposeColor({ type: 'rgb', values: [channel(0), channel(1), channel(2)] })
}

/**
 * `share` of `colour` over `ground`, the rest `ground` — what CSS's
 * `color-mix(in srgb, …)` draws, worked out here so the ink beside it can be
 * measured against the same colour.
 */
export function mix(colour: string, share: number, ground: string): string {
  const top = decomposeColor(colour).values
  const bottom = decomposeColor(ground).values
  const channel = (i: number) => Math.round(top[i] * share + bottom[i] * (1 - share))
  return recomposeColor({ type: 'rgb', values: [channel(0), channel(1), channel(2)] })
}

/** The WCAG ratio of `ink`, translucent or not, over an opaque `ground`. */
export function contrast(ink: string, ground: string): number {
  return getContrastRatio(flatten(ink, ground), ground)
}

/**
 * The ink for words on `fill`: `preferred` — the page's own ink — where it
 * reaches 4.5:1, and otherwise whichever of black and white reaches further.
 * One of the two always clears 4.5:1 on any opaque colour, which is why the
 * fallback is those two rather than MUI's 87 % black, which does not.
 */
export function inkOn(theme: Theme, fill: string, preferred = theme.palette.text.primary): string {
  if (contrast(preferred, fill) >= TEXT_CONTRAST) return preferred
  const { black, white } = theme.palette.common
  return contrast(black, fill) >= contrast(white, fill) ? black : white
}

/**
 * `colour`, stepped away from `ground` until words in it read there: darker on
 * a light ground, lighter on a dark one, in small steps so the hue somebody
 * picked is still the hue on the screen. A colour that already reads is
 * returned as it is.
 */
export function legibleOn(colour: string, ground: string): string {
  const opaque = flatten(colour, ground)
  // Above 0.18 black is the further of the two from the ground, below it white.
  const away = luminance(ground) > 0.18 ? darken : lighten
  for (let step = 0; step < 20; step += 1) {
    const candidate = away(opaque, step / 20)
    if (getContrastRatio(candidate, ground) >= TEXT_CONTRAST) return candidate
  }
  return away(opaque, 1)
}

/**
 * The red a destructive menu item is lettered in. `error.main` is measured as
 * text on paper, but a menu row is paper with the hover or focus tint over it,
 * and on those it fell to 3.2:1 in the dark mode and 3.8:1 in the light. A
 * step further from the ground in each mode clears 4.5:1 on every state a row
 * has, and is still the red.
 */
export function dangerInk(theme: Theme): string {
  const { palette } = theme
  return palette.mode === 'dark' ? palette.error.light : darken(palette.error.main, 0.2)
}

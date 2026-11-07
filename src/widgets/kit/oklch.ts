// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * OKLCH and sRGB, both ways, and the WCAG ratio.
 *
 * A colour is derived here rather than with `lighten` and `darken`, because
 * lightness in OKLCH is what the eye sees: two shades at one L read as one
 * step whatever their hue, which HSL does not manage. Pure arithmetic after
 * Björn Ottosson's published matrices; no dependency, no document.
 */
export type Oklch = { l: number; c: number; h: number }

type Rgb = [number, number, number]

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const toGamma = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055)

/** `#rgb` or `#rrggbb` as three channels from 0 to 1, or nothing for anything else. */
export function parseHex(input: string): Rgb | undefined {
  const text = input.trim().toLowerCase()
  const long = /^#[0-9a-f]{6}$/.test(text) ? text : /^#[0-9a-f]{3}$/.test(text) ? `#${[...text.slice(1)].map((d) => d + d).join('')}` : undefined
  if (!long) return undefined
  return [1, 3, 5].map((at) => Number.parseInt(long.slice(at, at + 2), 16) / 255) as Rgb
}

export function hexToOklch(hex: string): Oklch | undefined {
  const rgb = parseHex(hex)
  if (!rgb) return undefined
  const [r, g, b] = rgb.map(toLinear) as Rgb
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const hue = (Math.atan2(B, A) * 180) / Math.PI
  return { l: L, c: Math.hypot(A, B), h: hue < 0 ? hue + 360 : hue }
}

function linearChannels({ l: L, c, h }: Oklch): Rgb {
  const A = c * Math.cos((h * Math.PI) / 180)
  const B = c * Math.sin((h * Math.PI) / 180)
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

const inGamut = (rgb: Rgb) => rgb.every((v) => v >= -0.0001 && v <= 1.0001)

/**
 * The colour as `#rrggbb`. Where sRGB cannot show it, chroma gives way and
 * lightness and hue stay, since those two are what the shade was chosen for.
 */
export function oklchToHex(colour: Oklch): string {
  let c = colour.c
  let rgb = linearChannels(colour)
  while (!inGamut(rgb) && c > 0) {
    c = Math.max(0, c - 0.002)
    rgb = linearChannels({ ...colour, c })
  }
  const byte = (v: number) => Math.round(Math.min(1, Math.max(0, toGamma(Math.max(0, v)))) * 255).toString(16).padStart(2, '0')
  return `#${rgb.map(byte).join('')}`
}

function luminance(hex: string): number {
  const [r, g, b] = (parseHex(hex) ?? [0, 0, 0]).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as Rgb
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** The WCAG ratio of two opaque `#rrggbb` colours. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

/** How far apart two hues are on the circle, in degrees. */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

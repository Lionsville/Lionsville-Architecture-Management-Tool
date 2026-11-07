// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * How large this person reads: a step on the root's font size, which every size
 * and every measure that holds text is written against (`widgets/kit/tokens.ts`).
 *
 * A percentage and not a number of pixels, so it stands on top of what the
 * browser was set to rather than over it. A canvas's type is in px and takes no
 * part: a card is made larger by zooming the canvas.
 */
export const TEXT_SIZES = [90, 100, 112, 125, 150] as const
export type TextSize = (typeof TEXT_SIZES)[number]
export const DEFAULT_TEXT_SIZE: TextSize = 100
export type TextSizeMove = 'smaller' | 'larger' | 'default'

/** The step in a stored blob; what is not one of the steps is the default. */
export function readTextSize(stored: unknown): TextSize {
  const held = stored && typeof stored === 'object' ? (stored as { textSize?: unknown }).textSize : undefined
  return TEXT_SIZES.find((size) => size === held) ?? DEFAULT_TEXT_SIZE
}

/** The step a move lands on. At an end it stays where it is. */
export function movedTextSize(from: TextSize, how: TextSizeMove): TextSize {
  if (how === 'default') return DEFAULT_TEXT_SIZE
  const at = TEXT_SIZES.indexOf(from) + (how === 'larger' ? 1 : -1)
  return TEXT_SIZES[Math.min(Math.max(at, 0), TEXT_SIZES.length - 1)] ?? from
}

/** On the root, so that everything drawn outside the app's own tree, a menu or a dialog in its portal, has it too. */
export function applyTextSize(size: TextSize): void {
  const root = globalThis.document?.documentElement
  if (!root) return
  root.style.fontSize = size === DEFAULT_TEXT_SIZE ? '' : `${size}%`
  root.dataset.textSize = String(size)
}

/** How many times the browser's own rem this step is: for the few widths a script has to work out. */
export function textScale(): number {
  const root = globalThis.document?.documentElement
  const raw = root ? Number(root.dataset.textSize) : Number.NaN
  return Number.isFinite(raw) && raw > 0 ? raw / 100 : 1
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * How large this person reads: a step on the root's font size, which every size
 * and every measure that holds text is written against (`widgets/kit/tokens.ts`).
 *
 * A percentage and not a number of pixels, so it stands on top of what the
 * browser was set to rather than over it. A canvas's type is in pixels, so its
 * words keep to the boxes its layout made; the step reaches a canvas as a scale
 * on the whole drawing (`widgets/kit/zoom.canvasZoomProps`), and zooming past
 * 100% makes it larger still.
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

type Root = { style: { fontSize: string }; dataset: Record<string, string | undefined> }
/** Read off the global: `electron/main` compiles this file too, for its types, with no page to hold a root. */
const rootElement = () => (globalThis as { document?: { documentElement: Root } }).document?.documentElement

/** On the root, so that everything drawn outside the app's own tree, a menu or a dialog in its portal, has it too. */
export function applyTextSize(size: TextSize): void {
  const root = rootElement()
  if (!root) return
  root.style.fontSize = size === DEFAULT_TEXT_SIZE ? '' : `${size}%`
  root.dataset.textSize = String(size)
}

/**
 * How many times larger than the default the root's text is set: 1.5 at 150%.
 * A width kept in pixels at the default text size is drawn this many times
 * wider, so it is a width in rem and what fits in it at 100% fits at every size.
 */
export function textScale(): number {
  const held = Number(rootElement()?.dataset.textSize)
  return TEXT_SIZES.some((size) => size === held) ? held / DEFAULT_TEXT_SIZE : 1
}

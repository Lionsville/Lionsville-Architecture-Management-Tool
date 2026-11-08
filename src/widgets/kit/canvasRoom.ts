// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The room a canvas's floating controls leave: what Fit and the opening view frame
 * in, on every canvas, so the dock and a legend never sit on what was just framed.
 *
 * Whatever floats over a canvas says so with {@link CANVAS_FLOAT}; the dock does it
 * itself. Each is measured where it is drawn, and takes the cheaper of two strips off
 * the pane: the one along the edge it sits on (top or bottom), or the one along its
 * side, so a tall key at the right takes a column and a wide dock a row.
 */
import { useLayoutEffect, useState } from 'react'
import type { RefObject } from 'react'
import { FIT_GAP, NO_INSETS } from './zoom'
import type { Insets } from './zoom'

/** The attribute that marks something floating over a canvas, which a fit leaves room for. */
export const CANVAS_FLOAT = 'data-canvas-float'

type Box = { left: number; top: number; right: number; bottom: number }

/** The insets a pane of this box keeps clear of these floating boxes, in the same pixels. */
export function insetsFor(pane: Box, floats: readonly Box[]): Insets {
  const width = pane.right - pane.left
  const height = pane.bottom - pane.top
  const insets = { ...NO_INSETS }
  if (!(width > 0) || !(height > 0)) return insets
  for (const float of floats) {
    const left = Math.max(pane.left, float.left)
    const right = Math.min(pane.right, float.right)
    const top = Math.max(pane.top, float.top)
    const bottom = Math.min(pane.bottom, float.bottom)
    // Not over the pane, or not drawn: it takes nothing.
    if (right <= left || bottom <= top) continue
    const low = top + bottom > pane.top + pane.bottom
    const end = left + right > pane.left + pane.right
    const row = (low ? pane.bottom - top : bottom - pane.top) + FIT_GAP
    const column = (end ? pane.right - left : right - pane.left) + FIT_GAP
    if (row / height <= column / width) {
      if (low) insets.bottom = Math.max(insets.bottom, row)
      else insets.top = Math.max(insets.top, row)
    } else if (end) insets.right = Math.max(insets.right, column)
    else insets.left = Math.max(insets.left, column)
  }
  return insets
}

/**
 * What floats over `pane` takes off it, read from the page as it is drawn now.
 * `within` is where the floating controls are, when they are not inside the pane
 * (a dock beside a scrolling picture, in the element both sit in).
 */
export function canvasInsets(pane: Element, within: ParentNode = pane): Insets {
  const floats = [...within.querySelectorAll(`[${CANVAS_FLOAT}]`)].map((one) => one.getBoundingClientRect())
  return insetsFor(pane.getBoundingClientRect(), floats)
}

const same = (a: Insets, b: Insets) => a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left

/**
 * The insets kept as state, for a canvas that draws with them (a scrolling picture
 * pads its end by them, so what lies under the dock scrolls clear of it). Measured
 * again whenever the pane or a floating control there at the start changes size.
 */
export function useCanvasInsets(pane: RefObject<Element | null>, within?: RefObject<ParentNode | null>): Insets {
  const [insets, setInsets] = useState<Insets>(NO_INSETS)
  useLayoutEffect(() => {
    const element = pane.current
    if (!element) return undefined
    const root = within?.current ?? element
    const measure = () => {
      const next = canvasInsets(element, root)
      setInsets((was) => (same(was, next) ? was : next))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    for (const float of root.querySelectorAll(`[${CANVAS_FLOAT}]`)) observer.observe(float)
    return () => observer.disconnect()
  }, [pane, within])
  return insets
}

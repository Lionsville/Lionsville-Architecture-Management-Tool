// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * How many of a row's controls must fold into its More for the rest to fit.
 *
 * Measured and not set at a breakpoint, because what a row needs depends on the
 * language and the text size as much as on the window. One more folds while the
 * row overflows; a row given more room than it had when the last one folded
 * takes that one back and looks again.
 *
 * The row is the parent of the element `anchor` is put on, a hidden one in the
 * row itself, so a row's owner need not hand its element down.
 */
import { useCallback, useLayoutEffect, useRef, useState } from 'react'

export function useRowFold(most: number, again: unknown) {
  const [folded, setFolded] = useState(0)
  const [row, setRow] = useState<HTMLElement | null>(null)
  const widths = useRef<number[]>([])
  // How many the row is drawn with, and how many were last asked for: apart from when a fold is on its way to the screen.
  const drawn = useRef(0)
  const asked = useRef(0)
  const anchor = useCallback((held: HTMLElement | null) => setRow(held?.parentElement ?? null), [])

  const look = useCallback(() => {
    // A fold asked for and not drawn yet: the row still stands as it did when it was measured, and
    // a second look at it folds a second control for the one overflow, which no width then takes back.
    // Something arriving in a row is seen twice, as a change in it and as a child resized; the draw looks again.
    if (!row || asked.current !== drawn.current) return
    const was = drawn.current
    const width = row.clientWidth
    const last = widths.current[was - 1]
    let next = was
    if ((row.scrollWidth > width || pastItsEnd(row)) && was < most) {
      widths.current[was] = width
      next = was + 1
    } else if (was > 0 && last !== undefined && width > last) next = was - 1
    if (next === was) return
    asked.current = next
    setFolded(next)
  }, [row, most])

  // A language or a text size changes what the row needs at the same width: everything back, and fold again.
  useLayoutEffect(() => { widths.current = []; asked.current = 0; setFolded(0) }, [again])
  // Measured when the row or what is folded changes, and when something in it does — never on every render:
  // the frame draws again often, and a measure each time made the browser lay the page out mid-render.
  useLayoutEffect(() => { drawn.current = folded; look() }, [look, folded, again])
  useLayoutEffect(() => {
    if (!row) return undefined
    const sized = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(look)
    sized?.observe(row)
    for (const child of Array.from(row.children)) sized?.observe(child)
    const changed = typeof MutationObserver === 'undefined' ? undefined : new MutationObserver(look)
    changed?.observe(row, { childList: true, subtree: true, characterData: true })
    return () => { sized?.disconnect(); changed?.disconnect() }
  }, [row, look, folded])

  return { folded, anchor }
}

/**
 * Whether the row's last control runs into its end padding or past it. A flex
 * row's scroll width leaves its end padding out, so a row short by less than
 * that padding never overflows by its own measure, and its last control (More)
 * sat cut against the window's edge with nothing folded.
 */
export function pastItsEnd(row: HTMLElement): boolean {
  const end = row.getBoundingClientRect().right - (Number.parseFloat(getComputedStyle(row).paddingRight) || 0)
  return rightmost(row) > end + 0.5
}

/** The right edge of what the row draws: a child with no box of its own (`display: contents`) is read through. */
function rightmost(parent: Element): number {
  let most = Number.NEGATIVE_INFINITY
  for (const child of Array.from(parent.children)) {
    const right = getComputedStyle(child).display === 'contents' ? rightmost(child) : child.getBoundingClientRect().right
    if (right > most) most = right
  }
  return most
}

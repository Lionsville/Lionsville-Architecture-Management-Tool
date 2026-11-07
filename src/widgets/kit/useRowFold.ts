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
  const anchor = useCallback((held: HTMLElement | null) => setRow(held?.parentElement ?? null), [])

  const look = useCallback(() => {
    if (!row) return
    setFolded((was) => {
      const width = row.clientWidth
      if (row.scrollWidth > width && was < most) {
        widths.current[was] = width
        return was + 1
      }
      const last = widths.current[was - 1]
      return was > 0 && last !== undefined && width > last ? was - 1 : was
    })
  }, [row, most])

  // A language or a text size changes what the row needs at the same width: everything back, and fold again.
  useLayoutEffect(() => { widths.current = []; setFolded(0) }, [again])
  useLayoutEffect(look)
  useLayoutEffect(() => {
    if (!row || typeof ResizeObserver === 'undefined') return
    const watching = new ResizeObserver(look)
    watching.observe(row)
    return () => watching.disconnect()
  }, [row, look])

  return { folded, anchor }
}

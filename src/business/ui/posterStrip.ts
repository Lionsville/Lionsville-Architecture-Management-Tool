// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Whether the strip under the poster is short of room: a small window, a large text
 * size. Then the key folds into a press and the design bar keeps its everyday presses
 * out, the rest under one menu, so the strip is one line and the canvas keeps the
 * height. At 1100x700 and 150% the dock, the key and a design bar on two lines took
 * some 230 of the 700px.
 */
import { createContext, useLayoutEffect, useState } from 'react'

/** What is short of room: the design bar first, and the key only on a smaller strip still. */
export type StripNarrow = { readonly bar: boolean; readonly key: boolean }
const ROOMY: StripNarrow = { bar: false, key: false }
export const PosterStripNarrow = createContext<StripNarrow>(ROOMY)

/** Narrower than these many root ems: the room a whole design bar beside the dock and key needs, and the key beside a short bar. */
const BAR_ROOM_EM = 76
const KEY_ROOM_EM = 64

export function useStripNarrow(strip: { current: HTMLElement | null }): StripNarrow {
  const [narrow, setNarrow] = useState<StripNarrow>(ROOMY)
  useLayoutEffect(() => {
    const held = strip.current
    if (!held || typeof ResizeObserver === 'undefined') return undefined
    const root = () => Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    const measure = () => {
      const width = held.clientWidth
      const bar = width > 0 && width < BAR_ROOM_EM * root()
      const key = width > 0 && width < KEY_ROOM_EM * root()
      setNarrow((was) => (was.bar === bar && was.key === key ? was : { bar, key }))
    }
    measure()
    const watch = new ResizeObserver(measure)
    watch.observe(held)
    return () => watch.disconnect()
  }, [strip])
  return narrow
}

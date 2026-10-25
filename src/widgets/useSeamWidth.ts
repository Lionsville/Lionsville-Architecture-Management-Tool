// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The width a person dragged a column to, remembered per seam (ADR-0044 §4):
 * every column beside another can be given more room (`SeamResizer`), and
 * comes back the width it was left at. A preference of the viewer's, not of
 * the work, so the shell keeps it with the other preferences and hands it
 * down here; with nothing handed down — a test, a page drawn alone — a width
 * lasts as long as the page.
 */
import { createContext, useCallback, useContext, useState } from 'react'

/** The widths kept, by seam: what the shell hands down. */
export type SeamWidths = {
  widthOf(seam: string): number | undefined
  keep(seam: string, width: number): void
}

const SeamWidthsContext = createContext<SeamWidths | undefined>(undefined)

export const SeamWidthsProvider = SeamWidthsContext.Provider

export function useSeamWidth(seam: string, fallback: number): [number, (next: number) => void] {
  const kept = useContext(SeamWidthsContext)
  const [width, setWidth] = useState(() => kept?.widthOf(seam) ?? fallback)
  const set = useCallback((next: number) => {
    setWidth(next)
    kept?.keep(seam, next)
  }, [kept, seam])
  return [width, set]
}

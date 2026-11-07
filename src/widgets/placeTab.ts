// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Which tab of a page is up, kept in the frame so it is in the address: a link
 * and an agent reach a tab, and a reload stays on it (`?tab=`, `PAGE_TABS` in
 * `agent/screen.ts`). A page with tabs asks here instead of holding a
 * `useState`. With no frame above it, as in a page's own test, it behaves as
 * that `useState` would.
 */
import { createContext, useCallback, useContext, useState } from 'react'

export type PlaceTabs = {
  readonly tab: string | undefined
  readonly choose: (tab: string) => void
}

export const PlaceTabContext = createContext<PlaceTabs | undefined>(undefined)

export function usePlaceTab(first: string): readonly [string, (tab: string) => void] {
  const held = useContext(PlaceTabContext)
  const [own, setOwn] = useState(first)
  const choose = useCallback((tab: string) => {
    setOwn(tab)
    held?.choose(tab)
  }, [held])
  return [held?.tab ?? own, choose]
}

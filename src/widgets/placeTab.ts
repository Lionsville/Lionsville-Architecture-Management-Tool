// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Which tab of a page is up and which record it is on, kept in the frame so they
 * are in the address: a link and an agent reach them, and a reload stays on them
 * (`?tab=`, `PAGE_TABS` in `agent/screen.ts`, a record as the path's last
 * segment). A page asks here instead of holding a `useState`. With no frame above
 * it, as in a page's own test, it behaves as that `useState` would.
 */
import { createContext, useCallback, useContext, useState } from 'react'

/** Somewhere to go, in the three words of an address: strings only, since a widget knows no page names. */
export type PlaceTo = { readonly scope: string; readonly page?: string; readonly id?: string; readonly select?: string }

export type PlaceTabs = {
  readonly tab: string | undefined
  readonly choose: (tab: string) => void
  /** The record up, and the page it is of: said by the page, since a page arrives before the frame has looked again. */
  readonly record?: string | undefined
  readonly recordOf?: string | undefined
  readonly chooseRecord?: (record: string | undefined, of: string) => void
  /** Go to another place, the way `app.open` goes. */
  readonly go?: (to: PlaceTo) => void
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

/** Which record of a page is up, in the address where there is a frame. Undefined is the list with nothing open over it. */
export function usePlaceRecord(of: string, first?: string): readonly [string | undefined, (record: string | undefined) => void] {
  const held = useContext(PlaceTabContext)
  const [own, setOwn] = useState(first)
  const choose = useCallback((record: string | undefined) => {
    setOwn(record)
    held?.chooseRecord?.(record, of)
  }, [held, of])
  return [!held?.chooseRecord ? own : held.recordOf === of ? held.record : undefined, choose]
}

/** The way to another place, where a frame stands above the page; none in a page's own test. */
export function usePlaceGo(): ((to: PlaceTo) => void) | undefined {
  return useContext(PlaceTabContext)?.go
}

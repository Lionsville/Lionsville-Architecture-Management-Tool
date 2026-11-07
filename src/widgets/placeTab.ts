// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Which tab of a page is up and which record it is on, kept in the frame so they
 * are in the address: a link and an agent reach them, and a reload stays on them
 * (`?tab=`, `PAGE_TABS` in `agent/screen.ts`, a record as the path's last
 * segment). A page asks here instead of holding a `useState`. With no frame above
 * it, as in a page's own test, it behaves as that `useState` would.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { readListView, writeListView } from './kit/listView'
import type { ListView } from './kit/listView'

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

/** What a list keeps in the address, handed down beside the tab. */
export type PlaceLists = {
  readonly list: string | undefined
  readonly pick: string | undefined
  /** `of` is the page asking: while a page is arriving, the frame cannot yet tell whose this is. */
  readonly choose: (list: string, pick: string | undefined, of: string) => void
}

export const PlaceListContext = createContext<PlaceLists | undefined>(undefined)

export const PlaceTabContext = createContext<PlaceTabs | undefined>(undefined)

export function usePlaceTab(first: string): readonly [string, (tab: string) => void] {
  const held = useContext(PlaceTabContext)
  const [own, setOwn] = useState(first)
  const choose = useCallback((tab: string) => {
    setOwn(tab)
    held?.choose(tab)
  }, [held])
  // In a frame the address is the truth: no tab said is the first, whatever was last pressed here.
  return [held ? held.tab ?? first : own, choose]
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

/**
 * What a list is showing and the record picked on it, in the address: a screen's
 * `readListView`/`writeListView` over this, instead of a `useState`. With no
 * frame above it, it is that `useState`.
 */
export function usePlaceList(of: string): readonly [string, string | undefined, (list: string, pick: string | undefined) => void] {
  const held = useContext(PlaceListContext)
  const [own, setOwn] = useState<{ list: string; pick: string | undefined }>({ list: '', pick: undefined })
  const choose = useCallback((list: string, pick: string | undefined) => {
    setOwn({ list, pick })
    held?.choose(list, pick, of)
  }, [held, of])
  return held ? [held.list ?? '', held.pick, choose] : [own.list, own.pick, choose]
}

/**
 * {@link usePlaceList} as the kit's `ListView`: what `FilterWords`, `List` and
 * `Preview` are composed over, with the record picked said beside the rest.
 */
export function usePlaceListView(of: string): readonly [ListView, (next: ListView) => void] {
  const [list, pick, choose] = usePlaceList(of)
  const view = useMemo(() => ({ ...readListView(new URLSearchParams(list)), select: pick ?? null }), [list, pick])
  const set = useCallback((next: ListView) => {
    choose(writeListView({ ...next, select: null }).toString(), next.select ?? undefined)
  }, [choose])
  return [view, set]
}

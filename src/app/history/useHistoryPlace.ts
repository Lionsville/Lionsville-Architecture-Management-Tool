// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The History page as a place (ADR-0033): `#/<scope>/-/history`, which an
 * agent, a link, Back and a reload reach as they reach any page.
 *
 * The page is the workspace's or the home's, whichever is up, and it keeps
 * whether it is open itself; the frame holds the same fact (`FrameState.history`)
 * so the address says it and a move elsewhere closes it. This keeps the two
 * the same, either way round: the page opened from ⋯ marks the frame, and the
 * frame marked by an address or by Back opens or shuts the page.
 */
import { useContext, useEffect, useRef } from 'react'
import { FrameStoreContext } from '../frame/frameStore'

export function useHistoryPlace(page: { pageOpen: boolean; openPage: () => void; closePage: () => void } | undefined): void {
  const frame = useContext(FrameStoreContext)
  const latest = useRef(page)
  latest.current = page
  const open = page?.pageOpen ?? false
  const owns = page !== undefined
  // Only once the page itself moved: on the first look the frame may hold what an address asked, which opens it below.
  const was = useRef(open)
  useEffect(() => {
    if (!frame || !owns || was.current === open) return
    was.current = open
    if (Boolean(frame.get().history) !== open) frame.set({ history: open })
  }, [frame, owns, open])
  useEffect(() => {
    if (!frame || !owns) return undefined
    // Only when the frame's word moved: anything else the frame hears may come between the page opening and its word reaching the frame.
    let heard: boolean | undefined
    const follow = () => {
      const held = latest.current
      const asked = Boolean(frame.get().history)
      if (asked === heard) return
      heard = asked
      if (!held || asked === held.pageOpen) return
      if (asked) held.openPage()
      else held.closePage()
    }
    follow()
    return frame.subscribe(follow)
  }, [frame, owns])
}

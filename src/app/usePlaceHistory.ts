// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The window's history, bound to the shell (ADR-0033): {@link PlaceHistory}
 * over this window, opening a place the way `app.open` opens one, after asking
 * where it lands now (`placeLanding.ts`'s `landingFor`).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { placeOf, samePlace } from '../agent/place'
import type { Place } from '../agent/place'
import type { Screen } from '../agent/screen'
import { PlaceHistory } from './placeHistory'

/**
 * The history, for the shell: a look to hand every screen to, which is all
 * the shell does with it. Off where there is no window to keep one in.
 */
export function usePlaceHistory(deps: {
  open: (place: Place, stay?: () => void) => void
  nearest: (place: Place) => Promise<Place>
  failed: (cause: unknown) => void
  /** An address changed to one that names a page this app does not have. */
  unknown?: () => void
  /** The screen the looks settled on: where somebody is, rather than a screen passed through on the way. */
  settled?: (screen: Screen) => void
}): (screen: Screen) => void {
  // Read through a ref: the history is made once per mount and must reach the
  // shell's functions as they are now, not as they were then.
  const latest = useRef(deps)
  latest.current = deps
  const seen = useRef<Screen | undefined>(undefined)
  const [places] = useState(() => (typeof window === 'undefined' ? undefined : new PlaceHistory(window, {
    open: (place, stay) => latest.current.open(place, stay),
    nearest: (place) => latest.current.nearest(place),
    failed: (cause) => latest.current.failed(cause),
    unknown: () => latest.current.unknown?.(),
    // The place is what settled; the screen last looked at says the rest of it, where it is still that place.
    settled: (place) => { if (seen.current && samePlace(placeOf(seen.current), place)) latest.current.settled?.(seen.current) },
  })))
  useEffect(() => places?.listen(), [places])
  return useCallback((screen: Screen) => { seen.current = screen; places?.look(placeOf(screen)) }, [places])
}

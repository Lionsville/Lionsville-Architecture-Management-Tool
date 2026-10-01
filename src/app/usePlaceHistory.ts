// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The window's history, bound to the shell (ADR-0033): {@link PlaceHistory}
 * over this window, opening a place the way `app.open` opens one, after asking
 * where it lands now (`placeLanding.ts`'s `landingFor`).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { placeOf } from '../agent/place'
import type { Place } from '../agent/place'
import type { Screen } from '../agent/screen'
import { PlaceHistory } from './placeHistory'

/**
 * The history, for the shell: a look to hand every screen to, which is all
 * the shell does with it. Off where there is no window to keep one in.
 */
export function usePlaceHistory(deps: {
  open: (place: Place) => void
  nearest: (place: Place) => Promise<Place>
  failed: (cause: unknown) => void
}): (screen: Screen) => void {
  // Read through a ref: the history is made once per mount and must reach the
  // shell's functions as they are now, not as they were then.
  const latest = useRef(deps)
  latest.current = deps
  const [places] = useState(() => (typeof window === 'undefined' ? undefined : new PlaceHistory(window, {
    open: (place) => latest.current.open(place),
    nearest: (place) => latest.current.nearest(place),
    failed: (cause) => latest.current.failed(cause),
  })))
  useEffect(() => places?.listen(), [places])
  return useCallback((screen: Screen) => places?.look(placeOf(screen)), [places])
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where the frame takes what a screen hands it: a page's body, and the tabs of
 * the view on screen, which sit in row two rather than in the view's own bar.
 *
 * A context with the elements in it, so a component in any module may say
 * *draw me there* without knowing there is an app: absent in a test with no
 * frame, and each then draws where it stands, as it always did.
 */
import { createContext, useContext } from 'react'

export type PlaceHost = {
  /** Over the main column, under the two rows: a page fills it. */
  readonly page: HTMLElement | null
  /** Row two, after *Home*: the view's tabs. */
  readonly views: HTMLElement | null
  /** Is a page up over the view? No view's tab is the current one then. */
  readonly pageUp: boolean
}

export const PlaceHostContext = createContext<PlaceHost | undefined>(undefined)

export function usePlaceHost(): PlaceHost | undefined {
  return useContext(PlaceHostContext)
}

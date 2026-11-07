// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * How close a person likes every list's rows: one choice for the whole product,
 * which is why it is here and not in the address (`listView.ts`). The app keeps
 * it and hands it down; with nothing above, a list is at its usual distance and
 * the choice lasts as long as the page.
 */
import { createContext, useContext, useState } from 'react'
import type { ListDensity } from './List'

export type ListDensityChoice = readonly [ListDensity, (density: ListDensity) => void]

export const ListDensityContext = createContext<ListDensityChoice | undefined>(undefined)

export function useListDensity(): ListDensityChoice {
  const held = useContext(ListDensityContext)
  const own = useState<ListDensity>('normal')
  return held ?? own
}

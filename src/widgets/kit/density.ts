// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * How much a screen holds: one choice for the whole product, the person's, with
 * the same two options and names wherever it is offered — Preferences and a
 * list's View. The shell keeps it, sets it on the root (`density.css`, which
 * every row measure follows) and hands it down; with nothing above, the choice
 * lasts as long as the page.
 */
import { createContext, useContext, useState } from 'react'

export type Density = 'comfortable' | 'compact'

/** In the order they are offered. */
export const DENSITIES: readonly Density[] = ['comfortable', 'compact']

/** What the choice is called, and the word for each option, in the kit's strings: the one source of both. */
export const DENSITY_NAME = 'kit.density'
export const DENSITY_LABEL: Record<Density, 'kit.density.comfortable' | 'kit.density.compact'> = {
  comfortable: 'kit.density.comfortable',
  compact: 'kit.density.compact',
}

/** A density read back: anything else is the usual distance. */
export function densityFrom(held: unknown): Density {
  return held === 'compact' ? 'compact' : 'comfortable'
}

export type DensityChoice = readonly [Density, (density: Density) => void]

export const DensityContext = createContext<DensityChoice | undefined>(undefined)

export function useDensity(): DensityChoice {
  const held = useContext(DensityContext)
  const own = useState<Density>('comfortable')
  return held ?? own
}

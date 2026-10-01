// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The observations page's three tabs (ADR-0021, ADR-0026): the register, the
 * analysis, and the solutions. Said once, here, because a place in the app
 * names one (`agent/screen.ts`'s `Destination.tab`) and the page draws them.
 */
export const OBSERVATION_TABS = ['register', 'analysis', 'solutions'] as const

export type ObservationTab = (typeof OBSERVATION_TABS)[number]

/** Is this one of the three? For a value read from outside — a call, an address. */
export function isObservationTab(value: unknown): value is ObservationTab {
  return typeof value === 'string' && (OBSERVATION_TABS as readonly string[]).includes(value)
}

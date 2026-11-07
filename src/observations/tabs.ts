// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The observations page's stages, the chain a person is led through (ADR-0021,
 * ADR-0026): Seen, Why, Solve and Did it work. Said once, here, because a place
 * in the app names one (`agent/screen.ts`'s `Destination.tab`) and the page draws
 * them. The first three keep the words they had while they were a register, an
 * analysis and solutions, so every address and agent call written then still
 * lands; `results` is the fourth, and a stage with a Map and a List may be named
 * with its lens, for a link or an agent that wants that one and not the one this
 * person left it on.
 */
export const OBSERVATION_STAGES = ['register', 'analysis', 'solutions', 'results'] as const

export type ObservationStage = (typeof OBSERVATION_STAGES)[number]

export const OBSERVATION_TABS = [
  ...OBSERVATION_STAGES, 'analysis-list', 'analysis-map', 'solutions-list', 'solutions-map',
] as const

export type ObservationTab = (typeof OBSERVATION_TABS)[number]

export type ChainLens = 'list' | 'map'

/** Is this one of them? For a value read from outside: a call, an address. */
export function isObservationTab(value: unknown): value is ObservationTab {
  return typeof value === 'string' && (OBSERVATION_TABS as readonly string[]).includes(value)
}

/** The stage a tab lands on, and the lens where it names one. */
export function stageOfTab(tab: ObservationTab): { stage: ObservationStage; lens?: ChainLens } {
  const [stage, lens] = tab.split('-') as [ObservationStage, ChainLens | undefined]
  return lens ? { stage, lens } : { stage }
}

/** Only Why and Solve are drawn as well as listed. */
export function hasMap(stage: ObservationStage): boolean {
  return stage === 'analysis' || stage === 'solutions'
}

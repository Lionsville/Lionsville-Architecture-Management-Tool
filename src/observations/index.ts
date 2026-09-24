// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Observations and causes (ADR-0021): what was seen, what lies behind it, and
 * the picture between them. Solutions and experiments (ADR-0026): what is done
 * about it, and whether it held. The rules are pure; the page is React.
 */
export * from './observation'
export * from './observationScope'
export * from './graph'
export * from './solution'
export * from './solutionGraph'
export { ObservationsPage } from './ui/ObservationsPage'
export type { ObservationsPageProps } from './ui/ObservationsPage'

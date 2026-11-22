// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for a process with no screen: what was seen and what is covered.
 *
 * The rules over observations, causes and solutions (ADR-0021, ADR-0032) and
 * the coverage of the business layer: read by a process that answers for them
 * without drawing them.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export { coverageOf } from '../../business/coverage'
export { isRootCause, liveObservations, movedTo } from '../../observations/observation'
export { recorderInCopy } from '../../observations/recordedBy'
export { rootsFromSolutions } from '../../observations/rootsFromSolutions'
export { isLive } from '../../observations/solution'
export type { ObservationTab } from '../../observations/tabs'

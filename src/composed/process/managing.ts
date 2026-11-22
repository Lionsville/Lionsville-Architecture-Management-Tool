// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for a process with no screen: a managing role's reach.
 *
 * What a managing role's right reaches (ADR-0036 §12): the units held and those
 * below, and whether a step changes only their people. Apart from the model,
 * because it reads a step through the reducer.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export {
  holdsAllIn, managedReach, managingRoleIds, onlyAssignments, onlyPeopleIn, reachesAssignment, reachesHolder, reachesPosition,
} from '../../model/managing'
export type { ManagedReach } from '../../model/managing'

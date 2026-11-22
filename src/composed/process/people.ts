// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for a process with no screen: the people register.
 *
 * An entry, what every change to the register does, the retention policy and
 * the pairs answered as not the same person (ADR-0036).
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export { distinctFrom, pairKey, tidyDistinct } from '../../people/distinct'
export type { DistinctPair } from '../../people/distinct'
export { possibleDuplicates } from '../../people/duplicates'
export { MERGE_LEAVINGS, PERSON_KINDS, entriesOf, mergeAsks, personFrom } from '../../people/person'
export type { MergeLeaving, NewPerson, PeopleAction, PeopleRefusal, Person, PersonKind, PersonPatch, PolicyHold } from '../../people/person'
export { POLICY_KEY, dueOn, policyOf } from '../../people/policy'
export type { PeoplePolicy } from '../../people/policy'
export { changePeople } from '../../people/register'
export type { Changed, Minting, PeopleChange } from '../../people/register'

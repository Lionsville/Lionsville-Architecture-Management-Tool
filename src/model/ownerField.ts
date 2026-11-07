// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * An application's owner, as one field (ADR-0036, amended 7 November 2026): a
 * unit picked, or a name typed, which is flagged as not being a unit.
 *
 * Before it the answer had two places, `partyId` for the unit and `owner` for
 * what somebody wrote, and only the first counted: a record saying *Owner:
 * Revenue systems* was told nobody owns it. The file keeps the two keys, since
 * the map, the charts and every older folder read them, and everything that
 * asks who owns an application asks here, so they read as one answer.
 *
 * **Setting one clears the other** ({@link withOneOwner}), in the reducer, so a
 * screen, an agent and a paste all get the same field. **A record written
 * earlier may hold both**, and then the unit is the answer, since that is what
 * the map and the check have always counted, and what was written is kept
 * beside it until somebody next sets the owner. A person picked from the
 * register reads as a name: it is not a unit, and it is not lost.
 *
 * Applications only. On any other kind `owner` and `partyId` keep their own
 * meanings: a platform's owner, and whose an actor is.
 */
import { personRefOf } from './person'
import type { PersonRef } from './person'
import type { DesignElement, ElementId } from './types'

export type ApplicationOwner =
  /** A unit answers for it. `written` is what an older record also said in words. */
  | { readonly kind: 'unit'; readonly unitId: ElementId; readonly written?: PersonRef }
  /** A name somebody typed or picked, and it is not a unit: counted, and flagged. */
  | { readonly kind: 'named'; readonly name: PersonRef }
  | { readonly kind: 'none' }

const NONE: ApplicationOwner = { kind: 'none' }

/** Who owns it, off the two keys of a record or an index entry. */
export function applicationOwner(held: { readonly owner?: PersonRef; readonly partyId?: ElementId }): ApplicationOwner {
  const written = personRefOf(held.owner)
  if (held.partyId !== undefined) return { kind: 'unit', unitId: held.partyId, ...(written !== undefined ? { written } : {}) }
  return written !== undefined ? { kind: 'named', name: written } : NONE
}

/** What a person or an agent sets the field to: a unit, a name, or nothing. */
export type OwnerChoice = { readonly unit: ElementId } | { readonly name: PersonRef } | undefined

/** The patch that says one answer: both keys named, so the other half is cleared and an undo puts both back. */
export function ownerPatch(choice: OwnerChoice): Pick<DesignElement, 'owner' | 'partyId'> {
  if (choice === undefined) return { owner: undefined, partyId: undefined }
  return 'unit' in choice
    ? { owner: undefined, partyId: choice.unit }
    : { owner: personRefOf(choice.name), partyId: undefined }
}

/**
 * A patch of an application with the field held to one answer: naming only one
 * half with a value clears the other. One naming both says exactly what it
 * means, which is what an undo does, and what brings an older record back.
 */
export function withOneOwner(held: Pick<DesignElement, 'kind'>, patch: Partial<DesignElement>): Partial<DesignElement> {
  if (held.kind !== 'application' || ('owner' in patch && 'partyId' in patch)) return patch
  if (patch.partyId !== undefined) return { ...patch, owner: undefined }
  if (personRefOf(patch.owner) !== undefined) return { ...patch, partyId: undefined }
  return patch
}

/** A patch's keys as a write set says them: either half of the field may write both. */
export function ownerFieldNamed(patch: Partial<DesignElement>): Partial<DesignElement> {
  return 'owner' in patch || 'partyId' in patch ? { owner: patch.owner, partyId: patch.partyId, ...patch } : patch
}

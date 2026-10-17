// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The type a scope takes when a unit is linked to it from the workspace
 * (ADR-0036, amended 17 October 2026; `projects/scopeType.ts`): a unit's
 * *Serves* gaining a domain, or a new unit made with its domains picked.
 *
 * The link is the open scope's step — the unit's `scopes`, through its
 * session, undone with ⌘Z — and the type is the served scope's own header,
 * which is another scope's: written there as that scope's step, under its
 * rights (`writeIn.ts`), once the link has landed. Undoing the link leaves
 * the type, as taking a unit off a scope does: the type says what the scope
 * is, and a unit no longer serving it does not make it something else.
 */
import { isServable, servingUnits } from '../../model/serving'
import type { ElementId } from '../../model/types'
import type { OrganisationAt } from '../../projects/checks'
import type { ScopePath } from '../../projects/scopePath'
import { typedByUnitType, typeToFollow } from '../../projects/scopeType'
import type { WriteIn } from './writeIn'

/**
 * The type `scope` follows when a unit of `unitTypeId` is linked to it, given
 * the organisation as the window has it: the unit's, unless the scope's own
 * still agrees with a unit serving it once the link is made. Nothing where
 * the type stays, the unit has no type, or the scope is the organisation.
 */
export function typeFollowingHere(at: OrganisationAt, scope: ScopePath, unit: { id: ElementId; unitTypeId?: string | undefined }, day: string): string | undefined {
  if (!unit.unitTypeId || !isServable(scope)) return undefined
  const serving = servingUnits(at.organisation, scope, day, (id) => at.unitAt(id)?.scope).units
  const after = [...new Set([...serving.map((one) => one.unitTypeId ?? ''), unit.unitTypeId].filter(Boolean))]
  return typeToFollow({ unitTypeId: at.scopeTypes?.get(scope) }, unit.unitTypeId, after)
}

/**
 * Write the type `scope` follows, where there is one and a way to write
 * another scope; nothing where the scope already says it. Settles whatever
 * the write answers: a scope the person may only read keeps its type, and
 * the check says where the two disagree.
 */
export function followTypeIn(writeIn: WriteIn | undefined, scope: ScopePath, followed: string | undefined): Promise<void> {
  if (!writeIn || followed === undefined) return Promise.resolve()
  return writeIn(scope, (held) => (held.unitTypeId === followed ? undefined : [{ type: 'scope.describe', patch: typedByUnitType(followed) }]))
    .then(() => undefined, () => undefined)
}

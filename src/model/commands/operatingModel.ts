// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The operating model (ADR-0036): unit types, roles, responsibilities and the
 * rules, each added, patched and removed — the same three moves every record
 * family has, and the same inverses.
 *
 * **No rule of the model is enforced here.** A role a slot names that is not
 * there, a responsibility nobody is accountable for, a unit type that sits in
 * itself: each is a finding (`accountabilityGaps`, the page's flags), never a
 * refusal, because a model a person is building passes through every one of
 * them, and a log replayed through this writer has to arrive where it did.
 * Taking a role out of the slots and duties that name it is the caller's
 * transaction, said as the commands that do it.
 */
import { settledRole } from '../operatingModel'
import type { PatchKeys } from './handler'
import { plainFamily } from './plain'

/** Every field of a unit type but its id. */
const UNIT_TYPE_FIELDS: PatchKeys<'unitType.update'> = {
  name: true, purpose: true, top: true, within: true, spans: true, slots: true, limit: true, order: true, basedOn: true,
  alsoBasedOn: true, from: true, until: true, successors: true,
}

/** Every field of a role but its id. */
const ROLE_FIELDS: PatchKeys<'role.update'> = {
  name: true, short: true, purpose: true, description: true, duties: true, manages: true, reportsTo: true, order: true, basedOn: true,
  alsoBasedOn: true, from: true, until: true, successors: true,
}

/** Every field of a responsibility but its id. */
const RESPONSIBILITY_FIELDS: PatchKeys<'responsibility.update'> = {
  name: true, description: true, group: true, order: true, basedOn: true,
}

/** A rule names a role, and nothing else: its kind is its id. */
const RULE_FIELDS: PatchKeys<'operatingRule.update'> = { role: true }

export const UNIT_TYPE_COMMANDS = plainFamily('unitTypes', { fields: UNIT_TYPE_FIELDS })

export const ROLE_COMMANDS = plainFamily('roles', { fields: ROLE_FIELDS, settles: settledRole })

export const RESPONSIBILITY_COMMANDS = plainFamily('responsibilities', { fields: RESPONSIBILITY_FIELDS })

export const OPERATING_RULE_COMMANDS = plainFamily('operatingRules', { fields: RULE_FIELDS })

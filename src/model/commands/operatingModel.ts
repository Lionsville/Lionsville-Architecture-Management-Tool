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
import { operatingRulesOf, responsibilitiesOf, rolesOf, unitTypesOf } from '../normalised'
import { gone, ok, taken } from './handler'
import type { CommandTable, PatchKeys } from './handler'
import { drop, patched, put, withOperating } from './rows'
import { patchWrites } from './writes'

/** Every field of a unit type but its id. */
const UNIT_TYPE_FIELDS: PatchKeys<'unitType.update'> = {
  name: true, purpose: true, top: true, within: true, spans: true, slots: true, limit: true, order: true, basedOn: true,
  alsoBasedOn: true, from: true, until: true, successors: true,
}

/** Every field of a role but its id. */
const ROLE_FIELDS: PatchKeys<'role.update'> = {
  name: true, short: true, purpose: true, duties: true, manages: true, basedOn: true, alsoBasedOn: true,
  from: true, until: true, successors: true,
}

/** Every field of a responsibility but its id. */
const RESPONSIBILITY_FIELDS: PatchKeys<'responsibility.update'> = {
  name: true, description: true, group: true, basedOn: true,
}

/** A rule names a role, and nothing else: its kind is its id. */
const RULE_FIELDS: PatchKeys<'operatingRule.update'> = { role: true }

export const UNIT_TYPE_COMMANDS = {
  'unitType.add': {
    carries: { unitType: true },
    writes: (command) => [`unitType/${command.unitType.id}`],
    apply(model, command, { meta }) {
      const { unitType, at } = command
      if (unitType.id in unitTypesOf(model)) return taken
      const rows = put(unitTypesOf(model), model.order.unitTypes, unitType.id, unitType, at)
      return ok(withOperating(model, 'unitTypes', rows), { type: 'unitType.remove', id: unitType.id }, meta)
    },
  },

  'unitType.update': {
    carries: { id: true, patch: true },
    patch: { keys: UNIT_TYPE_FIELDS, row: (model, command) => unitTypesOf(model)[command.id] },
    writes: (command) => patchWrites(`unitType/${command.id}`, command.patch),
    apply(model, command, { meta }) {
      const held = unitTypesOf(model)[command.id]
      if (!held) return gone
      const { row, inverse } = patched(held, command.patch)
      const rows = put(unitTypesOf(model), model.order.unitTypes, command.id, row)
      return ok(withOperating(model, 'unitTypes', rows), { type: 'unitType.update', id: command.id, patch: inverse }, meta)
    },
  },

  'unitType.remove': {
    carries: { id: true },
    writes: (command) => [`unitType/${command.id}`],
    apply(model, command, { meta }) {
      const held = unitTypesOf(model)[command.id]
      if (!held) return gone
      const at = model.order.unitTypes.indexOf(command.id)
      const rows = drop(unitTypesOf(model), model.order.unitTypes, command.id)
      return ok(withOperating(model, 'unitTypes', rows), { type: 'unitType.add', unitType: held, at }, meta)
    },
  },
} satisfies Partial<CommandTable>

export const ROLE_COMMANDS = {
  'role.add': {
    carries: { role: true },
    writes: (command) => [`role/${command.role.id}`],
    apply(model, command, { meta }) {
      const { role, at } = command
      if (role.id in rolesOf(model)) return taken
      const rows = put(rolesOf(model), model.order.roles, role.id, role, at)
      return ok(withOperating(model, 'roles', rows), { type: 'role.remove', id: role.id }, meta)
    },
  },

  'role.update': {
    carries: { id: true, patch: true },
    patch: { keys: ROLE_FIELDS, row: (model, command) => rolesOf(model)[command.id] },
    writes: (command) => patchWrites(`role/${command.id}`, command.patch),
    apply(model, command, { meta }) {
      const held = rolesOf(model)[command.id]
      if (!held) return gone
      const { row, inverse } = patched(held, command.patch)
      const rows = put(rolesOf(model), model.order.roles, command.id, row)
      return ok(withOperating(model, 'roles', rows), { type: 'role.update', id: command.id, patch: inverse }, meta)
    },
  },

  'role.remove': {
    carries: { id: true },
    writes: (command) => [`role/${command.id}`],
    apply(model, command, { meta }) {
      const held = rolesOf(model)[command.id]
      if (!held) return gone
      const at = model.order.roles.indexOf(command.id)
      const rows = drop(rolesOf(model), model.order.roles, command.id)
      return ok(withOperating(model, 'roles', rows), { type: 'role.add', role: held, at }, meta)
    },
  },
} satisfies Partial<CommandTable>

export const RESPONSIBILITY_COMMANDS = {
  'responsibility.add': {
    carries: { responsibility: true },
    writes: (command) => [`responsibility/${command.responsibility.id}`],
    apply(model, command, { meta }) {
      const { responsibility, at } = command
      if (responsibility.id in responsibilitiesOf(model)) return taken
      const rows = put(responsibilitiesOf(model), model.order.responsibilities, responsibility.id, responsibility, at)
      return ok(withOperating(model, 'responsibilities', rows), { type: 'responsibility.remove', id: responsibility.id }, meta)
    },
  },

  'responsibility.update': {
    carries: { id: true, patch: true },
    patch: { keys: RESPONSIBILITY_FIELDS, row: (model, command) => responsibilitiesOf(model)[command.id] },
    writes: (command) => patchWrites(`responsibility/${command.id}`, command.patch),
    apply(model, command, { meta }) {
      const held = responsibilitiesOf(model)[command.id]
      if (!held) return gone
      const { row, inverse } = patched(held, command.patch)
      const rows = put(responsibilitiesOf(model), model.order.responsibilities, command.id, row)
      return ok(
        withOperating(model, 'responsibilities', rows),
        { type: 'responsibility.update', id: command.id, patch: inverse },
        meta,
      )
    },
  },

  'responsibility.remove': {
    carries: { id: true },
    writes: (command) => [`responsibility/${command.id}`],
    apply(model, command, { meta }) {
      const held = responsibilitiesOf(model)[command.id]
      if (!held) return gone
      const at = model.order.responsibilities.indexOf(command.id)
      const rows = drop(responsibilitiesOf(model), model.order.responsibilities, command.id)
      return ok(withOperating(model, 'responsibilities', rows), { type: 'responsibility.add', responsibility: held, at }, meta)
    },
  },
} satisfies Partial<CommandTable>

export const OPERATING_RULE_COMMANDS = {
  'operatingRule.add': {
    carries: { rule: true },
    writes: (command) => [`operatingRule/${command.rule.id}`],
    apply(model, command, { meta }) {
      const { rule, at } = command
      if (rule.id in operatingRulesOf(model)) return taken
      const rows = put(operatingRulesOf(model), model.order.operatingRules, rule.id, rule, at)
      return ok(withOperating(model, 'operatingRules', rows), { type: 'operatingRule.remove', id: rule.id }, meta)
    },
  },

  'operatingRule.update': {
    carries: { id: true, patch: true },
    patch: { keys: RULE_FIELDS, row: (model, command) => operatingRulesOf(model)[command.id] },
    writes: (command) => patchWrites(`operatingRule/${command.id}`, command.patch),
    apply(model, command, { meta }) {
      const held = operatingRulesOf(model)[command.id]
      if (!held) return gone
      const { row, inverse } = patched(held, command.patch)
      const rows = put(operatingRulesOf(model), model.order.operatingRules, command.id, row)
      return ok(withOperating(model, 'operatingRules', rows), { type: 'operatingRule.update', id: command.id, patch: inverse }, meta)
    },
  },

  'operatingRule.remove': {
    carries: { id: true },
    writes: (command) => [`operatingRule/${command.id}`],
    apply(model, command, { meta }) {
      const held = operatingRulesOf(model)[command.id]
      if (!held) return gone
      const at = model.order.operatingRules.indexOf(command.id)
      const rows = drop(operatingRulesOf(model), model.order.operatingRules, command.id)
      return ok(withOperating(model, 'operatingRules', rows), { type: 'operatingRule.add', rule: held, at }, meta)
    },
  },
} satisfies Partial<CommandTable>

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What was seen and what lies behind it (ADR-0021), and what is done about it
 * (ADR-0026): observations, causes, solutions and experiments, each added,
 * patched and removed.
 */
import { causesOf, observationsOf, solutionsOf } from '../normalised'
import type { Model } from '../normalised'
import type { Cause } from '../observation'
import { gone, ok, taken } from './handler'
import type { CommandTable, PatchKeys, Refused } from './handler'
import { plainFamily } from './plain'
import { drop, patched, put, withRows } from './rows'
import { patchWrites } from './writes'
import { sameValue } from '../recordKey'

/** Every field of an observation but its id. */
const OBSERVATION_FIELDS: PatchKeys<'observation.update'> = {
  number: true, title: true, date: true, where: true, about: true, by: true, impact: true, bright: true, tone: true, recordedBy: true, seen: true,
  archived: true, noted: true, body: true, history: true,
}

/** Every field of a cause but its id. */
const CAUSE_FIELDS: PatchKeys<'cause.update'> = {
  number: true, title: true, state: true, root: true, body: true, explains: true, history: true,
}

/**
 * Whether a cause may become a root cause, or go back, as the patch says
 * (ADR-0032 §3). Refused in `apply` rather than in a guard, because the rule
 * is the one writer's whoever sent the step — the page, the agent, a replay —
 * and no step written before a cause could be a root names `root`, so a log
 * replayed through here arrives where it did. A patch that names `root` and
 * says what the cause already is, as a whole row's replacement does, is no
 * change and is not asked.
 */
function rootRefusal(model: Model, held: Cause, patch: Partial<Cause>): Refused | undefined {
  if (!('root' in patch) || Boolean(patch.root) === Boolean(held.root)) return undefined
  if (patch.root) {
    const explained = Object.values(causesOf(model))
      .some((one) => one.id !== held.id && one.explains.some((link) => link.id === held.id && link.scope === undefined))
    return explained ? { ok: false, reason: 'command.rootExplained' } : undefined
  }
  const addressed = Object.values(solutionsOf(model)).some((one) => one.addresses.some((address) => address.id === held.id))
  return addressed ? { ok: false, reason: 'command.rootAddressed' } : undefined
}

/** Every field of a solution but its id. */
const SOLUTION_FIELDS: PatchKeys<'solution.update'> = {
  number: true, title: true, state: true, addresses: true, benefit: true, cost: true,
  validatedWith: true, attempts: true, noneKnown: true, whyNow: true, waived: true,
  droppedFrom: true, dropNote: true, decision: true, plan: true, body: true, history: true,
}

/** Every field of an experiment but its id. */
const EXPERIMENT_FIELDS: PatchKeys<'experiment.update'> = {
  number: true, title: true, tests: true, strength: true, hypothesis: true, measure: true,
  where: true, by: true, from: true, to: true, outcome: true, result: true, body: true,
}

export const OBSERVATION_COMMANDS = {
  'observation.add': {
    carries: { observation: true },
    writes: (command) => [`observation/${command.observation.id}`],
    apply(model, command, { meta }) {
      const { observation, at } = command
      if (observation.id in observationsOf(model)) return taken
      const rows = put(observationsOf(model), model.order.observations, observation.id, observation, at)
      return ok(withRows(model, 'observations', rows), { type: 'observation.remove', id: observation.id }, meta)
    },
  },

  'observation.update': {
    carries: { id: true, patch: true },
    patch: { keys: OBSERVATION_FIELDS, row: (model, command) => observationsOf(model)[command.id] },
    writes: (command) => patchWrites(`observation/${command.id}`, command.patch),
    apply(model, command, { meta }) {
      const held = observationsOf(model)[command.id]
      if (!held) return gone
      // Written once, by whoever recorded it (ADR-0038, amended §10): a patch
      // that names it and says what it already is — a whole row's
      // replacement — is no change and is let through.
      if ('recordedBy' in command.patch && !sameValue(command.patch.recordedBy, held.recordedBy)) {
        return { ok: false, reason: 'command.recordedByFixed' }
      }
      const { row, inverse } = patched(held, command.patch)
      const rows = put(observationsOf(model), model.order.observations, command.id, row)
      return ok(withRows(model, 'observations', rows), { type: 'observation.update', id: command.id, patch: inverse }, meta)
    },
  },

  'observation.remove': {
    carries: { id: true },
    writes: (command) => [`observation/${command.id}`],
    apply(model, command, { meta }) {
      const held = observationsOf(model)[command.id]
      if (!held) return gone
      const at = model.order.observations.indexOf(command.id)
      const rows = drop(observationsOf(model), model.order.observations, command.id)
      return ok(withRows(model, 'observations', rows), { type: 'observation.add', observation: held, at }, meta)
    },
  },
} satisfies Partial<CommandTable>

export const CAUSE_COMMANDS = plainFamily('causes', {
  fields: CAUSE_FIELDS,
  refuses: (model, _cause, command, held) => (command.type === 'cause.update' && held ? rootRefusal(model, held, command.patch) : undefined),
})

export const SOLUTION_COMMANDS = plainFamily('solutions', { fields: SOLUTION_FIELDS })

export const EXPERIMENT_COMMANDS = plainFamily('experiments', { fields: EXPERIMENT_FIELDS })

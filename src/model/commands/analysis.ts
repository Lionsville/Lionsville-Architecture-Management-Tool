// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What was seen and what lies behind it (ADR-0021), and what is done about it
 * (ADR-0026): observations, causes, solutions and experiments, each added,
 * patched and removed.
 */
import { causesOf, experimentsOf, observationsOf, solutionsOf } from '../normalised'
import { gone, ok, taken } from './handler'
import type { CommandTable, PatchKeys } from './handler'
import { drop, patched, put, withCauses, withExperiments, withObservations, withSolutions } from './rows'
import { patchWrites } from './writes'

/** Every field of an observation but its id. */
const OBSERVATION_FIELDS: PatchKeys<'observation.update'> = {
  number: true, title: true, date: true, where: true, by: true, impact: true, seen: true,
  shared: true, archived: true, body: true, history: true,
}

/** Every field of a cause but its id. */
const CAUSE_FIELDS: PatchKeys<'cause.update'> = {
  number: true, title: true, state: true, body: true, explains: true,
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
      return ok(withObservations(model, rows), { type: 'observation.remove', id: observation.id }, meta)
    },
  },

  'observation.update': {
    carries: { id: true, patch: true },
    patch: { keys: OBSERVATION_FIELDS, row: (model, command) => observationsOf(model)[command.id] },
    writes: (command) => patchWrites(`observation/${command.id}`, command.patch),
    apply(model, command, { meta }) {
      const held = observationsOf(model)[command.id]
      if (!held) return gone
      const { row, inverse } = patched(held, command.patch)
      const rows = put(observationsOf(model), model.order.observations, command.id, row)
      return ok(withObservations(model, rows), { type: 'observation.update', id: command.id, patch: inverse }, meta)
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
      return ok(withObservations(model, rows), { type: 'observation.add', observation: held, at }, meta)
    },
  },
} satisfies Partial<CommandTable>

export const CAUSE_COMMANDS = {
  'cause.add': {
    carries: { cause: true },
    writes: (command) => [`cause/${command.cause.id}`],
    apply(model, command, { meta }) {
      const { cause, at } = command
      if (cause.id in causesOf(model)) return taken
      const rows = put(causesOf(model), model.order.causes, cause.id, cause, at)
      return ok(withCauses(model, rows), { type: 'cause.remove', id: cause.id }, meta)
    },
  },

  'cause.update': {
    carries: { id: true, patch: true },
    patch: { keys: CAUSE_FIELDS, row: (model, command) => causesOf(model)[command.id] },
    writes: (command) => patchWrites(`cause/${command.id}`, command.patch),
    apply(model, command, { meta }) {
      const held = causesOf(model)[command.id]
      if (!held) return gone
      const { row, inverse } = patched(held, command.patch)
      const rows = put(causesOf(model), model.order.causes, command.id, row)
      return ok(withCauses(model, rows), { type: 'cause.update', id: command.id, patch: inverse }, meta)
    },
  },

  'cause.remove': {
    carries: { id: true },
    writes: (command) => [`cause/${command.id}`],
    apply(model, command, { meta }) {
      const held = causesOf(model)[command.id]
      if (!held) return gone
      const at = model.order.causes.indexOf(command.id)
      const rows = drop(causesOf(model), model.order.causes, command.id)
      return ok(withCauses(model, rows), { type: 'cause.add', cause: held, at }, meta)
    },
  },
} satisfies Partial<CommandTable>

export const SOLUTION_COMMANDS = {
  'solution.add': {
    carries: { solution: true },
    writes: (command) => [`solution/${command.solution.id}`],
    apply(model, command, { meta }) {
      const { solution, at } = command
      if (solution.id in solutionsOf(model)) return taken
      const rows = put(solutionsOf(model), model.order.solutions, solution.id, solution, at)
      return ok(withSolutions(model, rows), { type: 'solution.remove', id: solution.id }, meta)
    },
  },

  'solution.update': {
    carries: { id: true, patch: true },
    patch: { keys: SOLUTION_FIELDS, row: (model, command) => solutionsOf(model)[command.id] },
    writes: (command) => patchWrites(`solution/${command.id}`, command.patch),
    apply(model, command, { meta }) {
      const held = solutionsOf(model)[command.id]
      if (!held) return gone
      const { row, inverse } = patched(held, command.patch)
      const rows = put(solutionsOf(model), model.order.solutions, command.id, row)
      return ok(withSolutions(model, rows), { type: 'solution.update', id: command.id, patch: inverse }, meta)
    },
  },

  'solution.remove': {
    carries: { id: true },
    writes: (command) => [`solution/${command.id}`],
    apply(model, command, { meta }) {
      const held = solutionsOf(model)[command.id]
      if (!held) return gone
      const at = model.order.solutions.indexOf(command.id)
      const rows = drop(solutionsOf(model), model.order.solutions, command.id)
      return ok(withSolutions(model, rows), { type: 'solution.add', solution: held, at }, meta)
    },
  },
} satisfies Partial<CommandTable>

export const EXPERIMENT_COMMANDS = {
  'experiment.add': {
    carries: { experiment: true },
    writes: (command) => [`experiment/${command.experiment.id}`],
    apply(model, command, { meta }) {
      const { experiment, at } = command
      if (experiment.id in experimentsOf(model)) return taken
      const rows = put(experimentsOf(model), model.order.experiments, experiment.id, experiment, at)
      return ok(withExperiments(model, rows), { type: 'experiment.remove', id: experiment.id }, meta)
    },
  },

  'experiment.update': {
    carries: { id: true, patch: true },
    patch: { keys: EXPERIMENT_FIELDS, row: (model, command) => experimentsOf(model)[command.id] },
    writes: (command) => patchWrites(`experiment/${command.id}`, command.patch),
    apply(model, command, { meta }) {
      const held = experimentsOf(model)[command.id]
      if (!held) return gone
      const { row, inverse } = patched(held, command.patch)
      const rows = put(experimentsOf(model), model.order.experiments, command.id, row)
      return ok(withExperiments(model, rows), { type: 'experiment.update', id: command.id, patch: inverse }, meta)
    },
  },

  'experiment.remove': {
    carries: { id: true },
    writes: (command) => [`experiment/${command.id}`],
    apply(model, command, { meta }) {
      const held = experimentsOf(model)[command.id]
      if (!held) return gone
      const at = model.order.experiments.indexOf(command.id)
      const rows = drop(experimentsOf(model), model.order.experiments, command.id)
      return ok(withExperiments(model, rows), { type: 'experiment.add', experiment: held, at }, meta)
    },
  },
} satisfies Partial<CommandTable>

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What was seen and what lies behind it (ADR-0021), and what is done about it
 * (ADR-0026): observations, causes, solutions and experiments, each added,
 * patched and removed.
 */
import { causesOf, experimentsOf, observationsOf, solutionsOf } from '../normalised'
import { gone, ok, taken } from './handler'
import type { CommandTable } from './handler'
import { drop, patched, put, withCauses, withExperiments, withObservations, withSolutions } from './rows'

export const OBSERVATION_COMMANDS = {
  'observation.add': {
    apply(model, command, { meta }) {
      const { observation, at } = command
      if (observation.id in observationsOf(model)) return taken
      const rows = put(observationsOf(model), model.order.observations, observation.id, observation, at)
      return ok(withObservations(model, rows), { type: 'observation.remove', id: observation.id }, meta)
    },
  },

  'observation.update': {
    apply(model, command, { meta }) {
      const held = observationsOf(model)[command.id]
      if (!held) return gone
      const { row, inverse } = patched(held, command.patch)
      const rows = put(observationsOf(model), model.order.observations, command.id, row)
      return ok(withObservations(model, rows), { type: 'observation.update', id: command.id, patch: inverse }, meta)
    },
  },

  'observation.remove': {
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
    apply(model, command, { meta }) {
      const { cause, at } = command
      if (cause.id in causesOf(model)) return taken
      const rows = put(causesOf(model), model.order.causes, cause.id, cause, at)
      return ok(withCauses(model, rows), { type: 'cause.remove', id: cause.id }, meta)
    },
  },

  'cause.update': {
    apply(model, command, { meta }) {
      const held = causesOf(model)[command.id]
      if (!held) return gone
      const { row, inverse } = patched(held, command.patch)
      const rows = put(causesOf(model), model.order.causes, command.id, row)
      return ok(withCauses(model, rows), { type: 'cause.update', id: command.id, patch: inverse }, meta)
    },
  },

  'cause.remove': {
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
    apply(model, command, { meta }) {
      const { solution, at } = command
      if (solution.id in solutionsOf(model)) return taken
      const rows = put(solutionsOf(model), model.order.solutions, solution.id, solution, at)
      return ok(withSolutions(model, rows), { type: 'solution.remove', id: solution.id }, meta)
    },
  },

  'solution.update': {
    apply(model, command, { meta }) {
      const held = solutionsOf(model)[command.id]
      if (!held) return gone
      const { row, inverse } = patched(held, command.patch)
      const rows = put(solutionsOf(model), model.order.solutions, command.id, row)
      return ok(withSolutions(model, rows), { type: 'solution.update', id: command.id, patch: inverse }, meta)
    },
  },

  'solution.remove': {
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
    apply(model, command, { meta }) {
      const { experiment, at } = command
      if (experiment.id in experimentsOf(model)) return taken
      const rows = put(experimentsOf(model), model.order.experiments, experiment.id, experiment, at)
      return ok(withExperiments(model, rows), { type: 'experiment.remove', id: experiment.id }, meta)
    },
  },

  'experiment.update': {
    apply(model, command, { meta }) {
      const held = experimentsOf(model)[command.id]
      if (!held) return gone
      const { row, inverse } = patched(held, command.patch)
      const rows = put(experimentsOf(model), model.order.experiments, command.id, row)
      return ok(withExperiments(model, rows), { type: 'experiment.update', id: command.id, patch: inverse }, meta)
    },
  },

  'experiment.remove': {
    apply(model, command, { meta }) {
      const held = experimentsOf(model)[command.id]
      if (!held) return gone
      const at = model.order.experiments.indexOf(command.id)
      const rows = drop(experimentsOf(model), model.order.experiments, command.id)
      return ok(withExperiments(model, rows), { type: 'experiment.add', experiment: held, at }, meta)
    },
  },
} satisfies Partial<CommandTable>

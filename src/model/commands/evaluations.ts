// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A scope's evaluation of a building block (ADR-0043 §4): started, changed
 * and taken away. One per block in a scope, named by the block; the reducer
 * asks that it holds together (`model/evaluation.ts`) and leaves the block —
 * which may be kept in another scope — to where the block is read.
 */
import { evaluationRefusal } from '../evaluation'
import { evaluationsOf } from '../normalised'
import { gone, ok, taken } from './handler'
import type { CommandTable, PatchKeys } from './handler'
import { drop, patched, put, withEvaluations } from './rows'
import { patchWrites } from './writes'

const EVALUATION_FIELDS: PatchKeys<'evaluation.update'> = {
  block: true, contexts: true, options: true, coverage: true, chosen: true, decidedBy: true,
}

const BAD = { ok: false, reason: 'command.badEvaluation' } as const

export const EVALUATION_COMMANDS = {
  'evaluation.add': {
    carries: { evaluation: true },
    writes: (command) => [`evaluation/${command.evaluation.id}`],
    apply(model, command, { meta }) {
      const { evaluation, at } = command
      if (evaluation.id in evaluationsOf(model)) return taken
      if (evaluationRefusal(evaluation)) return BAD
      const rows = put(evaluationsOf(model), model.order.evaluations, evaluation.id, evaluation, at)
      return ok(withEvaluations(model, rows), { type: 'evaluation.remove', id: evaluation.id }, meta)
    },
  },

  'evaluation.update': {
    carries: { id: true, patch: true },
    patch: { keys: EVALUATION_FIELDS, row: (model, command) => evaluationsOf(model)[command.id] },
    writes: (command) => patchWrites(`evaluation/${command.id}`, command.patch),
    apply(model, command, { meta }) {
      const held = evaluationsOf(model)[command.id]
      if (!held) return gone
      const { row, inverse } = patched(held, command.patch)
      if (evaluationRefusal(row)) return BAD
      const rows = put(evaluationsOf(model), model.order.evaluations, command.id, row)
      return ok(withEvaluations(model, rows), { type: 'evaluation.update', id: command.id, patch: inverse }, meta)
    },
  },

  'evaluation.remove': {
    carries: { id: true },
    writes: (command) => [`evaluation/${command.id}`],
    apply(model, command, { meta }) {
      const held = evaluationsOf(model)[command.id]
      if (!held) return gone
      const at = model.order.evaluations.indexOf(command.id)
      const rows = drop(evaluationsOf(model), model.order.evaluations, command.id)
      return ok(withEvaluations(model, rows), { type: 'evaluation.add', evaluation: held, at }, meta)
    },
  },
} satisfies Partial<CommandTable>

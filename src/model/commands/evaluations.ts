// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A scope's evaluation of a building block (ADR-0043 §4): started, changed
 * and taken away. One per block in a scope, named by the block; the reducer
 * asks that it holds together (`model/evaluation.ts`) and leaves the block —
 * which may be kept in another scope — to where the block is read.
 */
import { evaluationRefusal } from '../evaluation'
import type { PatchKeys } from './handler'
import { plainFamily } from './plain'

const EVALUATION_FIELDS: PatchKeys<'evaluation.update'> = {
  block: true, contexts: true, options: true, coverage: true, chosen: true, decidedBy: true,
}

const BAD = { ok: false, reason: 'command.badEvaluation' } as const

export const EVALUATION_COMMANDS = plainFamily('evaluations', {
  fields: EVALUATION_FIELDS,
  refuses: (_model, evaluation) => (evaluationRefusal(evaluation) ? BAD : undefined),
})

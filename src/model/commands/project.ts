// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The project itself, and the two commands made of other commands: several
 * changes as one undo step, and a version put back (ADR-0008) — a
 * transaction that knows its name.
 */
import { NOTHING, reverse } from '../commands'
import type { Command, ProjectPatch } from '../commands'
import type { Model } from '../normalised'
import { ok } from './handler'
import type { CommandTable } from './handler'
import { patched } from './rows'

export const PROJECT_COMMANDS = {
  'project.settings': {
    apply(model, command, { meta }) {
      const { row, inverse } = patched(model, command.patch as Partial<Model>)
      return ok(row, { type: 'project.settings', patch: inverse as ProjectPatch }, meta)
    },
  },

  'restore': {
    apply: (model, command, { meta, apply }) =>
      apply(model, { ...meta, type: 'transaction', commands: command.commands }),
  },

  'transaction': {
    apply(model, command, { meta, apply }) {
      let next = model
      const inverses: Command[] = []
      for (const inner of command.commands) {
        const result = apply(next, inner)
        if (!result.ok) return result
        next = result.model
        inverses.push(result.inverse)
      }
      if (next === model) return ok(model, NOTHING, meta)
      return ok(next, reverse(inverses, meta), meta)
    },
  },
} satisfies Partial<CommandTable>

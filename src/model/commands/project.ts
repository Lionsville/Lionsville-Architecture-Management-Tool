// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The project itself, and the two commands made of other commands: several
 * changes as one undo step, and a version put back (ADR-0008) — a
 * transaction that knows its name.
 */
import { NOTHING, reverse } from '../commands'
import type { Command } from '../commands'
import { ok } from './handler'
import type { CommandTable, PatchKeys } from './handler'
import { patched } from './rows'
import { patchWrites } from './writes'

/**
 * The model's own scalars, and nothing else of it (`ProjectPatch`).
 *
 * The one patch spread over the model itself rather than over a record in
 * it, which is why a key outside this list is the refusal that matters most:
 * `elements` or `diagrams` in a settings patch would replace a list of the
 * scope with whatever came with it.
 */
const PROJECT_FIELDS: PatchKeys<'project.settings'> = {
  name: true, description: true, defaultAuthor: true, defaultAspectConfig: true,
}

export const PROJECT_COMMANDS = {
  'project.settings': {
    carries: { patch: true },
    patch: { keys: PROJECT_FIELDS, row: (model) => model },
    writes: (command) => patchWrites('project', command.patch),
    apply(model, command, { meta }) {
      const { row, inverse } = patched(model, command.patch)
      return ok(row, { type: 'project.settings', patch: inverse }, meta)
    },
  },

  'restore': {
    carries: { restored: true, commands: true },
    writes: (command, inner) => command.commands.flatMap(inner),
    apply: (model, command, { meta, apply }) =>
      apply(model, { ...meta, type: 'transaction', commands: command.commands }),
  },

  'transaction': {
    carries: { commands: true },
    writes: (command, inner) => command.commands.flatMap(inner),
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

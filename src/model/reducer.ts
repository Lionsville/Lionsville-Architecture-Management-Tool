// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The one writer (ADR-0002).
 *
 * `apply` takes a model and a command and returns the model that results,
 * together with **the command that undoes it** — computed from the state it just
 * saw, which is the only moment at which the inverse is both exact and cheap.
 * Undo is `apply(model, inverse)`; redo is the original command again. Nothing
 * else in the app may change a model.
 *
 * Three properties are worth stating, because everything downstream leans on
 * them and `reducer.test.ts` pins all three:
 *
 * - **Proportional.** A command touches the path it names. Renaming a diagram
 *   copies the model, its diagram record and that one diagram; every other
 *   diagram, every element and every route comes out of it by identity, so
 *   memoisation below the reducer holds.
 * - **Reversible.** `apply(apply(m, c).model, inverse)` is `m` again, deep
 *   equal, order arrays included — which is why a delete's inverse carries the
 *   index the row was at rather than appending it back at the end.
 * - **Atomic.** A transaction that refuses anywhere changes nothing.
 *
 * **A refusal is a key**, never a sentence, and it is a value rather than a
 * throw: a command that cannot be carried out is an ordinary answer here, the
 * way `openProjectDocument`'s three refusals are.
 *
 * Each kind of command has an entry of its own in `commands/` — one family per
 * module, put together in `commands/table.ts`, whose type is what makes a
 * command without an entry a compile error — and `apply` looks the command up
 * there. The arithmetic the entries share, including the rule about absence
 * (emptying an optional list removes the key rather than leaving it empty), is
 * `commands/rows.ts`.
 */
import { transaction } from './commands'
import type { Command, CommandMeta } from './commands'
import type { Model } from './normalised'
import type { ApplyResult, Context } from './commands/handler'
import { COMMAND_TABLE } from './commands/table'

export type { ApplyResult, CommandRefusal } from './commands/handler'

type Untyped = { apply: (model: Model, command: Command, context: Context) => ApplyResult }

export function apply(model: Model, command: Command): ApplyResult {
  const meta: CommandMeta = {}
  if (command.coalesce !== undefined) meta.coalesce = command.coalesce
  if (command.undoable !== undefined) meta.undoable = command.undoable
  if (command.origin !== undefined) meta.origin = command.origin
  // The table is keyed by the union and each entry takes its own member of it;
  // looking one up by a value of the union cannot say which, so the lookup is
  // widened here and nowhere else. An own key only: a type the table does not
  // hold is answered as the switch this replaced answered it, with nothing.
  if (!Object.hasOwn(COMMAND_TABLE, command.type)) return undefined as never
  const entry = COMMAND_TABLE[command.type] as unknown as Untyped
  return entry.apply(model, command, { meta, apply })
}

/** A run of commands, or the first refusal. One step, one inverse. */
export function applyAll(model: Model, commands: Command[], meta: CommandMeta = {}): ApplyResult {
  return apply(model, transaction(commands, meta))
}

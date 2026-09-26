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
 *
 * **What it is given is held to what the command says it may carry**
 * (ADR-0028). Beside each entry's `apply` is its descriptor, and a patch naming
 * a key its descriptor does not list is refused `command.notAField` before
 * the entry is reached — at every level of a transaction, because each inner
 * command comes back through here. The guard a descriptor may carry is not
 * run by `apply`: {@link applyGuarded} runs it, for a writer that has nobody
 * in front of it to have asked already.
 */
import { transaction } from './commands'
import type { Command, CommandMeta } from './commands'
import type { Model } from './normalised'
import type { ApplyResult, CommandRefusal, CommandType, Context, WriteKey } from './commands/handler'
import { COMMAND_TABLE } from './commands/table'
import { EVERYTHING } from './commands/writes'

export type { ApplyResult, CommandRefusal, WriteKey } from './commands/handler'
export { EVERYTHING } from './commands/writes'

type Untyped = {
  apply: (model: Model, command: Command, context: Context) => ApplyResult
  patch?: { keys: Record<string, true>; row: (model: Model, command: Command) => object | undefined }
  guard?: (model: Model, command: Command) => CommandRefusal | undefined
  writes: (command: Command, inner: (command: Command) => readonly WriteKey[]) => readonly WriteKey[]
}

/**
 * The entry for a command's type, or nothing for a type the table does not
 * hold. The table is keyed by the union and each entry takes its own member
 * of it; looking one up by a value of the union cannot say which, so the
 * lookup is widened here and nowhere else. An own key only, so `constructor`
 * is not a command.
 */
function entryOf(type: string): Untyped | undefined {
  if (!Object.hasOwn(COMMAND_TABLE, type)) return undefined
  return COMMAND_TABLE[type as CommandType] as unknown as Untyped
}

export function apply(model: Model, command: Command): ApplyResult {
  return run(model, command, false)
}

/**
 * {@link apply}, with every descriptor's guard asked first — at every level of
 * a transaction, against the model as it stands when that command lands.
 *
 * For the writer of a scope that more than one author writes to, which has
 * nobody in front of it: the screen and the agent ask `projects/mayEdit.ts`
 * before they build a command, and a command that arrives from elsewhere has
 * been asked by nobody this writer can vouch for. `apply` does not run the
 * guard, because on one machine every caller has asked already and the undo
 * stack must be able to put back what was there.
 */
export function applyGuarded(model: Model, command: Command): ApplyResult {
  return run(model, command, true)
}

function run(model: Model, command: Command, guarded: boolean): ApplyResult {
  const meta: CommandMeta = {}
  if (command.coalesce !== undefined) meta.coalesce = command.coalesce
  if (command.undoable !== undefined) meta.undoable = command.undoable
  if (command.origin !== undefined) meta.origin = command.origin
  // A type the table does not hold is answered as the switch this replaced
  // answered it, with nothing.
  const entry = entryOf(command.type)
  if (!entry) return undefined as never
  const refused = patchRefusal(entry, model, command) ?? (guarded ? entry.guard?.(model, command) : undefined)
  if (refused) return { ok: false, reason: refused }
  return entry.apply(model, command, {
    meta,
    apply: (at, inner) => run(at, inner, guarded),
  })
}

/**
 * A key a patch may not carry, or nothing.
 *
 * A key outside the descriptor's list is let through only where it says what
 * the record already says — the id the command names, or the value held —
 * because a patch built as a whole row's replacement (`replacement` in
 * `commands.ts`) names every key the row happens to hold, including one an
 * older file left on it. Anything else is a write the model has no field for.
 */
function patchRefusal(entry: Untyped, model: Model, command: Command): CommandRefusal | undefined {
  if (!entry.patch) return undefined
  const patch: unknown = (command as { patch?: unknown }).patch
  if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) return 'command.notAField'
  const row = entry.patch.row(model, command) as Record<string, unknown> | undefined
  for (const [key, value] of Object.entries(patch)) {
    if (Object.hasOwn(entry.patch.keys, key)) continue
    if (key === 'id' && 'id' in command && value === command.id) continue
    if (row !== undefined && Object.hasOwn(row, key) ? same(value, row[key]) : value === undefined) continue
    return 'command.notAField'
  }
  return undefined
}

function same(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b)
}

/** A run of commands, or the first refusal. One step, one inverse. */
export function applyAll(model: Model, commands: Command[], meta: CommandMeta = {}): ApplyResult {
  return apply(model, transaction(commands, meta))
}

/**
 * Every address this command writes, from its descriptor (ADR-0028), or
 * `undefined` for a type this build has no entry for — which a caller
 * comparing two steps should read as *anything at all*, since a write set
 * too small is a silent overwrite and one too large is only a question.
 */
export function writesOf(command: Command): readonly WriteKey[] | undefined {
  const entry = entryOf(command.type)
  if (!entry) return undefined
  return entry.writes(command, (inner) => writesOf(inner) ?? [EVERYTHING])
}

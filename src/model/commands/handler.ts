// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What one command is to the one writer (ADR-0002): the shape every entry in
 * `table.ts` has, and the answers an entry may give.
 *
 * An entry is an object rather than a bare function so that what else is true
 * of one command — what it may carry, what it writes — can be said beside how
 * it is applied, in the same file and under the same key, and the table's
 * type keeps every command answered for.
 */
import type { Command, CommandMeta } from '../commands'
import type { Model } from '../normalised'

/**
 * Why a command was not carried out. A key the shell turns into words, and a
 * closed set — anything that is not one of these is a bug in the caller, not a
 * refusal to show somebody.
 */
export type CommandRefusal =
  | 'command.gone' | 'command.lastLandscape' | 'command.datesOutOfOrder'
  /** A landing whose ends do not sit under the interface's ends (ADR-0013). */
  | 'command.refinesEnds'
  /** A landing on a line that is itself a landing: an interface lands once. */
  | 'command.refinesLevel'
  /** Where an application with containers runs is its containers' to say (ADR-0013). */
  | 'command.hostedOnContainers'
  /** A `hostedOn` that is not application | component → platform (ADR-0014). */
  | 'command.technologyEnds'
  /**
   * A create on an id the model already holds.
   *
   * A create used to upsert, which is silent and is only ever right by
   * accident: an id comes from `idPolicy`, which mints against what is taken,
   * so a create that lands on something is a create built against a model that
   * has moved on — another author took the id, or a step is being replayed on
   * a model that already has it. Overwriting a record nobody asked about is
   * the one outcome that loses work, so it is refused and the caller mints
   * again. Putting a record BACK is `at`-carrying and only ever runs where the
   * id is free, which is why the inverses are unaffected.
   */
  | 'command.taken'

export type ApplyResult =
  | { ok: true; model: Model; inverse: Command }
  | { ok: false; reason: CommandRefusal }

export type Refused = Extract<ApplyResult, { ok: false }>

export const gone = { ok: false, reason: 'command.gone' } as const
export const outOfOrder = { ok: false, reason: 'command.datesOutOfOrder' } as const
export const taken = { ok: false, reason: 'command.taken' } as const

/** Every kind of command there is, as the table is keyed. */
export type CommandType = Command['type']

/** The one command of that kind, narrowed. */
export type CommandOf<K extends CommandType> = Extract<Command, { type: K }>

/**
 * What an entry is handed beside the model and the command: the meta the
 * outermost command carried, which every inverse carries back, and the
 * writer itself — for the two commands that are made of other commands.
 */
export type Context = {
  meta: CommandMeta
  apply: (model: Model, command: Command) => ApplyResult
}

export type Handler<K extends CommandType> = (model: Model, command: CommandOf<K>, context: Context) => ApplyResult

export type CommandEntry<K extends CommandType> = {
  /** The model that results, and the command that undoes it — or the refusal. */
  apply: Handler<K>
}

/**
 * One entry per kind of command. Missing a kind is a type error where the
 * table is written; a family file answers for a slice of it.
 */
export type CommandTable = { [K in CommandType]: CommandEntry<K> }

/** The model that resulted, with the inverse carrying the meta the command came with. */
export function ok(next: Model, inverse: Command, meta: CommandMeta): ApplyResult {
  return { ok: true, model: next, inverse: { ...inverse, ...meta } }
}

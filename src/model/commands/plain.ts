// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The three moves most lists of records have, written once (ADR-0050): a
 * record added, patched and removed, each the others' inverse.
 *
 * A family file used to write the three entries out for its list — the same
 * forty lines but for the list's name, the word its `add` carries the record
 * under, and whatever the one writer refuses of it. Those are what a family
 * says now: the list, whose kind and payload the descriptor names
 * (`recordKinds.ts`), the keys a patch may name, and its refusal. The entries
 * that come back are the ones the table is typed to hold, so a family built
 * here is checked exactly as one written out.
 *
 * What is not plain stays written out: a command that takes other records
 * with it, a mark that is never patched, a comment's tombstone.
 */
import type { Command } from '../commands'
import type { Model } from '../normalised'
import { KINDS } from '../recordKinds'
import type { KindOf, PayloadOf, PlainList, RecordOf } from '../recordKinds'
import { gone, ok, taken } from './handler'
import type { CommandOf, CommandTable, CommandType, Context, PatchKeys, Refused } from './handler'
import { drop, patched, put, withRows } from './rows'
import type { Held } from './rows'
import { patchWrites } from './writes'

type AddOf<L extends PlainList> = Extract<CommandType, `${KindOf<L>}.add`>
type UpdateOf<L extends PlainList> = Extract<CommandType, `${KindOf<L>}.update`>
type RemoveOf<L extends PlainList> = Extract<CommandType, `${KindOf<L>}.remove`>

/** The three entries of one list: its slice of the table. */
export type PlainFamily<L extends PlainList> = Pick<CommandTable, AddOf<L> | UpdateOf<L> | RemoveOf<L>>

// The vocabulary held to what the descriptors say of it: a list said to be
// plain has the three commands, its `add` carrying the record under the
// payload named and its `update` a patch of that record. A list described as
// plain whose commands are another shape does not compile here.
type Is<Sent, Shape> = [Sent] extends [never] ? false : [Sent] extends [Shape] ? true : false
type Says<L extends PlainList> = [
  Is<CommandOf<AddOf<L>>, Record<PayloadOf<L>, RecordOf[L]>>,
  Is<CommandOf<UpdateOf<L>>, { id: string; patch: Partial<RecordOf[L]> }>,
  Is<CommandOf<RemoveOf<L>>, { id: string }>,
]
type Exactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never
const VOCABULARY_HOLDS: Exactly<{ [L in PlainList]: Says<L> }, { [L in PlainList]: [true, true, true] }> = true
void VOCABULARY_HOLDS

/** What a family says of its own: everything about the three moves that is not the same for every list. */
export type PlainRules<L extends PlainList> = {
  /** Every field of a record of the list but its id: the keys a patch may name. */
  fields: PatchKeys<UpdateOf<L>>
  /**
   * Why a record cannot be as it would be, or nothing: asked of one added,
   * and of one patched as the patch would leave it — handed the command, and
   * for a patch the record as it is held. Never asked of a removal.
   */
  refuses?: (
    model: Model, next: Held<L>, command: CommandOf<AddOf<L>> | CommandOf<UpdateOf<L>>, held?: Held<L>,
  ) => Refused | undefined
  /** What the `add` that undoes a removal carries beside the record and its place. */
  putBack?: Partial<CommandOf<AddOf<L>>>
}

// The three entries as this file writes them, before they are handed back
// under the types the table holds them to.
type Row = { id: string }
type Sent = { type: string; id: string; patch: object; at?: number } & Record<string, unknown>

export function plainFamily<L extends PlainList>(list: L, rules: PlainRules<L>): PlainFamily<L> {
  const kind: string = KINDS[list].kind
  const { payload } = KINDS[list].commands as { payload: string }
  const rowsOf = (model: Model) => (model[list] ?? {}) as Record<string, Row>
  const landed = (model: Model, rows: { by: Record<string, Row>; order: string[] }) => withRows(model, list, rows as never)
  const refuses = rules.refuses as ((model: Model, next: Row, command: Sent, held?: Row) => Refused | undefined) | undefined
  const family = {
    [`${kind}.add`]: {
      carries: { [payload]: true },
      writes: (command: Sent) => [`${kind}/${(command[payload] as Row).id}`],
      apply(model: Model, command: Sent, { meta }: Context) {
        const row = command[payload] as Row
        if (row.id in rowsOf(model)) return taken
        const refused = refuses?.(model, row, command)
        if (refused) return refused
        const rows = put(rowsOf(model), model.order[list], row.id, row, command.at)
        return ok(landed(model, rows), { type: `${kind}.remove`, id: row.id } as Command, meta)
      },
    },

    [`${kind}.update`]: {
      carries: { id: true, patch: true },
      patch: { keys: rules.fields, row: (model: Model, command: Sent) => rowsOf(model)[command.id] },
      writes: (command: Sent) => patchWrites(`${kind}/${command.id}`, command.patch),
      apply(model: Model, command: Sent, { meta }: Context) {
        const held = rowsOf(model)[command.id] as Row | undefined
        if (!held) return gone
        const { row, inverse } = patched(held, command.patch)
        const refused = refuses?.(model, row, command, held)
        if (refused) return refused
        const rows = put(rowsOf(model), model.order[list], command.id, row)
        return ok(landed(model, rows), { type: `${kind}.update`, id: command.id, patch: inverse } as Command, meta)
      },
    },

    [`${kind}.remove`]: {
      carries: { id: true },
      writes: (command: Sent) => [`${kind}/${command.id}`],
      apply(model: Model, command: Sent, { meta }: Context) {
        const held = rowsOf(model)[command.id] as Row | undefined
        if (!held) return gone
        const at = model.order[list].indexOf(command.id)
        const rows = drop(rowsOf(model), model.order[list], command.id)
        return ok(landed(model, rows), { type: `${kind}.add`, [payload]: held, at, ...rules.putBack } as Command, meta)
      },
    },
  }
  return family as unknown as PlainFamily<L>
}

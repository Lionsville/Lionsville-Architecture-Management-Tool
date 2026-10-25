// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What one command is to the one writer (ADR-0002): the shape every entry in
 * `table.ts` has, and the answers an entry may give.
 *
 * An entry is an object rather than a bare function so that what else is true
 * of one command can be said beside how it is applied, in the same file and
 * under the same key, and the table's type keeps every command answered for.
 * That else is its **descriptor** (ADR-0028): the fields it carries, the keys
 * its patch may carry, what it writes and who may write it. A command without
 * one does not compile, and a reader that needs to know any of the four — a
 * door checking what arrived, a channel deciding whether two steps touch the
 * same thing — reads it here rather than keeping a list of its own.
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
  /** An `interacts` that is not actor → another actor, or names no mode of the three (ADR-0036 §7). */
  | 'command.interactsEnds'
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
  /**
   * A patch naming a key its command may not carry (ADR-0028).
   *
   * A patch is spread over the record it lands on, so a key outside the
   * record's own is a field the model does not have — or, on the scope's own
   * settings, a whole list replaced: `elements` in a settings patch was once
   * the landscape, emptied. Refused whole, the way a transaction that refuses
   * anywhere changes nothing; a key that only says what the record already
   * says is not a write and is let through, because a patch built as a whole
   * row's replacement names every key the row happens to hold.
   */
  | 'command.notAField'
  /**
   * The owner's detail, written on a stand-in (ADR-0012 §10, ADR-0028).
   *
   * The rule `projects/mayEdit.ts` says for a screen and an agent, asked by a
   * writer that has nobody in front of it: a stand-in's lifecycle, dates,
   * vendor and the rest are the defining scope's, and so are its two caches
   * and its description. Answered by {@link CommandDescriptor.guard}, which
   * `applyGuarded` runs and `apply` does not.
   */
  | 'command.ownedElsewhere'
  /**
   * A cause made a root cause while another cause explains it (ADR-0032 §3):
   * a root cause ends the chain. Unlink the deeper cause, or make that one the
   * root cause instead.
   */
  | 'command.rootExplained'
  /**
   * Who recorded an observation changed after it was recorded (ADR-0038,
   * amended §10): it is written once, from whoever recorded it, and never
   * after.
   */
  | 'command.recordedByFixed'
  /** A principle with no aspect (ADR-0041 §2): one idea says at least one thing. */
  | 'command.aspectsEmpty'
  /** An aspect numbered twice, or past the highest ever given (ADR-0041 §2): a number is never given again. */
  | 'command.aspectNumber'
  /** A principle with no title. */
  | 'command.titleEmpty'
  /** An accepted principle's statement or aspects changed without the note that says why (ADR-0041 §4). */
  | 'command.sharpenNote'
  /** A scope's groups of principles with one unnamed, or an id said twice (ADR-0041 §3). */
  | 'command.badGroups'
  /** A kind that does not cite, or a stance it may not take (ADR-0041 §7, `model/citable.ts`). */
  | 'command.notCitable'
  /** A departure from a principle without its reason (ADR-0041 §7). */
  | 'command.reasonMissing'
  /** A building block's fields that do not hold together, or on an element that is no building block (ADR-0043 §2, §3). */
  | 'command.badBlock'
  /** An evaluation not named by its block, a level off the balls, or a choice it does not weigh (ADR-0043 §4). */
  | 'command.badEvaluation'
  /**
   * A root cause made a cause again while a solution addresses it (ADR-0032
   * §3): a solution addresses root causes only (ADR-0026). Move the solution
   * to another root cause, or unlink it, first.
   */
  | 'command.rootAddressed'
  /**
   * A fix marked as intended (ADR-0036, amended 11 October 2026): only a
   * review or a note can be, because a fix says the model contradicts itself
   * and the answer to that is in the model. Refused too for a check the
   * catalogue does not know, which nobody here can say the weight of.
   */
  | 'command.markFix'
  /**
   * A comment about a kind of record that is not commented on (ADR-0037 §3):
   * `model/commentable.ts` says which are.
   */
  | 'command.notCommentable'
  /** A comment about a record the scope does not hold (ADR-0037 §3). */
  | 'command.unknownRecord'
  /**
   * A reply that answers a reply, or a comment about another record, or one
   * the scope does not hold (ADR-0037 §4): a thread is one level deep.
   */
  | 'command.badReply'
  /** A comment removed, updated or removed again (ADR-0037 §5): a tombstone stays as it is. */
  | 'command.commentRemoved'

/**
 * Whether a refusal is one of the reducer's.
 *
 * A channel may refuse with a key of its own, and that key is deliberately
 * not one of these (`ports/CommandChannel.ts`). Callers that repair a
 * reducer's refusal one way and a channel's another tell them apart here.
 */
const COMMAND_REFUSALS: Record<CommandRefusal, true> = {
  'command.gone': true,
  'command.lastLandscape': true,
  'command.datesOutOfOrder': true,
  'command.refinesEnds': true,
  'command.refinesLevel': true,
  'command.hostedOnContainers': true,
  'command.technologyEnds': true,
  'command.interactsEnds': true,
  'command.taken': true,
  'command.notAField': true,
  'command.ownedElsewhere': true,
  'command.rootExplained': true,
  'command.recordedByFixed': true,
  'command.aspectsEmpty': true,
  'command.aspectNumber': true,
  'command.titleEmpty': true,
  'command.sharpenNote': true,
  'command.badGroups': true,
  'command.notCitable': true,
  'command.reasonMissing': true,
  'command.badBlock': true,
  'command.badEvaluation': true,
  'command.rootAddressed': true,
  'command.markFix': true,
  'command.notCommentable': true,
  'command.unknownRecord': true,
  'command.badReply': true,
  'command.commentRemoved': true,
}

export function isCommandRefusal(value: string): value is CommandRefusal {
  return Object.hasOwn(COMMAND_REFUSALS, value)
}

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

/**
 * The fields a command of this kind must carry beside its `type`, as the keys
 * of an object: every required field of the command's shape, and nothing
 * else — the optional ones (`at`, and the meta every command may carry) are
 * not a command's own. Typed from the union, so a field added to a command
 * and not said here, or said here and not on the command, fails to compile.
 */
export type Carries<K extends CommandType> = {
  [F in keyof CommandOf<K> as F extends 'type'
    ? never
    : Pick<CommandOf<K>, F> extends Required<Pick<CommandOf<K>, F>> ? F : never]-?: true
}

/** The patch a command of this kind carries, where it carries one. */
export type PatchOf<K extends CommandType> = CommandOf<K> extends { patch: infer P } ? P : never

/**
 * Every key a patch of this kind may name, as the keys of an object — exactly
 * the patch type's own, less `id`: a record's id is its key, and the one patch
 * that names it, a whole row's replacement, names the id it already has
 * (which {@link CommandDescriptor.patch} lets through as saying nothing).
 */
export type PatchKeys<K extends CommandType> = {
  [F in Exclude<keyof Required<PatchOf<K>>, 'id'>]: true
}

/** What a patch may name, and the record it lands on — to tell a write from a restatement. */
export type PatchRule<K extends CommandType> = {
  keys: PatchKeys<K>
  /** The record the patch is spread over, or nothing where it is gone (the entry answers that). */
  row: (model: Model, command: CommandOf<K>) => object | undefined
}

/**
 * One thing a step writes, as a path: `element/crews/name`,
 * `diagram/l7/node/crews`, `decision/adr-1`.
 *
 * A path rather than an opaque key so that coarse and fine addresses can be
 * compared: an address is in the way of another when one is a prefix of the
 * other on a segment boundary. `element/crews` (a delete) is in the way of
 * `element/crews/name` (a rename); `element/crews/name` is not in the way of
 * `element/crews/lifecycle`.
 */
export type WriteKey = string

/**
 * What one command says about itself, beside how it is applied (ADR-0028).
 *
 * - **`carries`** — the fields it must have. What a door that receives
 *   commands from elsewhere checks is there before anything reads one.
 * - **`patch`** — for the commands that carry a patch, the keys it may
 *   name. The one writer refuses any other (`command.notAField`).
 * - **`writes`** — the addresses it writes, from the command alone and never
 *   the model: granular where the command is (a patch names its fields, a drag
 *   its node), the whole record where it is coarse (a delete). Two steps whose
 *   addresses overlap touched the same thing. `inner` is the same question of
 *   a command inside this one, for the two made of others.
 * - **`guard`** — who may write it, where a rule says: a refusal or nothing,
 *   against the model the command is about to land on.
 */
export type CommandDescriptor<K extends CommandType> = {
  carries: Carries<K>
  writes: (command: CommandOf<K>, inner: (command: Command) => readonly WriteKey[]) => readonly WriteKey[]
  guard?: (model: Model, command: CommandOf<K>) => CommandRefusal | undefined
} & ([PatchOf<K>] extends [never] ? { patch?: never } : { patch: PatchRule<K> })

export type CommandEntry<K extends CommandType> = CommandDescriptor<K> & {
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

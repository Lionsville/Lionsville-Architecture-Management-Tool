// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Every kind of record a scope holds, described once (ADR-0050).
 *
 * A kind of record is a list on the model — a key of `ModelOrder` — and what
 * is the same about it wherever it is read: the list it is kept in, the word
 * its records are named by, and how one says its id. Those were said again in
 * each table that has a line per list; here they are said once, and the
 * tables that only repeated them are derived from this one
 * (`recordKey.ts`'s kinds and lists first).
 *
 * The table is typed over the model's lists, so **a list with no entry does
 * not compile**: adding a list to `ModelOrder` fails here before it fails
 * anywhere else, and what is derived follows from the entry written to fix it.
 *
 * What a kind has of its own stays where it is — its type, its rules, what it
 * says to a search — and what only one layer knows stays in that layer, in a
 * table of its own over the same keys: this file names no file and no folder,
 * and no word of the agent's vocabulary.
 *
 * It imports the kinds' own files and nothing that reads it, so every table
 * in the model may be derived from it without a loop.
 */
import type { Adr } from './adr'
import { checkMarkId } from './checkMarks'
import type { CheckMark } from './checkMarks'
import type { Citation } from './citable'
import type { Comment } from './comment'
import type { Evaluation } from './evaluation'
import type { ModelOrder } from './normalised'
import type { Cause, Experiment, Observation, Solution } from './observation'
import type { OperatingRule, Responsibility, Role, UnitType } from './operatingModel'
import type { Principle } from './principle'
import type { RecordKey } from './recordKey'
import type { Transition } from './transition'
import type { DesignDiagram, DesignElement, Relation } from './types'
import type { Assignment } from './units'

/** A list the model keeps its records in: a key of `ModelOrder`. */
export type RecordList = keyof ModelOrder

/** The record each list holds, as the file has it. */
export type RecordOf = {
  elements: DesignElement
  relations: Relation
  diagrams: DesignDiagram
  decisions: Adr
  transitions: Transition
  observations: Observation
  causes: Cause
  solutions: Solution
  experiments: Experiment
  unitTypes: UnitType
  roles: Role
  responsibilities: Responsibility
  operatingRules: OperatingRule
  assignments: Assignment
  checkMarks: CheckMark
  comments: Comment
  principles: Principle
  citations: Citation
  evaluations: Evaluation
}

// A list here that the model does not keep is a line nobody reads: the other
// half of the check the table's own type makes.
type Exactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never
const LISTS_MATCH: Exactly<keyof RecordOf, RecordList> = true
void LISTS_MATCH

/** What is said once about the records of one list. */
export type KindDescriptor<L extends RecordList> = {
  /** The list on the model, which is also this entry's key. */
  readonly list: L
  /**
   * The word one record of the list is named by: its kind in a record key
   * (`recordKey.ts`), and the first word of its commands and of what they
   * write (`decision.add`, `decision/adr-1`).
   */
  readonly kind: string
  /** A record's id: its own `id` for every list but the marks, whose id is worked out. */
  readonly idOf: (record: RecordOf[L]) => string
  /**
   * Whether absence is not emptiness for this list: optional in the file, so
   * one the file did not carry comes back absent, and one emptied is gone
   * rather than present and empty. True of every list but the three a
   * landscape always has.
   */
  readonly absentWhenEmpty: boolean
  /**
   * How its records are written. The plain three — `<kind>.add` carrying the
   * record under `payload`, `<kind>.update` an id and a patch, `<kind>.remove`
   * an id, each the others' inverse — or `'own'` where its commands are
   * another shape: an element's and a view's, a mark's two, a comment's five.
   * `commands/plain.ts` holds the vocabulary to what is said here.
   */
  readonly commands: 'own' | { readonly payload: string }
  /**
   * How a whole restore puts the list back (`restore.ts`). `'rows'`: each
   * record as it was, added or patched by what differs, in the order it was
   * kept, then those gone removed. `'list'`: the list handed back whole
   * (`listToCommands`), once every other record is back. `'own'`: the restore
   * says more of the kind than either — a locked decision kept, a thread put
   * back after its record. `'none'`: a whole restore leaves the list as it is.
   * The first two are a plain list's only.
   */
  readonly restore: 'rows' | 'list' | 'own' | 'none'
} & Compared<L>

/**
 * How two versions of the list are compared (`diff.ts`): record by record,
 * each change named by what `nameOf` answers — or `'own'` where the diff
 * says more than that of the kind: what a relation is, what came onto a view.
 */
type Compared<L extends RecordList> =
  | { readonly diff: 'own' }
  | { readonly diff: 'compare'; readonly nameOf: (record: RecordOf[L], around: NamedAround) => string }

/**
 * What a record named by another is named from: what the scope calls its
 * elements and its records, as whoever asks has them — a diff from whichever
 * version still holds the thing.
 */
export type NamedAround = {
  /** What an element is called, or nothing where it is not held. */
  readonly element: (id: string) => string | undefined
  /** What a record is called, by its key: its title or its name, or nothing where it is not held. */
  readonly record: (about: RecordKey) => string | undefined
}

/** One descriptor per list of the model: a list without one does not compile. */
export type KindTable = { readonly [L in RecordList]: KindDescriptor<L> }

const ownId = (record: { id: string }): string => record.id

export const KINDS = {
  elements: {
    list: 'elements', kind: 'element', idOf: ownId, absentWhenEmpty: false,
    commands: 'own',
    restore: 'own',
    diff: 'own',
  },
  relations: {
    list: 'relations', kind: 'relation', idOf: ownId, absentWhenEmpty: false,
    commands: 'own',
    restore: 'own',
    diff: 'own',
  },
  diagrams: {
    list: 'diagrams', kind: 'diagram', idOf: ownId, absentWhenEmpty: false,
    commands: 'own',
    restore: 'own',
    diff: 'own',
  },
  decisions: {
    list: 'decisions', kind: 'decision', idOf: ownId, absentWhenEmpty: true,
    commands: { payload: 'decision' },
    restore: 'own',
    diff: 'compare', nameOf: (held) => held.title,
  },
  transitions: {
    list: 'transitions', kind: 'transition', idOf: ownId, absentWhenEmpty: true,
    commands: { payload: 'transition' },
    restore: 'none',
    diff: 'compare', nameOf: (held) => held.title,
  },
  observations: {
    list: 'observations', kind: 'observation', idOf: ownId, absentWhenEmpty: true,
    commands: { payload: 'observation' },
    restore: 'rows',
    diff: 'compare', nameOf: (held) => held.title,
  },
  causes: {
    list: 'causes', kind: 'cause', idOf: ownId, absentWhenEmpty: true,
    commands: { payload: 'cause' },
    restore: 'rows',
    diff: 'compare', nameOf: (held) => held.title,
  },
  solutions: {
    list: 'solutions', kind: 'solution', idOf: ownId, absentWhenEmpty: true,
    commands: { payload: 'solution' },
    restore: 'rows',
    diff: 'compare', nameOf: (held) => held.title,
  },
  experiments: {
    list: 'experiments', kind: 'experiment', idOf: ownId, absentWhenEmpty: true,
    commands: { payload: 'experiment' },
    restore: 'rows',
    diff: 'compare', nameOf: (held) => held.title,
  },
  unitTypes: {
    list: 'unitTypes', kind: 'unitType', idOf: ownId, absentWhenEmpty: true,
    commands: { payload: 'unitType' },
    restore: 'rows',
    diff: 'compare', nameOf: (held) => held.name,
  },
  roles: {
    list: 'roles', kind: 'role', idOf: ownId, absentWhenEmpty: true,
    commands: { payload: 'role' },
    restore: 'rows',
    diff: 'compare', nameOf: (held) => held.name,
  },
  responsibilities: {
    list: 'responsibilities', kind: 'responsibility', idOf: ownId, absentWhenEmpty: true,
    commands: { payload: 'responsibility' },
    restore: 'rows',
    diff: 'compare', nameOf: (held) => held.name,
  },
  operatingRules: {
    list: 'operatingRules', kind: 'operatingRule', idOf: ownId, absentWhenEmpty: true,
    commands: { payload: 'rule' },
    restore: 'rows',
    // One rule per kind, so its kind is what it is called.
    diff: 'compare', nameOf: (held) => held.id,
  },
  assignments: {
    list: 'assignments', kind: 'assignment', idOf: ownId, absentWhenEmpty: true,
    commands: { payload: 'assignment' },
    restore: 'rows',
    // By the unit it is in: a line kept with the history never names the person (ADR-0036 §8).
    diff: 'compare', nameOf: (held, around) => around.element(held.unitId) ?? held.unitId,
  },
  // A mark has no id of its own: it is its check and the key of its subjects.
  checkMarks: {
    list: 'checkMarks', kind: 'checkMark', idOf: checkMarkId, absentWhenEmpty: true,
    commands: 'own',
    restore: 'own',
    diff: 'own',
  },
  comments: {
    list: 'comments', kind: 'comment', idOf: ownId, absentWhenEmpty: true,
    commands: 'own',
    restore: 'own',
    // By the record it is about, as the scope calls it: a line never names the author, who is a register id (ADR-0036 §8).
    diff: 'compare', nameOf: (held, around) => around.record(held.about) ?? held.about.id,
  },
  principles: {
    list: 'principles', kind: 'principle', idOf: ownId, absentWhenEmpty: true,
    commands: { payload: 'principle' },
    restore: 'rows',
    diff: 'compare', nameOf: (held) => held.title,
  },
  citations: {
    list: 'citations', kind: 'citation', idOf: ownId, absentWhenEmpty: true,
    commands: { payload: 'citation' },
    restore: 'own',
    // By the record that cites, as the scope calls it.
    diff: 'compare', nameOf: (held, around) => around.record(held.about) ?? held.about.id,
  },
  evaluations: {
    list: 'evaluations', kind: 'evaluation', idOf: ownId, absentWhenEmpty: true,
    commands: { payload: 'evaluation' },
    restore: 'list',
    // By the block, where this scope knows it.
    diff: 'compare', nameOf: (held, around) => around.element(held.block.id) ?? held.block.id,
  },
} as const satisfies KindTable

/** The lists, in the order the model keeps them. */
export const RECORD_LIST_NAMES = Object.keys(KINDS) as RecordList[]

/** The lists the file may leave out, in the same order. */
export const OPTIONAL_LISTS = RECORD_LIST_NAMES.filter((list) => KINDS[list].absentWhenEmpty)

/** The table as its type says it, for a reader that takes a list it does not know by name. */
export const KIND_TABLE: KindTable = KINDS

/** The kind one list's records are named by, as a type. */
export type KindOf<L extends RecordList> = (typeof KINDS)[L]['kind']

/** The lists whose records are written by the plain three commands. */
export type PlainList = { [L in RecordList]: (typeof KINDS)[L]['commands'] extends { payload: string } ? L : never }[RecordList]

/** The key a plain list's `add` carries its record under, as a type. */
export type PayloadOf<L extends PlainList> = (typeof KINDS)[L]['commands'] extends { payload: infer P extends string } ? P : never

/** Every kind of record the model keeps in a list. */
export type ListedKind = KindOf<RecordList>

/** Each kind and the list it is kept in, as a type: `{ element: 'elements', … }`. */
export type ListsByKind = { readonly [L in RecordList as KindOf<L>]: L }

/** Each kind and the list it is kept in. */
export const LISTS_BY_KIND = Object.fromEntries(
  RECORD_LIST_NAMES.map((list) => [KINDS[list].kind, list]),
) as ListsByKind

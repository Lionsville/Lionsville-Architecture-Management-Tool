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
}

/** One descriptor per list of the model: a list without one does not compile. */
export type KindTable = { readonly [L in RecordList]: KindDescriptor<L> }

const ownId = (record: { id: string }): string => record.id

export const KINDS = {
  elements: { list: 'elements', kind: 'element', idOf: ownId, absentWhenEmpty: false, commands: 'own' },
  relations: { list: 'relations', kind: 'relation', idOf: ownId, absentWhenEmpty: false, commands: 'own' },
  diagrams: { list: 'diagrams', kind: 'diagram', idOf: ownId, absentWhenEmpty: false, commands: 'own' },
  decisions: { list: 'decisions', kind: 'decision', idOf: ownId, absentWhenEmpty: true, commands: { payload: 'decision' } },
  transitions: { list: 'transitions', kind: 'transition', idOf: ownId, absentWhenEmpty: true, commands: { payload: 'transition' } },
  observations: { list: 'observations', kind: 'observation', idOf: ownId, absentWhenEmpty: true, commands: { payload: 'observation' } },
  causes: { list: 'causes', kind: 'cause', idOf: ownId, absentWhenEmpty: true, commands: { payload: 'cause' } },
  solutions: { list: 'solutions', kind: 'solution', idOf: ownId, absentWhenEmpty: true, commands: { payload: 'solution' } },
  experiments: { list: 'experiments', kind: 'experiment', idOf: ownId, absentWhenEmpty: true, commands: { payload: 'experiment' } },
  unitTypes: { list: 'unitTypes', kind: 'unitType', idOf: ownId, absentWhenEmpty: true, commands: { payload: 'unitType' } },
  roles: { list: 'roles', kind: 'role', idOf: ownId, absentWhenEmpty: true, commands: { payload: 'role' } },
  responsibilities: { list: 'responsibilities', kind: 'responsibility', idOf: ownId, absentWhenEmpty: true, commands: { payload: 'responsibility' } },
  operatingRules: { list: 'operatingRules', kind: 'operatingRule', idOf: ownId, absentWhenEmpty: true, commands: { payload: 'rule' } },
  assignments: { list: 'assignments', kind: 'assignment', idOf: ownId, absentWhenEmpty: true, commands: { payload: 'assignment' } },
  // A mark has no id of its own: it is its check and the key of its subjects.
  checkMarks: { list: 'checkMarks', kind: 'checkMark', idOf: checkMarkId, absentWhenEmpty: true, commands: 'own' },
  comments: { list: 'comments', kind: 'comment', idOf: ownId, absentWhenEmpty: true, commands: 'own' },
  principles: { list: 'principles', kind: 'principle', idOf: ownId, absentWhenEmpty: true, commands: { payload: 'principle' } },
  citations: { list: 'citations', kind: 'citation', idOf: ownId, absentWhenEmpty: true, commands: { payload: 'citation' } },
  evaluations: { list: 'evaluations', kind: 'evaluation', idOf: ownId, absentWhenEmpty: true, commands: { payload: 'evaluation' } },
} as const satisfies KindTable

/** The lists, in the order the model keeps them. */
export const RECORD_LIST_NAMES = Object.keys(KINDS) as RecordList[]

/** The lists the file may leave out, in the same order. */
export const OPTIONAL_LISTS = RECORD_LIST_NAMES.filter((list) => KINDS[list].absentWhenEmpty)

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

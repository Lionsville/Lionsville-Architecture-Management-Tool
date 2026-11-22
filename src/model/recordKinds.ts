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
}

/** One descriptor per list of the model: a list without one does not compile. */
export type KindTable = { readonly [L in RecordList]: KindDescriptor<L> }

const ownId = (record: { id: string }): string => record.id

export const KINDS = {
  elements: { list: 'elements', kind: 'element', idOf: ownId },
  relations: { list: 'relations', kind: 'relation', idOf: ownId },
  diagrams: { list: 'diagrams', kind: 'diagram', idOf: ownId },
  decisions: { list: 'decisions', kind: 'decision', idOf: ownId },
  transitions: { list: 'transitions', kind: 'transition', idOf: ownId },
  observations: { list: 'observations', kind: 'observation', idOf: ownId },
  causes: { list: 'causes', kind: 'cause', idOf: ownId },
  solutions: { list: 'solutions', kind: 'solution', idOf: ownId },
  experiments: { list: 'experiments', kind: 'experiment', idOf: ownId },
  unitTypes: { list: 'unitTypes', kind: 'unitType', idOf: ownId },
  roles: { list: 'roles', kind: 'role', idOf: ownId },
  responsibilities: { list: 'responsibilities', kind: 'responsibility', idOf: ownId },
  operatingRules: { list: 'operatingRules', kind: 'operatingRule', idOf: ownId },
  assignments: { list: 'assignments', kind: 'assignment', idOf: ownId },
  // A mark has no id of its own: it is its check and the key of its subjects.
  checkMarks: { list: 'checkMarks', kind: 'checkMark', idOf: checkMarkId },
  comments: { list: 'comments', kind: 'comment', idOf: ownId },
  principles: { list: 'principles', kind: 'principle', idOf: ownId },
  citations: { list: 'citations', kind: 'citation', idOf: ownId },
  evaluations: { list: 'evaluations', kind: 'evaluation', idOf: ownId },
} as const satisfies KindTable

/** The lists, in the order the model keeps them. */
export const RECORD_LIST_NAMES = Object.keys(KINDS) as RecordList[]

/** The kind one list's records are named by, as a type. */
export type KindOf<L extends RecordList> = (typeof KINDS)[L]['kind']

/** Every kind of record the model keeps in a list. */
export type ListedKind = KindOf<RecordList>

/** Each kind and the list it is kept in, as a type: `{ element: 'elements', … }`. */
export type ListsByKind = { readonly [L in RecordList as KindOf<L>]: L }

/** Each kind and the list it is kept in. */
export const LISTS_BY_KIND = Object.fromEntries(
  RECORD_LIST_NAMES.map((list) => [KINDS[list].kind, list]),
) as ListsByKind

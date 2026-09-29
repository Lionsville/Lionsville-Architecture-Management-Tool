// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The scopes of one source: the tree they make, each one's state, and the
 * steps that change them (ADR-0031 §1).
 *
 * The seam the domain reads and writes scopes through, in the domain's own
 * words and no others. Whatever keeps the work — a person's own machine, this
 * browser, memory, a service — implements this, and the domain never learns
 * which: it names scopes, records, steps and revisions, and nothing about how
 * any of them is kept.
 *
 * **Written for the richest implementation, not the simplest.** An
 * implementation that can index, page and answer at the level of a record
 * answers every member here directly; one that cannot does more work itself to
 * answer the same. Nothing here is narrowed to what is easy for one of them.
 *
 * **Every write is a step or a change to the tree.** A scope's state changes
 * only by steps (ADR-0002), applied by the same reducer a session applies them
 * with, so a state kept here and a model held by a session that applied the
 * same steps are the same. The tree changes only by creating, moving and
 * removing a scope. There is no whole write: nothing here can put a state
 * over another that nobody read.
 *
 * **A refusal is an answer, never a failure.** Everything a person or a
 * caller can do something about — the scope moved since it was read, the
 * address is taken, the step refers to something gone — comes back as a
 * value with a key (`projects/scopeState.ts`, `SCOPE_REFUSALS`), and nothing
 * is written. A promise rejects only where the implementation itself could not
 * answer.
 *
 * `ScopeRepository.contract.ts`, beside this seam, is the behaviour every
 * implementation must show.
 */
import type { ScopeKind } from '../projects/scope'
import type { RecordLink } from '../projects/links'
import type {
  Revision, ScopeAddress, ScopeDescription, ScopeId, ScopeRefusal, ScopeState, ScopeStep,
} from '../projects/scopeState'

/**
 * One scope in the tree: what a screen shows about it without reading its
 * state, and the scopes under it.
 */
export type ScopeNode = {
  id: ScopeId
  address: ScopeAddress
  /** The scope it is filed under; absent for the organisation, which is the root. */
  parent?: ScopeId
  /** What it is called — its model's name. */
  name: string
  kind?: ScopeKind
  client?: string
  /** Its model's description. */
  description?: string
  links?: RecordLink[]
  /** How many views it holds. Zero is ordinary: a domain need draw nothing. */
  diagrams: number
  /**
   * ISO time of the last step applied to it, where the repository keeps one.
   * The one field the tree's revision does not cover: it moves with every
   * step, and a tree whose revision did too would be read again after every
   * step anybody makes. A reader that wants it fresh reads the tree again.
   */
  updatedAt?: string
  /** The scopes directly under it, by address. */
  children: ScopeNode[]
}

/** The whole tree, and the revision it was answered at. */
export type ScopeTree = {
  /**
   * Changes whenever what a node says changes — a scope created, moved or
   * removed, or a step that changes its name, description, what it says about
   * itself or how many views it holds — and at no other time: not for a step
   * that changes none of those, and not for `updatedAt`. Equal for two reads
   * with none of those between them.
   */
  revision: Revision
  /** The organisation. It is always there, and has no parent. */
  root: ScopeNode
  /**
   * Addresses where the repository holds a scope it could not read enough of
   * to put in the tree, in its own words; absent when there are none. An
   * address listed here is not free, and a scope created there is refused.
   */
  unreadable?: readonly ScopeAddress[]
}

/** Steps for one scope, and what its state is expected to be when they land. */
export type StepsFor = {
  scope: ScopeId
  steps: readonly ScopeStep[]
  /**
   * The revision the steps were made against. Where it is given and the scope
   * is no longer at it, nothing is applied and the answer is `shell.scopeMoved`.
   * Without it the steps land on whatever the scope holds now, which is what a
   * session whose steps a command channel already put in order asks for.
   */
  expects?: Revision
}

/** What a refusal says: the key, and the scope and step it was met at where there was one. */
export type Refused = { refused: ScopeRefusal; scope?: ScopeId; stepId?: string }

/** Steps applied: each scope's revision after them, in the order they were given. */
export type Applied = { revisions: readonly Revision[] }

export type Created = { id: ScopeId; revision: Revision }

export type Moved = { revision: Revision }

/** Every scope removed: the one named and everything that was filed under it. */
export type Removed = { removed: readonly ScopeId[] }

/** What a new scope is told about itself: its name, and what it says about itself. */
export type NewScope = ScopeDescription & { name: string }

export interface ScopeRepository {
  /** Which repository this is, in plain words, for a message and the trail to name. */
  readonly id: string

  /** Every scope, as the tree it is. Always answers: the organisation is always there. */
  tree(): Promise<ScopeTree>

  /**
   * One scope's state, with its revision; `undefined` when no scope has that
   * identity. Reading a scope reads its records, its documents and its image
   * library's entries, and never a picture's bytes.
   */
  state(scope: ScopeId): Promise<ScopeState | undefined>

  /**
   * Apply steps to one scope, or to several together: every step of every
   * scope, or — where anything is refused — none of them, and the answer says
   * which scope and which step. The steps of one scope are applied in the order
   * given, as one change of its state. A refused apply changes nothing
   * anywhere: no state, no revision of a scope, the tree or the index, and no
   * step counts as applied — sent again, it is new.
   *
   * **A step lands once.** A `stepId` names one step in the whole source. One
   * this repository has already applied to this scope is not applied again: it
   * was sent twice because the answer to the first was lost. One it applied to
   * another scope is refused, `step.elsewhere` with the step named, and nothing
   * is applied: a caller told its step landed would believe a scope changed
   * that did not. **Applied ids are remembered for at least 24 hours**; a
   * repository that keeps a log of its steps remembers them for as long as the
   * log. Past that, a step sent again is a new step. A run
   * whose steps have all landed answers each scope's revision as it stands,
   * whatever it `expects`, because what it expected was the state it was made
   * against, and it has been applied to that. A run that mixes steps already
   * landed with new ones applies the new ones, and its `expects` is compared
   * with the state now. The same `stepId` twice in one run is the same step
   * sent twice, and lands once.
   *
   * **One scope named twice in one apply** is its runs one after the other,
   * as one change: each `expects` is compared with the revision the scope had
   * before the apply, both answer the revision after the whole apply, and a
   * second run that undoes the first leaves the scope, and its revision, as
   * they were.
   *
   * **A step that changes nothing changes no revision**, and makes no history
   * entry.
   */
  apply(work: readonly StepsFor[]): Promise<Applied | Refused>

  /**
   * A new scope at an address, with a new identity and an empty model named
   * as it is told. The scopes above it that are not there are created too,
   * each named after its own last address segment: a scope filed under nothing
   * would be addressed by nothing. `shell.scopeTaken` where a scope is at the
   * address already — the organisation included — and `shell.badScopePath`
   * for an address no scope may have.
   */
  create(at: ScopeAddress, scope: NewScope): Promise<Created | Refused>

  /**
   * A scope, and everything filed under it, to another address. Every one
   * keeps its identity, its state, its history, its image library and its
   * settings; only the addresses change. The scopes above the new address that
   * are not there are created, as `create` creates them.
   *
   * `expects` is the revision of the moved scope the move was decided against,
   * as for a step. Refused: the organisation, which is the root and stays
   * there; an address under the scope itself; an address taken or unusable.
   *
   * **A move changes the revision of the moved scope and of every scope under
   * it**, because an address is part of a state: a step made against one of
   * them before the move, and expecting that, is refused. No other scope's
   * revision moves. The answer is the moved scope's revision after the move.
   *
   * **A move is an entry in the history of every scope it moved**
   * (`HistoryEntry.moved`): who moved it, when, and from which address to
   * which, read by the scope's identity like any other of its entries. It
   * closes the scope's open entry, whatever steps were open going with it.
   * Recorded wherever the source keeps a history; one it has not started
   * yet is not started for a move.
   */
  move(scope: ScopeId, to: ScopeAddress, expects?: Revision): Promise<Moved | Refused>

  /**
   * A scope and everything filed under it, gone. A child left behind by a
   * removed parent would be addressed by nothing.
   *
   * `expects` as for a move; where the scope is no longer there, there is
   * nothing to lose, and the answer is that nothing was removed. The
   * organisation is refused: it is the root, not something to throw away.
   */
  remove(scope: ScopeId, expects?: Revision): Promise<Removed | Refused>
}

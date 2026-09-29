// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the scopes of one source were, and when (ADR-0031 §1; ADR-0008).
 *
 * **Entries, not steps.** A step is one command; a history is read by a person,
 * who wants the Tuesday afternoon somebody reworked the landscape as one line
 * and not as four hundred. An entry is a run of steps on one scope that the
 * implementation took together — what it recorded as one version, or what one
 * author did before a quiet moment. The steps `ScopeRepository` applies to a
 * scope collect in its **open entry**, and an implementation may close one
 * when it judges a run has ended; a person closes it when they say so —
 * *Snapshot*, with what it is called — and the app closes it before a change
 * it wants to be able to go back from, such as a replace. `record` is that
 * act. A step that changes nothing opens no entry.
 *
 * **A history is asked in pages**, newest first, of one scope or of several,
 * and of everything or of one thing — a record, by its kind and id
 * (`model/recordKey.ts`). A thing's history across several scopes is how an
 * element's page reads its history: the scope that answers for the element
 * and every scope that draws it (ADR-0012 §7).
 *
 * **A history follows the identity.** A scope moved keeps its entries; a scope
 * created where a removed one was starts with none.
 *
 * **Going back is a step.** The state at an entry is read here; making the
 * present equal it is the model's own `restore` command, applied through
 * `ScopeRepository` like any other step, so the history only ever grows.
 *
 * `HistoryRepository.contract.ts`, beside this seam, is the behaviour every
 * implementation must show.
 */
import type { LabelOutcome } from '../platform/history'
import type { RecordKey } from '../model/recordKey'
import type { ScopeId, ScopeState } from '../projects/scopeState'

/** An entry's identity: opaque, and handed back to read that entry. */
export type EntryId = string

/** Where the next page starts: opaque, and handed back as it was answered. */
export type HistoryCursor = string

/** One entry, as a person reads a list of them. */
export type HistoryEntry = {
  id: EntryId
  scope: ScopeId
  /** When the last of its steps was made, epoch milliseconds. */
  at: number
  /** Who made it, in the repository's word: never a claim a sender made about itself. */
  by: string
  /** What the entry says it was, where somebody said. */
  subject?: string
  /** What people have called this version since (ADR-0008); usually none. */
  labels: readonly string[]
}

/** Which entries: of which scopes, about what, and from where. */
export type EntriesWanted = {
  /** One scope or several; entries of all of them, merged newest first. */
  scopes: readonly ScopeId[]
  /** Only the entries with a step that wrote this record. */
  record?: RecordKey
  /** At most this many. The repository may answer fewer, and says where to go on. */
  limit?: number
  /** A page on from the one that answered this. */
  after?: HistoryCursor
}

/** One page, newest first, and where the next starts; `next` is absent on the last. */
export type HistoryPage = {
  entries: readonly HistoryEntry[]
  next?: HistoryCursor
}

/** A label's outcome, or `gone` for an entry the scope does not have. */
export type EntryLabelled = LabelOutcome | 'gone'

/** Which open entries to close, and what the entries they become say they are. */
export type RecordWanted = {
  /** The scopes whose open entry to close; absent for every scope that has one. */
  scopes?: readonly ScopeId[]
  /** What each entry says it was: a person's words, or the app's for a safeguard. */
  subject?: string
}

export interface HistoryRepository {
  readonly id: string

  /**
   * Close the open entry of each scope wanted, now, with the subject given,
   * and answer the entries that became — newest first, one per scope that had
   * one open, and none for a scope that had nothing open: a record with
   * nothing to record is ordinary, not a failure.
   */
  record(wanted: RecordWanted): Promise<readonly HistoryEntry[]>

  /** A page of entries, newest first. */
  entries(wanted: EntriesWanted): Promise<HistoryPage>

  /**
   * The scope as it was when the entry was made: its state after the last of
   * its steps. `undefined` for an entry the scope does not have. The revision
   * on it is the one the scope had then: a step that expects it is refused
   * once the scope has moved on.
   */
  stateAt(scope: ScopeId, entry: EntryId): Promise<ScopeState | undefined>

  /**
   * Call an entry something, afterwards (ADR-0008): a mark beside it, never a
   * change to it. A scope's labels are its own and unique in it, by the
   * letters and digits that survive `labelSlug`: `exists` where one is taken,
   * `unnamed` where nothing of the name survives.
   */
  label(scope: ScopeId, entry: EntryId, name: string): Promise<EntryLabelled>
}

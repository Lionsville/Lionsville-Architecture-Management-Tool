// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * An organisation carried out as one run of bytes a person can hand to
 * somebody else, and brought in again (ADR-0018, ADR-0023, ADR-0031 §2).
 *
 * **Any source, one shape.** What the bytes hold is read out of the
 * repositories and written back into them, so memory, this browser and a
 * person's own machine all carry the same organisation out as the same
 * bytes, and take in what any of them carried. How the bytes are laid out is
 * the implementation's: the app asks for them through this seam, seals them
 * under a password and hands them to the person, and never reads inside.
 *
 * **Brought in whole, or not at all.** Every scope the bytes hold lands as one
 * `scope.replace` step on the scope at its address, all of them in one apply:
 * a scope somebody changed meanwhile refuses the whole. The pictures' bytes
 * are put before the step that names them, so no library ever names a
 * picture it cannot answer.
 *
 * **What arrived is checked.** The bytes carry an account of what they hold,
 * and what landed is read back and held to it, so a person is told which
 * scope, view or part did not arrive rather than *done*.
 */
import type { OpenRefusal, ScopeSnapshot } from '../projects/scope'
import type { ScopeAddress } from '../projects/scopeState'
import type { Repositories } from './Repositories'

/** What a person is handed: the bytes, what to call them, and what they are. */
export type Parcel = {
  name: string
  bytes: Uint8Array
  mediaType: string
}

/** A parcel carried out, and what it was made without. */
export type CarriedOut = Parcel & {
  /**
   * What the scopes were read without — a part of a scope that was there and
   * would not read — each as `<address>/<part>`. The parcel says so too.
   */
  without: readonly string[]
}

/** What to carry out, where not the whole organisation as it is held. */
export type CarryOptions = {
  /** The scope at the top; the organisation where absent. Every scope under it goes with it. */
  from?: ScopeAddress
  /**
   * Scopes as the caller holds them now, each in place of what is read at its
   * address — the scope open on a screen, with the edits it has not written
   * yet. One with no scope read at its address goes first.
   */
  held?: readonly ScopeSnapshot[]
}

/** What a parcel holds, placed at the address it was opened at. */
export type Opened = {
  /** The scope at its top, at the address asked for. */
  top: ScopeSnapshot
  /** The scopes under it, at their addresses under the top's; empty where it holds one. */
  rest: readonly ScopeSnapshot[]
  /** Scopes it holds, by address under its top, that would not open. */
  unopened: readonly ScopeAddress[]
  /** What the parcel says of itself, which only the implementation that opened it reads. */
  account?: unknown
}

/** A scope that did not arrive whole: by its address under the parcel's top. */
export type Shortfall = {
  address: ScopeAddress
  name: string
  /** The whole scope is not there. */
  absent: boolean
  /** The views that are not there. */
  views: readonly { id: string; name: string }[]
  /** How many of its parts are not there, and how many arrived changed. */
  missing: number
  changed: number
}

/** What a landing, read back, came to. */
export type Arrival = {
  /** The parcel carried its own account; otherwise it was held to what it opened to. */
  accounted: boolean
  /** Every scope it holds, by address under its top, with its name. */
  scopes: readonly { address: ScopeAddress; name: string }[]
  /** What it holds, counted. */
  totals: { scopes: number; views: number; parts: number }
  /** What did not arrive; absent where everything did. */
  short?: {
    scopes: readonly Shortfall[]
    /** What the parcel itself says it was made without, per scope. */
    omitted: readonly { address: ScopeAddress; parts: number }[]
  }
}

/** One scope as it now reads: what a landing is read back through. */
export type ReadBack = (address: ScopeAddress) => Promise<ScopeSnapshot | undefined>

/** What bringing in also records, where a history is kept. */
export type BringOptions = {
  /** The subject of an entry recorded of every scope about to be replaced, before anything is. */
  before?: string
  /** The subject of the entry each landed scope's replacing becomes. */
  subject?: string
}

export interface Interchange {
  /** What a person may be offered to pick, as a picker names kinds: every parcel this reads. */
  readonly accepts: string

  /**
   * The organisation, or the scope at `from` and every scope under it, read
   * out of the repositories — pictures and all — as one parcel. Refused, as
   * a `ShellError`, where a scope could not be read: a parcel without one of
   * its scopes, handed over as the organisation, is the loss this refuses.
   */
  carryOut(from: Pick<Repositories, 'scopes' | 'images'>, options?: CarryOptions): Promise<CarriedOut>

  /** What bytes hold, the top placed at `at`; or the key for bytes that are no parcel of this kind. */
  open(bytes: Uint8Array, at: ScopeAddress): Promise<Opened | { refused: OpenRefusal }>

  /**
   * What was opened, landed: the scopes not there made, each picture's bytes
   * put, then one `scope.replace` step per scope in one apply. Every scope or
   * none; the scopes made to hold them go again where the apply is refused.
   */
  bringIn(into: Pick<Repositories, 'scopes' | 'images' | 'history'>, opened: Opened, options?: BringOptions): Promise<void>

  /** What landed, read back through `read`, held to what the parcel says it holds. */
  check(opened: Opened, read: ReadBack): Promise<Arrival>
}

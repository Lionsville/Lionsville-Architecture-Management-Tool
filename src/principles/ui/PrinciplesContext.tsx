// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What every principles screen reads and writes through (ADR-0041): a scope's
 * own principles and groups, those in force at a scope — its own, those of
 * every scope above and of every topic relevant to it or a scope above — and
 * the citations. Handed down once by the shell, so a citable reader mounts
 * `<CitationsSection about />` and nothing else.
 *
 * `here` is the scope a reader stands in: the open scope in the workspace, a
 * home's scope on a home. With no provider, nothing is drawn.
 */
import { createContext, useContext, type ReactNode } from 'react'
import type {
  Citation, CitationRefusal, CitingRecord, Principle, PrincipleGroup, PrincipleRef, PrincipleRelation, PrincipleStatus,
} from '../principle'
import type { PrincipleDraft } from '../draft'
import type { PrincipleInForce } from '../suggest'

/** Where a principle in force comes from, as a reader says it. */
export type PrincipleSource = { kind: 'here' } | { kind: 'above'; scope: string } | { kind: 'topic'; scope: string }

export type PrinciplesAccess = {
  /** Moves on every change, so a memo over a read knows to read again. */
  readonly version: number
  readonly here: string
  /** A scope as a reader says it: its name, the organisation's at the root, a topic's. */
  scopeLabel(scope: string): string
  own(scope: string): { principles: readonly Principle[]; groups: readonly PrincipleGroup[] }
  /** Own, above and through relevance, in that order. */
  inForce(scope: string): readonly PrincipleInForce[]
  sourceOf(at: string, scope: string): PrincipleSource
  find(ref: PrincipleRef): PrincipleInForce | undefined
  /** The citations a record holds, kept in its scope. */
  citationsOf(about: CitingRecord, scope: string): readonly Citation[]
  /** The citations of one principle, from anywhere. */
  citationsTo(ref: PrincipleRef): readonly Citation[]
  /** A record cited, as a line says it: `ADR-0003 Buy a yard system`. */
  recordLabel(citation: Citation): string
  /** Other records about the same subject: what they cite, for the suggestions. */
  citedNearby(about: CitingRecord, scope: string): readonly PrincipleRef[]
  cite(citation: Omit<Citation, 'id' | 'on'>): CitationRefusal | undefined
  uncite(scope: string, id: string): void
  /**
   * A draft saved in `scope`, as one step: a new principle numbered next, or
   * a change to `held`, with the groups it names that the scope has not got
   * made with it. `note` is the sharpening's, which a change to an accepted
   * one's statement or aspects carries. Answers the principle's id, or the
   * key of why it was refused.
   */
  save(scope: string, draft: PrincipleDraft, held?: Principle, note?: string): { id: string } | { refused: string }
  /** A principle moved on in its life: accepted (dated), retired, or back to a candidate. */
  setStatus(scope: string, id: string, status: PrincipleStatus): void
  /** Removed while nothing cites it; otherwise refused, and the screen offers to retire it. */
  remove(scope: string, id: string): boolean
  setGroups(scope: string, groups: readonly PrincipleGroup[]): void
  relate(scope: string, id: string, relation: PrincipleRelation): void
  unrelate(scope: string, id: string, relation: PrincipleRelation): void
  /** `into` absorbs `from`, with their aspects, groups, citations and comments. */
  merge(scope: string, into: string, from: readonly string[]): void
  /** Open a principle where it is kept: the principles page of its scope, on it. */
  open?(ref: PrincipleRef): void
  /** Open a citing record where it is kept. */
  openRecord?(citation: Citation): void
  /**
   * A new decision about an element that departs from a principle
   * (*Deviates…*, ADR-0041 §9), its departure cited with the reason, in one
   * step, and opened; or why not.
   */
  deviate?(about: CitingRecord, ref: PrincipleRef, aspect: number | undefined, reason: string): CitationRefusal | undefined
  /** Whether a scope's principles may be changed here: the open scope's, while it is not only read. */
  mayWrite(scope: string): boolean
  /** Today, `yyyy-mm-dd`. */
  today(): string
}

const PrinciplesContext = createContext<PrinciplesAccess | undefined>(undefined)

export function PrinciplesProvider({ value, children }: { value: PrinciplesAccess | undefined; children: ReactNode }) {
  return <PrinciplesContext.Provider value={value}>{children}</PrinciplesContext.Provider>
}

/** The same access, standing in another scope: the workspace's open scope. */
export function PrinciplesHere({ here, children }: { here: string; children: ReactNode }) {
  const access = useContext(PrinciplesContext)
  if (!access || access.here === here) return <>{children}</>
  return <PrinciplesContext.Provider value={{ ...access, here }}>{children}</PrinciplesContext.Provider>
}

export function usePrinciples(): PrinciplesAccess | undefined {
  return useContext(PrinciplesContext)
}

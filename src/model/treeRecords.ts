// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The 3.8.0 records as the whole tree holds them, for a reader with no screen
 * (ADR-0041, ADR-0042, ADR-0043): what an agent's `principles.list`,
 * `topics.list` and `blocks.list` answer from. A shape only — the fold that
 * fills it is `projects/treeRecords.ts`, over the tree's index, so the app and
 * a server answer the same question the same way.
 */
import type { Citation } from './citable'
import type { Evaluation } from './evaluation'
import type { Principle, PrincipleGroup } from './principle'
import type { DesignElement } from './types'

/** How a principle comes to hold where it was asked: kept there, above it, or by a topic relevant there today. */
export type PrincipleVia = 'here' | 'above' | 'topic'

/** A topic's link to a scope, dated (ADR-0042 §2). */
export type TreeTopicLink = { readonly path: string; readonly from?: string; readonly until?: string }

/** A topic: where it is, its own links, and where it is relevant today, through its parents too. */
export type TreeTopic = {
  readonly path: string
  readonly name: string
  readonly parent?: string
  readonly links: readonly TreeTopicLink[]
  readonly relevantTo: readonly string[]
}

export type TreeRecords = {
  /** The scopes that keep principles or groups. */
  principleScopes(): readonly string[]
  /** A scope's own principles and groups, in number order. */
  principlesAt(path: string): { readonly principles: readonly Principle[]; readonly groups: readonly PrincipleGroup[] }
  /** The principles in force at a scope today, each with the scope that keeps it and how it comes to hold there. */
  inForce(path: string): readonly { readonly scope: string; readonly via: PrincipleVia; readonly principle: Principle }[]
  topics(): readonly TreeTopic[]
  blocks(): readonly { readonly scope: string; readonly block: DesignElement }[]
  evaluations(): readonly { readonly scope: string; readonly evaluation: Evaluation }[]
  /** Every citation of a principle, with the scope that keeps it: what a building block cites is copied onto its decision (ADR-0043 §7). */
  citations(): readonly { readonly scope: string; readonly citation: Citation }[]
}

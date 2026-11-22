// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A step as the Activity list says it, and the source's own log of a scope
 * as the list asks for it: what a screen tells the frame it has, so the frame
 * can draw the list over whichever screen is up.
 */
import type { StepSummary } from '../model'
import type { SourceActivityLine } from '../platform/sourceProvider'

/** One line of the list: what was done, when, and by whom where that is not obvious. */
export type ActivityEntry = {
  summary: StepSummary
  /** Epoch milliseconds, as `Date.now()` gives them. */
  at: number
  /**
   * Not the person at this keyboard: the agent on this session (ADR-0007), or
   * another author whose step reached this model from elsewhere. The line says
   * which, because a change nobody here made appearing unattributed on the
   * board is indistinguishable from a fault.
   */
  origin?: 'agent' | 'remote'
  /** Who the other author was, where the step arrived with a name on it. */
  by?: string
  /**
   * What they made it with, where the step said: the line then reads *by
   * A. Author via their client*.
   *
   * The two are separate answers and the line says both, because one author
   * working from two clients and two authors are not the same thing to somebody
   * reading a log. Nothing at all where the step named no client, which is what
   * every step in this repository does.
   */
  via?: string
  /**
   * The step's name outside this session, and the names each announcement of
   * it went out under (`HistoryStep.stepId` and its `folds`). Read only to
   * list a step once where the source's log holds it too.
   */
  stepId?: string
  folds?: readonly { readonly changeId: string }[]
  /**
   * The editor made it by itself, not at anybody's asking (`HistoryStep`'s
   * own): never said to be the person's.
   */
  unattended?: boolean
}

/**
 * The source's own log of the open scope, asked for each time the list opens
 * (`SourceRecentActivity`, bound to that scope); nothing where it keeps none.
 */
export type RecentActivity = () => Promise<readonly SourceActivityLine[] | undefined>

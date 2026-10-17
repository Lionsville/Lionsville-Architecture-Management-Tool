// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * An organisation chart as a test meets it unfolded. A first open folds
 * below the second level (3.7.3), so a test about what a chart of three
 * levels draws opens it as a person who had unfolded it before would: with
 * the view's folds kept for the session, and none of them shut.
 */
import { foldKey, SessionFolds } from '../sessionFolds'

/** A session in which the view was left with nothing folded, on the chart and in the outline. */
export function leftUnfolded(scope: string, viewId: string): SessionFolds {
  const folds = new SessionFolds()
  folds.keep(foldKey(scope, viewId, 'chart'), new Set())
  folds.keep(foldKey(scope, viewId, 'outline'), new Set())
  return folds
}

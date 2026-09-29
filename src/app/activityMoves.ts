// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A scope's Activity, as far as the source's log and its history say it:
 * read by the scope's identity, so it follows the scope through a move and
 * says the move (`HistoryEntry.moved`, ADR-0031 §1).
 *
 * The session's own steps are the rest of the list (`ActivityMenu`). A
 * history's other entries are not lines of it: an entry is a run of steps a
 * person called something, and the steps are what the list is made of. A
 * move is no step at all — it changes no record — so the history is the one
 * place it is said, and where the source keeps a log of its own that says
 * moves, the log is taken at its word.
 */
import type { HistoryEntry, HistoryRepository } from '../ports/HistoryRepository'
import type { SourceActivityLine, SourceRecentActivity } from '../platform/sourceProvider'
import type { ScopeId } from '../projects/scopeState'

/** How far back a list looks for moves: the newest entries, as a list of what was lately done reads. */
export const MOVES_LOOKED_AT = 50

/** A move, as a line of the list: where from, where to, when, and who moved it. */
export function moveLine(entry: HistoryEntry): SourceActivityLine | undefined {
  if (!entry.moved) return undefined
  return { summary: { key: 'activity.scopeMoved', from: entry.moved.from, to: entry.moved.to }, at: entry.at, by: entry.by }
}

/** The moves among a scope's newest entries, as lines of its Activity. */
export async function movesOf(history: Pick<HistoryRepository, 'entries'>, scope: ScopeId): Promise<SourceActivityLine[]> {
  const { entries } = await history.entries({ scopes: [scope], limit: MOVES_LOOKED_AT })
  return entries.flatMap((entry) => moveLine(entry) ?? [])
}

/**
 * What the list asks, bound to one scope: the source's log where it keeps one,
 * and the moves its history holds where a history is kept — `undefined` where
 * neither has anything to say, and the list is the session's alone, as it
 * always was. A part that could not be asked is left out, and the other said.
 */
export function scopeActivity(
  scope: ScopeId | undefined, log: SourceRecentActivity | undefined, history: Pick<HistoryRepository, 'entries'> | undefined,
): (() => Promise<readonly SourceActivityLine[] | undefined>) | undefined {
  if (scope === undefined || (!log && !history)) return undefined
  return async () => {
    const [kept, moves] = await Promise.all([
      log ? log(scope).catch(() => undefined) : undefined,
      history ? movesOf(history, scope).catch(() => []) : [],
    ])
    const saysMoves = kept?.some((line) => line.summary.key === 'activity.scopeMoved') ?? false
    if (kept === undefined && moves.length === 0) return undefined
    return [...(kept ?? []), ...(saysMoves ? [] : moves)]
  }
}

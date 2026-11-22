// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for a process with no screen: the agent's handler.
 *
 * One request in, one answer out (ADR-0007). Apart from the vocabulary,
 * because it reaches every read and every write an agent has, and a process
 * that only lists the tools loads none of them.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export { handle } from '../../agent/handle'
export type { FollowScopeTypes, HistoryEntry, SessionView } from '../../agent/handle'

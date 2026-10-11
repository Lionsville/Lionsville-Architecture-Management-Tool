// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a part of a page keeps open or shown for the session: a set of
 * strings under a key, recalled the next time the part is drawn and kept
 * every time it changes — and never saved, which is the rule the scope tree,
 * the chart and its outline keep (`app/sessionFolds.ts`, ADR-0036 amended 11
 * October 2026). A fold is what somebody is doing this minute; a preference
 * would open next week with something hidden for a reason nobody can
 * reconstruct.
 *
 * The memory is the shell's, one for the window, handed down as a context so
 * a list drawn deep in a page reaches it without every page between carrying
 * it. Where nothing provides one — a test, a page drawn on its own — a part
 * keeps its set for as long as it is drawn.
 */
import { createContext, useCallback, useContext, useState } from 'react'

/** Where the sets are kept: `app/sessionFolds.SessionFolds` is one. */
export type SessionMemory = {
  keep(key: string, held: ReadonlySet<string>): void
  recall(key: string): ReadonlySet<string> | undefined
}

export const SessionMemoryContext = createContext<SessionMemory | undefined>(undefined)

const NOTHING: ReadonlySet<string> = new Set()

/**
 * A set kept for the session under `key`, starting from what was kept there
 * and empty where nothing was; a new key starts again from what it holds.
 * Without a key the set is the part's own.
 */
export function useSessionSet(key: string | undefined): [ReadonlySet<string>, (next: ReadonlySet<string>) => void] {
  const memory = useContext(SessionMemoryContext)
  const recall = (at: string | undefined) => (at !== undefined ? memory?.recall(at) : undefined) ?? NOTHING
  const [state, setState] = useState(() => ({ key, held: recall(key) }))
  const set = useCallback((next: ReadonlySet<string>) => {
    setState({ key, held: next })
    if (key !== undefined) memory?.keep(key, next)
  }, [key, memory])
  if (state.key !== key) {
    // Drawn for another key: what that one kept, at once, rather than a render late.
    const fresh = { key, held: recall(key) }
    setState(fresh)
    return [fresh.held, set]
  }
  return [state.held, set]
}

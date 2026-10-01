// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Something outside a laid-out page asking it to select one of the things it
 * draws — a place opened with something selected on it (ADR-0019, amended).
 *
 * A request carries a number, because the same thing asked for twice is two
 * requests and a prop that did not change is none; each number is honoured
 * once. It waits for the page to be able to say what it draws (`draws`
 * absent), and then selects the thing where the page draws it and nothing
 * where it does not: a page never selects what a person cannot see on it.
 */
import { useEffect, useRef } from 'react'

/** An id to select, and the request's own number. */
export type SelectRequest = { readonly id: string; readonly nonce: number }

export function useSelectRequest(
  request: SelectRequest | undefined,
  draws: ((id: string) => boolean) | undefined,
  select: (id: string) => void,
): void {
  const honoured = useRef<number | undefined>(undefined)
  const latest = useRef({ draws, select })
  latest.current = { draws, select }
  const ready = draws !== undefined
  useEffect(() => {
    const { draws: drawn, select: choose } = latest.current
    if (!request || !drawn || honoured.current === request.nonce) return
    honoured.current = request.nonce
    if (drawn(request.id)) choose(request.id)
  }, [request, ready])
}

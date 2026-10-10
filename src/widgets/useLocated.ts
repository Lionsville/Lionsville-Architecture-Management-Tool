// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Bring something on screen and ring it for a moment (ADR-0033, amended).
 *
 * What the sheet's finder does with a hit, and what a request from outside
 * does with a record or an element the address named: select it, scroll it
 * into view, and draw the same ring the sheet already draws, cleared after
 * a few seconds. The ring is one rule on an ancestor, keyed by
 * `data-element-id` (or, on a board, the canvas node's `data-id`), rather
 * than a prop through every card — it is a moment's emphasis, not state any
 * card has a say in.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

/** How long the ring stays on what was just brought into view. */
export const LOCATED_FOR_MS = 3000

const ring = {
  outline: '2px solid',
  outlineColor: 'primary.main',
  outlineOffset: 2,
  borderRadius: 1,
} as const

/** The ring, as a rule on `root` for the id that is located. None when nothing is. */
export function locatedMark(id: string | undefined): Record<string, unknown> {
  if (id === undefined) return {}
  return {
    [`& [data-element-id="${id}"]`]: ring,
    [`& .react-flow__node[data-id="${id}"]`]: ring,
  }
}

function findLocated(root: HTMLElement | null, id: string): HTMLElement | null {
  if (!root) return null
  return root.querySelector<HTMLElement>(`[data-element-id="${id}"]`)
    ?? root.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`)
}

/**
 * Select a thing, bring it on screen, and ring it. `show` rings without
 * selecting or scrolling: a board has already done both, through its own
 * focus, and only the ring is left.
 */
export function useLocated(root: RefObject<HTMLElement | null>, select: (id: string) => void) {
  const [locatedId, setLocatedId] = useState<string | undefined>(undefined)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const show = useCallback((id: string) => {
    setLocatedId(id)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setLocatedId(undefined), LOCATED_FOR_MS)
  }, [])
  const locate = useCallback((id: string) => {
    select(id)
    show(id)
    // jsdom has no scrollIntoView, hence the optional call.
    findLocated(root.current, id)?.scrollIntoView?.({ block: 'center', inline: 'center', behavior: 'smooth' })
  }, [root, select, show])
  return { locatedId, locate, show }
}

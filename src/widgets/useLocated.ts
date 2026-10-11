// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Select a thing, bring it on screen, and ring it for a moment: what a finder
 * does with a hit, and what a link or a request from outside does with what a
 * page draws (ADR-0033, amended 11 October 2026). One mark for every page
 * that has one — the sheet, the map, the decisions list, the observations
 * register and its pictures — so a thing somebody was sent to looks the same
 * wherever it is.
 *
 * The ring is one rule on the page keyed by the id rather than a prop through
 * every kind of card or row, because it is a moment's emphasis and not state
 * any card has a say in. The thing carries its id as data (`data-element-id`
 * unless the page says another attribute), so the page finds it without a ref
 * per row.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

/** How long the ring stays on what was located. */
export const LOCATED_FOR_MS = 3000

/** The attribute a located thing carries its id in, where a page says none. */
export const LOCATED_ATTRIBUTE = 'data-element-id'

/** An id as a quoted attribute value in a selector: an id is whatever a person or a file said. */
function quoted(id: string): string {
  return `"${id.replace(/["\\]/g, '\\$&')}"`
}

/** The selector for the thing carrying this id. */
export function locatedSelector(id: string, attribute: string = LOCATED_ATTRIBUTE): string {
  return `[${attribute}=${quoted(id)}]`
}

/**
 * The ring, as a rule for the page's `sx`: nothing while nothing is located,
 * and nothing in a picture being taken, which is no moment.
 */
export function locatedRing(id: string | undefined, attribute: string = LOCATED_ATTRIBUTE) {
  if (id === undefined) return {}
  return {
    [`& ${locatedSelector(id, attribute)}`]: {
      outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2,
      borderRadius: 1,
    },
  }
}

export function useLocated(
  page: RefObject<HTMLElement | null>,
  select: (id: string) => void,
  attribute: string = LOCATED_ATTRIBUTE,
): { locatedId: string | undefined; locate: (id: string) => void } {
  const [locatedId, setLocatedId] = useState<string | undefined>(undefined)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const locate = useCallback((id: string) => {
    select(id)
    setLocatedId(id)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setLocatedId(undefined), LOCATED_FOR_MS)
    // After the selection has drawn: a row a filter or a fold hid comes back
    // with the selection, and only then is there something to scroll to.
    // jsdom has no scrollIntoView, hence the optional call.
    requestAnimationFrame(() => {
      const node = page.current?.querySelector<HTMLElement>(locatedSelector(id, attribute))
      node?.scrollIntoView?.({ block: 'center', inline: 'center', behavior: 'smooth' })
    })
  }, [page, select, attribute])
  return { locatedId, locate }
}

/**
 * The same, for a page that only needs somewhere to look and the ring: the
 * ref for the element the things are drawn in, the rule for its `sx`, and the
 * call that locates one.
 */
export function useLocatedIn(select: (id: string) => void, attribute: string = LOCATED_ATTRIBUTE) {
  const ref = useRef<HTMLDivElement | null>(null)
  const { locatedId, locate } = useLocated(ref, select, attribute)
  return { ref, ring: locatedRing(locatedId, attribute), locate }
}

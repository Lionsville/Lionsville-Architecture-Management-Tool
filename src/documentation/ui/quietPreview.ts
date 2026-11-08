// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { useEffect } from 'react'
import type { KeyboardEvent, RefObject, SyntheticEvent } from 'react'

const PRESSABLE = 'a, button, [role="link"], [role="button"], [tabindex]'

/**
 * A preview is read, not used, while the text is being written: a link in it
 * would leave the editor mid-sentence and take the draft along. So nothing in it
 * answers a press, by mouse or by key, and nothing in it is in the Tab order,
 * which goes from the text to the bar and not into the reading.
 */
/** `shown` changes when the box comes and goes, so the hook finds it again. */
export function useReadOnlyPreview(boxRef: RefObject<HTMLDivElement | null>, shown?: unknown) {
  useEffect(() => {
    const box = boxRef.current
    if (!box) return undefined
    // A browser puts a box that scrolls in the Tab order of its own accord; this one stays out of it too.
    box.setAttribute('tabindex', '-1')
    const quiet = () => {
      for (const one of box.querySelectorAll<HTMLElement>(PRESSABLE)) {
        if (one.getAttribute('tabindex') !== '-1') one.setAttribute('tabindex', '-1')
      }
    }
    quiet()
    if (typeof MutationObserver === 'undefined') return undefined
    const watch = new MutationObserver(quiet)
    watch.observe(box, { childList: true, subtree: true })
    return () => watch.disconnect()
  }, [boxRef, shown])
}

export const refusePress = (event: SyntheticEvent<HTMLElement>) => {
  if (!(event.target as HTMLElement).closest(PRESSABLE)) return
  if ('key' in event && (event as KeyboardEvent<HTMLElement>).key !== 'Enter' && (event as KeyboardEvent<HTMLElement>).key !== ' ') return
  event.preventDefault()
  event.stopPropagation()
}

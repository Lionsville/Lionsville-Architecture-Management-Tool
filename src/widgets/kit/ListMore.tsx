// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The end of a list that is not all there: how much is kept back, and the way to
 * it. It stands where the eye arrives having read what is shown, and stays in view
 * while a long list scrolls, so nobody has to know the filter is why the list
 * stopped. One quiet line: the rows are what is being read.
 *
 * `atEnd` keeps it at the list's end instead, where it would otherwise stand over
 * rows a short page shows whole: a list that opens with its last rows under the
 * line reads as one the line has cut off.
 */
import type { ReactNode } from 'react'
import './List.css'

export function ListMore({ said, children, atEnd, 'data-testid': testId, 'data-guide': guide }: {
  /** How many are kept back, in words. Said aloud as it changes. */
  said: ReactNode
  /** The kit's buttons that bring them back. */
  children?: ReactNode
  /** At the list's end and nowhere else, rather than in view as the list scrolls. */
  atEnd?: boolean
  'data-testid'?: string
  'data-guide'?: string
}) {
  return (
    <div className="kit-list__more" data-at-end={atEnd || undefined} data-testid={testId} data-guide={guide}>
      <span aria-live="polite">{said}</span>
      {children}
    </div>
  )
}

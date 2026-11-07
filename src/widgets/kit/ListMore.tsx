// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The end of a list that is not all there: how much is kept back, and the way to
 * it. It stands where the eye arrives having read what is shown, and stays in view
 * while a long list scrolls, so nobody has to know the filter is why the list
 * stopped. One quiet line: the rows are what is being read.
 */
import type { ReactNode } from 'react'
import './List.css'

export function ListMore({ said, children, 'data-testid': testId, 'data-guide': guide }: {
  /** How many are kept back, in words. Said aloud as it changes. */
  said: ReactNode
  /** The kit's buttons that bring them back. */
  children?: ReactNode
  'data-testid'?: string
  'data-guide'?: string
}) {
  return (
    <div className="kit-list__more" data-testid={testId} data-guide={guide}>
      <span aria-live="polite">{said}</span>
      {children}
    </div>
  )
}

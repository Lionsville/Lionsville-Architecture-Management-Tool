// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { waitFor } from '@testing-library/react'

/** The page up in the frame's main column, on top where a plan is up over the roadmap. */
export function placePageNow(): HTMLElement | null {
  const up = document.querySelectorAll<HTMLElement>('[data-place-page]')
  return up[up.length - 1] ?? null
}

/** The same, once it has come up: what `findByRole('dialog')` was when a page was a dialog. */
export function placePage(): Promise<HTMLElement> {
  return waitFor(() => {
    const up = placePageNow()
    if (!up) throw new Error('no page is up in the frame')
    return up
  })
}

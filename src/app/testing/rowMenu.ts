// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { fireEvent, screen } from '@testing-library/react'

/** A scope's row keeps its settings and its removal under ⋯: open it, and press the one named. */
export async function pressRowMenu(scope: string, item: string): Promise<void> {
  fireEvent.click(await screen.findByRole('button', { name: `More for ${scope}` }))
  fireEvent.click(await screen.findByRole('menuitem', { name: item }))
}

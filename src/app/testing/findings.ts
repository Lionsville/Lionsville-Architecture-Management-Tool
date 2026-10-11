// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A list of findings as a test reads it (`widgets/FindingsList`): folded by
 * check and the notes hidden, as a person meets it, so a test that reads the
 * sentences, or presses one, unfolds it first the way a person would.
 */
import { fireEvent, within } from '@testing-library/react'

/** Every check in the list unfolded and its notes shown: every sentence on screen. */
export function unfoldFindings(list: HTMLElement): void {
  const notes = list.querySelector<HTMLInputElement>('[data-guide="findings.showNotes"] input')
  if (notes && !notes.checked) fireEvent.click(notes)
  for (const row of list.querySelectorAll<HTMLElement>('[data-guide="findings.group"][aria-expanded="false"]')) fireEvent.click(row)
}

/** The instance with this test id opened, the list unfolded first: its explanation. */
export function openFinding(list: HTMLElement, testId: string): HTMLElement {
  unfoldFindings(list)
  fireEvent.click(within(list).getByTestId(testId))
  return within(list).getByTestId('finding-explanation')
}

/** An action of an opened explanation, pressed by what its button says. */
export function pressAction(explanation: HTMLElement, name: string): void {
  fireEvent.click(within(explanation).getByRole('button', { name }))
}

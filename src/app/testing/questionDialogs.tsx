// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a question dialog promises about what is typed into it, as one check
 * any dialog can be put through.
 *
 * A dialog opened on a subject is rendered again whenever the page behind it
 * is — by the autosave, a blur that saves, a reader's commit, an agent's step,
 * a sync — and the page builds the subject afresh each time. The fields have
 * to survive that, and start empty again only when the dialog is asked about
 * something else (`widgets/useFreshFor`). The check reads the fields off the
 * DOM rather than by label, so a dialog added to the list needs no reader of
 * its own: every input and text area in the open dialog, a checkbox or a
 * radio by whether it is ticked, and a select by the hidden input MUI keeps
 * its value in.
 */
import type { ReactElement } from 'react'
import { expect } from 'vitest'
import { fireEvent, within } from '@testing-library/react'
import { renderShell } from './renderShell'

export type QuestionDialogCase = {
  name: string
  /**
   * The dialog, open on the subject with this id, from props built afresh
   * on every call — structurally the same each time, as a page's are.
   */
  open(id: string): ReactElement
  /** Answer it. Absent types into every text field and takes the last choice of every select. */
  fill?(): void
}

function dialog(): HTMLElement {
  // Queried off the DOM: a select's open menu hides the dialog from role queries.
  const found = document.querySelector<HTMLElement>('[role="dialog"]')
  if (!found) throw new Error('No dialog is open.')
  return found
}

/** Every field of the open dialog, as the person would read it back. */
export function dialogFields(): string[] {
  return [...dialog().querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')]
    .filter((field) => !(field instanceof HTMLTextAreaElement && field.readOnly))
    .map((field) => (field instanceof HTMLInputElement && (field.type === 'checkbox' || field.type === 'radio')
      ? String(field.checked)
      : field.value))
}

/** Take the last choice a select offers. */
export function chooseLast(combobox: HTMLElement): void {
  fireEvent.mouseDown(combobox)
  const lists = document.querySelectorAll<HTMLElement>('[role="listbox"]')
  const options = within(lists[lists.length - 1]!).getAllByRole('option')
  fireEvent.click(options[options.length - 1]!)
}

/** Type into every text field and take the last choice of every select. */
export function answerEverything(): void {
  const fields = [...dialog().querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input:not([aria-hidden]), textarea')]
    .filter((field) => !(field instanceof HTMLTextAreaElement && field.readOnly))
    .filter((field) => !(field instanceof HTMLInputElement && ['checkbox', 'radio', 'hidden'].includes(field.type)))
  fields.forEach((field, index) => {
    fireEvent.change(field, { target: { value: field.type === 'date' ? `2020-01-0${index + 1}` : `typed ${index}` } })
  })
  for (const combobox of within(dialog()).queryAllByRole('combobox')) chooseLast(combobox)
}

/**
 * Open the dialog, answer it, render it again from fresh props and expect
 * the answer to be there; then open it on another subject and expect it
 * back where it started.
 */
export function keepsWhatIsTyped(one: QuestionDialogCase): void {
  const { rerender } = renderShell(one.open('first'))
  const blank = dialogFields()
  ;(one.fill ?? answerEverything)()
  const typed = dialogFields()
  expect(typed, `${one.name}: answering it changed nothing, so the check proves nothing`).not.toEqual(blank)
  rerender(one.open('first'))
  expect(dialogFields(), `${one.name}: a render of the page behind it`).toEqual(typed)
  rerender(one.open('second'))
  expect(dialogFields(), `${one.name}: asked about something else`).toEqual(blank)
}

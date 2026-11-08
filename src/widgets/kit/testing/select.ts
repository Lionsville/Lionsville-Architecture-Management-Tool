// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The kit's `Select` in a test: a press opens its list and a press on a choice
 * takes it, as a person does. A browser's select took a change event with the
 * value; this one has no such event to take.
 */
import { fireEvent, within } from '@testing-library/react'

function listOf(combobox: HTMLElement): HTMLElement {
  if (combobox.getAttribute('aria-expanded') !== 'true') fireEvent.click(combobox)
  const id = combobox.getAttribute('aria-controls')
  const list = id ? document.getElementById(id) : null
  if (!list) throw new Error('The select did not open a list.')
  return list
}

/** Take the choice whose value is `value`. */
export function chooseValue(combobox: HTMLElement, value: string): void {
  const option = [...listOf(combobox).querySelectorAll<HTMLElement>('[role="option"]')].find((one) => one.dataset.value === value)
  if (!option) throw new Error(`The select offers no choice with the value ${value}.`)
  fireEvent.click(option)
}

/** Take the choice named `name`. */
export function chooseOption(combobox: HTMLElement, name: string | RegExp): void {
  fireEvent.click(within(listOf(combobox)).getByRole('option', { name }))
}

/** The values a select offers, in order. */
export function optionValues(combobox: HTMLElement): string[] {
  const list = listOf(combobox)
  const values = [...list.querySelectorAll<HTMLElement>('[role="option"]')].map((one) => one.dataset.value ?? '')
  fireEvent.keyDown(list, { key: 'Escape' })
  return values
}

/** The words of the choices a select offers, in order. */
export function optionLabels(combobox: HTMLElement): (string | null)[] {
  const list = listOf(combobox)
  const labels = [...list.querySelectorAll<HTMLElement>('[role="option"]')].map((one) => one.textContent)
  fireEvent.keyDown(list, { key: 'Escape' })
  return labels
}

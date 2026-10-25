// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A scope in a picker stands where it stands in the tree: indented by its
 * depth, and a topic under a heading of its own.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import { renderShell } from '../app/testing/renderShell'
import { renderScopeOption, scopeMenuItems } from './ScopeChoices'
import type { ScopeChoice } from './ScopeChoices'

afterEach(() => cleanup())

const WORDS = { topics: 'Topics', scopes: 'The organisation' }
const CHOICES: ScopeChoice[] = [
  { path: 'topics/integration', name: 'Integration', depth: 0, topic: true },
  { path: '', name: 'Acme', depth: 0 },
  { path: 'operations', name: 'Operations', depth: 1 },
  { path: 'operations/retail', name: 'Retail', depth: 2 },
]

describe('scope choices', () => {
  it('lists a select’s scopes at their depth, the topics and the rest under their headings', () => {
    renderShell(<TextField select label="Kept in" value="" slotProps={{ select: { displayEmpty: true } }}>{scopeMenuItems(CHOICES, WORDS)}</TextField>)
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Kept in' }))
    const list = screen.getByRole('listbox')
    expect(Array.from(list.children).map((one) => one.textContent)).toEqual(['Topics', 'Integration', 'The organisation', 'Acme', 'Operations', 'Retail'])
    expect(within(list).getByRole('option', { name: 'Retail' }).getAttribute('data-depth')).toBe('2')
    expect(within(list).getByRole('option', { name: 'Operations' }).getAttribute('data-depth')).toBe('1')
  })

  it('draws no heading where the list holds one kind', () => {
    renderShell(<TextField select label="Evaluated by" value="">{scopeMenuItems(CHOICES.filter((one) => !one.topic), WORDS)}</TextField>)
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Evaluated by' }))
    expect(within(screen.getByRole('listbox')).queryByText('The organisation')).toBeNull()
  })

  it('indents an autocomplete’s scopes by their depth', () => {
    renderShell(
      <Autocomplete
        options={CHOICES.filter((one) => !one.topic)} getOptionLabel={(one) => one.name} renderOption={renderScopeOption}
        renderInput={(params) => <TextField {...params} label="Relevant to" />}
      />,
    )
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Relevant to' }), { key: 'ArrowDown' })
    const options = screen.getAllByRole('option')
    expect(options.map((one) => [one.textContent, one.getAttribute('data-depth')])).toEqual([['Acme', '0'], ['Operations', '1'], ['Retail', '2']])
  })
})

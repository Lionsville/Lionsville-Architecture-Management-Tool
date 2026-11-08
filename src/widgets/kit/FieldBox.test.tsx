// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import MenuItem from '@mui/material/MenuItem'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { FieldBox } from './FieldBox'

afterEach(() => cleanup())

describe('FieldBox', () => {
  it('puts the label above the box, as the kit\'s fields do, and not in a notch of the outline', async () => {
    renderShell(<FieldBox label="Title" value="Labels print twice" onChange={() => {}} required />)
    const label = document.querySelector('.kit-field__label')!
    expect(label.textContent).toBe('Title')
    expect(document.querySelector('.MuiInputLabel-root')).toBeNull()
    // MUI keeps a zero-width space in an outline with no label, so the notch has nothing to open for.
    expect((document.querySelector('legend span')?.textContent ?? '').replace('\u200b', '')).toBe('')
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Labels print twice')
    expect(await axeFindings()).toEqual([])
  })

  it('names a select of MUI items by the same label', () => {
    renderShell(<FieldBox select label="Impact" value="low" onChange={() => {}}><MenuItem value="low">Low</MenuItem></FieldBox>)
    expect(screen.getByRole('combobox', { name: /Impact/ })).toBeTruthy()
  })

  it('is MUI\'s field alone where there is no label', () => {
    renderShell(<FieldBox placeholder="Find" value="" onChange={() => {}} />)
    expect(document.querySelector('.kit-field__label')).toBeNull()
  })
})

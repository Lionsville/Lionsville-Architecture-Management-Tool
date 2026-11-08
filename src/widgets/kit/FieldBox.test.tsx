// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
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

  it('marks a required field\'s label for the eye, and leaves its name and the control\'s required state to say it', () => {
    renderShell(<><FieldBox label="Title" value="" onChange={() => {}} required /><FieldBox label="Note" value="" onChange={() => {}} /></>)
    const [title, note] = [...document.querySelectorAll<HTMLElement>('.kit-field__label')]
    expect(title!.dataset.required).toBe('true')
    expect(note!.dataset.required).toBeUndefined()
    expect(screen.getByLabelText('Title').hasAttribute('required')).toBe(true)
    // The * is drawn by the stylesheet with no words in the name.
    expect(readFileSync('src/widgets/kit/Field.css', 'utf8')).toMatch(/\[data-required\]::after \{ content: '\*' \/ ''/)
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

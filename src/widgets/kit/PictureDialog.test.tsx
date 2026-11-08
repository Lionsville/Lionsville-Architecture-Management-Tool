// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom

import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { renderShell } from '../../app/testing/renderShell'
import { TextField } from './Field'
import { PictureDialog, PictureGroup } from './PictureDialog'
import { Segmented } from './Segmented'

afterEach(cleanup)

function WithBlock({ onSave = vi.fn(), warning }: { onSave?: () => Promise<void> | void; warning?: string }) {
  const [on, setOn] = useState(false)
  const [file, setFile] = useState<'pdf' | 'png'>('pdf')
  return (
    <PictureDialog
      name="Coverage" onSave={onSave} onClose={vi.fn()} saveWord="Save PDF" {...(warning ? { warning } : {})}
      titleBlock={{ on, onChange: setOn, fields: (disabled) => <TextField label="Author" value="" disabled={disabled} onChange={() => {}} /> }}
    >
      <PictureGroup label="File">
        <Segmented label="File" value={file} onChange={setFile} options={[{ value: 'pdf', label: 'PDF' }, { value: 'png', label: 'PNG' }]} />
      </PictureGroup>
    </PictureDialog>
  )
}

describe('PictureDialog', () => {
  it('is called Export <name>, names each choice on screen, and says what its one button does', () => {
    renderShell(<WithBlock />)
    expect(screen.getByRole('dialog', { name: 'Export Coverage' })).toBeTruthy()
    expect(screen.getByText('File', { selector: '.kit-field__label' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save PDF' })).toBeTruthy()
  })

  it('keeps the title block\'s fields closed until it is ticked', () => {
    renderShell(<WithBlock />)
    const author = screen.getByLabelText('Author') as HTMLInputElement
    expect(author.disabled).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Draw the title block' }))
    expect((screen.getByLabelText('Author') as HTMLInputElement).disabled).toBe(false)
  })

  it('says a warning where the print comes out too small', () => {
    renderShell(<WithBlock warning="Under 7 pt a name is hard to read on paper." />)
    expect(screen.getByRole('note').textContent).toBe('Under 7 pt a name is hard to read on paper.')
  })

  it('says a failure in place and stays up', async () => {
    renderShell(<WithBlock onSave={async () => { throw new Error('no bitmap') }} />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save PDF' })); await Promise.resolve() })
    expect(screen.getByRole('alert').textContent).toContain('no bitmap')
    expect(screen.getByRole('dialog', { name: 'Export Coverage' })).toBeTruthy()
  })
})

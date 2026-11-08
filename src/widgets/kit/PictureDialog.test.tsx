// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom

import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { renderShell } from '../../app/testing/renderShell'
import { TextField } from './Field'
import { PictureDialog, PictureGroup, PictureTitleFields, PictureTitleStrip } from './PictureDialog'
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
    fireEvent.click(screen.getByRole('checkbox', { name: 'Title block' }))
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

  it('says an image the browser would not load in words, not as an event', async () => {
    renderShell(<WithBlock onSave={async () => { throw new Event('error') }} />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Save PDF' })); await Promise.resolve() })
    expect(screen.getByRole('alert').textContent).toContain('The picture could not be made: the browser could not draw the page as an image')
    expect(screen.getByRole('alert').textContent).not.toContain('[object')
  })

  it('asks the title block\'s words in one order with what an empty one draws, and writes one as it is left', () => {
    const onChange = vi.fn()
    renderShell(<PictureTitleFields values={{ client: '', author: 'Ann', date: '' }} clientFrom="Acme" disabled={false} onChange={onChange} />)
    const fields = screen.getAllByRole('textbox')
    expect(fields.map((one) => one.getAttribute('aria-label') ?? (one as HTMLInputElement).labels?.[0]?.textContent)).toEqual(['Client', 'Author', 'Date'])
    expect(screen.getByText('Empty: uses Acme')).toBeTruthy()
    expect(screen.getByText('Empty: nobody is named')).toBeTruthy()
    expect(screen.getByText('Empty: the day it is exported')).toBeTruthy()
    fireEvent.change(fields[2], { target: { value: '2026-11-08' } })
    fireEvent.blur(fields[2])
    expect(onChange).toHaveBeenCalledWith({ date: '2026-11-08' })
  })

  it('draws a laid-out page\'s strip with the cells a board draws, leaving out an author nobody gave', () => {
    renderShell(<PictureTitleStrip client="Acme" title="Coverage" date="2026-11-08" />)
    expect(screen.getByTestId('picture-title-strip').textContent).toBe('TitleCoverageClientAcmeDate2026-11-08')
  })
})

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom

import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { Button } from './Button'
import { Dialog, DialogChoices, DialogDanger, DialogFacts } from './Dialog'
import type { DialogProps } from './Dialog'
import { TextField } from './Field'

afterEach(cleanup)

const actions = <><Button variant="quiet">Keep what is here</Button><Button variant="primary" type="submit">Open in a new folder</Button></>

function Asking(props: Partial<DialogProps>) {
  return <Dialog open title="Open acme.lvarch" onClose={() => {}} actions={actions} {...props}><p>It holds 5 scopes.</p></Dialog>
}

describe('Dialog', () => {
  it('has one anatomy in every width: named by its title, body, then the answers', async () => {
    for (const size of ['s', 'm', 'l'] as const) {
      const view = renderShell(<Asking size={size} data-guide="ask" />)
      const dialog = screen.getByRole('dialog', { name: 'Open acme.lvarch' })
      expect(dialog.dataset.size).toBe(size)
      expect(dialog.dataset.guide).toBe('ask')
      expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Open acme.lvarch')
      expect(await axeFindings()).toEqual([])
      view.unmount()
    }
  })

  it('is small unless asked', () => {
    renderShell(<Asking />)
    expect(screen.getByRole('dialog').dataset.size).toBe('s')
  })

  it('takes the focus in and gives it back', async () => {
    function Host() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Ask</button>
          <Dialog open={open} title="Sure?" onClose={() => setOpen(false)} actions={<Button onClick={() => setOpen(false)}>No</Button>}><p>Body</p></Dialog>
        </>
      )
    }
    renderShell(<Host />)
    const asker = screen.getByRole('button', { name: 'Ask' })
    asker.focus()
    fireEvent.click(asker)
    const dialog = await screen.findByRole('dialog')
    expect(dialog.contains(document.activeElement) || document.activeElement?.closest('.MuiDialog-root') !== null).toBe(true)
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(asker)
  })

  it('takes Escape as no, and has no way out while it is working', () => {
    const closed = vi.fn()
    const view = renderShell(<Asking onClose={closed} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(closed).toHaveBeenCalledOnce()
    closed.mockClear()
    view.rerender(<Asking onClose={closed} working />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(closed).not.toHaveBeenCalled()
  })

  it('says an error in place and keeps the question', () => {
    renderShell(<Asking error="The file could not be read." />)
    expect(screen.getByRole('alert').textContent).toBe('The file could not be read.')
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('answers Enter in a field through its form, but not twice while working', () => {
    const submitted = vi.fn()
    const body = <TextField label="What changed" value="" onChange={() => {}} />
    const view = renderShell(<Dialog open title="Snapshot" onClose={() => {}} onSubmit={submitted} actions={actions}>{body}</Dialog>)
    fireEvent.submit(screen.getByLabelText('What changed').closest('form') as HTMLFormElement)
    expect(submitted).toHaveBeenCalledOnce()
    view.rerender(<Dialog open title="Snapshot" onClose={() => {}} onSubmit={submitted} working actions={actions}>{body}</Dialog>)
    fireEvent.submit(screen.getByLabelText('What changed').closest('form') as HTMLFormElement)
    expect(submitted).toHaveBeenCalledOnce()
  })
})

describe('the parts of a dialog', () => {
  it('names each outcome in a radio row, says its effect, and answers by the arrows a browser gives', async () => {
    const chose = vi.fn()
    renderShell(
      <Dialog open title="Where should it go?" onClose={() => {}} actions={actions}>
        <DialogFacts title="In the file: Acme">5 scopes, 9 views</DialogFacts>
        <DialogChoices
          label="Where it goes" value="new" onChange={chose}
          options={[
            { value: 'new', label: 'A new folder', effect: 'What is here stays.' },
            { value: 'replace', label: 'Replace what is here', effect: 'It cannot be put back.', danger: true },
            { value: 'bare', label: 'Neither' },
          ]}
        />
      </Dialog>,
    )
    expect(screen.getByRole('group', { name: 'Where it goes' })).toBeTruthy()
    const replace = screen.getByRole('radio', { name: 'Replace what is here It cannot be put back.' })
    expect((screen.getByRole('radio', { name: 'A new folder What is here stays.' }) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(replace)
    expect(chose).toHaveBeenCalledWith('replace')
    expect(screen.getByText('It cannot be put back.').dataset.danger).toBeDefined()
    expect(await axeFindings()).toEqual([])
  })

  it('says what will be gone in a danger block, in words', async () => {
    renderShell(
      <Dialog open title="Replace your work?" onClose={() => {}} actions={<Button variant="danger">Replace and lose what is here</Button>}>
        <DialogFacts title="Bare fact" />
        <DialogDanger title="Northline and the 12 scopes under it will be gone.">It cannot be restored.</DialogDanger>
        <DialogDanger title="Only this" />
      </Dialog>,
    )
    expect(screen.getByText('Northline and the 12 scopes under it will be gone.')).toBeTruthy()
    expect(screen.getByText('It cannot be restored.')).toBeTruthy()
    expect(await axeFindings()).toEqual([])
  })
})

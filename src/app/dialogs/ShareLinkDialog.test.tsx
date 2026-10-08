// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { axeFindings } from '../testing/axe'
import { translator } from '../../i18n'
import { renderShell } from '../testing/renderShell'
import { ShareLinkDialog } from './ShareLinkDialog'

afterEach(() => cleanup())

const s = translator('en')
const LINK = 'https://work.example/#place?scope=acme&page=decisions&id=adr-1'

describe('ShareLinkDialog, as axe reads it', () => {
  it('finds nothing with a link, or with the sentence in its place', async () => {
    renderShell(<ShareLinkDialog answer={{ link: LINK }} onCopy={() => {}} onClose={() => {}} s={s} />)
    expect(await axeFindings()).toEqual([])
    cleanup()
    renderShell(<ShareLinkDialog answer={{ refused: 'share.noAddress' }} onCopy={() => {}} onClose={() => {}} s={s} />)
    expect(await axeFindings()).toEqual([])
  })
})

describe('ShareLinkDialog', () => {
  it('shows the link in a field named for it, read only, and copies it again on Copy link', () => {
    const onCopy = vi.fn()
    renderShell(<ShareLinkDialog answer={{ link: LINK }} onCopy={onCopy} onClose={() => {}} s={s} />)
    const field = screen.getByRole('textbox', { name: 'Link to this place' }) as HTMLInputElement
    expect(field.value).toBe(LINK)
    expect(field.readOnly).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    expect(onCopy).toHaveBeenCalledTimes(1)
  })

  it('says why there is no link, and offers nothing to copy', () => {
    const onClose = vi.fn()
    renderShell(<ShareLinkDialog answer={{ refused: 'share.noAddress' }} onCopy={() => {}} onClose={onClose} s={s} />)
    expect(screen.getByTestId('share-refused').textContent).toBe(s('share.noAddress'))
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Copy link' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('is shut with nothing to show', () => {
    renderShell(<ShareLinkDialog answer={undefined} onCopy={() => {}} onClose={() => {}} s={s} />)
    expect(screen.queryByTestId('share-link-dialog')).toBeNull()
  })
})

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * *Copy link* on one record (ADR-0033, amended 11 October 2026): the place
 * it names, on the source's address, copied and shown — or why there is no
 * link, with nothing copied.
 */
import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { translator } from '../i18n'
import { useShareLink } from './useShareLink'

function hook(address: string | undefined) {
  const copyText = vi.fn(() => Promise.resolve())
  const notify = vi.fn()
  const view = renderHook(() => useShareLink({
    address: () => address, screen: () => undefined, copyText, diagnostics: { report: vi.fn() }, notify, s: translator('en'),
  }))
  return { ...view, copyText, notify }
}

describe('a link to one record', () => {
  it('names the place it is on, whatever is on screen, and is copied and shown', async () => {
    const { result, copyText, notify } = hook('https://work.example/')
    act(() => result.current.shareTo({ scope: 'acme', page: 'observations', id: 'ob-1', tab: 'analysis' }))
    const link = 'https://work.example/#/acme/-/observations/ob-1?tab=analysis'
    expect(result.current.answer).toEqual({ link })
    expect(copyText).toHaveBeenCalledWith(link)
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Link copied', 'success'))
  })

  it('says why where the source has no address, and copies nothing', () => {
    const { result, copyText } = hook(undefined)
    act(() => result.current.shareTo({ scope: 'acme', page: 'decisions', id: 'adr-1' }))
    expect(result.current.answer).toEqual({ refused: 'share.noAddress' })
    expect(copyText).not.toHaveBeenCalled()
  })
})

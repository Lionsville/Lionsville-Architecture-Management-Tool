// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * *Copy link* on a record: the source's address and the place, or why there
 * is no link (ADR-0033, amended).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { translator } from '../i18n'
import { useRecordLink } from './useShareLink'

afterEach(() => cleanup())

const s = translator('en')

function mount(over: {
  address?: () => string | undefined
  copyText?: (text: string) => Promise<void>
} = {}) {
  const notify = vi.fn()
  const report = vi.fn()
  const copyText = over.copyText ?? vi.fn(async () => undefined)
  const { result } = renderHook(() => useRecordLink({
    address: over.address, scope: 'acme/rail', copyText, diagnostics: { report }, notify, s,
  }))
  return { result, notify, report, copyText }
}

describe('a link to one record', () => {
  it('copies the link and shows it, tab included', async () => {
    const { result, notify, copyText } = mount({ address: () => 'https://work.example/acme' })
    await act(async () => { result.current.copyRecord('observations', 'so-1', 'solutions') })
    expect(copyText).toHaveBeenCalledWith('https://work.example/acme#place?scope=acme%2Frail&page=observations&id=so-1&tab=solutions')
    expect(notify).toHaveBeenCalledWith('Link copied', 'success')
    expect(result.current.answer).toEqual({
      link: 'https://work.example/acme#place?scope=acme%2Frail&page=observations&id=so-1&tab=solutions',
    })
    await act(async () => { result.current.copy() })
    expect(copyText).toHaveBeenCalledTimes(2)
  })

  it('says why there is no link, and copies nothing', async () => {
    const { result, notify, copyText } = mount({ address: () => undefined })
    await act(async () => { result.current.copyRecord('decisions', 'adr-1') })
    expect(copyText).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
    expect(result.current.answer).toEqual({ refused: 'share.noAddress' })
    act(() => { result.current.copy() })
    expect(copyText).not.toHaveBeenCalled()
    act(() => { result.current.close() })
    expect(result.current.answer).toBeUndefined()
  })

  it('says the copy was refused, and a source that cannot say its address', async () => {
    const refused = mount({
      address: () => 'https://work.example/',
      copyText: async () => { throw new Error('denied') },
    })
    await act(async () => { refused.result.current.copyRecord('plan', 'tr-1') })
    expect(refused.report).toHaveBeenCalled()
    expect(refused.notify).toHaveBeenCalledWith(expect.stringContaining('could not be copied'), 'warning')

    const fallen = mount({ address: () => { throw new Error('down') } })
    await act(async () => { fallen.result.current.copyRecord('plan', 'tr-1') })
    expect(fallen.report).toHaveBeenCalled()
    expect(fallen.result.current.answer).toEqual({ refused: 'share.noAddress' })
  })
})

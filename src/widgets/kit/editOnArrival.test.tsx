// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { askToEdit, takeEditAsked, useEditAsked } from './editOnArrival'

afterEach(() => cleanup())

describe('opening a record already being written', () => {
  it('is taken once, by the page and record it was asked of', () => {
    askToEdit('document', 'crm')
    expect(takeEditAsked('blocks', 'crm')).toBe(false)
    expect(takeEditAsked('document', 'erp')).toBe(false)
    expect(takeEditAsked('document', 'crm')).toBe(true)
    expect(takeEditAsked('document', 'crm')).toBe(false)
  })

  it('starts the page that opens on the record asked, and the one already up when asked', () => {
    const start = vi.fn()
    askToEdit('document', 'crm')
    const { rerender } = renderHook(({ id }) => useEditAsked('document', id, start), { initialProps: { id: 'crm' } })
    expect(start).toHaveBeenCalledTimes(1)
    rerender({ id: 'erp' })
    expect(start).toHaveBeenCalledTimes(1)
    act(() => askToEdit('document', 'erp'))
    expect(start).toHaveBeenCalledTimes(2)
  })
})

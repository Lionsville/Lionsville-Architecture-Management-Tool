// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The located mark (ADR-0033, amended 11 October 2026): an id is found by its
 * attribute whatever it holds, the thing is brought on screen once it paints
 * — later than the selection, too — and the ring is a rule only while it is
 * on.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { locatedRing, locatedSelector, useLocated } from './useLocated'

afterEach(() => cleanup())

describe('the located mark', () => {
  it('finds an id by its attribute whatever characters it holds', () => {
    const page = document.createElement('div')
    const odd = 'a "quoted" \\ id]'
    const row = document.createElement('div')
    row.setAttribute('data-key', odd)
    page.appendChild(row)
    expect(page.querySelector(locatedSelector(odd, 'data-key'))).toBe(row)
  })

  it('rings nothing while nothing is located', () => {
    expect(locatedRing(undefined)).toEqual({})
    expect(Object.keys(locatedRing('x'))).toEqual(['& [data-element-id="x"]'])
  })

  it('selects at once, and brings the thing on screen when it paints after the selection', async () => {
    const page = document.createElement('div')
    document.body.appendChild(page)
    const select = vi.fn()
    const { result } = renderHook(() => useLocated({ current: page }, select))
    act(() => result.current.locate('late'))
    expect(select).toHaveBeenCalledWith('late')
    expect(result.current.locatedId).toBe('late')
    await new Promise((resolve) => setTimeout(resolve, 50))
    const row = document.createElement('div')
    row.setAttribute('data-element-id', 'late')
    const scrolled = vi.fn()
    row.scrollIntoView = scrolled
    page.appendChild(row)
    await waitFor(() => expect(scrolled).toHaveBeenCalledTimes(1))
    page.remove()
  })
})

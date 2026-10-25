// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A column's width is the reader's (ADR-0044 §4): kept per seam by whatever
 * the shell hands down, back at that width next time, and a page that
 * switches between screens keeps one per screen.
 */
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { SeamWidthsProvider, useSeamWidth, useSeamWidthsOf } from './useSeamWidth'
import type { SeamWidths } from './useSeamWidth'

afterEach(() => cleanup())

/** What the shell keeps, as a map. */
function kept(start: Record<string, number> = {}): SeamWidths & { held: Map<string, number> } {
  const held = new Map(Object.entries(start))
  return { held, widthOf: (seam) => held.get(seam), keep: (seam, width) => { held.set(seam, width) } }
}

const within = (widths: SeamWidths) => ({ children }: { children: ReactNode }) => <SeamWidthsProvider value={widths}>{children}</SeamWidthsProvider>

describe('a seam’s width', () => {
  it('starts where it was left, and keeps where it is dragged to', () => {
    const widths = kept({ 'history.list': 360 })
    const { result } = renderHook(() => useSeamWidth('history.list', 300), { wrapper: within(widths) })
    expect(result.current[0]).toBe(360)
    act(() => result.current[1](420))
    expect(result.current[0]).toBe(420)
    expect(widths.held.get('history.list')).toBe(420)
    // The next page that has the seam opens at it.
    const again = renderHook(() => useSeamWidth('history.list', 300), { wrapper: within(widths) })
    expect(again.result.current[0]).toBe(420)
  })

  it('is the default with nothing kept, and lasts as long as the page with nothing handed down', () => {
    const { result } = renderHook(() => useSeamWidth('people.aside', 400))
    expect(result.current[0]).toBe(400)
    act(() => result.current[1](500))
    expect(result.current[0]).toBe(500)
  })

  it('keeps one per screen of a page that switches between them', () => {
    const widths = kept({ 'observations.reader.analysis': 500 })
    const { result } = renderHook(() => useSeamWidthsOf('observations.reader', { register: 640, analysis: 420 }), { wrapper: within(widths) })
    expect(result.current[0]).toEqual({ register: 640, analysis: 500 })
    act(() => result.current[1]('register', 700))
    expect(result.current[0]).toEqual({ register: 700, analysis: 500 })
    expect(widths.held.get('observations.reader.register')).toBe(700)
  })
})

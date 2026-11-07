// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { frameStore, throughGuard } from './frameStore'
import { useHostWithOwnWork } from './unsavedTogether'

afterEach(() => cleanup())

describe('what closing the window would lose', () => {
  it('stays yes while either the document or an editor holds work', () => {
    const report = vi.fn()
    const frame = frameStore()
    const { result } = renderHook(() => useHostWithOwnWork({ onUnsavedWork: report }, frame))
    act(() => frame.set({ work: { state: 'dirty' } }))
    expect(report).toHaveBeenLastCalledWith(true)
    act(() => result.current.onUnsavedWork?.(false))
    expect(report).toHaveBeenCalledTimes(1)
    act(() => result.current.onUnsavedWork?.(true))
    act(() => frame.set({ work: { state: 'saved' } }))
    expect(report).toHaveBeenCalledTimes(1)
    act(() => result.current.onUnsavedWork?.(false))
    expect(report).toHaveBeenLastCalledWith(false)
  })
})

describe('a move through the guard', () => {
  it('is made where nothing guards it, or the guard lets it by, and held where it takes it', () => {
    const go = vi.fn()
    throughGuard(undefined, { page: 'home' }, go)
    const frame = frameStore()
    throughGuard(frame, { page: 'home' }, go)
    frame.set({ guard: () => false })
    throughGuard(frame, { page: 'home' }, go)
    expect(go).toHaveBeenCalledTimes(3)
    frame.set({ guard: () => true })
    throughGuard(frame, { page: 'home' }, go)
    expect(go).toHaveBeenCalledTimes(3)
  })
})

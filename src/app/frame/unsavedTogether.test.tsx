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
    act(() => { frame.set({ work: { state: 'dirty' } }) })
    expect(report).toHaveBeenLastCalledWith(true)
    act(() => { result.current.onUnsavedWork?.(false) })
    expect(report).toHaveBeenCalledTimes(1)
    act(() => { result.current.onUnsavedWork?.(true) })
    act(() => { frame.set({ work: { state: 'saved' } }) })
    expect(report).toHaveBeenCalledTimes(1)
    act(() => { result.current.onUnsavedWork?.(false) })
    expect(report).toHaveBeenLastCalledWith(false)
  })
})

describe('what the place refused, told apart from a write to come', () => {
  it('counts refused writes outside the open scope, and the open scope’s refused changes in place of a write', () => {
    const report = vi.fn()
    const refused = vi.fn()
    const frame = frameStore()
    let held: readonly unknown[] = []
    const listeners = new Set<() => void>()
    const refusals = { list: () => held as never, subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } } }
    const { result } = renderHook(() => useHostWithOwnWork({ onUnsavedWork: report, onRefusedWork: refused }, frame, undefined, refusals))
    act(() => { held = [{ id: 1 }]; for (const listener of listeners) listener() })
    expect(refused).toHaveBeenLastCalledWith(1)
    expect(report).not.toHaveBeenCalled()
    // The session refused: its document is dirty, but no write is coming for what it holds.
    act(() => { result.current.onUnsavedWork?.(true) })
    expect(report).toHaveBeenLastCalledWith(true)
    act(() => {
      frame.set({ screen: { kind: 'workspace', path: 'a', name: 'A', notWritten: { rows: () => [{ key: 'activity.nothing' }, { key: 'activity.nothing' }], retry: () => Promise.resolve(false), putBack: () => Promise.resolve(true) } } })
    })
    expect(report).toHaveBeenLastCalledWith(false)
    expect(refused).toHaveBeenLastCalledWith(3)
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

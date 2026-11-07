// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useOutOfSight, watchOutOfSight } from './outOfSight'

const WORDS = { title: 'Export waiting', body: 'Bring it back' }

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })
  document.dispatchEvent(new Event('visibilitychange'))
}

class Sent {
  static permission = 'granted'
  static all: Sent[] = []
  closed = false
  title: string
  options: { body: string }
  constructor(title: string, options: { body: string }) {
    this.title = title
    this.options = options
    Sent.all.push(this)
  }
  close() { this.closed = true }
}

beforeEach(() => {
  Sent.permission = 'granted'
  Sent.all = []
  vi.stubGlobal('Notification', Sent)
  document.title = 'Landscape'
})
afterEach(() => {
  cleanup()
  setVisibility('visible')
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('work in a window out of sight', () => {
  it('says nothing while the window can be seen', () => {
    const { result } = renderHook(() => useOutOfSight(true, WORDS))
    expect(result.current).toBe(false)
    expect(document.title).toBe('Landscape')
    expect(Sent.all).toEqual([])
  })

  it('says so at once when the window goes, outside it too, and takes it back when the window returns', () => {
    const { result } = renderHook(() => useOutOfSight(true, WORDS))
    act(() => setVisibility('hidden'))
    expect(result.current).toBe(true)
    expect(document.title).toBe('Export waiting')
    expect(Sent.all.map((one) => [one.title, one.options.body])).toEqual([['Export waiting', 'Bring it back']])
    act(() => setVisibility('visible'))
    expect(result.current).toBe(false)
    expect(document.title).toBe('Landscape')
    expect(Sent.all[0].closed).toBe(true)
  })

  it('says so of a window that was already gone when the work began', () => {
    setVisibility('hidden')
    const { result } = renderHook(() => useOutOfSight(true, WORDS))
    expect(result.current).toBe(true)
  })

  it('watches only while there is work, and leaves the title as it found it when the work ends unseen', () => {
    const { result, rerender } = renderHook(({ working }) => useOutOfSight(working, WORDS), { initialProps: { working: false } })
    act(() => setVisibility('hidden'))
    expect(result.current).toBe(false)
    rerender({ working: true })
    expect(document.title).toBe('Export waiting')
    rerender({ working: false })
    expect(result.current).toBe(false)
    expect(document.title).toBe('Landscape')
    expect(Sent.all[0].closed).toBe(true)
  })

  it('leaves alone a title something else moved meanwhile', () => {
    renderHook(() => useOutOfSight(true, WORDS))
    act(() => setVisibility('hidden'))
    document.title = 'Another scope'
    act(() => setVisibility('visible'))
    expect(document.title).toBe('Another scope')
  })

  it('asks nobody for permission to notify', () => {
    Sent.permission = 'default'
    const asked = vi.fn()
    Object.assign(Sent, { requestPermission: asked })
    const { result } = renderHook(() => useOutOfSight(true, WORDS))
    act(() => setVisibility('hidden'))
    expect(result.current).toBe(true)
    expect(Sent.all).toEqual([])
    expect(asked).not.toHaveBeenCalled()
  })

  it('tells a covered window by its frames, though it still says visible, and a blocked thread is not that', () => {
    vi.useFakeTimers()
    let drawn: FrameRequestCallback | undefined
    vi.stubGlobal('requestAnimationFrame', (next: FrameRequestCallback) => { drawn = next; return 1 })
    vi.stubGlobal('cancelAnimationFrame', () => {})
    const on = { gone: vi.fn(), back: vi.fn() }
    const stop = watchOutOfSight(on)
    // The clock and the frames held up alike: a long task. The next tick sees the frame old, but its own last tick old too.
    vi.setSystemTime(Date.now() + 5000)
    vi.advanceTimersByTime(500)
    expect(on.gone).not.toHaveBeenCalled()
    drawn!(0)
    // The clock runs and no frame comes.
    vi.advanceTimersByTime(2500)
    expect(on.gone).toHaveBeenCalledOnce()
    drawn!(0)
    expect(on.back).toHaveBeenCalledOnce()
    stop()
  })
})

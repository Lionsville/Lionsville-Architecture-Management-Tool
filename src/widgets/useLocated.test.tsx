// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The ring on what an address, a finder or a focus just brought into view.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useRef } from 'react'
import { act, cleanup, fireEvent, render, renderHook } from '@testing-library/react'
import { LOCATED_FOR_MS, locatedMark, useLocated } from './useLocated'

afterEach(() => cleanup())

describe('the ring', () => {
  it('is a rule keyed by the id, and none when nothing is located', () => {
    expect(locatedMark(undefined)).toEqual({})
    expect(locatedMark('billing')).toEqual({
      '& [data-element-id="billing"]': {
        outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2, borderRadius: 1,
      },
      '& .react-flow__node[data-id="billing"]': {
        outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2, borderRadius: 1,
      },
    })
  })
})

describe('locating', () => {
  afterEach(() => { vi.useRealTimers() })

  function mount() {
    const select = vi.fn()
    const scrolled = vi.fn()
    const root = document.createElement('div')
    const card = document.createElement('div')
    card.dataset.elementId = 'billing'
    card.scrollIntoView = scrolled
    root.append(card)
    document.body.append(root)
    const { result } = renderHook(() => {
      const ref = useRef<HTMLElement | null>(root)
      return useLocated(ref, select)
    })
    return { result, select, scrolled }
  }

  it('selects, scrolls the record into view, and clears the ring', () => {
    vi.useFakeTimers()
    const { result, select, scrolled } = mount()
    act(() => result.current.locate('billing'))
    expect(select).toHaveBeenCalledWith('billing')
    expect(scrolled).toHaveBeenCalledWith({ block: 'center', inline: 'center', behavior: 'smooth' })
    expect(result.current.locatedId).toBe('billing')
    act(() => { vi.advanceTimersByTime(LOCATED_FOR_MS) })
    expect(result.current.locatedId).toBeUndefined()
  })

  it('rings without selecting, for a board that has already focused', () => {
    vi.useFakeTimers()
    const { result, select } = mount()
    act(() => result.current.show('billing'))
    expect(select).not.toHaveBeenCalled()
    expect(result.current.locatedId).toBe('billing')
  })

  it('scrolls a board node by its canvas id', () => {
    const scrolled = vi.fn()
    const root = document.createElement('div')
    const node = document.createElement('div')
    node.className = 'react-flow__node'
    node.dataset.id = 'wms'
    node.scrollIntoView = scrolled
    root.append(node)
    const { result } = renderHook(() => useLocated({ current: root }, vi.fn()))
    act(() => result.current.locate('wms'))
    expect(scrolled).toHaveBeenCalled()
  })

  it('drops a ring that is still up when the screen goes', () => {
    vi.useFakeTimers()
    const clear = vi.spyOn(globalThis, 'clearTimeout')
    const { result, unmount } = renderHook(() => useLocated({ current: null }, vi.fn()))
    act(() => result.current.show('billing'))
    unmount()
    expect(clear).toHaveBeenCalled()
    clear.mockRestore()
  })
})

/** A render, so the hook's ref is a real one in the tree as a page uses it. */
it('reads the node from the ref it was handed', () => {
  const scrolled = vi.fn()
  function Page() {
    const ref = useRef<HTMLDivElement>(null)
    const located = useLocated(ref, () => undefined)
    return (
      <div ref={ref}>
        <button type="button" onClick={() => located.locate('row')}>go</button>
        <div data-element-id="row" ref={(node) => { if (node) node.scrollIntoView = scrolled }} />
      </div>
    )
  }
  const view = render(<Page />)
  fireEvent.click(view.getByRole('button'))
  expect(scrolled).toHaveBeenCalled()
})

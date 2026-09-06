// @vitest-environment jsdom
/**
 * The messages along the bottom: the state, and the bar that draws it.
 *
 * One slot, deliberately. A queue would mean the news from ten seconds ago is
 * still arriving while the user is trying to read the thing that just went
 * wrong; the whole design of `useStorageNotice`'s latch depends on the newest
 * message winning.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { hideAfter, ToastBar } from './ToastBar'
import { useToasts } from './useToasts'
import { renderShell } from './testing/renderShell'

afterEach(() => cleanup())

describe('useToasts', () => {
  it('starts with nothing to say', () => {
    const { result } = renderHook(() => useToasts())
    expect(result.current.toast).toBeNull()
    expect(result.current.open).toBe(false)
  })

  it('opens on the first message, at the severity asked for', () => {
    const { result } = renderHook(() => useToasts())
    act(() => result.current.notify('saved', 'success'))
    expect(result.current.toast?.message).toBe('saved')
    expect(result.current.toast?.severity).toBe('success')
    expect(result.current.open).toBe(true)
  })

  it('calls it information when nobody says otherwise', () => {
    const { result } = renderHook(() => useToasts())
    act(() => result.current.notify('something happened'))
    expect(result.current.toast?.severity).toBe('info')
  })

  it('replaces the standing message rather than queueing behind it', () => {
    const { result } = renderHook(() => useToasts())
    act(() => result.current.notify('first'))
    const first = result.current.toast!.key
    act(() => result.current.notify('second'))
    expect(result.current.toast?.message).toBe('second')
    // A new key is what restarts the bar's timer; without it the second message
    // inherits however much of the first one's five seconds was left.
    expect(result.current.toast?.key).not.toBe(first)
  })

  it('keeps the words while it slides away, and drops them once it is gone', () => {
    const { result } = renderHook(() => useToasts())
    act(() => result.current.notify('going'))
    act(() => result.current.close())
    expect(result.current.open).toBe(false)
    expect(result.current.toast?.message).toBe('going')
    act(() => result.current.exited())
    expect(result.current.toast).toBeNull()
  })
})

describe('ToastBar', () => {
  const toast = (severity: 'error' | 'success') => ({ key: 1, message: 'a message', severity })

  it('draws nothing at all when there is nothing to say', () => {
    renderShell(<ToastBar toast={null} open={false} onClose={() => {}} onExited={() => {}} />)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows the message and lets the reader dismiss it', () => {
    const onClose = vi.fn()
    renderShell(<ToastBar toast={toast('error')} open onClose={onClose} onExited={() => {}} />)
    expect(screen.getByRole('alert').textContent).toContain('a message')
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('gives an error longer on screen than anything else, because it has to be read', () => {
    expect(hideAfter('error')).toBeGreaterThan(hideAfter('success'))
    expect(hideAfter('success')).toBe(hideAfter(undefined))
  })
})

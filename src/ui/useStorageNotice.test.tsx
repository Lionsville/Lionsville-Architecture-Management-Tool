// @vitest-environment jsdom
/**
 * The brake on a message that would otherwise arrive on every keystroke.
 *
 * Storage that refuses does so for every autosave, four times a minute, for as
 * long as the tab is open. Without the latch the notice ispermanently on screen and
 * nobody reads it; with it, the news arrives once and the recovery arrives
 * once.
 */
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { translator } from '@lionsville/solution-design'
import { useStorageNotice } from './useStorageNotice'

function mount() {
  const notify = vi.fn()
  const { result } = renderHook(() => useStorageNotice(notify, translator('en')))
  return { notify, report: (ok: boolean) => result.current(ok) }
}

describe('useStorageNotice', () => {
  it('says nothing at all while writes are being accepted', () => {
    const { notify, report } = mount()
    report(true)
    report(true)
    expect(notify).not.toHaveBeenCalled()
  })

  it('reports a refusal once, however many times it happens', () => {
    const { notify, report } = mount()
    for (let i = 0; i < 20; i += 1) report(false)
    expect(notify).toHaveBeenCalledOnce()
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('could not save'), 'error')
  })

  it('says so when it works again, and then goes quiet', () => {
    const { notify, report } = mount()
    report(false)
    report(true)
    report(true)
    expect(notify).toHaveBeenCalledTimes(2)
    expect(notify).toHaveBeenLastCalledWith('Saving in this browser works again.', 'success')
  })

  it('can report a second outage after a recovery', () => {
    const { notify, report } = mount()
    report(false)
    report(true)
    report(false)
    expect(notify).toHaveBeenCalledTimes(3)
    expect(notify).toHaveBeenLastCalledWith(expect.stringContaining('could not save'), 'error')
  })
})

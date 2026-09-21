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
import { translator } from '../i18n'
import { useNearlyFullNotice, useStorageNotice } from './useStorageNotice'

function mount(sourceFailure?: (cause: unknown) => string | undefined) {
  const notify = vi.fn()
  const { result } = renderHook(() => useStorageNotice(notify, translator('en'), sourceFailure))
  return { notify, report: (ok: boolean, cause?: unknown) => result.current(ok, cause) }
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

/**
 * And the same brake over somebody else's sentence.
 *
 * Our sentence is about this browser's storage — full or blocked, save a working
 * file — which is right for the three sources that ship and wrong for anywhere
 * else: it names the wrong place and recommends the wrong remedy. So a source
 * that keeps work somewhere else says it itself, and may say nothing at all
 * because it has already said it somewhere of its own.
 */
describe('useStorageNotice, where the source has its own word for a refusal', () => {
  it('says the source\u2019s sentence instead of ours, and says it once', () => {
    const { notify, report } = mount((cause) => `Elsewhere would not take it: ${String(cause)}.`)
    report(false, 'signed out')
    report(false, 'signed out')
    expect(notify).toHaveBeenCalledOnce()
    expect(notify).toHaveBeenCalledWith('Elsewhere would not take it: signed out.', 'error')
  })

  it('is asked about every refusal, cause or no cause', () => {
    const asked: unknown[] = []
    const { report } = mount((cause) => { asked.push(cause); return 'No.' })
    report(false, new Error('gone'))
    expect(asked).toEqual([new Error('gone')])
  })

  it('says nothing at all where the source answered nothing', () => {
    const { notify, report } = mount(() => undefined)
    report(false)
    expect(notify).not.toHaveBeenCalled()
  })

  /**
   * And nothing on the way back either: the recovery sentence takes back the
   * failure sentence, and there was none to take back. A latch that had closed
   * over silence would answer a refusal nobody mentioned with "saving works
   * again".
   */
  it('does not say saving works again after a refusal it never mentioned', () => {
    const { notify, report } = mount(() => undefined)
    report(false)
    report(true)
    expect(notify).not.toHaveBeenCalled()
  })

  /** And the next one is asked afresh: by then the source may have a word for it. */
  it('asks again after a refusal it had nothing to say about', () => {
    let word: string | undefined = undefined
    const { notify, report } = mount(() => word)
    report(false)
    word = 'Elsewhere is refusing.'
    report(false)
    expect(notify).toHaveBeenCalledOnce()
    expect(notify).toHaveBeenCalledWith('Elsewhere is refusing.', 'error')
  })
})

/**
 * The same brake, on the warning that comes before the refusal rather than
 * after it. A quota is reached in silence, so this is the only chance anybody
 * gets to move their work somewhere safe while it still fits.
 */
function mountFull() {
  const notify = vi.fn()
  const { result } = renderHook(() => useNearlyFullNotice(notify, translator('en')))
  return { notify, report: (used: number, budget = 100) => result.current({ used, budget }) }
}

describe('useNearlyFullNotice', () => {
  it('says nothing while there is room', () => {
    const { notify, report } = mountFull()
    report(10)
    report(79)
    expect(notify).not.toHaveBeenCalled()
  })

  it('says so once, however many saves go past the line', () => {
    const { notify, report } = mountFull()
    report(80)
    report(85)
    report(90)
    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify.mock.calls[0][0]).toContain('80%')
    expect(notify.mock.calls[0][1]).toBe('warning')
  })

  it('says so again after there has been room in between', () => {
    const { notify, report } = mountFull()
    report(90)
    report(20)
    report(95)
    expect(notify).toHaveBeenCalledTimes(2)
  })

  it('does not divide by a budget of nothing', () => {
    const { notify, report } = mountFull()
    report(10, 0)
    expect(notify).not.toHaveBeenCalled()
  })
})

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The failures a boundary never sees: a throw in a listener, a timer, or a
 * promise nobody handled. Before this hook they happened in silence.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { translator } from '../i18n'
import { RecordingDiagnostics } from '../adapters/memory/RecordingDiagnostics'
import { useGlobalErrors } from './useGlobalErrors'
import { problemOffer } from './problem'
import type { Problem, ProblemOffer } from './problem'

afterEach(() => cleanup())

function mount(over: { throttleMs?: number; now?: () => number; problem?: ProblemOffer } = {}) {
  const diagnostics = new RecordingDiagnostics()
  const notify = vi.fn()
  function Host() {
    useGlobalErrors({ diagnostics, notify, s: translator('en'), ...over })
    return null
  }
  const view = render(<Host />)
  return { diagnostics, notify, view }
}

const throwAt = (message: string) =>
  window.dispatchEvent(new ErrorEvent('error', { message, error: new Error(message) }))

/**
 * jsdom has no `PromiseRejectionEvent`, and a real unhandled rejection is not
 * something a test can raise on demand anyway. The listener is registered on
 * `unhandledrejection` and reads `event.reason`; an Event carrying that field
 * exercises exactly the same path.
 */
const rejectWith = (reason: unknown) => {
  const event = new Event('unhandledrejection') as Event & { reason: unknown }
  event.reason = reason
  window.dispatchEvent(event)
}

describe('useGlobalErrors', () => {
  it('records an uncaught throw, with what was thrown', () => {
    const { diagnostics } = mount()
    throwAt('a timer fell over')
    const [entry] = diagnostics.recent()
    expect(entry.level).toBe('error')
    expect(entry.message).toBe('uncaught error')
    expect((entry.cause as Error).message).toBe('a timer fell over')
  })

  it('ignores the resize observer notice, which is not a failure', () => {
    const { diagnostics, notify } = mount()
    window.dispatchEvent(new ErrorEvent('error', {
      message: 'ResizeObserver loop completed with undelivered notifications.',
    }))
    expect(diagnostics.recent()).toEqual([])
    expect(notify).not.toHaveBeenCalled()
  })

  it('records an unhandled rejection too', () => {
    const { diagnostics } = mount()
    rejectWith(new Error('nobody caught this'))
    expect(diagnostics.messages()).toEqual(['unhandled rejection'])
  })

  it('says so, once', () => {
    const { notify } = mount()
    throwAt('first')
    expect(notify).toHaveBeenCalledWith(
      'Something unexpected went wrong. If the screen stops responding, reload the page.', 'error')
  })

  it('reports every one but shows one notice: a broken loop must not paper the screen', () => {
    const clock = 1000
    const { notify, diagnostics } = mount({ throttleMs: 10_000, now: () => clock })
    for (let i = 0; i < 20; i += 1) throwAt(`tick ${i}`)
    expect(diagnostics.recent()).toHaveLength(20)
    expect(notify).toHaveBeenCalledOnce()
  })

  it('speaks again once the window has passed', () => {
    let clock = 1000
    const { notify } = mount({ throttleMs: 10_000, now: () => clock })
    throwAt('first')
    clock += 10_001
    throwAt('second')
    expect(notify).toHaveBeenCalledTimes(2)
  })

  it('lets go of the window when it unmounts', () => {
    const { diagnostics, view } = mount()
    view.unmount()
    // Message only, no `error`: once our listener is gone the runner's own
    // handler picks the event up, and a real Error there fails the file.
    window.dispatchEvent(new ErrorEvent('error', { message: 'after the app is gone' }))
    expect(diagnostics.recent()).toHaveLength(0)
  })

  it('says nothing more than it did where no provider offers an action on a problem', () => {
    const { notify } = mount()
    throwAt('a timer fell over')
    expect(notify).toHaveBeenCalledWith('Something unexpected went wrong. If the screen stops responding, reload the page.', 'error')
    expect(notify.mock.calls[0]).toHaveLength(2)
  })

  it('carries the provider\u2019s action on a problem, and hands over what was thrown when pressed', () => {
    const handed: Problem[] = []
    const problem = problemOffer({ labelKey: 'x', run: (one) => handed.push(one) }, () => 'Pass it on', () => undefined)
    const { notify } = mount({ problem })
    throwAt('a timer fell over')
    const action = notify.mock.calls[0][2] as { label: string; onClick: () => void }
    expect(action.label).toBe('Pass it on')
    action.onClick()
    expect(handed[0]).toMatchObject({ where: 'window', key: 'shell.unexpectedError', name: 'Error', message: 'a timer fell over' })
  })
})

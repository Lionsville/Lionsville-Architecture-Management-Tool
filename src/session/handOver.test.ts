// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it, vi } from 'vitest'
import { handOver } from './handOver'

describe('a document handed over', () => {
  const said = () => ({ saved: vi.fn(), failed: vi.fn() })

  it('is said to be saved once it is, and not before', async () => {
    const words = said()
    let done: () => void = () => {}
    const going = handOver(() => new Promise<void>((resolve) => { done = resolve }), words)
    await Promise.resolve()
    expect(words.saved).not.toHaveBeenCalled()
    done()
    await going
    expect(words.saved).toHaveBeenCalledOnce()
  })

  it('says nothing at all of a dialog the person closed', async () => {
    const words = said()
    await handOver(() => Promise.resolve('cancelled'), words)
    expect(words.saved).not.toHaveBeenCalled()
    expect(words.failed).not.toHaveBeenCalled()
  })

  it('tells a caller that keeps a log that the dialog was closed', async () => {
    const cancelled = vi.fn()
    await handOver(() => Promise.resolve('cancelled'), { ...said(), cancelled })
    expect(cancelled).toHaveBeenCalledOnce()
  })

  it('says why, for a refusal and for a gateway that throws', async () => {
    const words = said()
    await handOver(() => Promise.reject(new Error('full')), words)
    await handOver(() => { throw new Error('broken') }, words)
    expect(words.failed).toHaveBeenCalledTimes(2)
    expect(words.saved).not.toHaveBeenCalled()
  })
})

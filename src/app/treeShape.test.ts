// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Command, DesignElement } from '../model'
import { changesTreeShape, watchTreeShape } from './treeShape'
import type { SessionChange } from './useModelSession'

/**
 * Which steps the tree hears about, and the one read after a burst of them:
 * a source whose changes travel as steps has no save to read the tree again on.
 */
const element: DesignElement = {
  id: 'wms', kind: 'application', name: 'WMS', lifecycle: 'live', isManaged: true, aspects: {},
}

function change(...commands: Command[]): SessionChange {
  return { kind: 'step', changeId: 'c', stepId: 's', commands, at: 0, revision: 1 }
}

afterEach(() => vi.useRealTimers())

describe('changesTreeShape', () => {
  it('is a record made, removed or linked, or a row made or removed', () => {
    expect(changesTreeShape({ type: 'element.create', element })).toBe(true)
    expect(changesTreeShape({ type: 'element.delete', id: 'wms' })).toBe(true)
    expect(changesTreeShape({ type: 'relation.delete', id: 'r1' } as Command)).toBe(true)
  })

  it('is a rename, and not a description or anything else about a record', () => {
    expect(changesTreeShape({ type: 'element.update', id: 'wms', patch: { name: 'Warehouse' } })).toBe(true)
    expect(changesTreeShape({ type: 'element.update', id: 'wms', patch: { description: 'Stock' } })).toBe(false)
    expect(changesTreeShape({ type: 'diagram.rename', id: 'l7', name: 'Now' } as Command)).toBe(false)
  })
})

describe('watchTreeShape', () => {
  function seam() {
    let heard: ((change: SessionChange) => void) | undefined
    const stopped = vi.fn()
    const onChange = (listener: (change: SessionChange) => void) => { heard = listener; return stopped }
    return { onChange, say: (one: SessionChange) => heard?.(one), stopped }
  }

  it('reads the tree once after a burst of steps that change its shape, and not for the others', () => {
    vi.useFakeTimers()
    const { onChange, say } = seam()
    const readAgain = vi.fn()
    watchTreeShape(onChange, readAgain, 100)
    say(change({ type: 'element.update', id: 'wms', patch: { description: 'Stock' } }))
    vi.advanceTimersByTime(200)
    expect(readAgain).not.toHaveBeenCalled()
    say(change({ type: 'element.create', element }))
    vi.advanceTimersByTime(50)
    say(change({ type: 'element.update', id: 'wms', patch: { name: 'Warehouse' } }))
    vi.advanceTimersByTime(99)
    expect(readAgain).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(readAgain).toHaveBeenCalledOnce()
  })

  it('stops listening, and drops a read still waiting, when it is stopped', () => {
    vi.useFakeTimers()
    const { onChange, say, stopped } = seam()
    const readAgain = vi.fn()
    const stop = watchTreeShape(onChange, readAgain, 100)
    say(change({ type: 'element.delete', id: 'wms' }))
    stop()
    vi.advanceTimersByTime(200)
    expect(stopped).toHaveBeenCalledOnce()
    expect(readAgain).not.toHaveBeenCalled()
  })

  /**
   * A step kept while the source is not there: a read then fails, and the
   * shell says so as an error nobody asked for. Skipped instead — the source
   * says the tree changed when it is back.
   */
  it('reads nothing while the source says it is not connected, asked when the read would be made', () => {
    vi.useFakeTimers()
    const { onChange, say } = seam()
    const readAgain = vi.fn()
    let up = true
    watchTreeShape(onChange, readAgain, 100, () => up)
    say(change({ type: 'element.create', element }))
    // The burst began online and settles after the connection went.
    up = false
    vi.advanceTimersByTime(100)
    expect(readAgain).not.toHaveBeenCalled()

    up = true
    say(change({ type: 'element.delete', id: 'wms' }))
    vi.advanceTimersByTime(100)
    expect(readAgain).toHaveBeenCalledOnce()
  })
})


// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV
// @vitest-environment jsdom

/**
 * The chart's zoom at a text size: opened at 150% it reads 150%, and a size
 * changed while it is up comes to what an open at that size says.
 */
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useChartZoom } from './useChartZoom'

const sized = (size: number | undefined) => {
  if (size === undefined) delete document.documentElement.dataset.textSize
  else document.documentElement.dataset.textSize = String(size)
}

afterEach(() => { cleanup(); sized(undefined) })

describe('the chart\'s zoom at a text size', () => {
  it('reads the same live as after a reload', async () => {
    sized(150)
    const reloaded = renderHook(() => useChartZoom({ current: null }, { current: null }))
    const atOpen = reloaded.result.current.zoom
    expect(atOpen).toBeCloseTo(1.5)
    reloaded.unmount()
    sized(100)
    const live = renderHook(() => useChartZoom({ current: null }, { current: null }))
    act(() => sized(150))
    await waitFor(() => expect(live.result.current.zoom).toBeCloseTo(atOpen))
  })
})

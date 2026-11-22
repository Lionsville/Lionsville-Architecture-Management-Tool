// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The assignment chosen on an organisation chart (ADR-0036 §7): one for the
 * workspace, on the chart it was chosen on, and let go only there.
 */
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useChartChoice } from './useChartChoice'

describe('the assignment chosen on a chart', () => {
  it('is the chart\'s it was chosen on, and no other\'s', () => {
    const { result } = renderHook(() => useChartChoice())
    expect(result.current.chosenOn('oc-1')).toBeUndefined()
    act(() => result.current.choose('oc-1', 'as-3'))
    expect(result.current.chosenOn('oc-1')).toBe('as-3')
    expect(result.current.chosenOn('oc-2')).toBeUndefined()
    act(() => result.current.choose('oc-2', 'as-4'))
    expect(result.current.chosenOn('oc-1')).toBeUndefined()
    expect(result.current.chosenOn('oc-2')).toBe('as-4')
  })

  it('is let go on its own chart, and not by another letting go of its own', () => {
    const { result } = renderHook(() => useChartChoice())
    act(() => result.current.choose('oc-1', 'as-3'))
    act(() => result.current.choose('oc-2', undefined))
    expect(result.current.chosenOn('oc-1')).toBe('as-3')
    act(() => result.current.choose('oc-1', undefined))
    expect(result.current.chosenOn('oc-1')).toBeUndefined()
  })

  it('stays the same object when the same is chosen again, so nothing draws for it', () => {
    const { result } = renderHook(() => useChartChoice())
    act(() => result.current.choose('oc-1', 'as-3'))
    const held = result.current
    act(() => result.current.choose('oc-1', 'as-3'))
    expect(result.current).toBe(held)
  })
})

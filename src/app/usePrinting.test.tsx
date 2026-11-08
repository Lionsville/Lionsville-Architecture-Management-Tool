// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePrinting } from './useShellPreferences'

describe('printing', () => {
  it('is said from the browser’s beforeprint to its afterprint, at once, so paper is drawn in the light theme', () => {
    const { result } = renderHook(() => usePrinting())
    expect(result.current).toBe(false)
    act(() => { window.dispatchEvent(new Event('beforeprint')) })
    expect(result.current).toBe(true)
    act(() => { window.dispatchEvent(new Event('afterprint')) })
    expect(result.current).toBe(false)
  })
})

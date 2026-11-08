// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV
// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { DENSITIES, DensityContext, densityFrom, useDensity } from './density'

describe('the one density', () => {
  it('is Comfortable or Compact, in that order', () => {
    expect(DENSITIES).toEqual(['comfortable', 'compact'])
  })

  it('reads anything but compact as the usual distance, the old list choices included', () => {
    expect(densityFrom('compact')).toBe('compact')
    for (const held of ['comfortable', 'normal', undefined, 3]) expect(densityFrom(held)).toBe('comfortable')
  })

  it('is the shell’s where it hands one down, and the page’s own with nothing above', () => {
    const choose = vi.fn()
    const wrapper = ({ children }: { children: ReactNode }) => <DensityContext.Provider value={['compact', choose]}>{children}</DensityContext.Provider>
    const held = renderHook(() => useDensity(), { wrapper })
    expect(held.result.current[0]).toBe('compact')
    held.result.current[1]('comfortable')
    expect(choose).toHaveBeenCalledWith('comfortable')

    const own = renderHook(() => useDensity())
    expect(own.result.current[0]).toBe('comfortable')
    act(() => own.result.current[1]('compact'))
    expect(own.result.current[0]).toBe('compact')
  })
})

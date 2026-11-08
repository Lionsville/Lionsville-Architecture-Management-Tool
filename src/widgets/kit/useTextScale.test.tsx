// @vitest-environment jsdom
// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { applyTextSize } from '../../platform/textSize'
import { useTextScale } from './useTextScale'

describe('useTextScale', () => {
  afterEach(() => applyTextSize(100))

  it('follows the person’s text size as it changes', async () => {
    const { result } = renderHook(() => useTextScale())
    expect(result.current).toBe(1)
    await act(async () => { applyTextSize(125); await Promise.resolve() })
    expect(result.current).toBe(1.25)
  })
})

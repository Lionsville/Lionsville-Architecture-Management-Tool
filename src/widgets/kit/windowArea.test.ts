// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { NO_WINDOW_AREA, showWindowArea } from './windowArea'

const root = () => document.documentElement

afterEach(() => showWindowArea(root(), NO_WINDOW_AREA))

describe('showWindowArea', () => {
  it('says the room the window keeps and that its top bar moves it, on the root', () => {
    showWindowArea(root(), { controls: 78, drag: true })
    expect(root().dataset['windowControls']).toBe('')
    expect(root().dataset['windowDrag']).toBe('')
    expect(root().style.getPropertyValue('--window-controls-w')).toBe('78px')
  })

  it('takes both back when the window asks nothing, as it does in full screen', () => {
    showWindowArea(root(), { controls: 78, drag: true })
    showWindowArea(root(), { controls: 0, drag: false })
    expect(root().dataset['windowControls']).toBeUndefined()
    expect(root().dataset['windowDrag']).toBeUndefined()
    expect(root().style.getPropertyValue('--window-controls-w')).toBe('')
  })
})

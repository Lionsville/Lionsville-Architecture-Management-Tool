// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV
// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { CanvasDock } from './CanvasDock'
import { canvasInsets } from './canvasRoom'
import { FIT_GAP } from './zoom'

afterEach(() => cleanup())

const at = (element: Element, box: { left: number; top: number; right: number; bottom: number }) => {
  element.getBoundingClientRect = () => ({ ...box, x: box.left, y: box.top, width: box.right - box.left, height: box.bottom - box.top, toJSON: () => box }) as DOMRect
}

describe('what a fit leaves room for', () => {
  // jsdom lays nothing out, so where each part stands is said for it.
  it('counts the dock, which says it floats by itself, on every canvas', () => {
    render(
      <div data-testid="pane">
        <CanvasDock zoom={1} onZoomIn={() => {}} onZoomOut={() => {}} onFit={() => {}} onHome={() => {}} data-testid="dock" />
      </div>,
    )
    const pane = screen.getByTestId('pane')
    at(pane, { left: 0, top: 0, right: 1200, bottom: 800 })
    at(screen.getByTestId('dock'), { left: 16, top: 744, right: 360, bottom: 784 })
    expect(canvasInsets(pane).bottom).toBe(56 + FIT_GAP)
  })

  it('finds a key beside the pane, in the element both sit in', () => {
    render(
      <div data-testid="work">
        <div data-testid="pane" />
        <div data-canvas-float="" data-testid="key" />
      </div>,
    )
    const pane = screen.getByTestId('pane')
    at(pane, { left: 0, top: 0, right: 1200, bottom: 800 })
    at(screen.getByTestId('key'), { left: 200, top: 700, right: 1180, bottom: 780 })
    expect(canvasInsets(pane).bottom).toBe(FIT_GAP)
    expect(canvasInsets(pane, screen.getByTestId('work')).bottom).toBe(100 + FIT_GAP)
  })
})

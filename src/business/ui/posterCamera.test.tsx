// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV
// @vitest-environment jsdom

import { act, cleanup, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { ViewerKeepProvider } from '../../widgets/useViewerKeep'
import type { ViewerKeep } from '../../widgets/useViewerKeep'
import { openingCamera, posterPlaceKey, rescaledKept, usePosterCamera } from './posterCamera'

/** A page larger than the window at any text size: it opens at the zoom a name reads at, from the top left. */
const PAGE = { width: 2400, height: 1600 }
const PANE = { width: 1400, height: 800 }
const INSETS = { top: 16, right: 16, bottom: 16, left: 16 }

const sized = (size: number) => { document.documentElement.dataset.textSize = String(size) }

afterEach(() => {
  cleanup()
  delete document.documentElement.dataset.textSize
})

function shelf(held: Record<string, unknown> = {}): ViewerKeep {
  return { read: (key) => held[key], keep: (key, value) => { held[key] = value } }
}

/** The camera on a pane of a size jsdom does not lay out, opened as the poster opens it. */
function opened(keep = shelf()) {
  const wrapper = ({ children }: { children: ReactNode }) => <ViewerKeepProvider value={keep}>{children}</ViewerKeepProvider>
  const hook = renderHook(() => usePosterCamera(PAGE, 'v1'), { wrapper })
  const pane = document.createElement('div')
  Object.defineProperty(pane, 'clientWidth', { value: PANE.width })
  Object.defineProperty(pane, 'clientHeight', { value: PANE.height })
  document.body.append(pane)
  const stage = document.createElement('div')
  pane.append(stage)
  act(() => {
    hook.result.current.attach(pane)
    hook.result.current.stage.current = stage
    hook.result.current.open()
  })
  return hook
}

describe('where the poster opens at a text size', () => {
  it('opens a first time at 150% with the rail and the journey at the top left, at the margins it has at 100%', () => {
    const at100 = openingCamera(PANE, PAGE, INSETS, 1)
    const at150 = openingCamera(PANE, PAGE, INSETS, 1.5)
    expect(at100).toEqual({ x: 16, y: 16, zoom: 0.9 })
    expect(at150).toEqual({ x: 16, y: 16, zoom: 1.35 })
  })

  it('opens a first time at 150% at the top left, on the pane, with nothing kept, at the margins the room leaves', () => {
    sized(150)
    const { result } = opened()
    expect(result.current.camera.current).toEqual({ x: 16, y: 16, zoom: 1.35 })
  })

  it('opens again at the new size, at the top left, when the size changes before the page is moved', async () => {
    const { result } = opened()
    expect(result.current.camera.current).toEqual({ x: 16, y: 16, zoom: 0.9 })
    await act(async () => { sized(150) })
    expect(result.current.camera.current).toEqual({ x: 16, y: 16, zoom: 1.35 })
  })

  it('grows about the middle when the size changes once the page has been moved', async () => {
    const { result } = opened()
    act(() => result.current.panBy(-200, -100))
    const before = result.current.camera.current
    await act(async () => { sized(150) })
    const after = result.current.camera.current
    expect(after.zoom).toBeCloseTo(1.35)
    const under = (at: typeof before) => ({ x: (PANE.width / 2 - at.x) / at.zoom, y: (PANE.height / 2 - at.y) / at.zoom })
    expect(under(after).x).toBeCloseTo(under(before).x)
    expect(under(after).y).toBeCloseTo(under(before).y)
  })

  it('reopens a place kept at 100% at 150% with the rail where it was left', () => {
    sized(150)
    const { result } = opened(shelf({ [posterPlaceKey('v1')]: { x: 16, y: -300, zoom: 0.9, scale: 1 } }))
    const camera = result.current.camera.current
    expect(camera.zoom).toBeCloseTo(1.35)
    // The page's left edge was at the window's: it stays there. The row at the top stays at the top.
    expect(camera.x).toBe(16)
    expect((16 - camera.y) / camera.zoom).toBeCloseTo((16 + 300) / 0.9)
  })
})

describe('a kept place at another text size', () => {
  it('keeps an edge of the page that was in the window where it was, and what was at the room edge there', () => {
    const kept = rescaledKept({ x: 40, y: -300, zoom: 0.9 }, 1.5, INSETS)
    expect(kept.x).toBe(40)
    // The page point under the room's top edge stays under it.
    expect((16 - kept.y) / kept.zoom).toBeCloseTo((16 + 300) / 0.9)
  })
})

describe('the tray opening beside the poster', () => {
  it('moves the page with the pane, so its left edge is not under the tray, and the kit\'s hold takes back the same amount', () => {
    const { result } = opened()
    const pane = result.current.pane.current as HTMLDivElement
    act(() => result.current.panBy(-200, 0))
    const was = result.current.camera.current
    pane.getBoundingClientRect = () => ({ left: 272, top: 0, right: 1400, bottom: 800, width: 1128, height: 800, x: 272, y: 0, toJSON: () => ({}) })
    act(() => result.current.besideMoved({ left: 0, width: PANE.width, height: PANE.height }))
    expect(result.current.camera.current).toEqual({ ...was, x: was.x + 272 })
  })

  it('fits a page that was at Fit to the room it has now', () => {
    const { result } = opened()
    const pane = result.current.pane.current as HTMLDivElement
    act(() => result.current.target.go('fit'))
    const fitBefore = result.current.camera.current
    pane.getBoundingClientRect = () => ({ left: 272, top: 0, right: 1400, bottom: 800, width: 1128, height: 800, x: 272, y: 0, toJSON: () => ({}) })
    // Measured narrower before, so the page was not at Fit for that room: it only moves with the pane.
    act(() => result.current.besideMoved({ left: 0, width: 900, height: PANE.height }))
    expect(result.current.camera.current).toEqual({ ...fitBefore, x: fitBefore.x + 272 })
    act(() => result.current.panBy(5, 0))
    // At Fit for the room it had: fitted again to the pane as it is, then moved with it.
    const refit = result.current.camera.current
    act(() => result.current.target.go('fit'))
    const fitted = result.current.camera.current
    act(() => result.current.besideMoved({ left: 0, width: PANE.width, height: PANE.height }))
    expect(result.current.camera.current).toEqual({ ...fitted, x: fitted.x + 272 })
    expect(refit.x).not.toBe(fitted.x)
  })
})

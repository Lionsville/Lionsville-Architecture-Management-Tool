// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { canvasZoomProps, clampZoom, modZoomKey, plainZoomKey, readingDistance, stepZoom, wheelFactor, zoomAbout, ZOOM_CEILING, ZOOM_FLOOR } from './zoom'
import type { ZoomChord } from './zoom'

const chord = (over: Partial<ZoomChord>): ZoomChord => ({ key: '', code: '', metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...over })

describe('the zoom of a canvas', () => {
  it('stops at 60% and 200%', () => {
    expect(ZOOM_FLOOR).toBe(0.6)
    expect(ZOOM_CEILING).toBe(2)
    expect(clampZoom(0.1)).toBe(0.6)
    expect(clampZoom(9)).toBe(2)
  })

  it('steps to the next round number, either way', () => {
    expect(stepZoom(0.72, 'in')).toBeCloseTo(0.8)
    expect(stepZoom(0.72, 'out')).toBeCloseTo(0.7)
    expect(stepZoom(1, 'in')).toBeCloseTo(1.1)
    expect(stepZoom(1, 'out')).toBeCloseTo(0.9)
    expect(stepZoom(0.7, 'out')).toBeCloseTo(0.6)
    expect(stepZoom(0.6, 'out')).toBe(0.6)
    expect(stepZoom(2, 'in')).toBe(2)
  })

  it('keeps the point under the pointer where it was', () => {
    const before = { x: 40, y: -20, zoom: 1 }
    const at = { x: 300, y: 200 }
    const after = zoomAbout(before, at, 1.5)
    const place = (v: typeof before) => ({ x: (at.x - v.x) / v.zoom, y: (at.y - v.y) / v.zoom })
    expect(place(after).x).toBeCloseTo(place(before).x)
    expect(place(after).y).toBeCloseTo(place(before).y)
  })

  it('holds the viewport to the range too', () => {
    expect(zoomAbout({ x: 0, y: 0, zoom: 1 }, { x: 0, y: 0 }, 0.1).zoom).toBe(0.6)
  })
})

describe('the keys', () => {
  it('reads ⌘ or Ctrl with + − 0', () => {
    for (const held of [{ metaKey: true }, { ctrlKey: true }]) {
      expect(modZoomKey(chord({ ...held, key: '=' }))).toBe('in')
      expect(modZoomKey(chord({ ...held, key: '+', shiftKey: true }))).toBe('in')
      expect(modZoomKey(chord({ ...held, key: '-' }))).toBe('out')
      expect(modZoomKey(chord({ ...held, key: '0' }))).toBe('home')
      expect(modZoomKey(chord({ ...held, key: '1', code: 'NumpadAdd' }))).toBe('in')
    }
    expect(modZoomKey(chord({ key: '=' }))).toBeUndefined()
    expect(modZoomKey(chord({ metaKey: true, key: 's' }))).toBeUndefined()
    expect(modZoomKey(chord({ metaKey: true, altKey: true, key: '=' }))).toBeUndefined()
  })

  it('keeps the keys boards have', () => {
    expect(plainZoomKey(chord({ key: '=' }))).toBe('in')
    expect(plainZoomKey(chord({ key: '-' }))).toBe('out')
    expect(plainZoomKey(chord({ key: '!', code: 'Digit1', shiftKey: true }))).toBe('fit')
    expect(plainZoomKey(chord({ key: '@', code: 'Digit2', shiftKey: true }))).toBe('home')
    expect(plainZoomKey(chord({ key: '1', code: 'Digit1' }))).toBeUndefined()
    expect(plainZoomKey(chord({ key: '=', metaKey: true }))).toBeUndefined()
  })
})

describe('the wheel', () => {
  it('moves a mouse a tenth a notch, and a pinch with the fingers', () => {
    expect(wheelFactor(-120)).toBeCloseTo(1.1)
    expect(wheelFactor(120)).toBeCloseTo(1 / 1.1)
    expect(wheelFactor(-3, 1)).toBeCloseTo(1.1)
    expect(wheelFactor(-4)).toBeGreaterThan(1)
    expect(wheelFactor(-4)).toBeLessThan(1.05)
    expect(wheelFactor(4)).toBeLessThan(1)
  })
})

describe('the seam for the reading distances', () => {
  it('says far below 70%, near above 120%', () => {
    expect(readingDistance(0.6)).toBe('far')
    expect(readingDistance(0.69)).toBe('far')
    expect(readingDistance(0.7)).toBe('middle')
    expect(readingDistance(1.2)).toBe('middle')
    expect(readingDistance(1.21)).toBe('near')
  })

  it('hands the canvas what the kit reads', () => {
    expect(canvasZoomProps(0.8)).toEqual({ 'data-distance': 'middle', 'data-labels': 'words', style: { '--canvas-zoom': '0.8' } })
    expect(canvasZoomProps(0.8, 0.9)['data-labels']).toBe('numbers')
  })
})

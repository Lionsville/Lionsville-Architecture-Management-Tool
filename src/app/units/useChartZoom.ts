// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The chart's zoom: a number on a state, in the kit's range and answering the
 * kit's keys (`useCanvasZoom`). It opens at 100%, because a chart that opens
 * readable and offers the rest beats one shrunk to fit, and Fit stops at the
 * floor below which a name cannot be read. The stage is zoomed by CSS rather than
 * scaled, so the boxes lay out again and their words wrap for the distance.
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { canvasZoomProps, clampZoom, ZOOM_HOME } from '../../widgets/kit/zoom'
import { textScale } from '../../widgets/kit/tokens'
import type { Point } from '../../widgets/kit/zoom'
import { steppedZoomTarget, useCanvasZoom } from '../../widgets/kit/useCanvasZoom'

/** The zoom that fits a drawing of this size in this pane, never above 100%, never below the floor. */
export function fitZoom(pane: { width: number; height: number }, drawing: { width: number; height: number }): number {
  if (drawing.width <= 0 || drawing.height <= 0) return ZOOM_HOME
  return clampZoom(Math.min(ZOOM_HOME, pane.width / drawing.width, pane.height / drawing.height))
}

export function useChartZoom(page: { current: HTMLDivElement | null }, stage: { current: HTMLElement | null }) {
  // At a larger text size the chart opens larger, all of it, as a board is framed (`canvasZoomProps`).
  const [zoom, setZoom] = useState(() => clampZoom(ZOOM_HOME * textScale()))
  const latest = useRef(zoom)
  latest.current = zoom
  const to = useCallback((next: number, at?: Point) => {
    const pane = page.current
    const was = latest.current
    setZoom(next)
    // The point under the pointer stays under it.
    if (pane && at && next !== was) {
      const ratio = next / was
      const left = (pane.scrollLeft + at.x) * ratio - at.x
      const top = (pane.scrollTop + at.y) * ratio - at.y
      requestAnimationFrame(() => pane.scrollTo?.({ left, top }))
    }
  }, [page])
  const fit = useCallback(() => {
    // Measured at 100%: below it the stage fills the pane, and says nothing of its own width.
    setZoom(ZOOM_HOME)
    requestAnimationFrame(() => {
      const pane = page.current
      const drawing = stage.current
      if (!pane || !drawing) return
      // In the room the dock and the key leave: the chart pads its end by them (`clearOfFloats`),
      // so the pane's own box less its padding is that room, and a stage no wider than it is 100%.
      const style = getComputedStyle(pane)
      const pad = (side: string) => Number.parseFloat(style.getPropertyValue(`padding-${side}`)) || 0
      const room = { width: pane.clientWidth - pad('left') - pad('right'), height: pane.clientHeight - pad('top') - pad('bottom') }
      const fitted = fitZoom(room, { width: drawing.scrollWidth, height: drawing.scrollHeight })
      setZoom(fitted)
      // Clamped at the floor, the chart is wider than the pane: its middle, where the top unit is, is what is shown.
      requestAnimationFrame(() => pane.scrollTo?.({ left: Math.max(0, (pane.scrollWidth - pane.clientWidth) / 2), top: 0 }))
    })
  }, [page, stage])
  const target = useMemo(() => steppedZoomTarget({ zoom: () => latest.current, to, fit }), [to, fit])
  const attachZoom = useCanvasZoom(target, { plainKeys: false })
  const attach = useCallback((element: HTMLDivElement | null) => {
    page.current = element
    attachZoom(element)
  }, [page, attachZoom])
  const props = canvasZoomProps(zoom, undefined, textScale())
  return { zoom, target, attach, canvas: { 'data-distance': props['data-distance'], style: props.style as CSSProperties } }
}

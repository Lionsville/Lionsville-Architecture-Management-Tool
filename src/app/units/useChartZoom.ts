// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The chart's zoom: a number on a state, in the kit's range and answering the
 * kit's keys (`useCanvasZoom`). It opens at 100%, because a chart that opens
 * readable and offers the rest beats one shrunk to fit, and Fit stops at the
 * floor below which a name cannot be read. The stage is zoomed by CSS rather than
 * scaled, so the boxes lay out again and their words wrap for the distance.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'
import { CANVAS_FLOAT, canvasRooms } from '../../widgets/kit/canvasRoom'
import { canvasZoomProps, clampZoom, NO_INSETS, ZOOM_HOME } from '../../widgets/kit/zoom'
import { textScale } from '../../widgets/kit/tokens'
import { useTextScale } from '../../widgets/kit/useTextScale'
import type { Insets, Point } from '../../widgets/kit/zoom'
import { steppedZoomTarget, useCanvasZoom } from '../../widgets/kit/useCanvasZoom'

/** The zoom that fits a drawing of this size in this pane, never above 100%, never below the floor. */
export function fitZoom(pane: { width: number; height: number }, drawing: { width: number; height: number }): number {
  if (drawing.width <= 0 || drawing.height <= 0) return ZOOM_HOME
  return clampZoom(Math.min(ZOOM_HOME, pane.width / drawing.width, pane.height / drawing.height))
}

/**
 * Of the rooms the dock and the key may leave (`canvasRooms`), the one the chart
 * is framed in: the largest zoom first, and where the floor holds them level,
 * the one that shows the most of it. The cheaper strip alone took a column for
 * the key on a chart far wider than tall, and centred the top unit about 118 px
 * left of the middle of the free room under it.
 */
export function chartRoom(pane: { width: number; height: number }, drawing: { width: number; height: number }, rooms: readonly Insets[]): Insets {
  let best: { room: Insets; zoom: number; shown: number } | undefined
  for (const room of rooms.length > 0 ? rooms : [NO_INSETS]) {
    const size = { width: pane.width - room.left - room.right, height: pane.height - room.top - room.bottom }
    if (size.width <= 0 || size.height <= 0) continue
    const zoom = fitZoom(size, drawing)
    const shown = Math.min(1, size.width / (drawing.width * zoom || 1)) * Math.min(1, size.height / (drawing.height * zoom || 1))
    if (!best || zoom > best.zoom + 1e-6 || (Math.abs(zoom - best.zoom) <= 1e-6 && shown > best.shown + 1e-6)) best = { room, zoom, shown }
  }
  return best?.room ?? NO_INSETS
}

/** The room the chart is padded by, measured again as the pane, the floats or the drawing change size. */
export function useChartRoom(pane: RefObject<HTMLElement | null>, within: RefObject<ParentNode | null>, stage: RefObject<HTMLElement | null>, zoom: number): Insets {
  const [room, setRoom] = useState<Insets>(NO_INSETS)
  useLayoutEffect(() => {
    const element = pane.current
    if (!element) return undefined
    const root = within.current ?? element
    const measure = () => {
      const drawn = stage.current?.getBoundingClientRect()
      const box = element.getBoundingClientRect()
      // The drawing at 100 %: the stage is zoomed by CSS, and its box is what is on screen.
      const drawing = drawn ? { width: drawn.width / zoom, height: drawn.height / zoom } : { width: 0, height: 0 }
      const next = drawing.width > 0 ? chartRoom(box, drawing, canvasRooms(element, root)) : NO_INSETS
      setRoom((was) => (was.top === next.top && was.right === next.right && was.bottom === next.bottom && was.left === next.left ? was : next))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    if (stage.current) observer.observe(stage.current)
    for (const float of root.querySelectorAll(`[${CANVAS_FLOAT}]`)) observer.observe(float)
    return () => observer.disconnect()
  }, [pane, within, stage, zoom])
  return room
}

export function useChartZoom(page: { current: HTMLDivElement | null }, stage: { current: HTMLElement | null }) {
  // At a larger text size the chart opens larger, all of it, as a board is framed (`canvasZoomProps`).
  const [zoom, setZoom] = useState(() => clampZoom(ZOOM_HOME * textScale()))
  const latest = useRef(zoom)
  latest.current = zoom
  const to = useCallback((next: number, at?: Point) => {
    const pane = page.current
    const was = latest.current
    // The point under the pointer stays under it; pressed on the dock or a key, the middle of the room does —
    // but where the chart's top was in the room, it stays where it was: from Fit, 100 % kept the middle and
    // put the top unit above the pane. Measured off the stage as drawn, whatever centres it in the room.
    const about = at ?? (pane ? roomMiddle(pane) : undefined)
    const drawn = stage.current?.getBoundingClientRect()
    const box = pane?.getBoundingClientRect()
    setZoom(next)
    if (!pane || !about || !drawn || !box || next === was) return
    const room = roomOf(pane)
    const topInRoom = at === undefined && drawn.top >= box.top + room.top - 1
    const held = { x: about.x, y: topInRoom ? drawn.top - box.top : about.y }
    const point = { x: (box.left + held.x - drawn.left) / was, y: topInRoom ? 0 : (box.top + held.y - drawn.top) / was }
    requestAnimationFrame(() => {
      const now = stage.current?.getBoundingClientRect()
      const paneBox = pane.getBoundingClientRect()
      if (!now) return
      pane.scrollBy?.({ left: now.left + point.x * next - (paneBox.left + held.x), top: now.top + point.y * next - (paneBox.top + held.y) })
    })
  }, [page, stage])
  const fit = useCallback(() => {
    // Measured at 100%: below it the stage fills the pane, and says nothing of its own width.
    setZoom(ZOOM_HOME)
    requestAnimationFrame(() => {
      const pane = page.current
      const drawing = stage.current
      if (!pane || !drawing) return
      // In the room the dock and the key leave: the chart pads its end by them (`clearOfFloats`),
      // so the pane's own box less its padding is that room, and a stage no wider than it is 100%.
      const room = roomOf(pane)
      const fitted = fitZoom(room, { width: drawing.scrollWidth, height: drawing.scrollHeight })
      setZoom(fitted)
      // The chart's middle, where the top unit is, in the middle of the room, and its top at the room's top —
      // measured off the stage as now drawn, so a Fit after the people shown changed frames what is there now
      // rather than where the scroll was left (it right-aligned a wider chart under the outline).
      requestAnimationFrame(() => {
        const now = stage.current?.getBoundingClientRect()
        const box = pane.getBoundingClientRect()
        if (!now) return
        const middle = roomMiddle(pane)
        pane.scrollBy?.({ left: now.left + now.width / 2 - (box.left + middle.x), top: now.top - (box.top + room.top) })
      })
    })
  }, [page, stage])
  const target = useMemo(() => steppedZoomTarget({ zoom: () => latest.current, to, fit }), [to, fit])
  // A text size changed while the chart is up grows or shrinks it as an open at that size would have: one meaning for
  // the readout, live or after a reload (the poster's camera does the same).
  const scale = useTextScale()
  const scaledAt = useRef(scale)
  useEffect(() => {
    const was = scaledAt.current
    scaledAt.current = scale
    if (was !== scale) to(clampZoom(latest.current * (scale / was)))
  }, [scale, to])
  const attachZoom = useCanvasZoom(target, { plainKeys: false })
  const attach = useCallback((element: HTMLDivElement | null) => {
    page.current = element
    attachZoom(element)
  }, [page, attachZoom])
  const props = canvasZoomProps(zoom, undefined, textScale())
  return { zoom, target, attach, canvas: { 'data-distance': props['data-distance'], style: props.style as CSSProperties } }
}

/** The room the pane shows, in its own pixels: its box less the padding the floats take. */
function roomOf(pane: HTMLElement): { top: number; right: number; bottom: number; left: number; width: number; height: number } {
  const style = getComputedStyle(pane)
  const pad = (side: string) => Number.parseFloat(style.getPropertyValue(`padding-${side}`)) || 0
  const [top, right, bottom, left] = [pad('top'), pad('right'), pad('bottom'), pad('left')]
  return { top, right, bottom, left, width: pane.clientWidth - left - right, height: pane.clientHeight - top - bottom }
}

/** The middle of the room the pane shows, in its own pixels. */
function roomMiddle(pane: HTMLElement): Point {
  const room = roomOf(pane)
  return { x: room.left + room.width / 2, y: room.top + room.height / 2 }
}

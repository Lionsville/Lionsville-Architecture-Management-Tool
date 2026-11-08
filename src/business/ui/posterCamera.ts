// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The poster's camera: a ref, written straight to the element, so a zoom or a pan
 * renders no tile. Only the dock's number has state, in a component of its own.
 *
 * It opens where the person left this view, or else at Fit where that can be read
 * and at a readable zoom from the top left where it cannot. A person's last place
 * is theirs and not the work's (`useViewerKeep`), so a reader never writes a step.
 */
import { useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import { steppedZoomTarget, useCanvasZoom } from '../../widgets/kit/useCanvasZoom'
import { canvasInsets } from '../../widgets/kit/canvasRoom'
import { canvasZoomProps, clampZoomTo, frameInRoom } from '../../widgets/kit/zoom'
import type { Insets, Point, ZoomRange } from '../../widgets/kit/zoom'
import { ViewerKeepContext } from '../../widgets/useViewerKeep'

/** This canvas only: it is read whole from far off, where every other stops at the zoom a name can be read at. */
export const POSTER_ZOOM: ZoomRange = {
  floor: 0.2, ceiling: 3,
  stops: [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.2, 1.4, 1.6, 2, 2.5, 3],
}

/** The zoom it opens at when it does not fit: a name reads there. */
const READABLE = 0.9
const MARGIN = 8
/** How long after the last move the page is sharpened, and the place kept. */
const SETTLE_MS = 140
/**
 * A step's words go where a tile's name goes, at the far distance, and not before: Fit on a laptop lands
 * near 77%, and a band of empty chevrons there said nothing. Below 70% `far` hides them with the rest.
 */
const WORDS_FROM = 0.7
/** A person can pan as far as they like, short of losing the page: this much of it stays in the window. */
const STAYS_IN_VIEW = 64
/** How much room to leave round something brought on screen, and the strip it must clear. */
const CLEAR_OF_EDGE = 20

export type Camera = { x: number; y: number; zoom: number }

/** The room the dock leaves over the pane; it floats beside it, in the poster. */
const roomOf = (pane: HTMLElement): Insets => canvasInsets(pane, pane.parentElement ?? pane)
type Size = { width: number; height: number }

/** Round the page where nothing floats over the pane. */
const BARE: Insets = { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN }

const whole = (page: Size) => ({ x: 0, y: 0, ...page })

/** The whole page in the room the dock leaves, centred. */
function fitOf(pane: Size, page: Size, insets: Insets): Camera {
  return frameInRoom(whole(page), pane, insets, { floor: POSTER_ZOOM.floor, ceiling: 1 }) ?? { x: insets.left, y: insets.top, zoom: POSTER_ZOOM.floor }
}

/** At Fit where that can be read, centred; otherwise at a readable zoom from the top left, with the rest a pan. */
export function openingCamera(pane: Size, page: Size, insets: Insets = BARE): Camera {
  const fit = fitOf(pane, page, insets)
  if (fit.zoom >= READABLE) return fit
  return frameInRoom(whole(page), pane, insets, { floor: READABLE, ceiling: READABLE }) ?? { x: insets.left, y: insets.top, zoom: READABLE }
}

export function heldInView(camera: Camera, pane: Size, page: Size): Camera {
  const hold = (at: number, room: number, size: number) => Math.min(room - STAYS_IN_VIEW, Math.max(STAYS_IN_VIEW - size, at))
  return { ...camera, x: hold(camera.x, pane.width, page.width * camera.zoom), y: hold(camera.y, pane.height, page.height * camera.zoom) }
}

function keptCamera(held: unknown): Camera | undefined {
  const at = held as Partial<Camera> | null | undefined
  if (typeof at?.x !== 'number' || typeof at.y !== 'number' || typeof at.zoom !== 'number') return undefined
  return { x: at.x, y: at.y, zoom: clampZoomTo(at.zoom, POSTER_ZOOM) }
}

/** What a person's last place on this view is kept under. */
export const posterPlaceKey = (viewId: string) => `poster.place.${viewId}`

export function usePosterCamera(page: Size, viewId: string | undefined) {
  const keep = useContext(ViewerKeepContext)
  const pane = useRef<HTMLDivElement | null>(null)
  const stage = useRef<HTMLDivElement | null>(null)
  const camera = useRef<Camera>({ x: 0, y: 0, zoom: 1 })
  const listeners = useRef(new Set<(zoom: number) => void>())
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const size = useRef(page)
  size.current = page
  const key = useRef(viewId)
  key.current = viewId
  const keeper = useRef(keep)
  keeper.current = keep

  const write = useCallback((moving: boolean) => {
    const on = stage.current
    const held = pane.current
    if (!on || !held) return
    camera.current = heldInView(camera.current, { width: held.clientWidth, height: held.clientHeight }, size.current)
    const { x, y, zoom } = camera.current
    on.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`
    if (!moving) return
    held.dataset.moving = ''
    clearTimeout(settle.current)
    settle.current = setTimeout(() => {
      delete held.dataset.moving
      if (key.current !== undefined) keeper.current?.keep(posterPlaceKey(key.current), camera.current)
    }, SETTLE_MS)
  }, [])
  const distances = useCallback(() => {
    const on = stage.current
    if (!on) return
    const props = canvasZoomProps(camera.current.zoom, WORDS_FROM)
    if (on.dataset.distance !== props['data-distance']) on.dataset.distance = props['data-distance']
    if (on.dataset.labels !== props['data-labels']) on.dataset.labels = props['data-labels']
    // Only the far sizes read it, and an inherited property touches every descendant: a step inside reading distance pays nothing.
    if (props['data-distance'] === 'far') on.style.setProperty('--canvas-zoom', props.style['--canvas-zoom'])
    for (const tell of listeners.current) tell(camera.current.zoom)
  }, [])
  const to = useCallback((zoom: number, at?: Point) => {
    const held = pane.current
    const was = camera.current
    const next = clampZoomTo(zoom, POSTER_ZOOM)
    const around = at ?? (held ? { x: held.clientWidth / 2, y: held.clientHeight / 2 } : { x: 0, y: 0 })
    const ratio = next / was.zoom
    camera.current = { x: around.x - (around.x - was.x) * ratio, y: around.y - (around.y - was.y) * ratio, zoom: next }
    write(true)
    distances()
  }, [write, distances])
  const panBy = useCallback((dx: number, dy: number) => {
    camera.current = { ...camera.current, x: camera.current.x + dx, y: camera.current.y + dy }
    write(true)
  }, [write])
  const fit = useCallback(() => {
    const held = pane.current
    if (!held) return
    const box = { width: held.clientWidth, height: held.clientHeight }
    camera.current = fitOf(box, size.current, roomOf(held))
    write(true)
    distances()
  }, [write, distances])
  const open = useCallback(() => {
    const held = pane.current
    if (!held) return
    const kept = key.current !== undefined ? keptCamera(keeper.current?.read(posterPlaceKey(key.current))) : undefined
    camera.current = kept ?? openingCamera({ width: held.clientWidth, height: held.clientHeight }, size.current, roomOf(held))
    write(false)
    distances()
  }, [write, distances])
  /** Keep this in the window, moving as little as it takes; from far off, come to where it can be read. */
  const follow = useCallback((element: Element, read = false) => {
    const held = pane.current
    if (!held) return
    if (read && camera.current.zoom < 0.85) {
      const box = element.getBoundingClientRect()
      const frame = held.getBoundingClientRect()
      to(1, { x: box.left + box.width / 2 - frame.left, y: box.top + box.height / 2 - frame.top })
    }
    const box = element.getBoundingClientRect()
    const frame = held.getBoundingClientRect()
    let dx = 0
    let dy = 0
    if (box.left < frame.left + CLEAR_OF_EDGE) dx = frame.left + CLEAR_OF_EDGE - box.left
    else if (box.right > frame.right - CLEAR_OF_EDGE) dx = frame.right - CLEAR_OF_EDGE - box.right
    if (box.top < frame.top + CLEAR_OF_EDGE) dy = frame.top + CLEAR_OF_EDGE - box.top
    else if (box.bottom > frame.bottom - CLEAR_OF_EDGE) dy = frame.bottom - CLEAR_OF_EDGE - box.bottom
    if (dx !== 0 || dy !== 0) panBy(dx, dy)
  }, [to, panBy])
  const target = useMemo(() => steppedZoomTarget({ zoom: () => camera.current.zoom, to, fit }, POSTER_ZOOM), [to, fit])
  const attachZoom = useCanvasZoom(target)
  const attach = useCallback((element: HTMLDivElement | null) => {
    pane.current = element
    attachZoom(element)
  }, [attachZoom])
  const listen = useCallback((tell: (zoom: number) => void) => {
    listeners.current.add(tell)
    tell(camera.current.zoom)
    return () => { listeners.current.delete(tell) }
  }, [])
  useEffect(() => () => clearTimeout(settle.current), [])
  return { attach, stage, pane, camera, panBy, open, follow, target, listen }
}

export type PosterCamera = ReturnType<typeof usePosterCamera>

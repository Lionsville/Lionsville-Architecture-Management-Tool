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
import { useTextScale } from '../../widgets/kit/useTextScale'

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
/**
 * Fit stops where the words do: under 70% the band and the tiles are empty boxes, and Fit landed at 57-61% on a
 * laptop. A page larger than the window shows its top left, the rest one pan away, as a board does. Overview and
 * zooming out still go further, by asking.
 */
export const FIT_FLOOR = WORDS_FROM
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

/**
 * A zoom said at 100% text, at the person's text size. The poster's type is in pixels, so its
 * words keep to the blocks its layout worked out; the text size reaches it as a scale on the
 * whole page, as it reaches a board (`canvasZoomProps`): Fit's floor and ceiling, the zoom a
 * name reads at and every reading distance scale with it.
 */
export const atScale = (zoom: number, scale: number) => clampZoomTo(zoom * scale, POSTER_ZOOM)

/** The whole page in the room the dock leaves, centred. */
function fitOf(pane: Size, page: Size, insets: Insets, scale = 1): Camera {
  const floor = atScale(FIT_FLOOR, scale)
  return frameInRoom(whole(page), pane, insets, { floor, ceiling: atScale(1, scale) }) ?? { x: insets.left, y: insets.top, zoom: floor }
}

/** At Fit where that can be read, centred; otherwise at a readable zoom from the top left, with the rest a pan. */
export function openingCamera(pane: Size, page: Size, insets: Insets = BARE, scale = 1): Camera {
  const fit = fitOf(pane, page, insets, scale)
  const readable = atScale(READABLE, scale)
  if (fit.zoom >= readable) return fit
  return frameInRoom(whole(page), pane, insets, { floor: readable, ceiling: readable }) ?? { x: insets.left, y: insets.top, zoom: readable }
}

/** The same place at another text size: the page grows or shrinks about the pane's middle, as a step of the zoom does. */
export function rescaled(camera: Camera, ratio: number, pane: Size): Camera {
  const zoom = clampZoomTo(camera.zoom * ratio, POSTER_ZOOM)
  const by = zoom / camera.zoom
  const at = { x: pane.width / 2, y: pane.height / 2 }
  return { x: at.x - (at.x - camera.x) * by, y: at.y - (at.y - camera.y) * by, zoom }
}

export function heldInView(camera: Camera, pane: Size, page: Size): Camera {
  const hold = (at: number, room: number, size: number) => Math.min(room - STAYS_IN_VIEW, Math.max(STAYS_IN_VIEW - size, at))
  return { ...camera, x: hold(camera.x, pane.width, page.width * camera.zoom), y: hold(camera.y, pane.height, page.height * camera.zoom) }
}

/** A place is kept with the text size it was left at, so a person who changed it since comes back to the same page at their size now. */
type KeptPlace = Camera & { scale?: number }

function keptCamera(held: unknown, scale: number, pane: Size): Camera | undefined {
  const at = held as Partial<KeptPlace> | null | undefined
  if (typeof at?.x !== 'number' || typeof at.y !== 'number' || typeof at.zoom !== 'number') return undefined
  const camera = { x: at.x, y: at.y, zoom: clampZoomTo(at.zoom, POSTER_ZOOM) }
  const was = typeof at.scale === 'number' && at.scale > 0 ? at.scale : 1
  return was === scale ? camera : rescaled(camera, scale / was, pane)
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
  const textScale = useTextScale()
  const scale = useRef(textScale)

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
      if (key.current !== undefined) keeper.current?.keep(posterPlaceKey(key.current), { ...camera.current, scale: scale.current } satisfies KeptPlace)
    }, SETTLE_MS)
  }, [])
  const distances = useCallback(() => {
    const on = stage.current
    if (!on) return
    const props = canvasZoomProps(camera.current.zoom, WORDS_FROM, scale.current)
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
    camera.current = fitOf(box, size.current, roomOf(held), scale.current)
    write(true)
    distances()
  }, [write, distances])
  const open = useCallback(() => {
    const held = pane.current
    if (!held) return
    const box = { width: held.clientWidth, height: held.clientHeight }
    const kept = key.current !== undefined ? keptCamera(keeper.current?.read(posterPlaceKey(key.current)), scale.current, box) : undefined
    camera.current = kept ?? openingCamera(box, size.current, roomOf(held), scale.current)
    write(false)
    distances()
  }, [write, distances])
  /** Keep this in the window, moving as little as it takes; from far off, come to where it can be read. */
  const follow = useCallback((element: Element, read = false) => {
    const held = pane.current
    if (!held) return
    if (read && camera.current.zoom < 0.85 * scale.current) {
      const box = element.getBoundingClientRect()
      const frame = held.getBoundingClientRect()
      to(atScale(1, scale.current), { x: box.left + box.width / 2 - frame.left, y: box.top + box.height / 2 - frame.top })
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
  const target = useMemo(() => steppedZoomTarget({ zoom: () => camera.current.zoom, to, fit, pan: (dx) => panBy(dx, 0) }, POSTER_ZOOM), [to, fit, panBy])
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
  // A text size changed while the poster is up grows or shrinks the whole page about the middle, as a board is framed again.
  useEffect(() => {
    const was = scale.current
    if (was === textScale) return
    scale.current = textScale
    const held = pane.current
    if (!held) return
    camera.current = rescaled(camera.current, textScale / was, { width: held.clientWidth, height: held.clientHeight })
    write(true)
    distances()
  }, [textScale, write, distances])
  return { attach, stage, pane, camera, panBy, open, follow, target, listen, fitFloor: atScale(FIT_FLOOR, textScale) }
}

export type PosterCamera = ReturnType<typeof usePosterCamera>

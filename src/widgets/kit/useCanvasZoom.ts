// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { useCallback, useEffect, useRef } from 'react'
import { clampZoom, clampZoomTo, modZoomKey, plainZoomKey, stepZoom, stepZoomAlong, wheelFactor, ZOOM_HOME } from './zoom'
import type { Point, ZoomHow, ZoomRange } from './zoom'

/**
 * What a canvas does when it is told to zoom. `at` is where the pointer is, in
 * the element's pixels, when it is over the element: the card under the pointer
 * stays under it.
 */
export type ZoomTarget = {
  go(how: ZoomHow, at?: Point): void
  /** Zoom by a factor, from the wheel or a pinch. */
  by(factor: number, at?: Point): void
  /**
   * Move what is drawn by `dx` pixels across the element, without a zoom. A
   * canvas that pans by a viewport of its own says how; one that scrolls needs
   * nothing, since its scroll is moved for it (`holdOnScreen`).
   */
  pan?(dx: number): void
}

/** The target of a canvas whose zoom is a number in the kit's range; the time axis's is not. */
export function steppedZoomTarget(canvas: {
  zoom(): number
  to(zoom: number, at?: Point): void
  fit(): void
  pan?(dx: number): void
}, range?: ZoomRange): ZoomTarget {
  return {
    ...(canvas.pan ? { pan: canvas.pan } : {}),
    go(how, at) {
      if (how === 'fit') canvas.fit()
      else if (how === 'home') canvas.to(ZOOM_HOME, at)
      else canvas.to(range ? stepZoomAlong(canvas.zoom(), how, range) : stepZoom(canvas.zoom(), how), at)
    },
    by(factor, at) {
      const zoom = canvas.zoom() * factor
      canvas.to(range ? clampZoomTo(zoom, range) : clampZoom(zoom), at)
    },
  }
}

type Live = { element: HTMLElement; target: () => ZoomTarget; pointer: Point | undefined }

/**
 * What is drawn stays where it was on the screen when the canvas's left edge
 * moves: the tree docked or put away beside it, or its seam dragged. Without
 * this a board slid by the tree's width under the person's eyes, its left lanes
 * under the tree's edge and an empty band on the right. Only the edge counts: a
 * window resized on its right, or a panel opened there, moves nothing.
 * Returns what stops the watching.
 */
export function holdOnScreen(element: HTMLElement, target: () => ZoomTarget): () => void {
  if (typeof ResizeObserver === 'undefined') return () => undefined
  const edge = () => {
    const box = element.getBoundingClientRect()
    // Hidden, the box says nothing of where the canvas will stand when it is shown again.
    return box.width > 0 ? box.left : undefined
  }
  let was = edge()
  const watching = new ResizeObserver(() => {
    const now = edge()
    if (now === undefined) return
    const moved = was === undefined ? 0 : now - was
    was = now
    if (Math.abs(moved) < 0.5) return
    const pan = target().pan
    if (pan) pan(-moved)
    else if (element.scrollWidth > element.clientWidth) element.scrollLeft += moved
  })
  watching.observe(element)
  return () => watching.disconnect()
}

const live = new Set<Live>()

/**
 * ⌘ + − 0 belong to the host's menu bar on the desktop.
 *
 * On macOS a menu accelerator fires whether or not the page handled the key, so
 * a chord with a keymap here as well would zoom twice, and the window with it.
 * The menu is their one owner there, and its items come back as a command that
 * {@link zoomCanvasInUse} answers. Set once by whoever composes the app.
 */
let hostOwnsZoomKeys = false
export function setHostOwnsZoomKeys(owned: boolean): void {
  hostOwnsZoomKeys = owned
}

/**
 * A dialog holding the focus has the keys, whatever the pointer happens to rest on
 * behind it. A canvas inside that dialog is not behind it, and a page may be one.
 */
function inUse(canvas: Live): boolean {
  const modal = document.activeElement?.closest('[aria-modal="true"]')
  if (modal && !modal.contains(canvas.element)) return false
  return canvas.pointer !== undefined || canvas.element.contains(document.activeElement)
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)
}

/**
 * Tell the canvas in use to zoom, for a menu item. False when there is none,
 * and the keys then keep their usual meaning, which is the window's.
 */
export function zoomCanvasInUse(how: ZoomHow): boolean {
  const canvas = [...live].find(inUse)
  if (!canvas) return false
  canvas.target().go(how, canvas.pointer)
  return true
}

/**
 * One zoom behaviour for every canvas: ⌘ or Ctrl with + − 0, the same with the
 * wheel, a pinch, ⇧ 1 to fit, and a board's = and − and ⇧ 2. Only over the canvas
 * or with the focus in it: everywhere else these keys keep their usual meaning.
 *
 * Returns the callback ref for the canvas's element. `wheel: false` is for a
 * canvas that already zooms on the wheel by itself, which is React Flow.
 * `plainKeys: false` is for one whose keymap has those keys.
 */
export function useCanvasZoom(target: ZoomTarget, options: { wheel?: boolean; plainKeys?: boolean } = {}): (element: HTMLElement | null) => void {
  const latest = useRef({ target, options })
  latest.current = { target, options }
  const detach = useRef<(() => void) | undefined>(undefined)

  const attach = useCallback((element: HTMLElement | null) => {
    detach.current?.()
    detach.current = undefined
    if (!element) return
    const canvas: Live = { element, target: () => latest.current.target, pointer: undefined }
    live.add(canvas)

    const within = (event: { clientX: number; clientY: number }): Point => {
      const box = element.getBoundingClientRect()
      return { x: event.clientX - box.left, y: event.clientY - box.top }
    }
    const moved = (event: PointerEvent) => { canvas.pointer = within(event) }
    const left = () => { canvas.pointer = undefined }

    // In the capture phase on the document, so a browser's page zoom and a
    // listener further in cannot get there first, wherever the focus sits.
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !inUse(canvas)) return
      const { plainKeys = true } = latest.current.options
      const mod = hostOwnsZoomKeys ? undefined : modZoomKey(event)
      const how = mod ?? (plainKeys && !isTyping(event.target) ? plainZoomKey(event) : undefined)
      if (!how) return
      event.preventDefault()
      latest.current.target.go(how, canvas.pointer)
    }
    const wheel = (event: WheelEvent) => {
      if (latest.current.options.wheel === false || (!event.ctrlKey && !event.metaKey)) return
      event.preventDefault()
      latest.current.target.by(wheelFactor(event.deltaY, event.deltaMode), within(event))
    }
    // Safari says a pinch in gestures of its own and no wheel at all. Each
    // event's scale is since the gesture began, so each is taken as a ratio.
    let lastScale = 1
    const gesture = (event: Event) => {
      const { scale, clientX, clientY } = event as Event & { scale: number; clientX: number; clientY: number }
      event.preventDefault()
      if (event.type === 'gesturestart') lastScale = 1
      else latest.current.target.by(scale / lastScale, within({ clientX, clientY }))
      lastScale = scale
    }

    element.addEventListener('pointermove', moved)
    element.addEventListener('pointerenter', moved)
    element.addEventListener('pointerleave', left)
    element.addEventListener('wheel', wheel, { passive: false })
    element.addEventListener('gesturestart', gesture)
    element.addEventListener('gesturechange', gesture)
    document.addEventListener('keydown', keydown, true)
    const unhold = holdOnScreen(element, () => latest.current.target)
    detach.current = () => {
      live.delete(canvas)
      unhold()
      element.removeEventListener('pointermove', moved)
      element.removeEventListener('pointerenter', moved)
      element.removeEventListener('pointerleave', left)
      element.removeEventListener('wheel', wheel)
      element.removeEventListener('gesturestart', gesture)
      element.removeEventListener('gesturechange', gesture)
      document.removeEventListener('keydown', keydown, true)
    }
  }, [])

  useEffect(() => () => { detach.current?.(); detach.current = undefined }, [])
  return attach
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * How far a canvas zooms and what each input means, for every canvas alike.
 *
 * React-free, so the sums are tested in node and a canvas of any make can use
 * them: a board, whose viewport is React Flow's, and a picture in a scrolling
 * window, whose zoom is a number on a state.
 */

/** Below this a name can no longer be read at its fixed size: the map scrolls instead. */
export const ZOOM_FLOOR = 0.6
export const ZOOM_CEILING = 2
export const ZOOM_HOME = 1

/** The keys and buttons move in tens, so a press always lands on a number somebody can say. */
const ZOOM_STOP = 0.1

export type Point = { x: number; y: number }
export type Viewport = Point & { zoom: number }
export type ZoomHow = 'in' | 'out' | 'home' | 'fit'

/** A zoom held to the range, rounded so a run of steps does not collect float dust. */
export function clampZoom(zoom: number): number {
  return Math.min(ZOOM_CEILING, Math.max(ZOOM_FLOOR, Math.round(zoom * 1000) / 1000))
}

/**
 * A canvas whose own range is not the rest's: a page read whole from far off and
 * close up, say. The floor of the others stays where it is, since it is a promise
 * about their names; a canvas that says otherwise has said how it keeps its own.
 */
export type ZoomRange = { readonly floor: number; readonly ceiling: number; readonly stops: readonly number[] }

export function clampZoomTo(zoom: number, range: ZoomRange): number {
  return Math.min(range.ceiling, Math.max(range.floor, Math.round(zoom * 1000) / 1000))
}

/** The next stop of the range that way, from wherever the zoom is now. At either end, that end. */
export function stepZoomAlong(zoom: number, way: 'in' | 'out', range: ZoomRange): number {
  const next = way === 'in'
    ? range.stops.find((stop) => stop > zoom + 0.001)
    : [...range.stops].reverse().find((stop) => stop < zoom - 0.001)
  return next ?? (way === 'in' ? range.ceiling : range.floor)
}

/** The next stop that way: 72% goes to 80% in and 70% out, and 70% to 80% and 60%. */
export function stepZoom(zoom: number, way: 'in' | 'out'): number {
  const stops = zoom / ZOOM_STOP
  const nearest = Math.round(stops)
  const onStop = Math.abs(stops - nearest) < 0.001
  const next = way === 'in' ? (onStop ? nearest + 1 : Math.ceil(stops)) : (onStop ? nearest - 1 : Math.floor(stops))
  return clampZoom(next * ZOOM_STOP)
}

/** The viewport at another zoom with the point `at`, in the pane's pixels, still over the same place. */
export function zoomAbout(viewport: Viewport, at: Point, zoom: number): Viewport {
  const next = clampZoom(zoom)
  const ratio = next / viewport.zoom
  return { x: at.x - (at.x - viewport.x) * ratio, y: at.y - (at.y - viewport.y) * ratio, zoom: next }
}

/** The subset of a keyboard event {@link zoomKey} reads. */
export type ZoomChord = Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>

/**
 * ⌘ or Ctrl with + − 0, on either modifier: a Mac with a Windows keyboard and a
 * remote desktop both exist, and neither chord means anything else over a
 * canvas. `=` is + without the Shift, and on a numeric keypad the code says it.
 */
export function modZoomKey(event: ZoomChord): ZoomHow | undefined {
  if (!event.metaKey && !event.ctrlKey) return undefined
  if (event.altKey) return undefined
  if (event.key === '+' || event.key === '=' || event.code === 'NumpadAdd') return 'in'
  if (event.key === '-' || event.key === '_' || event.code === 'NumpadSubtract') return 'out'
  if (!event.shiftKey && (event.key === '0' || event.code === 'Numpad0')) return 'home'
  return undefined
}

/**
 * The keys with no modifier that boards have always had: = and − alone, ⇧ 1 to
 * fit and ⇧ 2 for 100%. By code for the digits, since ⇧ 1 prints a different
 * character on every layout.
 */
export function plainZoomKey(event: ZoomChord): ZoomHow | undefined {
  if (event.metaKey || event.ctrlKey || event.altKey) return undefined
  if (event.shiftKey) {
    if (event.code === 'Digit1') return 'fit'
    if (event.code === 'Digit2') return 'home'
    return undefined
  }
  if (event.key === '=') return 'in'
  if (event.key === '-') return 'out'
  return undefined
}

/**
 * How much one wheel event zooms by. A pinch arrives as Ctrl with many small
 * deltas and a mouse as ⌘ or Ctrl with a few large ones, and only the size tells
 * them apart: a pinch follows the fingers, a notch moves one tenth.
 */
export function wheelFactor(deltaY: number, deltaMode = 0): number {
  if (deltaMode !== 0 || Math.abs(deltaY) >= 50) return deltaY < 0 ? 1.1 : 1 / 1.1
  return Math.exp(-deltaY * 0.01)
}

/** The three distances a canvas is read at. A card says more as the reader comes closer. */
export type ReadingDistance = 'far' | 'middle' | 'near'

export function readingDistance(zoom: number): ReadingDistance {
  if (zoom < 0.7) return 'far'
  return zoom <= 1.2 ? 'middle' : 'near'
}

/**
 * A label holds its size, so it reads at any zoom until there is no room for it: below
 * this, a line carries a number. How much room there is goes by what is drawn, so a
 * canvas may say it for itself: past about two dozen lines the words want to be near.
 */
export const LABEL_WORDS_FROM = 0.5
export const DENSE_LABEL_WORDS_FROM = 0.9

/**
 * What a canvas puts on the element its drawing sits in, and all it needs to do
 * for the kit's Card, Zone and Line to keep their sizes on screen and to say what
 * the distance allows. Through CSS, because a zoom must not render 500 cards.
 */
export function canvasZoomProps(zoom: number, wordsFrom = LABEL_WORDS_FROM): { 'data-distance': ReadingDistance; 'data-labels': 'words' | 'numbers'; style: Record<'--canvas-zoom', string> } {
  return { 'data-distance': readingDistance(zoom), 'data-labels': zoom < wordsFrom ? 'numbers' : 'words', style: { '--canvas-zoom': String(zoom) } }
}

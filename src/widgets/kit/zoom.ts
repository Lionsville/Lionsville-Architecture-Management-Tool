// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * How far a canvas zooms and what each input means, for every canvas alike.
 *
 * React-free, so the sums are tested in node and a canvas of any make can use
 * them: a board, whose viewport is React Flow's, and a picture in a scrolling
 * window, whose zoom is a number on a state.
 */
import { chordHeld } from './keys'

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
  if (!chordHeld(event)) return undefined
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
  if (chordHeld(event) || event.altKey) return undefined
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
 *
 * `--canvas-zoom` is what a size is held against, and it stops at 1: zoomed out,
 * words and strokes keep their size on screen so a far board stays readable;
 * zoomed in past 100%, they grow with the drawing, so ⌘+ reads larger.
 */
export function canvasZoomProps(zoom: number, wordsFrom = LABEL_WORDS_FROM): { 'data-distance': ReadingDistance; 'data-labels': 'words' | 'numbers'; style: Record<'--canvas-zoom', string> } {
  return { 'data-distance': readingDistance(zoom), 'data-labels': zoom < wordsFrom ? 'numbers' : 'words', style: { '--canvas-zoom': String(Math.min(zoom, 1)) } }
}

/**
 * What a canvas's floating controls take off its pane, side by side, in the pane's
 * pixels: the dock, a legend, a key. A fit frames what is drawn in the rest.
 */
export type Insets = { top: number; right: number; bottom: number; left: number }

/** Clear room round what a fit frames, where nothing floats. */
export const FIT_GAP = 16

export const NO_INSETS: Insets = { top: FIT_GAP, right: FIT_GAP, bottom: FIT_GAP, left: FIT_GAP }

export type Size = { width: number; height: number }

/**
 * The viewport that shows `content` (in the drawing's own units, from `x`, `y`) in the
 * room a pane of this size leaves inside `insets`: as large as fits, never past `ceiling`
 * nor under `floor`. Where it fits it stands in the middle of the room; where it does not,
 * even at the floor, it starts at the room's start on that side, so what is read first
 * is in view and clear of the controls, and the rest is a pan away rather than cut at
 * both ends.
 */
export function frameInRoom(
  content: { x: number; y: number; width: number; height: number },
  pane: Size,
  insets: Insets = NO_INSETS,
  range: { floor: number; ceiling: number } = { floor: ZOOM_FLOOR, ceiling: ZOOM_HOME },
): Viewport | undefined {
  const room = { width: pane.width - insets.left - insets.right, height: pane.height - insets.top - insets.bottom }
  if (!(content.width > 0) || !(content.height > 0) || !(room.width > 0) || !(room.height > 0)) return undefined
  const zoom = Math.min(range.ceiling, Math.max(range.floor, Math.min(room.width / content.width, room.height / content.height)))
  const place = (start: number, size: number, from: number, length: number) => {
    const drawn = length * zoom
    return (drawn <= size ? start + (size - drawn) / 2 : start) - from * zoom
  }
  return { x: place(insets.left, room.width, content.x, content.width), y: place(insets.top, room.height, content.y, content.height), zoom }
}

/**
 * The largest of the frames these rooms give: a key in a corner may leave a row or a
 * column, and which leaves the drawing more depends on the drawing's shape. On a tie
 * the first room wins, which `roomsFor` makes the cheapest.
 */
export function frameInRooms(
  content: { x: number; y: number; width: number; height: number },
  pane: Size,
  rooms: readonly Insets[],
  range: { floor: number; ceiling: number } = { floor: ZOOM_FLOOR, ceiling: ZOOM_HOME },
): Viewport | undefined {
  let best: Viewport | undefined
  for (const room of rooms.length > 0 ? rooms : [NO_INSETS]) {
    const frame = frameInRoom(content, pane, room, range)
    if (frame && (!best || frame.zoom > best.zoom + 1e-6)) best = frame
  }
  return best
}

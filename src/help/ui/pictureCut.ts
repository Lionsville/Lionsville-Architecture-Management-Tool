// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where a picture of the screen is cut, worked out from the picture as it is
 * laid out: the parts its words name, widened to whole lines of text. A cut
 * written as numbers ran through a line once a language or a typeface made
 * that line a few pixels taller or longer; a cut that reads the lines cannot.
 */

export type Box = { x: number; y: number; width: number; height: number }
/** A line as it is seen; `clipped` where the picture itself hides part of it, a box it sits in or its frame. */
export type Line = Box & { clipped?: true }

/** More than this hidden is a line the picture cuts, not a line box a little taller than its letters. */
const CLIPPED = 4

/** Less than this is the rounding of a layout, not a line cut through. */
const EPS = 0.5

const right = (box: Box) => box.x + box.width
const bottom = (box: Box) => box.y + box.height

function union(a: Box, b: Box): Box {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, width: Math.max(right(a), right(b)) - x, height: Math.max(bottom(a), bottom(b)) - y }
}

/** Whether two boxes share more than a rounding's worth. */
export function overlaps(a: Box, b: Box): boolean {
  return Math.min(right(a), right(b)) - Math.max(a.x, b.x) > EPS && Math.min(bottom(a), bottom(b)) - Math.max(a.y, b.y) > EPS
}

function inside(line: Box, cut: Box): boolean {
  return line.x >= cut.x - EPS && line.y >= cut.y - EPS && right(line) <= right(cut) + EPS && bottom(line) <= bottom(cut) + EPS
}

/** A line the cut's edge runs through: part of it in the window, part out. */
export function crosses(line: Box, cut: Box): boolean {
  return overlaps(line, cut) && !inside(line, cut)
}

/** The parts, together, with `room` round them: the box a cut starts from. */
export function partsBox(parts: readonly Box[], room = 0): Box | undefined {
  const all = parts.filter((part) => part.width > 0 && part.height > 0)
  if (all.length === 0) return undefined
  const box = all.reduce(union)
  return { x: box.x - room, y: box.y - room, width: box.width + 2 * room, height: box.height + 2 * room }
}

function clamp(box: Box, whole: { width: number; height: number }): Box {
  const x = Math.max(0, box.x)
  const y = Math.max(0, box.y)
  return { x, y, width: Math.min(whole.width, right(box)) - x, height: Math.min(whole.height, bottom(box)) - y }
}

/** Room kept between an edge and a line it stops short of, where the gap allows: a word flush with the edge reads as cut. */
const GAP = 6

type Span = { from: number; to: number }

/** Spans that touch or overlap, as one. */
function merged(spans: readonly Span[]): Span[] {
  const out: Span[] = []
  for (const span of [...spans].sort((a, b) => a.from - b.from)) {
    const last = out[out.length - 1]
    if (last && span.from <= last.to + EPS) last.to = Math.max(last.to, span.to)
    else out.push({ ...span })
  }
  return out
}

/**
 * Where one axis of a cut runs: edges that hold `from`..`to`, and stand in no
 * line, a little clear of the nearest. Where no line lies beyond the parts on
 * a side, that edge is the picture's own, so a window does not end a few
 * pixels short of a frame for nothing. With `most`, the widest such edges no
 * further apart than that, and failing any, the nearest.
 */
export function spanAtLines(from: number, to: number, lines: readonly Span[], extent: number, most = Infinity): Span {
  const runs = merged(lines)
  const free = (at: number) => !runs.some((run) => run.from + EPS < at && at < run.to - EPS)
  // The parts' own edges, where a line does not start or end right against them: flush with an edge a word reads as cut.
  const clear = (at: number) => !runs.some((run) => Math.abs(run.from - at) < GAP - EPS || Math.abs(run.to - at) < GAP - EPS)
  const edges = [0, extent, ...[from, to].filter(clear), ...runs.flatMap((run, at) => [
    run.from - Math.min(GAP, (run.from - (runs[at - 1]?.to ?? 0)) / 2),
    run.to + Math.min(GAP, ((runs[at + 1]?.from ?? extent) - run.to) / 2),
  ])].filter(free)
  const starts = edges.filter((at) => at <= from + EPS)
  const ends = edges.filter((at) => at >= to - EPS)
  const first = Math.max(...starts)
  const last = Math.min(...ends)
  const nearest = {
    from: runs.some((run) => run.to <= first + EPS) ? first : 0,
    to: runs.some((run) => run.from >= last - EPS) ? last : extent,
  }
  if (most === Infinity || nearest.to - nearest.from <= most + EPS) return nearest
  let best: Span | undefined
  for (const start of starts) {
    for (const end of ends) {
      if (end - start <= most + EPS && (!best || end - start > best.to - best.from)) best = { from: start, to: end }
    }
  }
  return best ?? nearest
}

/**
 * The cut: the parts' box taken out to lines of text it would otherwise run
 * through, each axis read against the lines the other lets in, until neither
 * moves. `most` is the widest it may be, where it stands in a column that
 * would otherwise cut it again.
 */
export function cutAtLines(start: Box, lines: readonly Box[], whole: { width: number; height: number }, most = Infinity): Box {
  const parts = clamp(start, whole)
  let cut = parts
  for (let round = 0; round < 20; round += 1) {
    const across = lines.filter((line) => Math.min(right(line), right(cut)) - Math.max(line.x, cut.x) > EPS)
    const down = spanAtLines(parts.y, bottom(parts), across.map((line) => ({ from: line.y, to: bottom(line) })), whole.height)
    const level = lines.filter((line) => Math.min(bottom(line), down.to) - Math.max(line.y, down.from) > EPS)
    const side = spanAtLines(parts.x, right(parts), level.map((line) => ({ from: line.x, to: right(line) })), whole.width, most)
    const next = { x: side.from, y: down.from, width: side.to - side.from, height: down.to - down.from }
    if (next.x === cut.x && next.y === cut.y && next.width === cut.width && next.height === cut.height) break
    cut = next
  }
  return cut
}

/**
 * How much smaller than it is laid out a picture is drawn: a picture scaled down to a narrow column is
 * measured as it is laid out, so the cut does not shrink with the scale it decides. 1 where nothing is laid out.
 */
export function drawnScale(picture: Element): number {
  const laid = (picture as HTMLElement).offsetWidth
  const drawn = picture.getBoundingClientRect().width
  return laid > 0 && drawn > 0 ? drawn / laid : 1
}

/** A box on screen in px from the picture's top left, as the picture is laid out. */
export function inPicture(picture: Element): (rect: DOMRect) => Box {
  const origin = picture.getBoundingClientRect()
  const scale = drawnScale(picture)
  return (rect) => ({ x: (rect.left - origin.left) / scale, y: (rect.top - origin.top) / scale, width: rect.width / scale, height: rect.height / scale })
}

/** Whether a line's text ends in an ellipsis where it does not fit. */
function ellipsed(element: Element | null): boolean {
  return !!element && element.ownerDocument.defaultView?.getComputedStyle(element).textOverflow === 'ellipsis'
}

/** Whether an element hides what overflows it, and so clips the lines inside it. */
function clips(element: Element): boolean {
  const style = element.ownerDocument.defaultView?.getComputedStyle(element)
  return !!style && (style.overflowX !== 'visible' || style.overflowY !== 'visible')
}

/**
 * Every line of text in the picture as it is seen, in px from its top left:
 * a line clipped by a box it sits in counts for the part of it that shows,
 * and one that shows not at all does not count.
 */
export function textLines(picture: Element): Line[] {
  const doc = picture.ownerDocument
  const walker = doc.createTreeWalker(picture, 4 /* NodeFilter.SHOW_TEXT */)
  const clipOf = new Map<Element, Box | undefined>()
  const relative = inPicture(picture)
  const clipFor = (element: Element | null): Box | undefined => {
    if (!element || element === picture || !picture.contains(element)) return undefined
    if (clipOf.has(element)) return clipOf.get(element)
    const above = clipFor(element.parentElement)
    const own = clips(element) ? relative(element.getBoundingClientRect()) : undefined
    const clip = own && above ? meet(own, above) : own ?? above
    clipOf.set(element, clip)
    return clip
  }
  // The picture's own frame clips too: a callout's line box standing over its top edge is seen to that edge.
  const frame = { x: 0, y: 0, width: picture.scrollWidth, height: picture.scrollHeight }
  const lines: Line[] = []
  const range = doc.createRange()
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue
    range.selectNodeContents(node)
    const clip = clipFor(node.parentElement)
    for (const rect of Array.from(range.getClientRects())) {
      const line = relative(rect)
      const seen = meet(clip ? meet(line, clip) : line, frame)
      // An ellipsis is the app's own way of saying there is more, drawn as the app draws it; anything else hidden is a line the picture cuts.
      const cut = line.height - seen.height > CLIPPED || line.width - seen.width > CLIPPED
      if (seen.width > EPS && seen.height > EPS) lines.push(cut && !ellipsed(node.parentElement) ? { ...seen, clipped: true } : seen)
    }
  }
  return lines
}

/** The part two boxes share: nothing wide where they share none. */
function meet(a: Box, b: Box): Box {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const width = Math.min(right(a), right(b)) - x
  const height = Math.min(bottom(a), bottom(b)) - y
  return { x, y, width: Math.max(0, width), height: Math.max(0, height) }
}

/**
 * How much the whole picture is enlarged to fill most of the window, both
 * ways and keeping its shape: the reviewer's press showed it at the size it
 * already had beside the words.
 */
export function fitScale(picture: { width: number; height: number }, room: { width: number; height: number }): number {
  if (picture.width <= 0 || picture.height <= 0 || room.width <= 0 || room.height <= 0) return 1
  return Math.min(room.width / picture.width, room.height / picture.height)
}

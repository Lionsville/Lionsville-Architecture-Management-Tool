// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a drawing's XML says, read without an editor.
 *
 * A drawing is draw.io's XML. A shape points at an element by
 * `link="element:<id>"` on the cell, or on the UserObject that wraps it.
 * `lvElement="<id>"` is the same point when the cell has no `link`. The
 * place is the cell's `mxGeometry`, and a child is placed relative to its
 * parent, so the absolute area is the sum of the ancestors. The labels —
 * a cell's `value`, a UserObject's `label` — are the prose a search
 * indexes. Nothing here draws, and nothing here changes the model.
 *
 * **One page.** A file draw.io saves may hold several `<diagram>` pages; the
 * picture the editor exports is the first, and so the links and the prose
 * are read from the first page alone. A page draw.io kept compressed holds
 * no cells this can read: {@link isCompressedDrawing} says so, and the agent
 * refuses one rather than keeping a drawing whose links read empty.
 */
import type { ContentAddress } from './imageName'
import type { DesignDiagram, DrawingLink, ElementId } from './types'

const ELEMENT_LINK = /^element:(.+)$/

/** The largest code point there is; a reference past it is not a character. */
const LAST_CODE_POINT = 0x10ffff

/**
 * The coordinate frame a picture is drawn in: model units, origin included.
 * A viewBox is the export's; a picture's frame says where that box sits in
 * the model.
 */
export type PictureFrame = { x: number; y: number; width: number; height: number }

type Attrs = Record<string, string>

type El = { tag: string; attrs: Attrs; children: El[] }

type Box = { x: number; y: number; width: number; height: number }

/** One cell that can point, or hold a child: its id, its parent, its words, its box. */
type Cell = {
  id: string
  parent?: string
  link?: string
  label?: string
  /** The label is HTML (`html=1` in the style), so its text is read as HTML. */
  html: boolean
  vertex: boolean
  edge: boolean
  /** `visible="0"`: drawn by nobody, and in no picture. */
  hidden: boolean
  /** The geometry is placed against the parent (an edge's label), not a box of its own. */
  relative: boolean
  /** Has an `mxGeometry` at all; a layer has none. */
  placed: boolean
  /** An edge's own points: its ends where they float, and its waypoints. */
  points: { x: number; y: number }[]
  x: number
  y: number
  width: number
  height: number
}

/** The links a drawing's XML names, in document order. Nested groups are summed. */
export function linksFromXml(xml: string): DrawingLink[] {
  const cells = cellsIn(xml)
  const byId = new Map(cells.map((cell) => [cell.id, cell]))
  const links: DrawingLink[] = []
  for (const cell of cells) {
    const elementId = elementOf(cell.link)
    if (!elementId) continue
    const area = absoluteArea(cell, byId)
    links.push({ shapeId: cell.id, elementId, area })
  }
  return links
}

/**
 * The words on the shapes, one label a line: what a search indexes as the
 * drawing's prose. HTML in a label is the text, not the tags.
 */
export function drawingProse(xml: string): string {
  const lines = cellsIn(xml).flatMap((cell) => {
    const text = labelText(cell.label, cell.html)
    return text ? [text] : []
  })
  return lines.join('\n')
}

/**
 * The drawings anchored to one element, in the order the scope keeps its
 * views. A drawing with no element is of the scope itself and is not among
 * them.
 */
export function drawingsAnchoredTo(
  diagrams: readonly { id: string; kind: string; name: string; elementId?: string }[],
  elementId: string,
): { id: string; name: string }[] {
  const found: { id: string; name: string }[] = []
  for (const diagram of diagrams) {
    if (diagram.kind === 'drawing' && diagram.elementId === elementId) found.push({ id: diagram.id, name: diagram.name })
  }
  return found
}

/**
 * Every content address a drawing in this list names. The sweep keeps these
 * the way it keeps an address the history names: a drawing's picture has no
 * library name of its own.
 */
export function drawingPictureAddresses(
  diagrams: readonly { kind: string; drawing?: { picture?: string } }[],
): ContentAddress[] {
  const addresses: ContentAddress[] = []
  for (const diagram of diagrams) {
    if (diagram.kind !== 'drawing') continue
    const picture = diagram.drawing?.picture
    if (picture) addresses.push(picture)
  }
  return addresses
}

/**
 * Where the drawing's shapes are, in model coordinates: every vertex that is
 * drawn, ancestors summed, and every point an edge names. Absent for a
 * drawing with nothing on it.
 *
 * This is the box draw.io crops an export to. Its `xmlsvg` export does not
 * draw the page: it draws the shapes' bounding box, moved so that its top
 * left is the picture's (0, 0). A label drawn outside its shape, or a thick
 * stroke, widens draw.io's own box by a little more than this reads; a
 * shape's place on the picture is then off by that much, and no more.
 */
export function drawingBounds(xml: string): Box | undefined {
  const cells = cellsIn(xml)
  const byId = new Map(cells.map((cell) => [cell.id, cell]))
  const hidden = hiddenCells(cells, byId)
  let box: { left: number; top: number; right: number; bottom: number } | undefined
  const take = (left: number, top: number, right: number, bottom: number) => {
    box = box
      ? { left: Math.min(box.left, left), top: Math.min(box.top, top), right: Math.max(box.right, right), bottom: Math.max(box.bottom, bottom) }
      : { left, top, right, bottom }
  }
  for (const cell of cells) {
    if (hidden.has(cell.id) || !cell.placed) continue
    if (cell.edge) {
      const origin = offsetOf(cell.parent, byId)
      for (const point of cell.points) take(origin.x + point.x, origin.y + point.y, origin.x + point.x, origin.y + point.y)
      continue
    }
    if (!cell.vertex || cell.relative) continue
    const area = absoluteArea(cell, byId)
    take(area.x, area.y, area.x + area.width, area.y + area.height)
  }
  const found = box as { left: number; top: number; right: number; bottom: number } | undefined
  return found ? { x: found.left, y: found.top, width: found.right - found.left, height: found.bottom - found.top } : undefined
}

/**
 * The picture's frame in model coordinates: where the export's box sits.
 *
 * The origin is where the shapes begin ({@link drawingBounds}) — draw.io
 * moved them there — and the size is the export's own viewBox, at the scale
 * it was exported at, one model unit to one picture unit. Without a viewBox
 * it is the shapes' box; without shapes, the viewBox from the origin.
 */
export function pictureFrame(xml: string, picture: PictureFrame | undefined): PictureFrame | undefined {
  const bounds = drawingBounds(xml)
  if (!picture) return bounds && bounds.width > 0 && bounds.height > 0 ? bounds : undefined
  return { x: bounds?.x ?? 0, y: bounds?.y ?? 0, width: picture.width, height: picture.height }
}

/**
 * Whether the first page is kept compressed: a `<diagram>` holding text and
 * no `mxGraphModel`. draw.io writes that unless it is told not to, and the
 * cells in it are not readable as XML.
 */
export function isCompressedDrawing(xml: string): boolean {
  const page = /<diagram\b[^>]*>([\s\S]*?)<\/diagram>/i.exec(xml)
  if (!page) return false
  const inside = page[1].trim()
  return inside.length > 0 && !/<mxGraphModel\b/i.test(inside)
}

/**
 * The picture's own frame, when it is an SVG that names a viewBox.
 *
 * That box is the coordinate system the image was exported in, so a model
 * coordinate scales onto the displayed image by it. Absent when the markup
 * is not an SVG or names no box.
 */
export function svgFrame(markup: string): PictureFrame | undefined {
  const tag = /<svg\b[^>]*>/i.exec(markup)?.[0]
  if (!tag) return undefined
  const box = /\sviewBox\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(tag)
  const raw = box?.[1] ?? box?.[2]
  if (!raw) return undefined
  const [x, y, width, height] = raw.trim().split(/[\s,]+/).map(Number)
  if (![x, y, width, height].every((value) => Number.isFinite(value))) return undefined
  if (width <= 0 || height <= 0) return undefined
  return { x, y, width, height }
}

/**
 * Where an area sits on the displayed picture, as fractions of it.
 *
 * The area is in model coordinates. The frame is the picture's, so the
 * fractions are the place on the image however it is scaled.
 */
export function areaOnPicture(
  area: DrawingLink['area'],
  frame: PictureFrame,
): { left: number; top: number; width: number; height: number } | undefined {
  if (frame.width <= 0 || frame.height <= 0) return undefined
  return {
    left: (area.x - frame.x) / frame.width,
    top: (area.y - frame.y) / frame.height,
    width: area.width / frame.width,
    height: area.height / frame.height,
  }
}

/**
 * The drawings in this list whose links point at the element, in the list's
 * order. A drawing anchored to the element and not pointing at it is not one.
 */
export function drawingsPointingAt(diagrams: readonly DesignDiagram[], elementId: ElementId): DesignDiagram[] {
  return diagrams.filter((diagram) =>
    diagram.kind === 'drawing' && (diagram.drawing?.links ?? []).some((link) => link.elementId === elementId))
}

function elementOf(link: string | undefined): string | undefined {
  const matched = link?.match(ELEMENT_LINK)
  const id = matched?.[1]
  return id ? id : undefined
}

/** `link` when the cell has one; otherwise `lvElement` read as `element:<id>`. */
function pointedAt(link: string | undefined, lvElement: string | undefined): string | undefined {
  if (link) return link
  if (lvElement) return `element:${lvElement}`
  return undefined
}

function absoluteArea(cell: Cell, byId: ReadonlyMap<string, Cell>): DrawingLink['area'] {
  let x = cell.x
  let y = cell.y
  const seen = new Set<string>([cell.id])
  let parent = cell.parent ? byId.get(cell.parent) : undefined
  while (parent && !seen.has(parent.id)) {
    seen.add(parent.id)
    x += parent.x
    y += parent.y
    parent = parent.parent ? byId.get(parent.parent) : undefined
  }
  return { x, y, width: cell.width, height: cell.height }
}

/** Where a cell's children are placed from: its own place, ancestors summed. A layer is at 0. */
function offsetOf(id: string | undefined, byId: ReadonlyMap<string, Cell>): { x: number; y: number } {
  const cell = id ? byId.get(id) : undefined
  if (!cell) return { x: 0, y: 0 }
  const area = absoluteArea(cell, byId)
  return { x: area.x, y: area.y }
}

/** The cells no picture draws: hidden ones, and everything inside one. */
function hiddenCells(cells: readonly Cell[], byId: ReadonlyMap<string, Cell>): Set<string> {
  const hidden = new Set<string>()
  for (const cell of cells) {
    const seen = new Set<string>()
    let at: Cell | undefined = cell
    while (at && !seen.has(at.id)) {
      if (at.hidden) {
        hidden.add(cell.id)
        break
      }
      seen.add(at.id)
      at = at.parent ? byId.get(at.parent) : undefined
    }
  }
  return hidden
}

/** The cells of the first page, or of the whole document where it has no pages. */
function cellsIn(xml: string): Cell[] {
  const cells: Cell[] = []
  walk(firstPage(parseElements(xml)), cells)
  return cells
}

/** The first `<diagram>` found, as the list to walk; the document itself where there is none. */
function firstPage(nodes: El[]): El[] {
  const queue = [...nodes]
  while (queue.length > 0) {
    const node = queue.shift()!
    if (node.tag === 'diagram') return [node]
    queue.push(...node.children)
  }
  return nodes
}

function walk(nodes: readonly El[], into: Cell[]): void {
  for (const node of nodes) {
    if (node.tag === 'UserObject' || node.tag === 'object') {
      const inner = node.children.find((child) => child.tag === 'mxCell')
      const cell = cellOf(node, inner && !inner.attrs.id ? inner : undefined)
      if (cell) into.push(cell)
      walk(node.children.filter((child) => child !== inner || Boolean(inner?.attrs.id)), into)
      continue
    }
    if (node.tag === 'mxCell') {
      const cell = cellOf(node)
      if (cell) into.push(cell)
    }
    walk(node.children, into)
  }
}

/** A cell from an element, taking parent, link and geometry from an inner mxCell that has no id of its own. */
function cellOf(node: El, inner?: El): Cell | undefined {
  const id = node.attrs.id || inner?.attrs.id
  if (!id) return undefined
  const source = inner ?? node
  // The inner cell's word first, the wrapper's where it has none.
  const pick = (name: string): string | undefined => source.attrs[name] || node.attrs[name] || undefined
  const geometryNode = source.children.find((child) => child.tag === 'mxGeometry') ?? node.children.find((child) => child.tag === 'mxGeometry')
  const geometry = geometryNode ? geometryOf(geometryNode) : { x: 0, y: 0, width: 0, height: 0 }
  const link = pointedAt(node.attrs.link || source.attrs.link, node.attrs.lvElement || source.attrs.lvElement)
  const label = node.attrs.label || node.attrs.value || source.attrs.value || source.attrs.label
  const parent = pick('parent')
  return {
    id,
    ...(parent ? { parent } : {}),
    ...(link ? { link } : {}),
    ...(label ? { label } : {}),
    html: /(?:^|;)\s*html=1\s*(?:;|$)/.test(pick('style') ?? ''),
    vertex: pick('vertex') === '1',
    edge: pick('edge') === '1',
    hidden: pick('visible') === '0',
    relative: geometryNode?.attrs.relative === '1',
    placed: geometryNode !== undefined,
    points: geometryNode ? pointsOf(geometryNode) : [],
    ...geometry,
  }
}

/** An edge geometry's points: a floating end (`sourcePoint`, `targetPoint`) and each waypoint. */
function pointsOf(geometry: El): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = []
  for (const child of geometry.children) {
    if (child.tag === 'mxPoint') points.push({ x: numberOf(child.attrs.x), y: numberOf(child.attrs.y) })
    if (child.tag === 'Array') {
      for (const point of child.children) {
        if (point.tag === 'mxPoint') points.push({ x: numberOf(point.attrs.x), y: numberOf(point.attrs.y) })
      }
    }
  }
  return points
}

function geometryOf(geometry: El): Box {
  return {
    x: numberOf(geometry.attrs.x),
    y: numberOf(geometry.attrs.y),
    width: numberOf(geometry.attrs.width),
    height: numberOf(geometry.attrs.height),
  }
}

function numberOf(value: string | undefined): number {
  if (value === undefined || value === '') return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Tags and text, enough to read draw.io's cells. Comments and the prologue are skipped. */
function parseElements(xml: string): El[] {
  const root: El[] = []
  const stack: El[] = []
  const re = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<\/([A-Za-z_][\w:.-]*)\s*>|<([A-Za-z_][\w:.-]*)([^>]*?)(\/)?>/g
  let match: RegExpExecArray | null
  while ((match = re.exec(xml))) {
    if (match[1]) {
      const name = match[1]
      for (let at = stack.length - 1; at >= 0; at -= 1) {
        if (stack[at].tag === name) {
          stack.length = at
          break
        }
      }
      continue
    }
    if (!match[2]) continue
    const el: El = { tag: match[2], attrs: attributes(match[3] ?? ''), children: [] }
    const parent = stack[stack.length - 1]
    ;(parent ? parent.children : root).push(el)
    if (!match[4]) stack.push(el)
  }
  return root
}

function attributes(raw: string): Attrs {
  // No prototype: an attribute called `constructor` or `__proto__` is an
  // attribute like any other, not a property of every object.
  const attrs = Object.create(null) as Attrs
  const re = /([A-Za-z_][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g
  let match: RegExpExecArray | null
  while ((match = re.exec(raw))) attrs[match[1]] = decode(match[3] ?? match[4] ?? '')
  return attrs
}

/** One character reference as its character; one past the last code point, or a surrogate, as U+FFFD. */
function character(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > LAST_CODE_POINT || (code >= 0xd800 && code <= 0xdfff)) return '\ufffd'
  return String.fromCodePoint(code)
}

/** XML's five entities and its character references, once. */
function decode(value: string): string {
  return value.replace(/&(?:#x([0-9a-fA-F]+)|#(\d+)|(lt|gt|quot|apos|amp));/g, (_, hex?: string, dec?: string, named?: string) => {
    if (hex !== undefined) return character(Number.parseInt(hex, 16))
    if (dec !== undefined) return character(Number.parseInt(dec, 10))
    return NAMED[named as keyof typeof NAMED]
  })
}

const NAMED = { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' } as const

/** HTML's entities a label is likely to hold, beside XML's: what draw.io's editor writes. */
function decodeHtml(value: string): string {
  return decode(value.replace(/&nbsp;/g, '\u00a0'))
}

/**
 * A label's words. The attribute is already decoded once, as XML. An HTML
 * label is HTML: its tags are taken out — a line break as a space — and its
 * entities decoded, once more and no more. A plain label is its text, tags
 * a person typed included as words would be, entities left as they read.
 */
export function labelText(label: string | undefined, html: boolean): string {
  if (!label) return ''
  const text = html
    ? decodeHtml(label.replace(/<(?:br|\/?(?:div|p|li))\b[^>]*>/gi, ' ').replace(/<[^>]*>/g, ''))
    : label.replace(/<[^>]*>/g, '')
  return text.replace(/\s+/g, ' ').trim()
}

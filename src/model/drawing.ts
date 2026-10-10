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
 */
import type { ContentAddress } from './imageName'
import type { DesignDiagram, DrawingLink, ElementId } from './types'

const ELEMENT_LINK = /^element:(.+)$/

/** draw.io's page, when the model does not name one. */
const PAGE_WIDTH = 850
const PAGE_HEIGHT = 1100

/**
 * The coordinate frame a picture is drawn in: model units, origin included.
 * A viewBox is the export's; a page is the model's, origin at 0.
 */
export type PictureFrame = { x: number; y: number; width: number; height: number }

type Attrs = Record<string, string>

type El = { tag: string; attrs: Attrs; children: El[] }

/** One cell that can point, or hold a child: its id, its parent, its words, its box. */
type Cell = {
  id: string
  parent?: string
  link?: string
  label?: string
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
    const text = plain(cell.label)
    return text ? [text] : []
  })
  return lines.join('\n')
}

/**
 * Every content address a drawing in this list names. The sweep keeps these
 * the way it keeps an address the history names: a drawing's picture has no
 * library name of its own.
 */
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
 * The page the model draws on.
 *
 * Origin at 0. The size is what `mxGraphModel` names, and draw.io's own page
 * where it names none — that is the frame an export uses when the picture
 * itself does not say.
 */
export function modelFrame(xml: string): PictureFrame {
  const tag = /<mxGraphModel\b([^>]*)>/i.exec(xml)?.[1] ?? ''
  return {
    x: 0,
    y: 0,
    width: positive(attr(tag, 'pageWidth')) ?? PAGE_WIDTH,
    height: positive(attr(tag, 'pageHeight')) ?? PAGE_HEIGHT,
  }
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

function cellsIn(xml: string): Cell[] {
  const cells: Cell[] = []
  walk(parseElements(xml), cells)
  return cells
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
  const geometry = geometryOf(source) ?? geometryOf(node)
  const link = pointedAt(
    node.attrs.link || source.attrs.link,
    node.attrs.lvElement || source.attrs.lvElement,
  )
  const label = node.attrs.label || node.attrs.value || source.attrs.value || source.attrs.label
  return {
    id,
    ...(source.attrs.parent || node.attrs.parent ? { parent: source.attrs.parent || node.attrs.parent } : {}),
    ...(link ? { link } : {}),
    ...(label ? { label } : {}),
    x: geometry?.x ?? 0,
    y: geometry?.y ?? 0,
    width: geometry?.width ?? 0,
    height: geometry?.height ?? 0,
  }
}

function geometryOf(node: El): { x: number; y: number; width: number; height: number } | undefined {
  const geometry = node.children.find((child) => child.tag === 'mxGeometry')
  if (!geometry) return undefined
  return {
    x: numberOf(geometry.attrs.x),
    y: numberOf(geometry.attrs.y),
    width: numberOf(geometry.attrs.width),
    height: numberOf(geometry.attrs.height),
  }
}

function attr(raw: string, name: string): string | undefined {
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(raw)
  return match?.[1] ?? match?.[2]
}

function positive(value: string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
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
  const attrs: Attrs = {}
  const re = /([A-Za-z_][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g
  let match: RegExpExecArray | null
  while ((match = re.exec(raw))) attrs[match[1]] = decode(match[3] ?? match[4] ?? '')
  return attrs
}

function decode(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function plain(label: string | undefined): string {
  if (!label) return ''
  return decode(label).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

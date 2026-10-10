// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a drawing's XML says, read without an editor.
 *
 * A drawing is draw.io's XML. A shape points at an element by
 * `link="element:<id>"` on the cell, or on the UserObject that wraps it.
 * The place is the cell's `mxGeometry`, and a child is placed relative to
 * its parent, so the absolute area is the sum of the ancestors. The labels
 * — a cell's `value`, a UserObject's `label` — are the prose a search
 * indexes. Nothing here draws, and nothing here changes the model.
 */
import type { ContentAddress } from './imageName'
import type { DrawingLink } from './types'

const ELEMENT_LINK = /^element:(.+)$/

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

function elementOf(link: string | undefined): string | undefined {
  const matched = link?.match(ELEMENT_LINK)
  const id = matched?.[1]
  return id ? id : undefined
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
  const link = node.attrs.link || source.attrs.link
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

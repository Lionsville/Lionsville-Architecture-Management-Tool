// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the drawing editor says to draw.io, and what it hears back.
 *
 * The frame speaks the JSON protocol: a message is a JSON string, posted
 * across origins. This file is the words. It does not hold an iframe, and it
 * does not change the model — a save is a `diagram.update` the caller makes,
 * on the one write a drawing already has.
 */
import type { Language } from '../i18n/languages'
import { isCompressedDrawing, labelText, linksFromXml } from '../model/drawing'
import type { DrawingContent } from '../model'

/** An empty drawing: a model with the root and the default layer, and nothing on it. */
export const EMPTY_DRAWING_XML =
  '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>'

/** The two looks the app has, as its theme resolves them. */
export type DrawingMode = 'light' | 'dark'

/**
 * The query the frame is opened with.
 *
 * Embedded, the JSON protocol, configuration from us, no logo, no windows of
 * its own, the small interface, the app's language and the app's look
 * (`dark`). `keepmodified`: a save leaves the editor saying it has changes
 * until this side says the save landed ({@link savedStatus}), so its own Exit
 * still asks before it drops work a refused save did not keep. No `libs`:
 * the palette is the configuration, not a parameter.
 */
export function drawingFrameQuery(language: Language, mode: DrawingMode = 'light'): string {
  return `embed=1&proto=json&configure=1&stealth=1&suppressNewWindows=1&keepmodified=1&ui=min&lang=${language}&dark=${mode === 'dark' ? 1 : 0}`
}

/** The frame's address: the origin, and the query on its root. */
export function drawingFrameSrc(origin: string, language: Language, mode: DrawingMode = 'light'): string {
  const base = origin.endsWith('/') ? origin : `${origin}/`
  return `${base}?${drawingFrameQuery(language, mode)}`
}

/**
 * What the frame may do: run its scripts on its own origin, and nothing else
 * a page in a frame can be let do — no popups, no downloads, no navigating
 * the app, no forms. The real editor loads, saves and exports with these two
 * alone (the smoke run).
 */
export const DRAWING_FRAME_SANDBOX = 'allow-scripts allow-same-origin'

/**
 * The origin a message is posted to.
 *
 * A scheme this runtime treats as standard has an origin. `drawing://` does
 * not, until the desktop registers it, and then `origin` is `null` — the
 * scheme and host are the target either way.
 */
export function frameTarget(origin: string): string {
  try {
    const parsed = new URL(origin)
    if (parsed.origin !== 'null') return parsed.origin
    // An opaque origin — `drawing://` until the scheme is registered. The
    // scheme and the host are the target.
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return origin.replace(/\/$/, '')
  }
}

/** One element, as far as a palette shape needs: what it is called, and which it is. */
export type PaletteElement = { id: string; name: string }

const SHAPE_WIDTH = 160
const SHAPE_HEIGHT = 60

/**
 * One element, as a shape draw.io can drop on the page.
 *
 * Uncompressed XML, so it starts with `<`. The shape is a UserObject: the
 * label is the element's name, `link="element:<id>"` is the point at it, and
 * `lvElement` says the same id beside the link. The label is plain text, not
 * HTML: a name is words, and a name with a `<` in it is drawn as one.
 */
export function elementShapeXml(element: PaletteElement): string {
  const label = xmlAttr(element.name || element.id)
  const id = xmlAttr(element.id)
  return '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>'
    + `<UserObject label="${label}" link="element:${id}" lvElement="${id}" id="2">`
    + '<mxCell vertex="1" parent="1" style="rounded=0;whiteSpace=wrap;">'
    + `<mxGeometry width="${SHAPE_WIDTH}" height="${SHAPE_HEIGHT}" as="geometry"/>`
    + '</mxCell></UserObject></root></mxGraphModel>'
}

/**
 * The configuration sent when the frame asks.
 *
 * Uncompressed XML, the elements and the C4 shapes, both on, both open. Each
 * element is uncompressed XML in the library's data.
 */
export function drawingConfig(elements: readonly PaletteElement[], paletteTitle: string): {
  compressXml: false
  defaultLibraries: string
  enabledLibraries: string[]
  expandLibraries: true
  libraries: unknown[]
} {
  return {
    // The XML a save hands back is kept as text a person can read and a diff
    // can show (ADR-0034 §2), and its cells are what the links are read from.
    compressXml: false,
    defaultLibraries: 'elements;c4',
    enabledLibraries: ['elements', 'c4'],
    expandLibraries: true,
    libraries: [
      {
        entries: [
          {
            id: 'elements',
            libs: [
              {
                title: { main: paletteTitle },
                expand: true,
                data: elements.map((element) => ({
                  title: element.name || element.id,
                  w: SHAPE_WIDTH,
                  h: SHAPE_HEIGHT,
                  xml: elementShapeXml(element),
                })),
              },
            ],
          },
        ],
      },
    ],
  }
}

export function configureMessage(elements: readonly PaletteElement[], paletteTitle: string): {
  action: 'configure'
  config: ReturnType<typeof drawingConfig>
} {
  return { action: 'configure', config: drawingConfig(elements, paletteTitle) }
}

/** Load the drawing, or an empty model when it has not been drawn, in the app's look. */
export function loadMessage(xml: string | undefined, mode: DrawingMode = 'light'): { action: 'load'; xml: string; dark: boolean } {
  return { action: 'load', xml: xml && xml.length > 0 ? xml : EMPTY_DRAWING_XML, dark: mode === 'dark' }
}

/** The picture, as SVG with the XML inside it. */
export function exportMessage(): { action: 'export'; format: 'xmlsvg' } {
  return { action: 'export', format: 'xmlsvg' }
}

/** The drawing as it is in the editor now, saved or not: asked for before the look changes. */
export function currentXmlMessage(): { action: 'export'; format: 'xml' } {
  return { action: 'export', format: 'xml' }
}

/** Tell the editor its save landed, so it no longer says it has changes. */
export function savedStatus(): { action: 'status'; modified: false } {
  return { action: 'status', modified: false }
}

/** Tell the editor it holds work no save has kept: after a reload in another look. */
export function unsavedStatus(): { action: 'status'; modified: true } {
  return { action: 'status', modified: true }
}

/** The newer drawing, for draw.io to merge with what is open. */
export function mergeMessage(xml: string): { action: 'merge'; xml: string } {
  return { action: 'merge', xml }
}

/** What the frame said, as far as this side reads it. */
export type FrameEvent = { event?: string; xml?: unknown; data?: unknown; format?: unknown; exit?: unknown; modified?: unknown }

/** A message the frame posted, or nothing when it is not one. */
export function frameEvent(data: unknown): FrameEvent | undefined {
  const parsed = typeof data === 'string' ? parsedJson(data) : data
  if (!parsed || typeof parsed !== 'object') return undefined
  const held = parsed as Record<string, unknown>
  return {
    ...(typeof held.event === 'string' ? { event: held.event } : {}),
    xml: held.xml,
    data: held.data,
    format: held.format,
    exit: held.exit,
    modified: held.modified,
  }
}

/**
 * What a save event is answered with: an export, in `xmlsvg`.
 * Configure and init are answered with their own messages; init loads the
 * drawing with every pointing shape labelled as its element is called now.
 * Anything else is not a turn we take.
 */
export function replyTo(
  event: { event?: string },
  held: { elements: readonly PaletteElement[]; paletteTitle: string; xml: string | undefined; mode?: DrawingMode },
): { action: string; [key: string]: unknown } | undefined {
  if (event.event === 'configure') return configureMessage(held.elements, held.paletteTitle)
  if (event.event === 'init') return loadMessage(held.xml && withElementNames(held.xml, held.elements), held.mode)
  if (event.event === 'save') return exportMessage()
  return undefined
}

/**
 * The SVG an export answered with, as bytes.
 *
 * The frame sends a data URI, base64 or not, or the markup itself when it
 * starts with `<`. Anything else is not a picture.
 */
export function svgBytes(data: string): Uint8Array | undefined {
  const bytes = rawBytes(data)
  if (!bytes) return undefined
  // A picture is an SVG: its first element is `<svg`. Anything else — a page
  // of HTML, a PNG — is not kept as a drawing's picture.
  const head = new TextDecoder().decode(bytes.subarray(0, 4096)).replace(/<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!DOCTYPE[^>]*>/gi, '').trimStart()
  return /^<svg[\s>]/i.test(head) ? bytes : undefined
}

function rawBytes(data: string): Uint8Array | undefined {
  if (data.startsWith('<')) return new TextEncoder().encode(data)
  if (!data.startsWith('data:')) return undefined
  const comma = data.indexOf(',')
  if (comma < 0) return undefined
  const meta = data.slice(0, comma)
  const body = data.slice(comma + 1)
  try {
    if (meta.includes(';base64')) {
      const binary = atob(body)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
      return bytes
    }
    return new TextEncoder().encode(decodeURIComponent(body))
  } catch {
    return undefined
  }
}

/**
 * The XML a save keeps: the one the save event named, uncompressed, because
 * the configuration asked for that — the export's own copy is compressed
 * whatever the configuration says. The export's, where the save named none
 * and it is readable. A compressed one is not kept: its links would read
 * empty.
 */
export function savedXml(exported: unknown, fromSave: string | undefined): string | undefined {
  for (const xml of [fromSave, exported]) {
    if (typeof xml === 'string' && xml.length > 0 && !isCompressedDrawing(xml)) return xml
  }
  return undefined
}

/** The drawing a save writes: the XML, the picture's address, and the links read from the XML. */
export function savedDrawing(xml: string, picture: string): DrawingContent {
  return { xml, picture, links: linksFromXml(xml) }
}

/** The XML to merge, when the drawing now held is not the one this save wrote. */
export function newerDrawing(current: string | undefined, written: string): string | undefined {
  const xml = current && current.length > 0 ? current : EMPTY_DRAWING_XML
  return xml === written ? undefined : xml
}

/**
 * The drawing with every shape that points at an element labelled with that
 * element's name as it is now (ADR-0034 §4): the model is the one place, and
 * the label is a copy of it, refreshed each time the editor opens. A shape
 * whose element is not in the list keeps its label; so does one whose label
 * already reads as the name, formatting and all. An HTML label is written as
 * HTML.
 */
export function withElementNames(xml: string, elements: readonly PaletteElement[]): string {
  const names = new Map(elements.map((element) => [element.id, element.name]))
  return xml.replace(/<(UserObject|object|mxCell)\b([^>]*?)(\/?)>/g, (whole, tag: string, attrs: string, closed: string, at: number) => {
    const id = pointedId(attrs)
    const name = id === undefined ? undefined : names.get(id)
    if (!name) return whole
    const wrapper = tag !== 'mxCell'
    const key = wrapper ? 'label' : 'value'
    const style = wrapper ? /<mxCell\b[^>]*?\sstyle="([^"]*)"/.exec(xml.slice(at + whole.length))?.[1] ?? '' : attrOf(attrs, 'style') ?? ''
    const html = /(?:^|;)\s*html=1\s*(?:;|$)/.test(style)
    const current = attrOf(attrs, key)
    if (current !== undefined && labelText(xmlText(current), html) === name) return whole
    const written = xmlAttr(html ? htmlText(name) : name)
    const next = current === undefined
      ? `${attrs} ${key}="${written}"`
      : attrs.replace(new RegExp(`(\\s${key}\\s*=\\s*)"[^"]*"`), `$1"${written}"`)
    return `<${tag}${next}${closed}>`
  })
}

/** The element a tag's own attributes point at: `link="element:<id>"`, or `lvElement`. */
function pointedId(attrs: string): string | undefined {
  const link = attrOf(attrs, 'link')
  const matched = link === undefined ? undefined : /^element:(.+)$/.exec(xmlText(link))?.[1]
  return matched ?? (attrOf(attrs, 'lvElement') !== undefined ? xmlText(attrOf(attrs, 'lvElement')!) : undefined)
}

function attrOf(attrs: string, name: string): string | undefined {
  return new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`).exec(attrs)?.[1]
}

/** An attribute's raw value as its text: XML's five entities, once. */
function xmlText(raw: string): string {
  return raw.replace(/&(lt|gt|quot|apos|amp);/g, (_, named: string) => ({ lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' })[named] ?? '')
}

/** Words as HTML text: what an HTML label must hold for the words to read as themselves. */
function htmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function xmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function parsedJson(data: string): unknown {
  try {
    return JSON.parse(data)
  } catch {
    return undefined
  }
}

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
import { linksFromXml } from '../model/drawing'
import type { DrawingContent } from '../model'
import { isCommandRefusal } from '../model/commands/handler'

/** An empty drawing: a model with the root and the default layer, and nothing on it. */
export const EMPTY_DRAWING_XML =
  '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>'

/**
 * The query the frame is opened with.
 *
 * Embedded, the JSON protocol, configuration from us, no logo, no windows of
 * its own, the small interface, and the app's language. No `libs`: the
 * palette is the configuration, not a parameter.
 */
export function drawingFrameQuery(language: Language): string {
  return `embed=1&proto=json&configure=1&stealth=1&suppressNewWindows=1&ui=min&lang=${language}`
}

/** The frame's address: the origin, and the query on its root. */
export function drawingFrameSrc(origin: string, language: Language): string {
  const base = origin.endsWith('/') ? origin : `${origin}/`
  return `${base}?${drawingFrameQuery(language)}`
}

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
 * `lvElement` says the same id beside the link.
 */
export function elementShapeXml(element: PaletteElement): string {
  const label = xmlAttr(element.name || element.id)
  const id = xmlAttr(element.id)
  return '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>'
    + `<UserObject label="${label}" link="element:${id}" lvElement="${id}" id="2">`
    + '<mxCell vertex="1" parent="1" style="rounded=0;whiteSpace=wrap;html=1;">'
    + `<mxGeometry width="${SHAPE_WIDTH}" height="${SHAPE_HEIGHT}" as="geometry"/>`
    + '</mxCell></UserObject></root></mxGraphModel>'
}

/**
 * The configuration sent when the frame asks.
 *
 * The elements and the C4 shapes, both on, both open. Each element is
 * uncompressed XML in the library's data.
 */
export function drawingConfig(elements: readonly PaletteElement[], paletteTitle: string): {
  defaultLibraries: string
  enabledLibraries: string[]
  expandLibraries: true
  libraries: unknown[]
} {
  return {
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

/** Load the drawing, or an empty model when it has not been drawn. */
export function loadMessage(xml: string | undefined): { action: 'load'; xml: string } {
  return { action: 'load', xml: xml && xml.length > 0 ? xml : EMPTY_DRAWING_XML }
}

/** The picture, as SVG with the XML inside it. */
export function exportMessage(): { action: 'export'; format: 'xmlsvg' } {
  return { action: 'export', format: 'xmlsvg' }
}

/** The newer drawing, for draw.io to merge with what is open. */
export function mergeMessage(xml: string): { action: 'merge'; xml: string } {
  return { action: 'merge', xml }
}

/** A message the frame posted, or nothing when it is not one. */
export function frameEvent(data: unknown): { event?: string; xml?: unknown; data?: unknown } | undefined {
  const parsed = typeof data === 'string' ? parsedJson(data) : data
  if (!parsed || typeof parsed !== 'object') return undefined
  const event = (parsed as { event?: unknown }).event
  return {
    ...(typeof event === 'string' ? { event } : {}),
    xml: (parsed as { xml?: unknown }).xml,
    data: (parsed as { data?: unknown }).data,
  }
}

/**
 * What a save event is answered with: an export, in `xmlsvg`.
 * Configure and init are answered with their own messages. Anything else is
 * not a turn we take.
 */
export function replyTo(
  event: { event?: string },
  held: { elements: readonly PaletteElement[]; paletteTitle: string; xml: string | undefined },
): { action: string; [key: string]: unknown } | undefined {
  if (event.event === 'configure') return configureMessage(held.elements, held.paletteTitle)
  if (event.event === 'init') return loadMessage(held.xml)
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

/** The XML an export carried, or the one the save named, when the export did not. */
export function savedXml(exported: unknown, fromSave: string | undefined): string | undefined {
  if (typeof exported === 'string' && exported.length > 0) return exported
  if (fromSave && fromSave.length > 0) return fromSave
  return undefined
}

/** The drawing a save writes: the XML, the picture's address, and the links read from the XML. */
export function savedDrawing(xml: string, picture: string): DrawingContent {
  return { xml, picture, links: linksFromXml(xml) }
}

/**
 * A channel's own refusal of this save.
 *
 * The reducer's keys are a closed set, and a command it refuses is said the
 * way every other command's refusal is said. What is left is the channel's
 * key. Two saves of one drawing write one key, so that refusal is the overlap,
 * and the repair is the editor's merge rather than another write.
 */
export function isDrawingOverlap(refused: string): boolean {
  return refused !== 'agent.readOnly' && !isCommandRefusal(refused)
}

/** The XML to merge, when the drawing now held is not the one this save wrote. */
export function newerDrawing(current: string | undefined, written: string): string | undefined {
  const xml = current && current.length > 0 ? current : EMPTY_DRAWING_XML
  return xml === written ? undefined : xml
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

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A laid-out page as a picture, for an agent that asked to see it (ADR-0007).
 *
 * The sheet's first, and now every page that is laid out rather than drawn
 * — the map, the technology landscape — which is why it lives among the
 * widgets: a page is a DOM node with a size, and rasterising one knows
 * nothing about what the page is of.
 *
 * The canvas gives an agent a PNG by rasterising React Flow's viewport and
 * handing back the transform beside it, so a pixel maps to a flow coordinate.
 * A sheet has no coordinates: it is laid out from the trees, and the only
 * honest thing to hand over is the page as drawn, at a size. So this is the
 * smaller half of `editor/export/exportPng.ts` — the same library, no title
 * block, no crop, no transform.
 *
 * The page is rasterised **unclipped**: the body scrolls on screen, and a
 * picture of the visible third of a business architecture would be worse than
 * none. The clone is given `overflow: visible` and the node's full scroll
 * size, which is what makes the whole page come out.
 *
 * What it leaves out is the authoring controls. Every *+* on the page carries
 * `data-sheet-add`, and a picture of a business architecture with *+ phase*
 * printed eleven times across it is a picture of the tool rather than of the
 * architecture — the one thing a drawing handed to somebody else must not be.
 */

import { pictureFontCss } from './pictureFonts'
import { refused } from './pictureRefused'

export type SheetShot = {
  png: Uint8Array
  width: number
  height: number
  pixelRatio: number
}

export type PageCaptureOptions = {
  maxPixels: number
  /**
   * Lay the page out at this width in CSS pixels before drawing it — the
   * long side of an A1 is 3179 (`business/grid.paperWidth`). Absent draws
   * the page as it stands, at the window's width.
   */
  width?: number
}

/** What a laid-out page hands the host, so the agent's renderer can ask it for a picture. */
export type PageHandle = {
  /** Which view is on screen, so a caller can tell it is the one it asked for. */
  readonly diagramId: string
  /**
   * The one thing selected on the page, by element id, where one is: what a
   * link to the view selects again (ADR-0033, amended 11 October 2026). A
   * laid-out page keeps its own selection, so it says it itself.
   */
  readonly selectedId?: string
  capture(options: PageCaptureOptions): Promise<SheetShot>
}

/**
 * At most two image pixels per CSS pixel — a retina screen — and fewer when
 * the page would otherwise overflow the budget. Two decimals, rounded down,
 * the way the export rounds down.
 */
export function sheetPixelRatio(width: number, height: number, maxPixels: number): number {
  if (width <= 0 || height <= 0) return 1
  return Math.max(0.05, Math.floor(Math.min(2, Math.sqrt(maxPixels / (width * height))) * 100) / 100)
}

export async function captureSheet(
  node: HTMLElement,
  options: { maxPixels: number; background?: string },
): Promise<SheetShot> {
  // The rasteriser arrives with the first picture asked for, not in the first download.
  const { toCanvas } = await import('html-to-image')
  const fontEmbedCSS = await pictureFontCss()
  const width = Math.max(node.scrollWidth, node.clientWidth, 1)
  const height = Math.max(node.scrollHeight, node.clientHeight, 1)
  const pixelRatio = sheetPixelRatio(width, height, options.maxPixels)

  const painted = paintSvgInline(node)
  const canvas = await toCanvas(node, {
    backgroundColor: options.background,
    // The app's own faces, handed over ready (`pictureFonts`).
    fontEmbedCSS,
    pixelRatio,
    width,
    height,
    // The page scrolls; the picture does not.
    style: { overflow: 'visible', width: `${width}px`, height: `${height}px` },
    filter: (held) => !(held instanceof HTMLElement) || held.dataset.sheetAdd === undefined,
  }).catch((cause: unknown) => { throw refused(cause) }).finally(painted)
  const blob = await blobOf(canvas)
  return {
    png: new Uint8Array(await blob.arrayBuffer()),
    width: Math.round(width * pixelRatio),
    height: Math.round(height * pixelRatio),
    pixelRatio,
  }
}

/** What an SVG shape is painted with, which a class gives it on the page and nothing gives it in the picture. */
const SVG_PAINT = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'stroke-opacity', 'opacity', 'visibility', 'display', 'marker-start', 'marker-mid', 'marker-end'] as const

/**
 * The library copies an `<svg>` whole and writes no style onto anything inside
 * it, so a line painted by a class — the chart's connectors, the kit's lines —
 * comes out unpainted. Each shape is given its paint as an inline style for the
 * picture, and the styles it had are put back after, drawn or not.
 */
export function paintSvgInline(node: HTMLElement): () => void {
  const held: Array<{ shape: SVGElement; style: string | null }> = []
  for (const shape of node.querySelectorAll<SVGElement>('svg *')) {
    const computed = getComputedStyle(shape)
    held.push({ shape, style: shape.getAttribute('style') })
    for (const name of SVG_PAINT) {
      const value = computed.getPropertyValue(name)
      if (value) shape.style.setProperty(name, value)
    }
  }
  return () => {
    for (const { shape, style } of held) {
      if (style === null) shape.removeAttribute('style')
      else shape.setAttribute('style', style)
    }
  }
}

function blobOf(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      // A browser that declined the bitmap. There is nothing to hand over and
      // nothing to retry, so it is said out loud rather than returned empty.
      else reject(new Error('captureSheet: the browser produced no image'))
    }, 'image/png')
  })
}

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
import { toCanvas } from 'html-to-image'

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
  const width = Math.max(node.scrollWidth, node.clientWidth, 1)
  const height = Math.max(node.scrollHeight, node.clientHeight, 1)
  const pixelRatio = sheetPixelRatio(width, height, options.maxPixels)

  const canvas = await toCanvas(node, {
    backgroundColor: options.background,
    pixelRatio,
    width,
    height,
    // The page scrolls; the picture does not.
    style: { overflow: 'visible', width: `${width}px`, height: `${height}px` },
    filter: (held) => !(held instanceof HTMLElement) || held.dataset.sheetAdd === undefined,
  })
  const blob = await blobOf(canvas)
  return {
    png: new Uint8Array(await blob.arrayBuffer()),
    width: Math.round(width * pixelRatio),
    height: Math.round(height * pixelRatio),
    pixelRatio,
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

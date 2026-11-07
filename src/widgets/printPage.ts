// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A laid-out page ready for paper: text and rules rather than pixels.
 *
 * A copy of the page goes straight under the body and everything else leaves the
 * print, so nothing the page sits in can clip it or spill it onto a second sheet.
 * The copy is scaled by a transform, and a transform is still vector in a PDF; the
 * sheet is size-contained, because paged layout breaks by the size before the scale. What
 * then asks for the PDF is the host's: Electron's `printToPDF` on the desktop, the
 * browser's own print dialog on the web, each reading the `@page` size set here.
 */
import { tokenVariables } from './kit/tokens'

export type PrintPaper = { readonly name: string; readonly widthMm: number; readonly heightMm: number }

export const PRINT_PAPERS: Readonly<Record<'A4' | 'A3' | 'A2' | 'A1' | 'A0', PrintPaper>> = {
  A4: { name: 'A4', widthMm: 297, heightMm: 210 },
  A3: { name: 'A3', widthMm: 420, heightMm: 297 },
  A2: { name: 'A2', widthMm: 594, heightMm: 420 },
  A1: { name: 'A1', widthMm: 841, heightMm: 594 },
  A0: { name: 'A0', widthMm: 1189, heightMm: 841 },
}

const CSS_PX_PER_MM = 96 / 25.4

/** A margin of one part in sixty of the long side, and never under 8 mm, so a large sheet has a margin in proportion. */
export function printMarginMm(paper: PrintPaper): number {
  return Math.max(8, paper.widthMm / 60)
}

/** The scale that fits a page of this size inside the paper's margins. */
export function printScale(page: { width: number; height: number }, paper: PrintPaper): number {
  const margin = printMarginMm(paper)
  const room = (paper.widthMm - 2 * margin) * CSS_PX_PER_MM
  const tall = (paper.heightMm - 2 * margin) * CSS_PX_PER_MM
  return Math.min(room / page.width, tall / page.height)
}

export type PrintPage = {
  /** The copy on its sheet, for a host that rasterises rather than prints. */
  readonly node: HTMLElement
  /** Takes the copy and the page size away again. */
  release(): void
}

/**
 * Put a copy of `page` on paper, in the print's own light theme whatever the window
 * is in. The page's own size is its content's: it may be scrolled or scaled on screen.
 */
export function printPage(page: HTMLElement, size: { width: number; height: number }, paper: PrintPaper): PrintPage {
  const scale = printScale(size, paper)
  const margin = printMarginMm(paper)
  const host = document.createElement('div')
  host.className = 'print-page'
  host.style.cssText = `position:absolute;left:0;top:0;width:${paper.widthMm - 2 * margin}mm;height:${paper.heightMm - 2 * margin}mm;overflow:hidden;contain:strict;background:#fff`
  for (const [name, value] of Object.entries(tokenVariables('light'))) host.style.setProperty(name, value)
  const copy = page.cloneNode(true) as HTMLElement
  copy.style.transform = `scale(${scale})`
  copy.style.transformOrigin = '0 0'
  copy.style.position = 'absolute'
  copy.style.width = `${size.width}px`
  copy.style.height = `${size.height}px`
  copy.removeAttribute('data-testid')
  host.append(copy)
  const style = document.createElement('style')
  style.textContent = `@page { size: ${paper.widthMm}mm ${paper.heightMm}mm; margin: ${margin}mm; }
@media print { html, body { background: #fff; height: auto; overflow: visible; } body > :not(.print-page) { display: none !important; } .print-page { position: static !important; } }
@media screen { .print-page { visibility: hidden; pointer-events: none; } }`
  document.head.append(style)
  document.body.append(host)
  return { node: host, release: () => { host.remove(); style.remove() } }
}

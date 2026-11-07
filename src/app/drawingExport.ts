// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A file from the picture a drawing keeps, for anyone reading it: the editor's own
 * menu has every format, and needs the editor. PNG is the SVG drawn on a canvas at
 * twice its size, on the page's white, since a slide is where it is going.
 */
import { slug } from '../model/keys'
import type { PictureFrame } from '../model/drawing'
import type { SavedDocument } from '../ports/DocumentGateway'
import { coloursOf } from '../widgets/kit/tokens'
import { PRINT_PAPERS, printPage } from '../widgets/printPage'
import type { PrintPaper } from '../widgets/printPage'

/** Pixels per picture unit. */
const PNG_SCALE = 2

export async function pictureFile(name: string, svg: Uint8Array, format: 'svg' | 'png', frame: PictureFrame | undefined): Promise<SavedDocument> {
  const base = fileBase(name)
  if (format === 'svg') return { name: `${base}.svg`, mediaType: 'image/svg+xml', bytes: svg }
  return { name: `${base}.png`, mediaType: 'image/png', bytes: await pngOf(svg, frame) }
}

/** What asks for the paper: the host's, as for every other page that prints. */
export type PrintHost = (doc: { name: string; widthMm: number; heightMm: number }) => Promise<void>

/**
 * A picture on paper: A4 the way round it fits, a copy under the body, and what
 * prints it asked once the picture has been decoded, since a print does not wait
 * for an image. An image rather than the markup, so nothing in the SVG runs here.
 */
export async function printPicture(name: string, svg: Uint8Array, print: PrintHost): Promise<void> {
  const url = URL.createObjectURL(new Blob([new Uint8Array(svg)], { type: 'image/svg+xml' }))
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const size = { width: image.naturalWidth || 800, height: image.naturalHeight || 600 }
    const sideways = PRINT_PAPERS.A4
    const paper: PrintPaper = size.width >= size.height ? sideways : { name: sideways.name, widthMm: sideways.heightMm, heightMm: sideways.widthMm }
    const held = printPage(image, size, paper)
    try {
      await held.node.querySelector('img')?.decode()
      await print({ name: `${fileBase(name)}.pdf`, widthMm: paper.widthMm, heightMm: paper.heightMm })
    } finally {
      held.release()
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** `slug` answers `element` for a name with no letter it can keep, which here would be somebody else's word. */
function fileBase(name: string): string {
  const word = slug(name)
  return word === 'element' && !/element/i.test(name) ? 'drawing' : word
}

async function pngOf(svg: Uint8Array, frame: PictureFrame | undefined): Promise<Uint8Array> {
  const url = URL.createObjectURL(new Blob([new Uint8Array(svg)], { type: 'image/svg+xml' }))
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil((frame?.width ?? image.naturalWidth) * PNG_SCALE)
    canvas.height = Math.ceil((frame?.height ?? image.naturalHeight) * PNG_SCALE)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('no canvas')
    context.fillStyle = coloursOf('light')['surface-raised']
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => { canvas.toBlob(resolve, 'image/png') })
    if (!blob) throw new Error('no png')
    return new Uint8Array(await blob.arrayBuffer())
  } finally {
    URL.revokeObjectURL(url)
  }
}

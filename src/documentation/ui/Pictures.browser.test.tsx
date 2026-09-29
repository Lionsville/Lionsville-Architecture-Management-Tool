// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Nothing on a page moves when its pictures arrive, in Chromium and WebKit
 * (`vitest.browser.config.ts`, `npm run test:browser`).
 *
 * A document is laid out by a real browser with every picture's box taken
 * from the library, before a byte is answered; then the bytes are answered,
 * decoded and painted, and every picture and every paragraph after them is
 * where it was, to the pixel. The pictures are real ones, drawn on a canvas
 * in a shape other than their box's where the entry says nothing, so a box
 * that followed the picture would show. What the page asks for is what the
 * browser's own IntersectionObserver says came into view: a picture far
 * below the window is never asked for.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { imageEntryOf } from '../../model/imageEntry'
import type { ImageEntry } from '../../model/imageName'
import { memoryImageSource } from '../pictureSource'
import type { PictureBytes } from '../pictureSource'
import { MarkdownView } from './MarkdownView'
import { LibraryPicture, PicturesProvider } from './Pictures'

/** A picture of the given size, as a browser encodes one. */
async function drawn(width: number, height: number): Promise<Uint8Array> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')!
  context.fillStyle = '#3a7'
  context.fillRect(0, 0, width, height)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((made) => (made ? resolve(made) : reject(new Error('no picture'))), 'image/png')
  })
  return new Uint8Array(await blob.arrayBuffer())
}

/**
 * An SVG that declares no size at all: laid out in the default shape. A
 * browser draws such an SVG as 300 by 150 of its own units, so its tall strip
 * is cut off at 150, and that drawing is fitted in the box.
 */
const UNSIZED = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><rect width="40" height="300" fill="#a37"/></svg>')

const DOCUMENT = [
  '# A document with pictures',
  '',
  'Before the first.',
  '',
  '![Wide](image:wide.png)',
  '',
  'Between the first and the second.',
  '',
  '![Plan](image:plan.svg)',
  '',
  'Between the second and the third.',
  '',
  '![Square](image:square.png)',
  '',
  'After the third.',
  '',
  ...Array.from({ length: 120 }, (_, n) => `A long way down, line ${n + 1}.\n`),
  '![Far](image:far.png)',
  '',
  'The end.',
].join('\n')

let root: Root | undefined
let host: HTMLElement | undefined

afterEach(() => {
  root?.unmount()
  host?.remove()
  root = undefined
  host = undefined
})

/** Where every picture, and every paragraph, is on the page. */
function layout(): Record<string, [number, number, number, number]> {
  const places: Record<string, [number, number, number, number]> = {}
  const at = (element: Element) => {
    const box = element.getBoundingClientRect()
    return [box.x, box.y, box.width, box.height].map((value) => Math.round(value * 100) / 100) as [number, number, number, number]
  }
  for (const img of host!.querySelectorAll('img[data-picture]')) places[img.getAttribute('data-picture')!] = at(img)
  host!.querySelectorAll('p').forEach((paragraph, n) => { places[`p${n}`] = at(paragraph) })
  return places
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => { requestAnimationFrame(() => resolve()) })
}

describe('pictures in a real browser', () => {
  it('lay out from the library at once, and nothing moves when their bytes arrive', async () => {
    const bytes: Record<string, PictureBytes> = {
      'wide.png': { mediaType: 'image/png', bytes: await drawn(1200, 300) },
      'plan.svg': { mediaType: 'image/svg+xml', bytes: UNSIZED },
      // Declared square, drawn square: the box is the entry's either way.
      'square.png': { mediaType: 'image/png', bytes: await drawn(400, 400) },
      'far.png': { mediaType: 'image/png', bytes: await drawn(300, 200) },
    }
    const library: ImageEntry[] = await Promise.all(Object.entries(bytes).map(([name, held]) => imageEntryOf(name, held.bytes)))
    expect(library.find((entry) => entry.name === 'plan.svg')).toMatchObject({ width: 0, height: 0 })
    const source = memoryImageSource({ crews: bytes })
    source.hold()

    host = document.createElement('div')
    host.style.width = '600px'
    document.body.append(host)
    root = createRoot(host)
    flushSync(() => {
      root!.render(
        <PicturesProvider source={source} scope="crews" library={library}>
          <MarkdownView markdown={DOCUMENT} />
        </PicturesProvider>,
      )
    })
    await nextFrame()
    const before = layout()
    expect(Object.keys(before)).toEqual(expect.arrayContaining(['wide.png', 'plan.svg', 'square.png', 'far.png']))
    expect(before['wide.png'][2] / before['wide.png'][3]).toBeCloseTo(4, 1)

    // The browser says what came into view; the answers are let through.
    await expect.poll(() => source.asked.length).toBeGreaterThan(0)
    source.answer()
    const shown = ['wide.png', 'plan.svg', 'square.png']
    await expect.poll(() => shown.every((name) => host!.querySelector(`img[data-picture="${name}"]`)?.getAttribute('src'))).toBe(true)
    await Promise.all(shown.map((name) => host!.querySelector<HTMLImageElement>(`img[data-picture="${name}"]`)!.decode()))
    await nextFrame()
    await nextFrame()

    expect(layout()).toEqual(before)
    expect(source.asked.map((one) => one.name).sort()).toEqual([...shown].sort())
  })

  it('yield to a flex column shorter than they are, fitted inside, and do not move when their bytes arrive', async () => {
    const bytes: Record<string, PictureBytes> = {
      'plan.svg': { mediaType: 'image/svg+xml', bytes: UNSIZED },
      'tall.png': { mediaType: 'image/png', bytes: await drawn(300, 900) },
    }
    const library: ImageEntry[] = await Promise.all(Object.entries(bytes).map(([name, held]) => imageEntryOf(name, held.bytes)))
    const source = memoryImageSource({ crews: bytes })
    source.hold()

    host = document.createElement('div')
    host.style.cssText = 'width: 600px; height: 240px; display: flex; flex-direction: column'
    document.body.append(host)
    root = createRoot(host)
    flushSync(() => {
      root!.render(
        <PicturesProvider source={source} scope="crews" library={library}>
          {library.map((entry) => <LibraryPicture key={entry.name} entry={entry} alt={entry.name} />)}
          <p>After the pictures.</p>
        </PicturesProvider>,
      )
    })
    await nextFrame()
    const before = layout()
    // Every box, and what follows them, inside the column rather than past its end.
    expect(Math.max(...Object.values(before).map(([, y, , height]) => y + height))).toBeLessThanOrEqual(240)

    await expect.poll(() => source.asked.length).toBe(2)
    source.answer()
    await expect.poll(() => library.every((entry) => host!.querySelector(`img[data-picture="${entry.name}"]`)?.getAttribute('src'))).toBe(true)
    await Promise.all(library.map((entry) => host!.querySelector<HTMLImageElement>(`img[data-picture="${entry.name}"]`)!.decode()))
    await nextFrame()
    await nextFrame()

    expect(layout()).toEqual(before)
  })
})


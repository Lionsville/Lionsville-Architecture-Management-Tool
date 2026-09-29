// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * Pictures loaded when shown (ADR-0031 §3), as a reader of a document sees
 * them: every picture's place taken from the library at once, its bytes asked
 * for when it comes into view and never before, and a picture seen before
 * shown without asking again.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, waitFor } from '@testing-library/react'
import type { ImageEntry } from '../../model/imageName'
import { renderShell } from '../../app/testing/renderShell'
import { memoryImageSource } from '../pictureSource'
import type { ImageSource, PictureAddresses } from '../pictureSource'
import { MarkdownView } from './MarkdownView'
import { PicturesProvider } from './Pictures'
import type { PictureWatch } from './Pictures'

afterEach(() => cleanup())

const PNG = { mediaType: 'image/png', bytes: new Uint8Array([1, 2, 3]) }
const ADDRESS = (n: number) => `sha256:${String(n).repeat(64).slice(0, 64)}`

function entry(name: string, width = 640, height = 480, n = 1): ImageEntry {
  return { name, mediaType: 'image/png', size: 3, width, height, contentAddress: ADDRESS(n) }
}

const LIBRARY = [entry('depot.png'), entry('yard.png', 1200, 300, 2), entry('Kaart-ü.png', 100, 100, 3)]
const SOURCE = () => memoryImageSource({ crews: { 'depot.png': PNG, 'yard.png': PNG, 'Kaart-ü.png': PNG } })

/** A watch a test drives: nothing is in view until the test scrolls it there. */
function scrolling(): PictureWatch & { into(name: string): void; watched(): string[] } {
  const waiting = new Map<Element, () => void>()
  const watch = ((element: Element, seen: () => void) => {
    waiting.set(element, seen)
    return () => { waiting.delete(element) }
  }) as PictureWatch & { into(name: string): void; watched(): string[] }
  watch.into = (name) => {
    for (const [element, seen] of waiting) if (element.getAttribute('data-picture') === name) seen()
  }
  watch.watched = () => [...waiting.keys()].map((element) => element.getAttribute('data-picture') ?? '')
  return watch
}

/** Addresses the test can read, and whose letting go it can see. */
function addresses(): PictureAddresses & { released: string[] } {
  let made = 0
  const released: string[] = []
  return { released, make: () => `blob:picture-${made += 1}`, release: (address) => { released.push(address) } }
}

function page(markdown: string, source: ImageSource, watch: PictureWatch, made = addresses()) {
  return (
    <PicturesProvider source={source} scope="crews" library={LIBRARY} watch={watch} addresses={made}>
      <MarkdownView markdown={markdown} />
    </PicturesProvider>
  )
}

const DOCUMENT = [
  '![The depot](image:depot.png)',
  '',
  'A long way down.',
  '',
  '![The yard](image:yard.png)',
].join('\n')

function picture(container: HTMLElement, name: string): HTMLImageElement {
  const found = container.querySelector<HTMLImageElement>(`img[data-picture="${name}"]`)
  if (!found) throw new Error(`no picture ${name}`)
  return found
}

describe('pictures in a document', () => {
  it('opening a document full of pictures asks for no bytes', () => {
    const source = SOURCE()
    const watch = scrolling()
    const { container } = renderShell(page(DOCUMENT, source, watch))
    expect(container.querySelectorAll('img[data-picture]')).toHaveLength(2)
    expect(watch.watched().sort()).toEqual(['depot.png', 'yard.png'])
    expect(source.asked).toEqual([])
    expect(picture(container, 'depot.png').getAttribute('src')).toBeNull()
  })

  it('lays every picture out from the library, and nothing moves when its bytes arrive', async () => {
    const source = SOURCE()
    const watch = scrolling()
    const { container } = renderShell(page(DOCUMENT, source, watch))
    const yard = picture(container, 'yard.png')
    const before = { width: yard.getAttribute('width'), height: yard.getAttribute('height'), ratio: yard.style.aspectRatio }
    const style = getComputedStyle(yard)
    const box = { maxWidth: style.maxWidth, maxHeight: style.maxHeight, height: style.height, aspectRatio: style.aspectRatio }
    expect(before).toEqual({ width: '1200', height: '300', ratio: expect.any(String) as unknown })
    expect(box.aspectRatio.replace(/\s/g, '')).toBe('1200/300')

    act(() => watch.into('yard.png'))
    await waitFor(() => expect(picture(container, 'yard.png').getAttribute('src')).toBe('blob:picture-1'))
    const after = picture(container, 'yard.png')
    expect(after).toBe(yard)
    expect({ width: after.getAttribute('width'), height: after.getAttribute('height'), ratio: after.style.aspectRatio }).toEqual(before)
    const now = getComputedStyle(after)
    expect({ maxWidth: now.maxWidth, maxHeight: now.maxHeight, height: now.height, aspectRatio: now.aspectRatio }).toEqual(box)
  })

  it('a picture scrolled into view asks once, and only for itself', async () => {
    const source = SOURCE()
    const watch = scrolling()
    const { container } = renderShell(page(DOCUMENT, source, watch))
    act(() => watch.into('depot.png'))
    await waitFor(() => expect(picture(container, 'depot.png').getAttribute('src')).toBeTruthy())
    act(() => watch.into('depot.png'))
    expect(source.asked).toEqual([{ scope: 'crews', name: 'depot.png' }])
    expect(picture(container, 'yard.png').getAttribute('src')).toBeNull()
  })

  it('seen before, it is shown in the render it comes back in, and asks no more', async () => {
    const source = SOURCE()
    const watch = scrolling()
    const made = addresses()
    const first = renderShell(page(DOCUMENT, source, watch, made))
    act(() => watch.into('depot.png'))
    await waitFor(() => expect(picture(first.container, 'depot.png').getAttribute('src')).toBeTruthy())
    // Away to another document, and back: the same provider, a page with other pictures between.
    first.rerender(page('![The yard](image:yard.png)', source, watch, made))
    expect(made.released).toEqual(['blob:picture-1'])
    first.rerender(page(DOCUMENT, source, watch, made))
    expect(picture(first.container, 'depot.png').getAttribute('src')).toBe('blob:picture-2')
    expect(source.asked).toHaveLength(1)
  })

  it('switching to a document with another picture in the same place draws a new img, never the old one', async () => {
    const source = SOURCE()
    const watch = scrolling()
    const view = renderShell(page('![A picture](image:depot.png)', source, watch))
    act(() => watch.into('depot.png'))
    await waitFor(() => expect(picture(view.container, 'depot.png').getAttribute('src')).toBeTruthy())
    const depot = picture(view.container, 'depot.png')
    view.rerender(page('![A picture](image:yard.png)', source, watch))
    const yard = picture(view.container, 'yard.png')
    expect(yard).not.toBe(depot)
    expect(yard.getAttribute('src')).toBeNull()
  })

  it('finds a name with an accent in it, as the document wrote it', () => {
    const { container } = renderShell(page('![Map](image:Kaart-ü.png)', SOURCE(), scrolling()))
    expect(picture(container, 'Kaart-ü.png').getAttribute('width')).toBe('100')
  })

  it('draws the alt text for a name the library does not hold, and asks nothing', () => {
    const source = SOURCE()
    const { getByTestId } = renderShell(page('![Gone](image:gone.png)', source, scrolling()))
    expect(getByTestId('image-missing').textContent).toBe('Gone')
    expect(source.asked).toEqual([])
  })

  it('without a provider, draws every picture as its alt text', () => {
    const { getByTestId } = renderShell(<MarkdownView markdown={'![Depot](image:depot.png)'} />)
    expect(getByTestId('image-missing').textContent).toBe('Depot')
  })
})

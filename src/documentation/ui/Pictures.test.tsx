// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * Pictures loaded when shown (ADR-0031 §3), as a reader of a document sees
 * them: every picture's place taken from the library at once, its bytes asked
 * for when it comes into view and never before, and a picture seen before
 * shown without asking again.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import type { ImageEntry } from '../../model/imageName'
import { renderShell } from '../../app/testing/renderShell'
import { memoryImageSource } from '../pictureSource'
import type { ImageSource, PictureAddresses } from '../pictureSource'
import { MarkdownView } from './MarkdownView'
import { AHEAD, LibraryPicture, PicturesProvider, watchInView } from './Pictures'
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
type Scrolling = PictureWatch & { into(name: string): void; watched(): string[]; afresh(): string[] }

function scrolling(): Scrolling {
  const waiting = new Map<Element, { seen: () => void; afresh: boolean }>()
  const watch = ((element: Element, seen: () => void, afresh = false) => {
    waiting.set(element, { seen, afresh })
    return () => { waiting.delete(element) }
  }) as Scrolling
  watch.into = (name) => {
    for (const [element, { seen }] of [...waiting]) {
      if (element.getAttribute('data-picture') !== name) continue
      waiting.delete(element)
      seen()
    }
  }
  watch.afresh = () => [...waiting].filter(([, one]) => one.afresh).map(([element]) => element.getAttribute('data-picture') ?? '')
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

  it('a picture whose bytes did not come shows its alt text, keeps its place, and asks again when seen afresh', async () => {
    let fail = true
    const failures: unknown[] = []
    const asked: string[] = []
    const source: ImageSource = {
      bytes: (_scope, name) => {
        asked.push(name)
        return fail ? Promise.reject(new Error('offline')) : Promise.resolve(PNG)
      },
    }
    const watch = scrolling()
    const { container } = renderShell(
      <PicturesProvider source={source} scope="crews" library={LIBRARY} watch={watch} addresses={addresses()} onFailure={(error) => failures.push(error)}>
        <MarkdownView markdown={'![The depot](image:depot.png)'} />
      </PicturesProvider>,
    )
    act(() => watch.into('depot.png'))
    await waitFor(() => expect(picture(container, 'depot.png').hasAttribute('data-failed')).toBe(true))
    const depot = picture(container, 'depot.png')
    expect(getComputedStyle(depot).color).not.toBe('transparent')
    expect(depot.getAttribute('alt')).toBe('The depot')
    expect(depot.getAttribute('width')).toBe('640')
    expect(failures).toHaveLength(1)
    expect(watch.afresh()).toEqual(['depot.png'])
    fail = false
    act(() => watch.into('depot.png'))
    await waitFor(() => expect(picture(container, 'depot.png').getAttribute('src')).toBe('blob:picture-1'))
    expect(picture(container, 'depot.png').hasAttribute('data-failed')).toBe(false)
    expect(asked).toEqual(['depot.png', 'depot.png'])
  })

  it('a picture gone before its bytes arrive lets their address go', async () => {
    const source = SOURCE()
    source.hold()
    const watch = scrolling()
    const made = addresses()
    const view = renderShell(page(DOCUMENT, source, watch, made))
    act(() => watch.into('depot.png'))
    view.unmount()
    await act(async () => { source.answer(); await Promise.resolve() })
    await waitFor(() => expect(made.released).toEqual(['blob:picture-1']))
  })

  it('with no watch handed in, and no observer to be had, asks for every picture at once', async () => {
    const source = SOURCE()
    const { container } = renderShell(
      <PicturesProvider source={source} scope="crews" library={LIBRARY} addresses={addresses()}>
        <MarkdownView markdown={DOCUMENT} />
      </PicturesProvider>,
    )
    await waitFor(() => expect(picture(container, 'yard.png').getAttribute('src')).toBeTruthy())
    expect(source.asked.map((one) => one.name).sort()).toEqual(['depot.png', 'yard.png'])
  })

  it('lays out an entry that declares no size in the default shape, which its picture is fitted inside', () => {
    const { container } = renderShell(
      <PicturesProvider source={SOURCE()} scope="crews" library={[entry('plan.svg', 0, 0, 4)]} watch={scrolling()}>
        <MarkdownView markdown={'![Plan](image:plan.svg)'} />
      </PicturesProvider>,
    )
    const plan = picture(container, 'plan.svg')
    expect([plan.getAttribute('width'), plan.getAttribute('height')]).toEqual(['640', '480'])
    expect(getComputedStyle(plan).aspectRatio.replace(/\s/g, '')).toBe('640/480')
    expect(getComputedStyle(plan).objectFit).toBe('contain')
  })

  it('opens a shown picture full size on a click, and closes it on the next; an empty box opens nothing', async () => {
    const watch = scrolling()
    const { container } = renderShell(page('![The depot](image:depot.png)', SOURCE(), watch))
    fireEvent.click(picture(container, 'depot.png'))
    expect(screen.queryByTestId('lightbox')).toBeNull()
    act(() => watch.into('depot.png'))
    await waitFor(() => expect(picture(container, 'depot.png').getAttribute('src')).toBeTruthy())
    fireEvent.click(picture(container, 'depot.png'))
    const large = screen.getByTestId('lightbox')
    expect(large.getAttribute('src')).toBe('blob:picture-1')
    fireEvent.click(large)
    await waitFor(() => expect(screen.queryByTestId('lightbox')).toBeNull())
  })

  it('outside any provider, a picture keeps its place and asks nothing anybody answers', async () => {
    const { container } = renderShell(<LibraryPicture entry={entry('depot.png')} alt="The depot" />)
    await waitFor(() => expect(picture(container, 'depot.png').hasAttribute('data-failed')).toBe(true))
    expect(picture(container, 'depot.png').getAttribute('width')).toBe('640')
  })
})

describe('watching for a picture coming into view', () => {
  type Observed = { callback: IntersectionObserverCallback; options?: IntersectionObserverInit; observed: Element[]; unobserved: Element[] }
  let made: Observed[] = []

  function stubObserver() {
    made = []
    vi.stubGlobal('IntersectionObserver', class {
      private readonly held: Observed
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        this.held = { callback, options, observed: [], unobserved: [] }
        made.push(this.held)
      }
      observe(element: Element) { this.held.observed.push(element) }
      unobserve(element: Element) { this.held.unobserved.push(element) }
      disconnect() {}
    })
  }

  function report(element: Element, isIntersecting: boolean) {
    const observed = made[0]
    observed.callback([{ target: element, isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver)
  }

  afterEach(() => { vi.unstubAllGlobals() })

  it('shares one observer, a little ahead of the window, and tells seen only when the element is in view', () => {
    stubObserver()
    const watch = watchInView()
    const [one, two] = [document.createElement('img'), document.createElement('img')]
    const seen: string[] = []
    watch(one, () => seen.push('one'))
    watch(two, () => seen.push('two'))
    expect(made).toHaveLength(1)
    expect(made[0].options?.rootMargin).toBe(AHEAD)
    expect(made[0].observed).toEqual([one, two])
    report(one, false)
    expect(seen).toEqual([])
    report(one, true)
    expect(seen).toEqual(['one'])
    expect(made[0].unobserved).toEqual([one])
    report(one, true)
    expect(seen).toEqual(['one'])
  })

  it('stops watching when told, and then tells nothing', () => {
    stubObserver()
    const watch = watchInView()
    const element = document.createElement('img')
    const seen: string[] = []
    const stop = watch(element, () => seen.push('seen'))
    stop()
    expect(made[0].unobserved).toEqual([element])
    report(element, true)
    expect(seen).toEqual([])
  })

  it('afresh, waits for the element to leave the view and come back', () => {
    stubObserver()
    const watch = watchInView()
    const element = document.createElement('img')
    const seen: string[] = []
    watch(element, () => seen.push('seen'), true)
    report(element, true)
    expect(seen).toEqual([])
    report(element, false)
    report(element, true)
    expect(seen).toEqual(['seen'])
  })

  it('with no observer to be had, is seen at once, and never afresh', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const watch = watchInView()
    const seen: string[] = []
    watch(document.createElement('img'), () => seen.push('at once'))
    watch(document.createElement('img'), () => seen.push('afresh'), true)
    expect(seen).toEqual(['at once'])
  })
})

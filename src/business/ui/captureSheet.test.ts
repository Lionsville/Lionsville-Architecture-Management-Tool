// @vitest-environment jsdom
/**
 * A picture of the page, for an agent (ADR-0007).
 *
 * What is pinned is what the capture ASKS FOR — the whole scrolled page,
 * unclipped, inside the caller's pixel budget — not what a rasteriser draws:
 * jsdom has no 2d context, and the real bitmap is `html-to-image`'s business.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * jsdom's `Blob` has no `arrayBuffer()`, so the three bytes come back through
 * a stand-in. What matters here is that the bytes the browser produced are
 * the bytes handed over — not which implementation carried them.
 */
const fakeBlob = () => ({
  type: 'image/png',
  arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
} as unknown as Blob)

const fakeCanvas = () => ({
  width: 100,
  height: 80,
  getContext: () => null,
  toBlob: (give: (blob: Blob | null) => void) => give(fakeBlob()),
} as unknown as HTMLCanvasElement)

const toCanvas = vi.fn(async () => fakeCanvas())

vi.mock('html-to-image', () => ({ toCanvas: (...args: unknown[]) => toCanvas(...(args as [])) }))

const { captureSheet, sheetPixelRatio } = await import('./captureSheet')

afterEach(() => {
  toCanvas.mockClear()
  document.body.innerHTML = ''
})

/** A page that is taller than its own box, the way a real sheet is. */
function page(scroll = { width: 1200, height: 3000 }) {
  const node = document.createElement('div')
  Object.defineProperties(node, {
    scrollWidth: { value: scroll.width },
    scrollHeight: { value: scroll.height },
    // The box on screen is never wider than the content and is usually shorter.
    clientWidth: { value: Math.min(scroll.width, 1200) },
    clientHeight: { value: Math.min(scroll.height, 800) },
  })
  document.body.appendChild(node)
  return node
}

describe('sheetPixelRatio', () => {
  it('is a retina screen’s two, for a page well inside the budget', () => {
    expect(sheetPixelRatio(800, 600, 4_000_000)).toBe(2)
  })

  it('comes down rather than overflowing the budget', () => {
    expect(sheetPixelRatio(2000, 3000, 4_000_000)).toBeCloseTo(0.81, 2)
    expect(2000 * 0.81 * (3000 * 0.81)).toBeLessThan(4_000_000)
  })

  it('rounds down, so the budget is never exceeded by the rounding', () => {
    const ratio = sheetPixelRatio(1234, 5678, 1_000_000)
    expect(1234 * ratio * (5678 * ratio)).toBeLessThanOrEqual(1_000_000)
  })

  it('answers something drawable for a page with no size yet', () => {
    expect(sheetPixelRatio(0, 0, 4_000_000)).toBe(1)
  })
})

describe('captureSheet', () => {
  it('captures the whole scrolled page, not the part in view', async () => {
    await captureSheet(page(), { maxPixels: 4_000_000 })
    const [, options] = toCanvas.mock.calls[0] as unknown as [HTMLElement, Record<string, unknown>]
    expect(options).toMatchObject({ width: 1200, height: 3000 })
    expect(options.style).toMatchObject({ overflow: 'visible' })
  })

  it('says how large the bitmap came out, which is what a caller can act on', async () => {
    const shot = await captureSheet(page({ width: 1000, height: 1000 }), { maxPixels: 1_000_000 })
    expect(shot).toMatchObject({ pixelRatio: 1, width: 1000, height: 1000 })
    expect([...shot.png]).toEqual([1, 2, 3])
  })

  it('draws on the background it was given, so a dark sheet is dark to its edge', async () => {
    await captureSheet(page(), { maxPixels: 4_000_000, background: '#121212' })
    const [, options] = toCanvas.mock.calls[0] as unknown as [HTMLElement, Record<string, unknown>]
    expect(options.backgroundColor).toBe('#121212')
  })

  it('says so out loud when the browser hands back no image', async () => {
    toCanvas.mockResolvedValueOnce({
      ...fakeCanvas(), toBlob: (give: (blob: Blob | null) => void) => give(null),
    } as unknown as HTMLCanvasElement)
    await expect(captureSheet(page(), { maxPixels: 4_000_000 })).rejects.toThrow(/no image/)
  })
})

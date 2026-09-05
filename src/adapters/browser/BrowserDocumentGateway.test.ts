// @vitest-environment jsdom
/**
 * The only shell suite that needs a real browser API — which is the point:
 * everything above this can be faked in a handful of lines, so this is the edge
 * of the map.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BrowserDocumentGateway } from './BrowserDocumentGateway'

const gateway = new BrowserDocumentGateway()

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('BrowserDocumentGateway — handing over', () => {
  /** jsdom has no `createObjectURL`; this test is about what the adapter does. */
  function stubObjectUrl() {
    const revoked: string[] = []
    vi.stubGlobal('URL', Object.assign(Object.create(URL), {
      createObjectURL: () => 'blob:fake',
      revokeObjectURL: (u: string) => { revoked.push(u) },
    }))
    return revoked
  }

  it('offers the document under the requested name', async () => {
    stubObjectUrl()
    const clicked: HTMLAnchorElement[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this)
    })

    await gateway.save({ name: 'ns-design.json', text: '{}', mediaType: 'application/json' })

    expect(clicked).toHaveLength(1)
    expect(clicked[0].download).toBe('ns-design.json')
    expect(clicked[0].href).toBe('blob:fake')
  })

  it('releases the blob URL again and cleans up the anchor', async () => {
    // Without this the tab holds on to the whole payload until you close it —
    // with a drawing full of embedded marks that is not a trifle.
    vi.useFakeTimers()
    const revoked = stubObjectUrl()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    await gateway.save({ name: 'x.json', text: '{}', mediaType: 'application/json' })
    expect(document.querySelectorAll('a')).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(1000)
    expect(revoked).toEqual(['blob:fake'])
    expect(document.querySelectorAll('a')).toHaveLength(0)
  })
})

describe('BrowserDocumentGateway — taking in', () => {
  it('reads a file as text', async () => {
    const blob = new Blob(['{"formatVersion":"1"}'], { type: 'application/json' })
    await expect(gateway.readText(blob)).resolves.toBe('{"formatVersion":"1"}')
  })

  it('reads a file as a data URL', async () => {
    const blob = new Blob(['<svg/>'], { type: 'image/svg+xml' })
    expect((await gateway.readDataUrl(blob)).startsWith('data:image/svg+xml')).toBe(true)
  })

  it('rejects when the reader stumbles', async () => {
    class BrokenReader {
      onerror: (() => void) | null = null
      onload: (() => void) | null = null
      result: string | null = null
      readAsText() { setTimeout(() => this.onerror?.(), 0) }
      readAsDataURL() { setTimeout(() => this.onerror?.(), 0) }
    }
    vi.stubGlobal('FileReader', BrokenReader)
    await expect(gateway.readText(new Blob(['x']))).rejects.toBeInstanceOf(Error)
  })

  it('names itself', () => {
    expect(gateway.id).toBe('browser')
  })
})

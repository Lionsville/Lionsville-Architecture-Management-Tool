// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { afterEach, describe, expect, it } from 'vitest'
import type { ImageEntry } from '../model/imageName'
import {
  defaultPictureAddresses, memoryImageSource, NO_PICTURES, PictureCache, pictureDataAddress, picturesForReport,
} from './pictureSource'
import type { PictureAddresses } from './pictureSource'

const PNG = { mediaType: 'image/png', bytes: new Uint8Array([1, 2, 3]) }
const SVG = { mediaType: 'image/svg+xml', bytes: new TextEncoder().encode('<svg/>') }

function entry(name: string, contentAddress = `sha256:${'a'.repeat(64)}`): ImageEntry {
  return { name, mediaType: 'image/png', size: 3, width: 640, height: 480, contentAddress }
}

/** Addresses that say what they were made from, and remember what was let go. */
function countedAddresses(): PictureAddresses & { made: number; released: string[] } {
  const addresses = {
    made: 0,
    released: [] as string[],
    make: () => `picture:${addresses.made += 1}`,
    release: (address: string) => { addresses.released.push(address) },
  }
  return addresses
}

describe('a memory source', () => {
  it('answers the bytes held and writes down every ask', async () => {
    const source = memoryImageSource({ crews: { 'depot.png': PNG } })
    expect(await source.bytes('crews', 'depot.png')).toBe(PNG)
    expect(await source.bytes('crews', 'gone.png')).toBeUndefined()
    expect(source.asked).toEqual([{ scope: 'crews', name: 'depot.png' }, { scope: 'crews', name: 'gone.png' }])
  })

  it('holds its answers back until told, for a test that looks in between', async () => {
    const source = memoryImageSource({ crews: { 'depot.png': PNG } })
    source.hold()
    let answered = false
    const asked = source.bytes('crews', 'depot.png').then(() => { answered = true })
    await Promise.resolve()
    expect(answered).toBe(false)
    source.answer()
    await asked
    expect(answered).toBe(true)
  })

  it('without pictures answers nothing', async () => {
    expect(await NO_PICTURES.bytes('crews', 'depot.png')).toBeUndefined()
  })
})

describe('the cache', () => {
  it('asks once however many places want a picture at the same moment', async () => {
    const source = memoryImageSource({ crews: { 'depot.png': PNG } })
    const cache = new PictureCache(source, { addresses: countedAddresses() })
    const answers = await Promise.all([cache.load('crews', entry('depot.png')), cache.load('crews', entry('depot.png'))])
    expect(answers).toEqual([true, true])
    expect(await cache.load('crews', entry('depot.png'))).toBe(true)
    expect(source.asked).toHaveLength(1)
  })

  it('makes one address for every place showing a picture, and lets it go when the last one stops', async () => {
    const addresses = countedAddresses()
    const cache = new PictureCache(memoryImageSource({ crews: { 'depot.png': PNG } }), { addresses })
    expect(cache.show('crews', entry('depot.png'))).toBeUndefined()
    await cache.load('crews', entry('depot.png'))
    const first = cache.show('crews', entry('depot.png'))
    expect(cache.show('crews', entry('depot.png'))).toBe(first)
    cache.hide('crews', entry('depot.png'))
    expect(addresses.released).toEqual([])
    cache.hide('crews', entry('depot.png'))
    expect(addresses.released).toEqual([first])
    // The bytes stay: shown again, it is a new address and no new ask.
    expect(cache.has('crews', entry('depot.png'))).toBe(true)
    expect(cache.show('crews', entry('depot.png'))).toBe('picture:2')
  })

  it('keeps a few pictures nobody shows, oldest out first, and never one being shown', async () => {
    const source = memoryImageSource({ crews: { 'a.png': PNG, 'b.png': PNG, 'c.png': PNG } })
    const cache = new PictureCache(source, { keep: 1, addresses: countedAddresses() })
    await cache.load('crews', entry('a.png'))
    cache.show('crews', entry('a.png'))
    await cache.load('crews', entry('b.png'))
    await cache.load('crews', entry('c.png'))
    expect(cache.has('crews', entry('a.png'))).toBe(true)
    expect(cache.has('crews', entry('b.png'))).toBe(false)
    expect(cache.has('crews', entry('c.png'))).toBe(true)
  })

  it('is another picture when the bytes a name holds change, and another scope\'s is not this one\'s', async () => {
    const source = memoryImageSource({ crews: { 'depot.png': PNG }, depots: { 'depot.png': PNG } })
    const cache = new PictureCache(source, { addresses: countedAddresses() })
    await cache.load('crews', entry('depot.png'))
    expect(cache.has('crews', entry('depot.png', `sha256:${'b'.repeat(64)}`))).toBe(false)
    expect(cache.has('depots', entry('depot.png'))).toBe(false)
  })

  it('says a failure where it is told, keeps nothing, and asks again next time', async () => {
    const failures: unknown[] = []
    let calls = 0
    const cache = new PictureCache(
      { bytes: () => { calls += 1; return Promise.reject(new Error('gone')) } },
      { addresses: countedAddresses(), onFailure: (error) => failures.push(error) },
    )
    expect(await cache.load('crews', entry('depot.png'))).toBe(false)
    expect(await cache.load('crews', entry('depot.png'))).toBe(false)
    expect(failures).toHaveLength(2)
    expect(calls).toBe(2)
  })
})

describe('the cache under pressure', () => {
  it('shows every picture asked for at once, even when more arrive together than it keeps', async () => {
    const source = memoryImageSource({ crews: { 'a.png': PNG, 'b.png': PNG, 'c.png': PNG } })
    const addresses = countedAddresses()
    const cache = new PictureCache(source, { keep: 0, addresses })
    source.hold()
    const asked = ['a.png', 'b.png', 'c.png'].map((name) => cache.request('crews', entry(name)))
    source.answer()
    expect(await Promise.all(asked)).toEqual(['picture:1', 'picture:2', 'picture:3'])
    // Nobody shows them any more: none is kept beyond `keep`.
    for (const name of ['a.png', 'b.png', 'c.png']) cache.hide('crews', entry(name))
    expect(['a.png', 'b.png', 'c.png'].filter((name) => cache.has('crews', entry(name)))).toEqual([])
    expect(addresses.released).toEqual(['picture:1', 'picture:2', 'picture:3'])
  })

  it('with room for two, shows all three pictures seen together, and keeps two once none is shown', async () => {
    const source = memoryImageSource({ crews: { 'a.png': PNG, 'b.png': PNG, 'c.png': PNG } })
    const cache = new PictureCache(source, { keep: 2, addresses: countedAddresses() })
    source.hold()
    const asked = ['a.png', 'b.png', 'c.png'].map((name) => cache.request('crews', entry(name)))
    source.answer()
    expect((await Promise.all(asked)).every((address) => address !== undefined)).toBe(true)
    for (const name of ['a.png', 'b.png', 'c.png']) cache.hide('crews', entry(name))
    expect(['a.png', 'b.png', 'c.png'].filter((name) => cache.has('crews', entry(name)))).toEqual(['b.png', 'c.png'])
  })

  it('two places asking for one picture together are one ask and one address', async () => {
    const source = memoryImageSource({ crews: { 'a.png': PNG } })
    const cache = new PictureCache(source, { keep: 0, addresses: countedAddresses() })
    const both = await Promise.all([cache.request('crews', entry('a.png')), cache.request('crews', entry('a.png'))])
    expect(both).toEqual(['picture:1', 'picture:1'])
    expect(source.asked).toHaveLength(1)
    cache.hide('crews', entry('a.png'))
    expect(cache.has('crews', entry('a.png'))).toBe(true)
  })

  it('answers nothing for a picture whose bytes are not there, and keeps nothing for it', async () => {
    const cache = new PictureCache(memoryImageSource({}), { addresses: countedAddresses() })
    expect(await cache.request('crews', entry('gone.png'))).toBeUndefined()
    expect(cache.has('crews', entry('gone.png'))).toBe(false)
  })

  it('hiding a picture nobody shows changes nothing', () => {
    const addresses = countedAddresses()
    new PictureCache(NO_PICTURES, { addresses }).hide('crews', entry('a.png'))
    expect(addresses.released).toEqual([])
  })

  it('with nothing said about failures, a failure answers no and throws nothing', async () => {
    const cache = new PictureCache({ bytes: () => Promise.reject(new Error('gone')) }, { addresses: countedAddresses() })
    expect(await cache.request('crews', entry('a.png'))).toBeUndefined()
  })
})

describe('the addresses a picture is drawn from', () => {
  const create = URL.createObjectURL
  const revoke = URL.revokeObjectURL
  afterEach(() => {
    URL.createObjectURL = create
    URL.revokeObjectURL = revoke
  })

  it('are object addresses where the platform makes them, let go of when asked', () => {
    const made: Blob[] = []
    const released: string[] = []
    URL.createObjectURL = (blob: Blob) => { made.push(blob); return 'blob:one' }
    URL.revokeObjectURL = (address: string) => { released.push(address) }
    const addresses = defaultPictureAddresses()
    expect(addresses.make(PNG)).toBe('blob:one')
    expect(made[0].type).toBe('image/png')
    expect(made[0].size).toBe(3)
    addresses.release('blob:one')
    expect(released).toEqual(['blob:one'])
  })

  it('are never object addresses for an SVG, which would run its script as the app if opened on its own', () => {
    const made: Blob[] = []
    const released: string[] = []
    URL.createObjectURL = (blob: Blob) => { made.push(blob); return 'blob:one' }
    URL.revokeObjectURL = (address: string) => { released.push(address) }
    const addresses = defaultPictureAddresses()
    const address = addresses.make(SVG)
    expect(address.startsWith('data:image/svg+xml;base64,')).toBe(true)
    expect(made).toEqual([])
    addresses.release(address)
    expect(released).toEqual([])
  })

  it('are data addresses where it does not, with nothing to let go of', () => {
    ;(URL as { createObjectURL?: unknown }).createObjectURL = undefined
    const addresses = defaultPictureAddresses()
    expect(addresses.make(PNG)).toBe('data:image/png;base64,AQID')
    expect(() => addresses.release('data:image/png;base64,AQID')).not.toThrow()
  })

  it('carry bytes of any size as base64', () => {
    const large = new Uint8Array(0x8000 * 2 + 5).fill(255)
    const address = pictureDataAddress({ mediaType: 'image/png', bytes: large })
    expect(atob(address.slice('data:image/png;base64,'.length))).toHaveLength(large.length)
  })
})

describe('a memory source answering', () => {
  it('with nothing held back answers nothing more', () => {
    expect(() => memoryImageSource({}).answer()).not.toThrow()
  })
})

describe('a report', () => {
  const library = [entry('depot.png'), entry('plans/yard.svg')]
  const documents = ['![Depot](image:depot.png) and ![Yard](image:plans/yard.svg)', '![Again](image:depot.png) ![None](image:none.png)']

  it('asks for nothing until it is produced, then for every picture its documents show, once each', async () => {
    const source = memoryImageSource({ crews: { 'depot.png': PNG, 'plans/yard.svg': SVG } })
    const produce = () => picturesForReport(source, 'crews', library, documents)
    expect(source.asked).toEqual([])
    const pictures = await produce()
    expect(source.asked.map((ask) => ask.name).sort()).toEqual(['depot.png', 'plans/yard.svg'])
    expect([...pictures.keys()].sort()).toEqual(['depot.png', 'plans/yard.svg'])
    expect(pictureDataAddress(pictures.get('depot.png')!)).toBe('data:image/png;base64,AQID')
  })

  it('leaves out a picture whose bytes are not there', async () => {
    const pictures = await picturesForReport(memoryImageSource({ crews: { 'depot.png': PNG } }), 'crews', library, documents)
    expect([...pictures.keys()]).toEqual(['depot.png'])
  })
})

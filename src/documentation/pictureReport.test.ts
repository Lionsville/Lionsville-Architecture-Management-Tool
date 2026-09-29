// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { ImageEntry } from '../model/imageName'
import { drawnPictures, picturesForReport, REPORT_ASKS } from './pictureReport'
import type { DrawnPicture } from './pictureReport'
import { memoryImageSource } from './pictureSource'
import type { ImageSource } from './pictureSource'

const PNG = { mediaType: 'image/png', bytes: new Uint8Array([1, 2, 3]) }
const OTHER = { mediaType: 'image/png', bytes: new Uint8Array([9]) }

function entry(name: string): ImageEntry {
  return { name, mediaType: 'image/png', size: 3, width: 640, height: 480, contentAddress: `sha256:${'a'.repeat(64)}` }
}

function crews(...names: string[]): DrawnPicture[] {
  return names.map((name) => ({ scope: 'crews', entry: entry(name) }))
}

describe('the pictures a report drew', () => {
  it('are one picture per name by the library\'s rule in each scope, the first drawn, in the order drawn', () => {
    const drawn = drawnPictures()
    for (const name of ['depot.png', 'DEPOT.png', 'Kaart-ü.png', 'Kaart-ü.png']) drawn.add('crews', entry(name))
    drawn.add('depots', entry('depot.png'))
    expect(drawn.pictures().map((one) => `${one.scope}:${one.entry.name}`))
      .toEqual(['crews:depot.png', 'crews:Kaart-ü.png', 'depots:depot.png'])
  })
})

describe('a report asking for its pictures', () => {
  it('asks for each picture once, and answers the ones whose bytes came, in the order drawn', async () => {
    const source = memoryImageSource({ crews: { 'depot.png': PNG, 'yard.png': PNG, 'route.png': PNG } })
    source.hold()
    const asking = picturesForReport(source, crews('route.png', 'depot.png', 'Depot.PNG', 'gone.png', 'yard.png'))
    await Promise.resolve()
    source.answer()
    const report = await asking
    expect(source.asked.map((one) => one.name).sort()).toEqual(['depot.png', 'gone.png', 'route.png', 'yard.png'])
    expect(report.pictures.map((one) => one.entry.name)).toEqual(['route.png', 'depot.png', 'yard.png'])
    expect(report.of('crews', 'DEPOT.png')).toBe(PNG)
    expect(report.of('crews', 'gone.png')).toBeUndefined()
  })

  it('answers in the order drawn, whatever order the answers come in', async () => {
    const source: ImageSource = {
      bytes: (_scope, name) => new Promise((resolve) => { setTimeout(() => resolve(PNG), name === 'first.png' ? 20 : 1) }),
    }
    const report = await picturesForReport(source, crews('first.png', 'second.png', 'third.png'))
    expect(report.pictures.map((one) => one.entry.name)).toEqual(['first.png', 'second.png', 'third.png'])
  })

  it('keeps one name in two scopes apart: each asked of its own scope, each printed as its own', async () => {
    const source = memoryImageSource({ crews: { 'depot.png': PNG }, depots: { 'depot.png': OTHER } })
    const report = await picturesForReport(source, [
      { scope: 'crews', entry: entry('depot.png') },
      { scope: 'depots', entry: entry('depot.png') },
    ])
    expect(source.asked).toEqual([{ scope: 'crews', name: 'depot.png' }, { scope: 'depots', name: 'depot.png' }])
    expect(report.of('crews', 'depot.png')).toBe(PNG)
    expect(report.of('depots', 'depot.png')).toBe(OTHER)
  })

  it('asks nothing for a report that drew no picture', async () => {
    const source = memoryImageSource({})
    expect((await picturesForReport(source, [])).pictures).toEqual([])
    expect(source.asked).toEqual([])
  })

  it('keeps no more than a few asks open at once, and asks for every one', async () => {
    let open = 0
    let most = 0
    const asked: string[] = []
    const source: ImageSource = {
      bytes: async (_scope, name) => {
        asked.push(name)
        open += 1
        most = Math.max(most, open)
        await new Promise((resolve) => setTimeout(resolve, 1))
        open -= 1
        return PNG
      },
    }
    const names = Array.from({ length: 11 }, (_, n) => `p${n}.png`)
    const report = await picturesForReport(source, crews(...names))
    expect(most).toBe(REPORT_ASKS)
    expect(asked.sort()).toEqual([...names].sort())
    expect(report.pictures).toHaveLength(11)
    most = 0
    await picturesForReport(source, crews(...names), { limit: 2 })
    expect(most).toBe(2)
  })

  it('asks for every picture, one at a time, where the limit given is none, less than one, or not a number', async () => {
    const source = memoryImageSource({ crews: { 'a.png': PNG, 'b.png': PNG } })
    for (const limit of [0, -3, Number.NaN, 0.5]) {
      const report = await picturesForReport(source, crews('a.png', 'b.png'), { limit })
      expect(report.pictures.map((one) => one.entry.name)).toEqual(['a.png', 'b.png'])
    }
  })

  it('goes on past a failed ask, says it where it is told, and leaves that picture out', async () => {
    const failures: unknown[] = []
    const source: ImageSource = {
      bytes: (_scope, name) => (name === 'broken.png' ? Promise.reject(new Error('offline')) : Promise.resolve(PNG)),
    }
    const report = await picturesForReport(source, crews('broken.png', 'depot.png'), {
      onFailure: (error) => failures.push(error),
    })
    expect(report.pictures.map((one) => one.entry.name)).toEqual(['depot.png'])
    expect(failures).toHaveLength(1)
  })

  it('is never refused for a source that throws before it answers, nor for a failure handler that throws', async () => {
    const failures: unknown[] = []
    const source: ImageSource = {
      bytes: (_scope, name) => {
        if (name === 'throws.png') throw new Error('at once')
        return Promise.resolve(PNG)
      },
    }
    const report = await picturesForReport(source, crews('throws.png', 'depot.png'), { onFailure: (error) => failures.push(error) })
    expect(report.pictures.map((one) => one.entry.name)).toEqual(['depot.png'])
    expect(failures).toHaveLength(1)
    const again = await picturesForReport(source, crews('throws.png', 'depot.png'), {
      onFailure: () => { throw new Error('the handler too') },
    })
    expect(again.pictures.map((one) => one.entry.name)).toEqual(['depot.png'])
  })
})

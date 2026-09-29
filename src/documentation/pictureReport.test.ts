// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { ImageEntry } from '../model/imageName'
import { drawnPictures, picturesForReport, REPORT_ASKS } from './pictureReport'
import { memoryImageSource } from './pictureSource'
import type { ImageSource } from './pictureSource'

const PNG = { mediaType: 'image/png', bytes: new Uint8Array([1, 2, 3]) }

function entry(name: string): ImageEntry {
  return { name, mediaType: 'image/png', size: 3, width: 640, height: 480, contentAddress: `sha256:${'a'.repeat(64)}` }
}

describe('the pictures a report drew', () => {
  it('are one picture per name by the library\'s rule, the first drawn, whatever case or form it came in', () => {
    const drawn = drawnPictures()
    for (const name of ['depot.png', 'DEPOT.png', 'Kaart-ü.png', 'Kaart-ü.png']) drawn.add(entry(name))
    expect(drawn.entries().map((one) => one.name)).toEqual(['depot.png', 'Kaart-ü.png'])
  })
})

describe('a report asking for its pictures', () => {
  it('asks for each picture once, and answers the ones whose bytes came', async () => {
    const source = memoryImageSource({ crews: { 'depot.png': PNG, 'yard.png': PNG } })
    const drawn = [entry('depot.png'), entry('Depot.PNG'), entry('yard.png'), entry('gone.png')]
    const pictures = await picturesForReport(source, 'crews', drawn)
    expect(source.asked.map((one) => one.name).sort()).toEqual(['depot.png', 'gone.png', 'yard.png'])
    expect([...pictures.keys()].sort()).toEqual(['depot.png', 'yard.png'])
  })

  it('asks nothing for a report that drew no picture', async () => {
    const source = memoryImageSource({})
    expect((await picturesForReport(source, 'crews', [])).size).toBe(0)
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
    const pictures = await picturesForReport(source, 'crews', names.map(entry))
    expect(most).toBe(REPORT_ASKS)
    expect(asked.sort()).toEqual([...names].sort())
    expect(pictures.size).toBe(11)
    most = 0
    await picturesForReport(source, 'crews', names.map(entry), { limit: 2 })
    expect(most).toBe(2)
  })

  it('goes on past a failed ask, says it where it is told, and leaves that picture out', async () => {
    const failures: unknown[] = []
    const source: ImageSource = {
      bytes: (_scope, name) => (name === 'broken.png' ? Promise.reject(new Error('offline')) : Promise.resolve(PNG)),
    }
    const pictures = await picturesForReport(source, 'crews', [entry('broken.png'), entry('depot.png')], {
      onFailure: (error) => failures.push(error),
    })
    expect([...pictures.keys()]).toEqual(['depot.png'])
    expect(failures).toHaveLength(1)
    expect(await picturesForReport(source, 'crews', [entry('broken.png')])).toEqual(new Map())
  })
})

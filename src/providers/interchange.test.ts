// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The working file as the interchange between every source that ships
 * (ADR-0031 §2): an organisation carried out of one source, brought into a
 * fresh source of another kind and carried out again is the same file, byte
 * for byte, pictures and all. Each source is opened through its own
 * provider's `open`, as the app gets it.
 */
import { unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { RecordingDiagnostics } from '../adapters/memory/RecordingDiagnostics'
import { FakeDirectory } from '../adapters/folder/fakeDirectory'
import { WORKING_FILE_INTERCHANGE as interchange } from '../adapters/folder/format/interchange'
import { png, seed } from '../adapters/folder/format/testing/organisation'
import { carryScopes } from '../adapters/folder/format/interchange'
import { laidOut } from '../model/testFixtures'
import { dataUrl } from '../projects/dataUrl'
import type { KeyValueStorage } from '../adapters/webStorage/KeyValueStorage'
import { fakeIndexedDb } from '../adapters/webStorage/testing/fakeIndexedDb'
import type { Repositories } from '../ports/Repositories'
import { readWhole } from '../projects/scopeAccess'
import { BROWSER_STORAGE_SOURCE } from './browserStorage/browserStorageSource'
import { openFolder } from './folder/openFolder'
import { MEMORY_SOURCE } from './memory/memorySource'

/** A key-value storage that keeps what it is given, for as long as the test runs. */
function keyValues(): KeyValueStorage {
  const held = new Map<string, string>()
  return {
    getItem: (key) => held.get(key) ?? null,
    setItem: (key, value) => { held.set(key, value) },
    removeItem: (key) => { held.delete(key) },
    keys: () => [...held.keys()],
  }
}

/** Each source that ships, fresh, through its provider's own `open`. */
const SOURCES: readonly [string, () => Promise<Repositories>][] = [
  ['memory', async () => (await MEMORY_SOURCE.open(undefined, {})).repositories],
  ['this browser', async () => (await BROWSER_STORAGE_SOURCE.open(
    { storage: keyValues(), database: fakeIndexedDb() }, { diagnostics: new RecordingDiagnostics() },
  )).repositories],
  ['a folder', async () => {
    const handle = new FakeDirectory('Architecture')
    return (await openFolder({ handle, name: 'Architecture', root: 'Architecture' }, { diagnostics: new RecordingDiagnostics() })).repositories
  }],
]

describe('the working file between sources', () => {
  for (const [at, [from, openFrom]] of SOURCES.entries()) {
    const [to, openTo] = SOURCES[(at + 1) % SOURCES.length]

    it(`carries an organisation out of ${from}, into ${to} and out again as the same file, pictures and all`, async () => {
      const source = await openFrom()
      await seed(source)
      const first = await interchange.carryOut(source)

      const target = await openTo()
      const opened = await interchange.open(first.bytes, '')
      if ('refused' in opened) throw new Error(`the file did not open: ${opened.refused}`)
      await interchange.bringIn(target, opened)
      const second = await interchange.carryOut(target)

      expect(second.name).toBe(first.name)
      expect(Buffer.from(second.bytes).equals(Buffer.from(first.bytes))).toBe(true)
      const inside = unzipSync(second.bytes)
      expect(Object.keys(inside)).toEqual(expect.arrayContaining([
        'scope.json', 'application-landscape/scope.json', 'application-landscape/images/depot.png', 'depots/images/yard.png',
        'depots/images/diagrams/ctx.png',
      ]))
      // And what landed, read back, is everything the file says it holds.
      const arrival = await interchange.check(opened, (address) => readWhole(target, address))
      expect(arrival.short).toBeUndefined()
      expect(arrival.totals.scopes).toBe(3)
    })
  }
})

/**
 * A file an older build wrote names its pictures by where they were kept,
 * and a picture's file by a name the library would refuse. Wherever it lands,
 * it lands as the same scope: its documents naming its pictures by name.
 */
describe('a working file an older build wrote', () => {
  const older = () => carryScopes([{
    path: '',
    model: {
      name: 'Older',
      elements: [{
        id: 'depot', kind: 'application', name: 'Depot', lifecycle: 'live', isManaged: true, aspects: {},
        description: 'The yard.\n\n![The depot](../images/depot.png)\n\n![A photo](../images/old%20photo.png)\n',
      }],
      relations: [],
      diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [] })],
    },
    activeDiagramId: 'd1',
    logoLibrary: [],
    imageLibrary: [
      { file: 'depot.png', url: dataUrl('image/png', png(1)) },
      { file: 'old photo.png', url: dataUrl('image/png', png(2)) },
    ],
  }])

  it('lands the same in every source, its pictures named', async () => {
    const { bytes } = await older()
    const landed = await Promise.all(SOURCES.map(async ([, openOne]) => {
      const repositories = await openOne()
      const opened = await interchange.open(bytes, '')
      if ('refused' in opened) throw new Error(opened.refused)
      await interchange.bringIn(repositories, opened)
      const arrival = await interchange.check(opened, (address) => readWhole(repositories, address))
      const scope = await readWhole(repositories, '')
      return {
        short: arrival.short,
        description: scope?.model.elements[0].description,
        pictures: scope?.images?.map((entry) => entry.name),
        carried: Buffer.from((await interchange.carryOut(repositories)).bytes),
      }
    }))
    for (const one of landed) {
      expect(one.short).toBeUndefined()
      expect(one.description).toBe('The yard.\n\n![The depot](image:depot.png)\n\n![A photo](image:old-photo.png)\n')
      expect(one.pictures?.sort()).toEqual(['depot.png', 'old-photo.png'])
      expect(one.carried.equals(landed[0].carried)).toBe(true)
    }
  })

  /**
   * A name the library already takes is kept for its own picture: a name made
   * for a file the library refuses never takes it, so a document that says
   * `image:old-photo.png` still shows that picture.
   */
  it('keeps every picture on its own bytes where a made name would meet a name already taken', async () => {
    const element = (id: string, description: string) => ({
      id, kind: 'application' as const, name: id, lifecycle: 'live' as const, isManaged: true, aspects: {}, description,
    })
    const { bytes } = await carryScopes([{
      path: '',
      model: {
        name: 'Older',
        elements: [
          element('spaced', '![Spaced](../images/old%20photo.png)\n'),
          element('named', '![Named](image:old-photo.png)\n'),
        ],
        relations: [],
        diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [] })],
      },
      activeDiagramId: 'd1',
      logoLibrary: [],
      imageLibrary: [
        { file: 'old photo.png', url: dataUrl('image/png', png(2)) },
        { file: 'old-photo.png', url: dataUrl('image/png', png(3)) },
      ],
    }])
    for (const [, openOne] of SOURCES) {
      const repositories = await openOne()
      const opened = await interchange.open(bytes, '')
      if ('refused' in opened) throw new Error(opened.refused)
      await interchange.bringIn(repositories, opened)
      const scope = await readWhole(repositories, '')
      const shown = (id: string) => /image:([^)]+)\)/.exec(scope!.model.elements.find((one) => one.id === id)!.description!)![1]
      const bytesOf = (name: string) => scope!.imageLibrary!.find((image) => image.file === name)!.url
      expect(shown('named')).toBe('old-photo.png')
      expect(bytesOf(shown('named'))).toBe(dataUrl('image/png', png(3)))
      expect(shown('spaced')).not.toBe('old-photo.png')
      expect(bytesOf(shown('spaced'))).toBe(dataUrl('image/png', png(2)))
    }
  })
})

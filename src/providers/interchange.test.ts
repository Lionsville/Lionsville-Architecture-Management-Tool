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
import { seed } from '../adapters/folder/format/testing/organisation'
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
      ]))
      // And what landed, read back, is everything the file says it holds.
      const arrival = await interchange.check(opened, (address) => readWhole(target, address))
      expect(arrival.short).toBeUndefined()
      expect(arrival.totals.scopes).toBe(3)
    })
  }
})

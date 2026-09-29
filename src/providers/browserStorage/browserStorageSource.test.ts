// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What this browser settles on as it opens: its database where it opens or
 * waits on another tab, and memory where it will not — showing what the older
 * storage kept, read and never moved, and saying that nothing here is kept.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RecordingDiagnostics } from '../../adapters/memory/RecordingDiagnostics'
import type { IndexedDb } from '../../adapters/webStorage/IndexedDbStore'
import type { KeyValueStorage } from '../../adapters/webStorage/KeyValueStorage'
import { fakeIndexedDb } from '../../adapters/webStorage/testing/fakeIndexedDb'
import { WebStorageScopeStore } from '../../adapters/webStorage/WebStorageScopeStore'
import { translator } from '../../i18n'
import type { HostModel } from '../../model/hostModel'
import { BROWSER_KEEPING_NOTHING, BROWSER_STORAGE, BROWSER_STORAGE_SOURCE, STILL_ANSWERING_MS } from './browserStorageSource'
import type { BrowserParts } from './browserStorageSource'

function fakeStorage(): KeyValueStorage & { held: Map<string, string> } {
  const held = new Map<string, string>()
  return {
    held,
    getItem: (key) => held.get(key) ?? null,
    setItem: (key, value) => { held.set(key, value) },
    removeItem: (key) => { held.delete(key) },
    keys: () => [...held.keys()],
  }
}

const model = (name: string): HostModel => ({ name, elements: [], relations: [], diagrams: [] })

/** A browser whose older storage kept Acme's organisation and its rail scope. */
async function keptBefore() {
  const storage = fakeStorage()
  const store = new WebStorageScopeStore(storage)
  await store.save({ path: '', model: model('Acme Group'), activeDiagramId: '', logoLibrary: [] })
  await store.save({ path: 'acme', model: model('Acme Logistics'), activeDiagramId: '', logoLibrary: [] })
  return storage
}

/** A database the browser will not open. */
function refusing(): IndexedDb {
  return {
    ...fakeIndexedDb(),
    factory: { open: () => { throw new DOMException('not in this window', 'InvalidStateError') } } as unknown as IDBFactory,
  }
}

/** A database another tab holds at an older layout: it waits, and never opens here. */
function held(): IndexedDb {
  return {
    ...fakeIndexedDb(),
    factory: {
      open: () => {
        const request = { onblocked: null as null | (() => void) }
        setTimeout(() => request.onblocked?.(), 0)
        return request
      },
    } as unknown as IDBFactory,
  }
}

/** A database whose open answers nothing until the test says so — or ever. */
function silent(): IndexedDb & { answer: () => void } {
  const real = fakeIndexedDb()
  let answer!: () => void
  const asked = new Promise<void>((resolve) => { answer = resolve })
  type Request = { result?: unknown; error: null; onsuccess: (() => void) | null; onerror: (() => void) | null; onupgradeneeded: (() => void) | null; onblocked: (() => void) | null }
  const factory = {
    open: (name: string, version: number) => {
      const outer: Request = { error: null, onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null }
      void asked.then(() => {
        const inner = real.factory.open(name, version) as unknown as Request
        inner.onupgradeneeded = () => { outer.result = inner.result; outer.onupgradeneeded?.() }
        inner.onsuccess = () => { outer.result = inner.result; outer.onsuccess?.() }
        inner.onerror = () => outer.onerror?.()
      })
      return outer
    },
  }
  return { ...real, factory: factory as unknown as IDBFactory, answer }
}

async function settle(opening: Parameters<typeof BROWSER_STORAGE_SOURCE.open>[0], s = translator('en')) {
  const diagnostics = new RecordingDiagnostics()
  const opened = await BROWSER_STORAGE_SOURCE.open(opening, { diagnostics, s })
  const parts: BrowserParts = await opened.settled!() as BrowserParts
  return { parts, diagnostics }
}

const names = async (parts: BrowserParts) => {
  const { root } = await parts.repositories.scopes.tree()
  return [root.name, ...root.children.map((node) => node.name)]
}

describe('a browser whose database will not open', () => {
  it('shows what the older storage kept, in memory, and leaves the older storage exactly as it was', async () => {
    const storage = await keptBefore()
    const before = new Map(storage.held)
    const { parts } = await settle({ storage })
    expect(await names(parts)).toEqual(['Acme Group', 'Acme Logistics'])
    expect(parts.own?.shownFromOlder()).toBe(true)
    expect(parts.own?.keepsNothing()).toBe(true)
    expect(storage.held).toEqual(before)
  })

  it('says it keeps nothing, on the bar, in the subtitle and in the history’s note', async () => {
    const { parts } = await settle({ storage: await keptBefore() })
    expect(parts.source).toEqual(BROWSER_KEEPING_NOTHING)
    expect(parts.source.transient).toBe(true)
    expect(parts.sayings).toMatchObject({ labelKey: 'shell.sourceMemory', describeKey: 'shell.sourceTipMemory', whereKey: 'memory.where' })
    expect(parts.historyNoteKey).toBe('memory.historyNote')
  })

  it('still keeps the preferences, whose storage is still there', async () => {
    const storage = fakeStorage()
    const { parts } = await settle({ storage })
    await parts.preferences.write({ language: 'nl' })
    expect(storage.held.size).toBe(1)
    expect(await parts.preferences.read()).toMatchObject({ language: 'nl' })
  })

  it('says only that nothing is kept where the older storage kept nothing', async () => {
    const { parts } = await settle({ storage: fakeStorage() })
    expect(parts.own?.shownFromOlder()).toBe(false)
    expect((await parts.repositories.scopes.tree()).root.children).toEqual([])
  })

  it('falls the same way where the browser has one and it refuses to open, and says why in the trail', async () => {
    const { parts, diagnostics } = await settle({ storage: await keptBefore(), database: refusing() })
    expect(parts.source).toEqual(BROWSER_KEEPING_NOTHING)
    expect(await names(parts)).toEqual(['Acme Group', 'Acme Logistics'])
    expect(diagnostics.messages().join('\n')).toContain('the database would not open; nothing is kept')
  })

  it('answers through memory before it has settled, too', async () => {
    const opened = await BROWSER_STORAGE_SOURCE.open({ storage: await keptBefore() }, { diagnostics: new RecordingDiagnostics() })
    expect((await opened.repositories.scopes.tree()).root.name).toBe('Acme Group')
  })

  it('records history in the person’s language', async () => {
    const { parts } = await settle({ storage: await keptBefore() }, translator('nl'))
    const { root } = await parts.repositories.scopes.tree()
    const written = await parts.repositories.history.record({ scopes: [root.id], subject: 'Before the move' })
    expect(written.map((entry) => entry.by)).toEqual(['dit tabblad'])
  })
})

describe('a browser whose database opens', () => {
  it('settles on its database, and says it keeps what is done here', async () => {
    const { parts } = await settle({ storage: await keptBefore(), database: fakeIndexedDb() })
    expect(parts.source).toEqual(BROWSER_STORAGE)
    expect(parts.sayings).toBeUndefined()
    expect(parts.historyNoteKey).toBe('browser.historyNote')
    expect(parts.own?.keepsNothing()).toBe(false)
    expect(await names(parts)).toEqual(['Acme Group', 'Acme Logistics'])
  })

  it('brings the older work over with entries in the person’s language', async () => {
    const { parts } = await settle({ storage: await keptBefore(), database: fakeIndexedDb() }, translator('nl'))
    const { root } = await parts.repositories.scopes.tree()
    const { entries } = await parts.repositories.history.entries({ scopes: [root.id] })
    expect(entries.map((entry) => entry.by)).toContain('deze browser')
    expect(entries.map((entry) => entry.subject)).toContain(translator('nl')('browser.broughtOver'))
  })

  it('does not wait to be drawn while another tab holds it', async () => {
    const { parts } = await settle({ storage: fakeStorage(), database: held() })
    expect(parts.source).toEqual(BROWSER_STORAGE)
    expect(parts.own?.database.standing()).toBe('blocked')
  })
})

describe('a browser whose database does not answer', () => {
  afterEach(() => { vi.useRealTimers() })

  it('draws without it after a while, says it is still answering, and shows the work once it does', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const database = silent()
    const opened = await BROWSER_STORAGE_SOURCE.open({ storage: await keptBefore(), database }, { diagnostics: new RecordingDiagnostics() })
    let parts: BrowserParts | undefined
    void opened.settled!().then((settled) => { parts = settled as BrowserParts })
    await vi.advanceTimersByTimeAsync(STILL_ANSWERING_MS - 1)
    expect(parts).toBeUndefined()
    await vi.advanceTimersByTimeAsync(1)
    expect(parts?.source).toEqual(BROWSER_STORAGE)
    expect(parts?.own?.stillAnswering()).toBe(true)
    const heard: boolean[] = []
    parts?.own?.onStillAnswering((still) => heard.push(still))
    vi.useRealTimers()
    database.answer()
    expect(await names(parts!)).toEqual(['Acme Group', 'Acme Logistics'])
    await new Promise((resolve) => { setTimeout(resolve, 0) })
    expect(parts?.own?.stillAnswering()).toBe(false)
    expect(heard).toEqual([false])
  })

  it('says nothing of it where the database answers in time', async () => {
    const { parts } = await settle({ storage: await keptBefore(), database: fakeIndexedDb() })
    expect(parts.own?.stillAnswering()).toBe(false)
  })
})


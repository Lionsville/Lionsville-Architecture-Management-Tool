// @vitest-environment jsdom
/**
 * A folder in a browser tab, which is the best-effort half of ADR-0003.
 *
 * Two properties, and both are about NOT being annoying. A browser that cannot
 * give a page a folder must not be offered one; and a folder whose permission
 * has lapsed — which is the ordinary state of a tab the morning after — must be
 * ignored silently rather than prompting on every boot, because asking needs a
 * click and a boot is not one.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { canChooseDirectory, chooseDirectory, rememberedDirectory } from './workingDirectory'

type Host = Record<string, unknown>

const held = new Map<string, unknown>()

/** Enough IndexedDB to keep one handle. The real one is not in jsdom. */
function fakeIndexedDb(): unknown {
  const request = (result: unknown) => {
    const held = { result, onsuccess: () => {}, onerror: () => {}, onupgradeneeded: () => {} }
    queueMicrotask(() => held.onsuccess())
    return held
  }
  return {
    open: () => request({
      createObjectStore: () => {},
      transaction: () => ({
        objectStore: () => ({
          put: (value: unknown, key: string) => { held.set(key, value); return request(undefined) },
          get: (key: string) => request(held.get(key)),
        }),
      }),
    }),
  }
}

afterEach(() => {
  held.clear()
  delete (window as unknown as Host).showDirectoryPicker
  delete (window as unknown as Host).indexedDB
})

function browser(picker?: unknown): void {
  const host = window as unknown as Host
  host.indexedDB = fakeIndexedDb()
  if (picker) host.showDirectoryPicker = picker
}

const handle = (permission: string) => ({
  kind: 'directory',
  name: 'Architecture',
  queryPermission: () => Promise.resolve(permission),
})

describe('canChooseDirectory', () => {
  it('is false in a browser without the API', () => {
    browser()
    expect(canChooseDirectory()).toBe(false)
  })

  it('is true where a page can be handed a folder', () => {
    browser(() => Promise.resolve(handle('granted')))
    expect(canChooseDirectory()).toBe(true)
  })
})

describe('chooseDirectory', () => {
  it('hands back the folder and remembers it', async () => {
    browser(() => Promise.resolve(handle('granted')))
    expect((await chooseDirectory())?.name).toBe('Architecture')
    expect((await rememberedDirectory())?.name).toBe('Architecture')
  })

  it('says nothing when the user cancelled', async () => {
    // Cancelling a picker throws, and it is not a failure.
    browser(() => Promise.reject(new Error('AbortError')))
    await expect(chooseDirectory()).resolves.toBeUndefined()
  })

  it('says nothing in a browser that cannot offer one', async () => {
    browser()
    await expect(chooseDirectory()).resolves.toBeUndefined()
  })
})

describe('rememberedDirectory', () => {
  it('is nothing when nothing was ever chosen', async () => {
    browser(() => Promise.resolve(handle('granted')))
    await expect(rememberedDirectory()).resolves.toBeUndefined()
  })

  it('is nothing when the permission has lapsed, rather than a prompt', async () => {
    // The ordinary state of a tab the morning after. Asking again needs a
    // click, so the tab quietly starts in browser storage and offers the
    // button — which is a click the user meant to make.
    browser(() => Promise.resolve(handle('prompt')))
    await chooseDirectory()
    await expect(rememberedDirectory()).resolves.toBeUndefined()
  })

  it('is the folder when the permission is still granted', async () => {
    browser(() => Promise.resolve(handle('granted')))
    await chooseDirectory()
    expect((await rememberedDirectory())?.name).toBe('Architecture')
  })

  it('does not mind a browser that refuses IndexedDB', async () => {
    const host = window as unknown as Host
    host.showDirectoryPicker = vi.fn()
    await expect(rememberedDirectory()).resolves.toBeUndefined()
  })
})

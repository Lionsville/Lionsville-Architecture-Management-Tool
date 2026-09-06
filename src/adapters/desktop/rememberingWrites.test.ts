/**
 * Our own writes, coming back as news.
 *
 * Every save produces a filesystem event, so this is the difference between a
 * conflict prompt that means something and one that appears every three
 * seconds. By content rather than by timing, which is what makes a slow
 * notification and a sync client's echo the same case.
 */
import { describe, expect, it, vi } from 'vitest'
import type { DesktopFiles, DesktopStamp } from './channel'
import { rememberingWrites } from './rememberingWrites'

const stamp = (sha256: string): DesktopStamp => ({ mtimeMs: 1, size: 2, sha256 })

function channel(): DesktopFiles {
  return {
    chooseDirectory: () => Promise.resolve(undefined),
    recentDirectories: () => Promise.resolve([]),
    list: () => Promise.resolve([]),
    makeDirectory: () => Promise.resolve(),
    read: () => Promise.resolve(undefined),
    write: vi.fn(() => Promise.resolve(stamp('abc'))),
    remove: vi.fn(() => Promise.resolve()),
    fingerprint: () => Promise.resolve(undefined),
    revealInFolder: () => Promise.resolve(),
    saveDocument: () => Promise.resolve(true),
    watch: () => Promise.resolve(),
    unwatch: () => Promise.resolve(),
    onChanged: () => () => {},
  }
}

describe('rememberingWrites', () => {
  it('recognises the change our own write causes', async () => {
    const held = rememberingWrites(channel())
    await held.files.write('/work', 'acme/landscape/model.json', new Uint8Array([1]))

    expect(held.ours({ root: '/work', path: 'acme/landscape/model.json', stamp: stamp('abc') }))
      .toBe(true)
  })

  it('does not recognise somebody else changing a file we wrote', async () => {
    const held = rememberingWrites(channel())
    await held.files.write('/work', 'model.json', new Uint8Array([1]))

    expect(held.ours({ root: '/work', path: 'model.json', stamp: stamp('different') })).toBe(false)
  })

  it('does not recognise a file we never wrote', () => {
    const held = rememberingWrites(channel())
    expect(held.ours({ root: '/work', path: 'model.json', stamp: stamp('abc') })).toBe(false)
  })

  it('keeps two folders apart', async () => {
    const held = rememberingWrites(channel())
    await held.files.write('/work', 'model.json', new Uint8Array([1]))

    expect(held.ours({ root: '/other', path: 'model.json', stamp: stamp('abc') })).toBe(false)
  })

  it('recognises a removal we asked for', async () => {
    const held = rememberingWrites(channel())
    await held.files.remove('/work', 'diagrams/old.json')

    expect(held.ours({ root: '/work', path: 'diagrams/old.json' })).toBe(true)
  })

  it('still passes everything through to the channel underneath', async () => {
    const underneath = channel()
    const held = rememberingWrites(underneath)
    await held.files.write('/work', 'model.json', new Uint8Array([1]))
    await held.files.remove('/work', 'model.json')

    expect(underneath.write).toHaveBeenCalled()
    expect(underneath.remove).toHaveBeenCalled()
  })
})

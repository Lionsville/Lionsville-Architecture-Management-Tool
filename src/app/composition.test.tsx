// @vitest-environment jsdom
/**
 * The desktop shell, composed over a fake file channel.
 *
 * The seams are tested one by one elsewhere; this is the one place that puts
 * them together for the desktop, and a wrapper here can quietly lose what it
 * wraps. It did: the folder settings store is a class, and spreading it kept
 * `id` and dropped `readLocal`, so every desktop boot logged a warning from
 * pull-on-open and the preferences dialog rejected. Nothing above the seam
 * could have caught that — the tests hand `App` plain objects.
 */
import { describe, expect, it, vi } from 'vitest'
import type { DesktopFiles } from '../adapters/desktop/channel'
import { DEFAULT_LOCAL_SETTINGS } from '../projects/folderSettings'
import { inWorkingDirectory, type Shell } from './composition'

function channel(): DesktopFiles {
  return {
    chooseDirectory: () => Promise.resolve(undefined),
    recentDirectories: () => Promise.resolve([]),
    list: () => Promise.resolve(undefined),
    makeDirectory: () => Promise.resolve(),
    read: () => Promise.resolve(undefined),
    write: vi.fn(() => Promise.resolve({ mtimeMs: 1, size: 1, sha256: 'x' })),
    remove: () => Promise.resolve(),
    fingerprint: () => Promise.resolve(undefined),
    revealInFolder: () => Promise.resolve(),
    saveDocument: () => Promise.resolve(true),
    watch: () => Promise.resolve(),
    unwatch: () => Promise.resolve(),
    onChanged: () => () => {},
  }
}

describe('inWorkingDirectory', () => {
  it('keeps every method of the folder settings store, not only the one it wraps', async () => {
    const shell = inWorkingDirectory({} as Shell, channel(), { root: '/work', name: 'work' })
    const settings = shell.folderSettings!

    expect(typeof settings.readLocal).toBe('function')
    expect(typeof settings.readFolder).toBe('function')
    expect(await settings.readLocal()).toEqual(DEFAULT_LOCAL_SETTINGS)
    expect(await settings.readFolder()).toEqual({})
  })
})

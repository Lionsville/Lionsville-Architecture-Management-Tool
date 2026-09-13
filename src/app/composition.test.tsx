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

describe('inWorkingDirectory — what a scope hears about', () => {
  function listening() {
    let listener: ((change: { root: string; path: string; stamp?: { mtimeMs: number; size: number; sha256: string } }) => void) | undefined
    const files = { ...channel(), onChanged: (held: typeof listener) => { listener = held; return () => {} } }
    const shell = inWorkingDirectory({} as Shell, files as never, { root: '/work', name: 'work' })
    const heard: string[] = []
    const report = (path: string) => listener?.({ root: '/work', path, stamp: { mtimeMs: 1, size: 1, sha256: 'x' } })
    return { shell, heard, report }
  }

  it('tells the open scope about its own files and nothing else', () => {
    const { shell, heard, report } = listening()
    shell.watchProject!('acme', () => heard.push('acme'))
    report('acme/model.json')
    report('acme/docs/erp.md')
    // A landscape filed under the domain, a README beside scope.json, an
    // export saved into the folder, another domain: none of them this scope's.
    report('acme/rail/model.json')
    report('acme/README.md')
    report('acme/landscape.lvarch')
    report('finance/model.json')
    report('scope.json')
    expect(heard).toHaveLength(2)
  })

  it('tells the tree about everything under it', () => {
    const { shell, heard, report } = listening()
    shell.watchProject!('', () => heard.push('tree'), true)
    report('acme/rail/model.json')
    report('scope.json')
    report('acme/README.md')
    expect(heard).toHaveLength(3)
  })

  it('tells the organisation, opened on a page, about its own files only', () => {
    const { shell, heard, report } = listening()
    shell.watchProject!('', () => heard.push('root'))
    report('acme/rail/model.json')
    report('scope.json')
    report('diagrams/l7.json')
    expect(heard).toHaveLength(2)
  })
})

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

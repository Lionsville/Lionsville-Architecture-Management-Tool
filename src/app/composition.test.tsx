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
import { InMemoryScopeStore } from '../adapters/memory/InMemoryScopeStore'
import { IN_MEMORY } from '../platform/workingSource'
import type { SourceProvider } from '../platform/sourceProvider'
import {
  inWorkingDirectory, openSource, registerSourceProvider, sourceProvider,
  type FolderOpening, type Shell, type SourceParts,
} from './composition'

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

  /**
   * A write of ours comes back from the watcher with the fingerprint we
   * remembered. The open scope must not hear it — that would be the app
   * interrupting itself — and the tree must, because the index is built from
   * what this app writes as much as from what anyone else does: the example
   * copied in, a scope created, a landscape saved with one more application.
   */
  it('tells the tree about our own writes, and the open scope not', async () => {
    const { shell, heard, report } = listening()
    shell.watchProject!('acme', () => heard.push('acme'))
    shell.watchProject!('', () => heard.push('tree'), true)
    // Through the store, so the remembering wrapper sees the write; the fake
    // channel stamps every write 'x', and the report carries the same stamp.
    await shell.scopes.save({
      path: 'acme', model: { name: 'Acme', elements: [], relations: [], diagrams: [] },
      activeDiagramId: '', logoLibrary: [],
    })
    report('acme/model.json')
    expect(heard).toEqual(['tree'])
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

/**
 * The registry that replaced the switch.
 *
 * The three that ship are registered here at module load, so importing this
 * file is enough to have them; a build composed from this one registers a
 * fourth the same way and nothing above the composition root is edited for it.
 */
describe('registerSourceProvider', () => {
  it('has the three that ship, each answering for its own kind', () => {
    expect(sourceProvider('folder')?.kind).toBe('folder')
    expect(sourceProvider('browserStorage')?.kind).toBe('browserStorage')
    expect(sourceProvider('memory')?.kind).toBe('memory')
  })

  it('answers nobody for a kind nobody registered', () => {
    expect(sourceProvider('elsewhere')).toBeUndefined()
  })

  it('takes a build\'s own provider, with its way in and its own words', () => {
    const provider: SourceProvider<SourceParts, { name: string }> = {
      kind: 'elsewhere',
      connect: { labelKey: 'elsewhere.connect' },
      // Somewhere that means something else by *dirty* than a file does: work
      // that has not left this machine, whatever the document's machine says.
      statusOf: (work) => (work.editedWhileSaving ? 'dirty' : work.status),
      open: ({ name }) => ({
        scopes: new InMemoryScopeStore(),
        source: { kind: 'registered', provider: 'elsewhere', name, key: name, readOnly: true },
      }),
    }
    registerSourceProvider(provider)

    const found = sourceProvider<{ name: string }>('elsewhere')
    expect(found?.connect?.labelKey).toBe('elsewhere.connect')
    expect(found?.statusOf?.({ status: 'clean', editedWhileSaving: true })).toBe('dirty')
    expect(found?.statusOf?.({ status: 'saving', editedWhileSaving: false })).toBe('saving')
    expect(found?.open({ name: 'Elsewhere' }).source)
      .toEqual({ kind: 'registered', provider: 'elsewhere', name: 'Elsewhere', key: 'Elsewhere', readOnly: true })
  })

  /**
   * Registering twice is ignored rather than replacing, the way a logo pack
   * is: a test that registers per case is then safe, and a build cannot
   * quietly take over the folder every desktop boot depends on.
   */
  it('keeps the first registration for a kind', () => {
    registerSourceProvider({ kind: 'folder', open: () => ({ source: IN_MEMORY }) })
    expect(sourceProvider('folder')?.open).not.toBe(undefined)
    expect(sourceProvider<FolderOpening>('folder')?.connect?.labelKey).toBe('picker.chooseFolder')
  })
})

/**
 * Opening one, which is the step a composer outside this file also takes.
 *
 * Exported for exactly that: the parts a provider builds and its word about
 * the five statuses travel together, and a composer that spelled that out for
 * itself would be one field short the day a third thing joins them.
 */
describe('openSource', () => {
  it('brings the provider\'s word about the five words along with its parts', () => {
    registerSourceProvider<{ name: string }>({
      kind: 'measured',
      statusOf: (work) => (work.editedWhileSaving ? 'dirty' : work.status),
      open: ({ name }) => ({
        scopes: new InMemoryScopeStore(),
        source: { kind: 'registered', provider: 'measured', name, key: name },
      }),
    })

    const parts = openSource('measured', { name: 'Measured' })

    expect(parts.source).toEqual({ kind: 'registered', provider: 'measured', name: 'Measured', key: 'Measured' })
    expect(parts.sourceStatus?.({ status: 'clean', editedWhileSaving: true })).toBe('dirty')
  })

  /** A folder means what a file means, and says so by bringing no `statusOf`. */
  it('leaves the answer undefined where the provider has none', () => {
    expect(openSource('memory', undefined).sourceStatus).toBeUndefined()
  })

  /**
   * A wiring mistake found at the boot is a wiring mistake; found at the first
   * save it is a lost document.
   */
  it('refuses a kind nobody registered', () => {
    expect(() => openSource('nowhere', undefined)).toThrow(/nowhere/)
  })
})

describe('the folder source', () => {
  it('is what a desktop shell is composed from, root and all', () => {
    const shell = inWorkingDirectory({} as Shell, channel(), { root: '/work', name: 'work' })
    expect(shell.source).toEqual({ kind: 'folder', name: 'work', root: '/work' })
  })

  /**
   * Nothing to say about the five words: a folder means by them exactly what
   * `documentSession` means, which is what all three that ship mean.
   */
  it('leaves the document\'s own machine to say what dirty means', () => {
    const shell = inWorkingDirectory({} as Shell, channel(), { root: '/work', name: 'work' })
    expect(shell.sourceStatus).toBeUndefined()
    expect(sourceProvider('folder')?.statusOf).toBeUndefined()
  })
})

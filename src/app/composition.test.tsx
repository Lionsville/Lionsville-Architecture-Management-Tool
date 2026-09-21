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
import { InMemoryPreferencesStore } from '../adapters/memory/InMemoryPreferencesStore'
import { InMemoryScopeStore } from '../adapters/memory/InMemoryScopeStore'
import { RecordingDiagnostics } from '../adapters/memory/RecordingDiagnostics'
import { IN_MEMORY } from '../platform/workingSource'
import type { SourceProvider } from '../platform/sourceProvider'
import {
  inWorkingDirectory, openSource, registerSourceProvider, registeredChrome, registeredConnects,
  registeredMenus, sourceAgentPanel, sourceChip, sourceDescription, sourceProvider,
  type FolderOpening, type Shell, type SourceBase, type SourceParts,
} from './composition'

/**
 * The shell's own side of opening a source, as little of it as a test needs:
 * somewhere to report, and nothing to reuse unless the case is about that.
 */
function opening(shell?: Shell): SourceBase & { diagnostics: RecordingDiagnostics } {
  return { diagnostics: new RecordingDiagnostics(), shell }
}

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

  it('takes a build\'s own provider, with its way in and its own words', async () => {
    const provider: SourceProvider<SourceParts, { name: string }> = {
      kind: 'elsewhere',
      connect: {
        labelKey: 'elsewhere.connect',
        // The provider's own dialog, which in a test is the answer without one.
        open: () => Promise.resolve({ name: 'Elsewhere' }),
        fromLocation: (location) =>
          (location.search.includes('elsewhere=') ? { name: 'From the address' } : undefined),
      },
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
    expect((await found?.open({ name: 'Elsewhere' }, opening()))?.source)
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
  it('brings the provider\'s word about the five words along with its parts', async () => {
    registerSourceProvider<{ name: string }>({
      kind: 'measured',
      statusOf: (work) => (work.editedWhileSaving ? 'dirty' : work.status),
      open: ({ name }) => ({
        scopes: new InMemoryScopeStore(),
        source: { kind: 'registered', provider: 'measured', name, key: name },
      }),
    })

    const parts = await openSource('measured', { name: 'Measured' }, opening())

    expect(parts.source).toEqual({ kind: 'registered', provider: 'measured', name: 'Measured', key: 'Measured' })
    expect(parts.sourceStatus?.({ status: 'clean', editedWhileSaving: true })).toBe('dirty')
  })

  /** A folder means what a file means, and says so by bringing no `statusOf`. */
  it('leaves the answer undefined where the provider has none', async () => {
    expect((await openSource('memory', undefined, opening())).sourceStatus).toBeUndefined()
  })

  /**
   * And the sentence for a refusal comes the other way: with the parts, not from
   * the registration.
   *
   * What the five words mean is a fact about the kind of place; what a store
   * saying no means is a fact about the store this opening just made — which
   * host answered, who is signed in. A provider answering from the registration
   * would have to keep the last opening in a variable to say it.
   */
  it('carries a provider\u2019s own sentence for a refusal where it keeps work', async () => {
    registerSourceProvider<{ name: string }>({
      kind: 'refusing',
      open: ({ name }) => ({
        scopes: new InMemoryScopeStore(),
        source: { kind: 'registered', provider: 'refusing', name, key: name },
        sourceFailure: (cause) => `${name} would not take it: ${String(cause)}.`,
      }),
    })

    const parts = await openSource('refusing', { name: 'Refusing' }, opening())

    expect(parts.sourceFailure?.('signed out')).toBe('Refusing would not take it: signed out.')
  })

  /**
   * And the three that ship bring none, so a refused save says what it has
   * always said: that this browser could not save the design.
   */
  it('leaves the sentence for a refusal to this tree where no provider gives one', async () => {
    expect((await openSource('memory', undefined, opening())).sourceFailure).toBeUndefined()
    expect((await openSource('browserStorage', {
      getItem: () => null, setItem: () => {}, removeItem: () => {}, key: () => null, length: 0,
    } as never, opening())).sourceFailure).toBeUndefined()
  })

  /**
   * The three that ship answer without waiting, and two shells in
   * `composition.ts` are composed on the strength of that: `composeShell` runs
   * before the boot's first line and answers a shell, not a promise.
   */
  it('answers the three that ship without a promise in the way', () => {
    expect(openSource('memory', undefined, opening())).not.toBeInstanceOf(Promise)
  })

  /**
   * A wiring mistake found at the boot is a wiring mistake; found at the first
   * save it is a lost document.
   */
  it('refuses a kind nobody registered', () => {
    expect(() => openSource('nowhere', undefined, opening())).toThrow(/nowhere/)
  })
})

/**
 * What the shell hands over from its own side, which used to be nothing.
 *
 * A provider had the console to report to and nothing of this shell to reuse,
 * so the honest thing for it to do was compose a second preferences store, a
 * second document gateway and a second browser store — three decisions this
 * file exists to make once, made twice in one window.
 */
describe('what a provider is handed besides its own opening', () => {
  const handed: SourceProvider<SourceParts, void, SourceBase> = {
    kind: 'handed',
    open: (_nothing, base) => {
      base.diagnostics.report({ level: 'info', where: 'source', message: 'shook hands' })
      return {
        scopes: new InMemoryScopeStore(),
        // The whole point of being handed the shell: the language, the theme
        // and which folder this machine uses stay where they were.
        preferences: base.shell?.preferences,
        source: { kind: 'registered', provider: 'handed', name: 'Handed', key: 'one' },
      }
    },
  }
  registerSourceProvider(handed)

  it('reports into the trail the app already keeps, not into the console', async () => {
    const base = opening()
    await openSource('handed', undefined, base)
    expect(base.diagnostics.messages()).toEqual(['shook hands'])
  })

  it('is given the shell as it stands, so a provider reuses its seams', async () => {
    // As much of a shell as this provider reads, which is the one seam a
    // folder deliberately leaves where it was.
    const shell = { ...({} as Shell), preferences: new InMemoryPreferencesStore() }
    expect((await openSource('handed', undefined, opening(shell))).preferences).toBe(shell.preferences)
  })

  /**
   * The one opening with no shell in it, because there is none yet: what
   * `composeShell` would hand over is the shell it is building out of what this
   * provider answers.
   */
  it('has no shell to give at the first compose, and says so by leaving it out', async () => {
    expect((await openSource('handed', undefined, opening())).preferences).toBeUndefined()
  })
})

/**
 * A source that has to shake hands before it can say what it is.
 *
 * What it is called, which scopes it holds and whether this person may write to
 * it at all are answers over a wire, and the boot waits for them: `readOnly`
 * decides what the workspace offers and what an agent is refused, so a shell
 * mounted over a guess and corrected a moment later is a mount thrown away and
 * a write offered that was never allowed.
 */
describe('a provider that opens asynchronously', () => {
  registerSourceProvider<{ name: string }>({
    kind: 'awaited',
    statusOf: (work) => (work.editedWhileSaving ? 'dirty' : work.status),
    open: async ({ name }) => {
      await Promise.resolve()
      return {
        scopes: new InMemoryScopeStore(),
        source: { kind: 'registered', provider: 'awaited', name, key: name, readOnly: true },
      }
    },
  })

  it('is waited for, and what travels with its parts travels anyway', async () => {
    const parts = await openSource('awaited', { name: 'Awaited' }, opening())
    expect(parts.source).toEqual({
      kind: 'registered', provider: 'awaited', name: 'Awaited', key: 'Awaited', readOnly: true,
    })
    expect(parts.sourceStatus?.({ status: 'clean', editedWhileSaving: true })).toBe('dirty')
  })

  /**
   * A handshake that fails is a source that could not be opened, and the
   * sentence is the provider's: the boot puts it on the screen it already keeps
   * for a boot that failed (`BootFailure`), which is the one screen with a way
   * back in.
   */
  it('rejects with its own sentence rather than opening over nothing', async () => {
    registerSourceProvider({
      kind: 'refused',
      open: () => Promise.reject(new Error('elsewhere would not have us')),
    })
    await expect(openSource('refused', undefined, opening())).rejects.toThrow(/would not have us/)
  })
})

/**
 * The ways in, which is what the boot draws a button from.
 *
 * `registerSourceProvider` above registers `elsewhere` with a connect
 * affordance, so this reads the folder's and that one's. A provider with no way
 * in is not on the list at all: this browser's storage and memory are where
 * work ends up when there was nowhere to go, not places a person navigates to.
 */
describe('registeredConnects', () => {
  it('lists every provider that offers a way in, and only those', () => {
    const kinds = registeredConnects().map((way) => way.kind)
    expect(kinds).toContain('folder')
    expect(kinds).toContain('elsewhere')
    expect(kinds).not.toContain('browserStorage')
    expect(kinds).not.toContain('memory')
  })

  it('says what the button says, unchanged', () => {
    const folder = registeredConnects().find((way) => way.kind === 'folder')
    expect(folder?.connect.labelKey).toBe('picker.chooseFolder')
  })

  /**
   * The folder's own dialog is the picker this app has always had — and in a
   * test there is neither a file channel nor a browser that can give a folder,
   * which is a tab that cannot be offered one and answers with nothing.
   */
  it('has the folder answering for its own picker', async () => {
    const folder = registeredConnects().find((way) => way.kind === 'folder')
    expect(await folder?.connect.open()).toBeUndefined()
  })

  /**
   * The way in that needs nobody: a link carries the address, and the boot reads
   * it before the first render rather than composing over the fallback and
   * swapping a mount away a moment later.
   */
  it('reads an address a provider recognises, and passes over one nobody does', () => {
    const elsewhere = registeredConnects().find((way) => way.kind === 'elsewhere')
    const location = { href: 'https://example.test/?elsewhere=one', search: '?elsewhere=one', hash: '' }
    expect(elsewhere?.connect.fromLocation?.(location)).toEqual({ name: 'From the address' })
    expect(elsewhere?.connect.fromLocation?.({ href: 'https://example.test/', search: '', hash: '' }))
      .toBeUndefined()
    // The folder has no address to read, so it has no say in the question.
    expect(registeredConnects().find((way) => way.kind === 'folder')?.connect.fromLocation)
      .toBeUndefined()
  })

  /**
   * And whether the button is drawn where it is about to be drawn: a way in is
   * standing, and standing is wrong for the provider that already answers for
   * the open source — *connect to…* then offers a person where they already are.
   *
   * The folder defines none, which is *always offered*: a folder is offered
   * wherever a folder can be chosen, and the picker is how you change to another
   * one.
   */
  it('leaves the question to the shell where the folder is concerned', () => {
    expect(registeredConnects().find((way) => way.kind === 'folder')?.connect.offer)
      .toBeUndefined()
  })

  it('lets a provider hide its own way in, or say something else on it', () => {
    registerSourceProvider({
      kind: 'offering',
      connect: {
        labelKey: 'offering.connect',
        open: () => Promise.resolve(undefined),
        offer: ({ source }) => (source.kind === 'registered' && source.provider === 'offering'
          ? null
          : { labelKey: 'offering.connectInstead' }),
      },
      open: () => ({
        scopes: new InMemoryScopeStore(),
        source: { kind: 'registered', provider: 'offering', name: 'Offering', key: 'one' },
      }),
    })

    const offer = registeredConnects().find((way) => way.kind === 'offering')?.connect.offer
    const location = { href: 'https://example.test/', search: '', hash: '' }
    expect(offer?.({ source: { kind: 'registered', provider: 'offering', name: 'O', key: 'one' }, location }))
      .toBeNull()
    expect(offer?.({ source: { kind: 'folder', name: 'work', root: '/work' }, location }))
      .toEqual({ labelKey: 'offering.connectInstead' })
  })
})

/**
 * The strips, which the boot draws for every registration and not for the open
 * source alone.
 *
 * A chrome that arrived with the parts of an opened source was missing at the
 * one moment a provider needs a screen: the first press of its way in, when it
 * has to ask where to connect to and is not the source yet. So it is declared on
 * the registration, and this is the list the boot hands over.
 */
describe('registeredChrome', () => {
  function Strip() {
    return <p>Elsewhere</p>
  }

  it('lists every provider that draws one, and only those', () => {
    registerSourceProvider({
      kind: 'drawing',
      chrome: Strip,
      open: () => ({
        scopes: new InMemoryScopeStore(),
        source: { kind: 'registered', provider: 'drawing', name: 'Drawing', key: 'one' },
      }),
    })

    const drawn = registeredChrome()
    expect(drawn.find((entry) => entry.kind === 'drawing')?.chrome).toBe(Strip)
    // The three that ship have nothing to say that the bar does not say for them.
    expect(drawn.map((entry) => entry.kind))
      .not.toContain('folder')
    expect(drawn.map((entry) => entry.kind)).not.toContain('memory')
  })

  /**
   * It is on the registration and not on the parts, so it is there before the
   * provider has opened anything — which is the whole of the fix.
   */
  it('has it before that provider has opened anything at all', () => {
    expect(registeredChrome().some((entry) => entry.kind === 'drawing')).toBe(true)
    expect(sourceProvider('drawing')?.chrome).toBe(Strip)
  })
})

/**
 * The sentence for the chip that names the source, which only a provider can
 * give for a source this tree has never heard of.
 */
describe('sourceDescription', () => {
  it('is the provider\'s own key for a source it answers for', () => {
    registerSourceProvider({
      kind: 'described',
      describeKey: 'described.kept',
      open: () => ({
        scopes: new InMemoryScopeStore(),
        source: { kind: 'registered', provider: 'described', name: 'Described', key: 'one' },
      }),
    })
    expect(sourceDescription({
      kind: 'registered', provider: 'described', name: 'Described', key: 'one',
    })).toBe('described.kept')
  })

  /** Nothing to guess with, so nothing said: the chip then says only the name. */
  it('is nothing where the provider gave none, and nothing for a kind nobody registered', () => {
    expect(sourceDescription({
      kind: 'registered', provider: 'handed', name: 'Handed', key: 'one',
    })).toBeUndefined()
    expect(sourceDescription({
      kind: 'registered', provider: 'nobody', name: 'Nobody', key: 'one',
    })).toBeUndefined()
  })

  /** The three that ship have their sentences in this tree's own tables. */
  it('says nothing about a built-in kind, whose sentence this tree holds', () => {
    expect(sourceDescription(IN_MEMORY)).toBeUndefined()
    expect(sourceDescription({ kind: 'folder', name: 'work', root: '/work' })).toBeUndefined()
  })
})

/**
 * The lines a provider puts in the app's own menu, and the name it puts on the
 * chip. Both are read from the registration, for the reason the chrome is: a
 * provider is at its most talkative before it is anybody's source.
 */
describe('registeredMenus', () => {
  const lines = () => [{ key: 'in', labelKey: 'lined.signIn', onSelect: () => {} }]

  it('lists every provider that wants lines, and only those', () => {
    registerSourceProvider({
      kind: 'lined',
      menu: lines,
      open: () => ({
        scopes: new InMemoryScopeStore(),
        source: { kind: 'registered', provider: 'lined', name: 'Lined', key: 'one' },
      }),
    })

    const asked = registeredMenus()
    expect(asked.find((entry) => entry.kind === 'lined')?.menu).toBe(lines)
    // The three that ship add nothing: what can be done to a folder is the File
    // menu, and this is not a second place to say it.
    for (const kind of ['folder', 'browserStorage', 'memory']) {
      expect(asked.map((entry) => entry.kind)).not.toContain(kind)
    }
  })

  /** On the registration, so the line that opens a source is there to be pressed. */
  it('has them before that provider has opened anything at all', () => {
    expect(registeredMenus().some((entry) => entry.kind === 'lined')).toBe(true)
    expect(sourceProvider('lined')?.menu).toBe(lines)
  })
})

describe('sourceChip', () => {
  const named = () => ({ label: 'Anna Berg' })

  it('is the provider\'s own for a source it answers for', () => {
    registerSourceProvider({
      kind: 'named',
      chip: named,
      open: () => ({
        scopes: new InMemoryScopeStore(),
        source: { kind: 'registered', provider: 'named', name: 'Named', key: 'one' },
      }),
    })
    expect(sourceChip({
      kind: 'registered', provider: 'named', name: 'Named', key: 'one',
    })).toBe(named)
  })

  /** Then the chip says the name the source was opened under, as it always has. */
  it('is nothing where the provider gave none, and nothing for a kind nobody registered', () => {
    expect(sourceChip({
      kind: 'registered', provider: 'lined', name: 'Lined', key: 'one',
    })).toBeUndefined()
    expect(sourceChip({
      kind: 'registered', provider: 'nobody', name: 'Nobody', key: 'one',
    })).toBeUndefined()
  })

  it('says nothing about a built-in kind, whose chip this tree has always said', () => {
    expect(sourceChip(IN_MEMORY)).toBeUndefined()
    expect(sourceChip({ kind: 'folder', name: 'work', root: '/work' })).toBeUndefined()
  })
})

/**
 * What a provider puts inside *Connect an agent*, which is the open source's
 * alone.
 *
 * The chromes and the menu lines are asked of every registration because a
 * provider that answers for nothing still has a way in to offer; this is the
 * opposite case — the dialog is about reaching the landscape that is open, and
 * nobody else has anything to say about that.
 */
describe('sourceAgentPanel', () => {
  function Panel() {
    return <p>Reach this from anywhere</p>
  }

  it('is the provider\u2019s own for a source it answers for', () => {
    registerSourceProvider({
      kind: 'reachable',
      agentPanel: Panel,
      open: () => ({
        scopes: new InMemoryScopeStore(),
        source: { kind: 'registered', provider: 'reachable', name: 'Reachable', key: 'one' },
      }),
    })
    expect(sourceAgentPanel({
      kind: 'registered', provider: 'reachable', name: 'Reachable', key: 'one',
    })).toBe(Panel)
  })

  /**
   * And nothing for the three that ship or for a provider that gave none: the
   * loopback server is the only way an agent reaches a folder, and this shell
   * already says so.
   */
  it('is nothing for a built-in kind, or a provider that gave none', () => {
    expect(sourceAgentPanel(IN_MEMORY)).toBeUndefined()
    expect(sourceAgentPanel({ kind: 'folder', name: 'work', root: '/work' })).toBeUndefined()
    expect(sourceAgentPanel({
      kind: 'registered', provider: 'lined', name: 'Lined', key: 'one',
    })).toBeUndefined()
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

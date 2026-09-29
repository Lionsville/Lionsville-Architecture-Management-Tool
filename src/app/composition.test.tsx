// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
import { describe, expect, it } from 'vitest'
import { InMemoryPreferencesStore } from '../adapters/memory/InMemoryPreferencesStore'
import { InMemoryScopeStore } from '../adapters/memory/InMemoryScopeStore'
import { RecordingDiagnostics } from '../adapters/memory/RecordingDiagnostics'
import { FakeDirectory } from '../adapters/folder/fakeDirectory'
import { sampleScope, SAMPLE_PATH } from '../ports/ScopeStore.contract'
const IN_MEMORY = { provider: 'memory', name: '', key: '', transient: true } as const
import type { SourceProvider } from '../platform/sourceProvider'
import {
  openSource, registerSourceProvider, registeredChrome, registeredConnects,
  registeredMenus, sourceAgentPanel, sourceChip, sourceChipFace, sourceChipPanel, sourceDescription, sourceProvider,
  sourceSayings,
  type Shell, type SourceBase, type SourceParts,
} from './composition'

/** What a folder is opened with, as much of it as a test here gives. */
type FolderOpening = { handle: FakeDirectory; name: string; root: string }

/**
 * The shell's own side of opening a source, as little of it as a test needs:
 * somewhere to report, and nothing to reuse unless the case is about that.
 */
function opening(shell?: Shell): SourceBase & { diagnostics: RecordingDiagnostics } {
  return { diagnostics: new RecordingDiagnostics(), shell }
}

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
        source: { provider: 'elsewhere', name, key: name, readOnly: true },
      }),
    }
    registerSourceProvider(provider)

    const found = sourceProvider<{ name: string }>('elsewhere')
    expect(found?.connect?.labelKey).toBe('elsewhere.connect')
    expect(found?.statusOf?.({ status: 'clean', editedWhileSaving: true })).toBe('dirty')
    expect(found?.statusOf?.({ status: 'saving', editedWhileSaving: false })).toBe('saving')
    expect((await found?.open({ name: 'Elsewhere' }, opening()))?.source)
      .toEqual({ provider: 'elsewhere', name: 'Elsewhere', key: 'Elsewhere', readOnly: true })
  })

  /**
   * Registering twice is ignored rather than replacing, the way a logo pack
   * is: a test that registers per case is then safe, and a build cannot
   * quietly take over the folder every desktop boot depends on.
   */
  it('keeps the first registration for a kind', () => {
    registerSourceProvider({ kind: 'folder', open: () => ({ source: IN_MEMORY }) })
    expect(sourceProvider('folder')?.open).not.toBe(undefined)
    expect(sourceProvider('folder')?.connect?.labelKey).toBe('picker.chooseFolder')
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
        source: { provider: 'measured', name, key: name },
      }),
    })

    const parts = await openSource('measured', { name: 'Measured' }, opening())

    expect(parts.source).toEqual({ provider: 'measured', name: 'Measured', key: 'Measured' })
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
        source: { provider: 'refusing', name, key: name },
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
        source: { provider: 'handed', name: 'Handed', key: 'one' },
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
        source: { provider: 'awaited', name, key: name, readOnly: true },
      }
    },
  })

  it('is waited for, and what travels with its parts travels anyway', async () => {
    const parts = await openSource('awaited', { name: 'Awaited' }, opening())
    expect(parts.source).toEqual({
      provider: 'awaited', name: 'Awaited', key: 'Awaited', readOnly: true,
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
 * A caller's own answers for the store a source brings (ADR-0022, the ninth
 * amendment).
 *
 * A build composed from this one opens the folder source over a handle of its
 * own and wants one or two answers of its own on top. It used to take the store
 * out of the parts and derive a copy from it by prototype; now it says what it
 * answers for when it opens the source, and the store it gets back is one this
 * file built.
 */
describe('a source opened with a filling of the caller\u2019s own', () => {
  const folder = (): FolderOpening => ({ handle: new FakeDirectory(), name: 'Folder', root: 'folder' })

  it('answers with the filling where it gave one and with the source everywhere else', async () => {
    const parts = await openSource('folder', folder(), opening(), {
      scopes: () => ({ models: () => Promise.resolve([]) }),
    })
    await parts.scopes!.save(sampleScope())
    expect(await parts.scopes!.models!()).toEqual([])
    expect((await parts.scopes!.load(SAMPLE_PATH))?.model.name).toBe('Application landscape')
    expect(parts.source).toEqual({ provider: 'folder', name: 'Folder', key: 'folder' })
  })

  it('hands the filling the store it fills, so an answer can fall back on the source\u2019s', async () => {
    const saved: string[] = []
    const parts = await openSource('folder', folder(), opening(), {
      scopes: (built) => ({ save: (scope) => { saved.push(scope.path); return built.save(scope) } }),
    })
    await parts.scopes!.save(sampleScope())
    expect(saved).toEqual([SAMPLE_PATH])
    expect(await parts.scopes!.load(SAMPLE_PATH)).toBeDefined()
  })

  it('fills the store of a source that answered a promise, too', async () => {
    const parts = await openSource('awaited', { name: 'Awaited' }, opening(), {
      scopes: () => ({ id: 'filled' }),
    })
    expect(parts.scopes?.id).toBe('filled')
    expect(parts.sourceStatus).toBeDefined()
  })

  it('refuses to fill a store the source did not bring', () => {
    registerSourceProvider({
      kind: 'storeless',
      open: () => ({ source: { provider: 'storeless', name: 'Storeless', key: 'one' } }),
    })
    expect(() => openSource('storeless', undefined, opening(), { scopes: () => ({}) }))
      .toThrow(/nowhere to keep a scope/)
  })

  it('leaves the parts exactly as the source built them where no filling is given', async () => {
    const parts = await openSource('memory', undefined, opening())
    expect(parts.scopes?.constructor.name).toBe('InMemoryScopeStore')
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
   * The folder's is offered wherever a folder can be chosen, and says, where
   * a folder is already the source, that it offers another one.
   */
  it('has the folder offer another folder where one is already open', () => {
    const offer = registeredConnects().find((way) => way.kind === 'folder')?.connect.offer
    const location = { href: 'https://example.test/', search: '', hash: '' }
    expect(offer?.({ source: { provider: 'folder', name: 'work', key: '/work' }, location }))
      .toEqual({ labelKey: 'picker.changeFolder' })
    expect(offer?.({ source: IN_MEMORY, location })).toBeUndefined()
  })

  it('lets a provider hide its own way in, or say something else on it', () => {
    registerSourceProvider({
      kind: 'offering',
      connect: {
        labelKey: 'offering.connect',
        open: () => Promise.resolve(undefined),
        offer: ({ source }) => (source.provider === 'offering'
          ? null
          : { labelKey: 'offering.connectInstead' }),
      },
      open: () => ({
        scopes: new InMemoryScopeStore(),
        source: { provider: 'offering', name: 'Offering', key: 'one' },
      }),
    })

    const offer = registeredConnects().find((way) => way.kind === 'offering')?.connect.offer
    const location = { href: 'https://example.test/', search: '', hash: '' }
    expect(offer?.({ source: { provider: 'offering', name: 'O', key: 'one' }, location }))
      .toBeNull()
    expect(offer?.({ source: { provider: 'folder', name: 'work', key: '/work' }, location }))
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
        source: { provider: 'drawing', name: 'Drawing', key: 'one' },
      }),
    })

    const drawn = registeredChrome()
    expect(drawn.find((entry) => entry.kind === 'drawing')?.chrome).toBe(Strip)
    // The folder says what its remote answered, and memory that nothing is kept.
    expect(drawn.map((entry) => entry.kind)).toContain('folder')
    expect(drawn.map((entry) => entry.kind)).toContain('memory')
    expect(drawn.map((entry) => entry.kind)).not.toContain('browserStorage')
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
        source: { provider: 'described', name: 'Described', key: 'one' },
      }),
    })
    expect(sourceDescription({
      provider: 'described', name: 'Described', key: 'one',
    })).toBe('described.kept')
  })

  /** Nothing to guess with, so nothing said: the chip then says only the name. */
  it('is nothing where the provider gave none, and nothing for a kind nobody registered', () => {
    expect(sourceDescription({
      provider: 'handed', name: 'Handed', key: 'one',
    })).toBeUndefined()
    expect(sourceDescription({
      provider: 'nobody', name: 'Nobody', key: 'one',
    })).toBeUndefined()
  })

  /** The three that ship have their sentences in this tree's own tables. */
  it('is the provider\'s own sentence for the three that ship too, with what the chip and the home say', () => {
    expect(sourceDescription(IN_MEMORY)).toBe('shell.sourceTipMemory')
    expect(sourceDescription({ provider: 'folder', name: 'work', key: '/work' })).toBe('shell.sourceTipFolder')
    expect(sourceSayings({ provider: 'folder', name: 'work', key: '/work' })).toEqual({
      labelKey: 'shell.sourceFolder', whereKey: 'folder.where', removeKey: 'picker.deleteBodyFolder',
    })
    expect(sourceSayings({ provider: 'browserStorage', name: '', key: '' })).toEqual({
      labelKey: 'shell.sourceBrowser', whereKey: 'browser.where', removeKey: 'picker.deleteBodyBrowser',
    })
    expect(sourceSayings(IN_MEMORY).labelKey).toBe('shell.sourceMemory')
    expect(sourceSayings({ provider: 'nobody', name: 'x', key: 'x' })).toEqual({})
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
        source: { provider: 'lined', name: 'Lined', key: 'one' },
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
        source: { provider: 'named', name: 'Named', key: 'one' },
      }),
    })
    expect(sourceChip({
      provider: 'named', name: 'Named', key: 'one',
    })).toBe(named)
  })

  /** Then the chip says the name the source was opened under, as it always has. */
  it('is nothing where the provider gave none, and nothing for a kind nobody registered', () => {
    expect(sourceChip({
      provider: 'lined', name: 'Lined', key: 'one',
    })).toBeUndefined()
    expect(sourceChip({
      provider: 'nobody', name: 'Nobody', key: 'one',
    })).toBeUndefined()
  })

  it('says nothing about a built-in kind, whose chip this tree has always said', () => {
    expect(sourceChip(IN_MEMORY)).toBeUndefined()
    expect(sourceChip({ provider: 'folder', name: 'work', key: '/work' })).toBeUndefined()
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
        source: { provider: 'reachable', name: 'Reachable', key: 'one' },
      }),
    })
    expect(sourceAgentPanel({
      provider: 'reachable', name: 'Reachable', key: 'one',
    })).toBe(Panel)
  })

  /**
   * And nothing for the three that ship or for a provider that gave none: the
   * loopback server is the only way an agent reaches a folder, and this shell
   * already says so.
   */
  it('is nothing for a built-in kind, or a provider that gave none', () => {
    expect(sourceAgentPanel(IN_MEMORY)).toBeUndefined()
    expect(sourceAgentPanel({ provider: 'folder', name: 'work', key: '/work' })).toBeUndefined()
    expect(sourceAgentPanel({
      provider: 'lined', name: 'Lined', key: 'one',
    })).toBeUndefined()
  })
})

/**
 * What pressing the chip opens: the open source's provider's own, for the
 * reason the chip is — it names that source, and nobody else's panel belongs
 * under that name.
 */
describe('sourceChipPanel', () => {
  function Panel() {
    return <p>Signed in</p>
  }

  it('is the provider\u2019s own for a source it answers for, and nothing otherwise', () => {
    registerSourceProvider({
      kind: 'pressable',
      chipPanel: Panel,
      open: () => ({
        scopes: new InMemoryScopeStore(),
        source: { provider: 'pressable', name: 'Pressable', key: 'one' },
      }),
    })
    expect(sourceChipPanel({ provider: 'pressable', name: 'Pressable', key: 'one' })).toBe(Panel)
    expect(sourceChipPanel(IN_MEMORY)).toBeUndefined()
    expect(sourceChipPanel({ provider: 'folder', name: 'work', key: '/work' })).toBeUndefined()
    expect(sourceChipPanel({ provider: 'lined', name: 'Lined', key: 'one' })).toBeUndefined()
  })
})

/** What the chip looks like: the open source's provider's own face, and nobody else's. */
describe('sourceChipFace', () => {
  function Face({ label }: { label: string }) {
    return <b>{label}</b>
  }

  it('is the provider\u2019s own for a source it answers for, and nothing otherwise', () => {
    registerSourceProvider({
      kind: 'faced',
      chipFace: Face,
      open: () => ({
        scopes: new InMemoryScopeStore(),
        source: { provider: 'faced', name: 'Faced', key: 'one' },
      }),
    })
    expect(sourceChipFace({ provider: 'faced', name: 'Faced', key: 'one' })).toBe(Face)
    expect(sourceChipFace(IN_MEMORY)).toBeUndefined()
    expect(sourceChipFace({ provider: 'folder', name: 'work', key: '/work' })).toBeUndefined()
    expect(sourceChipFace({ provider: 'lined', name: 'Lined', key: 'one' })).toBeUndefined()
  })
})


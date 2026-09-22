// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The session that leaves nothing behind, and says so.
 *
 * When browser storage refuses at boot the composition swaps in memory stores.
 * Everything then works — and nothing survives the tab. Because those stores
 * never fail, `useStorageNotice` is never called and the user was told
 * precisely nothing; they would find out on the next morning's first coffee.
 *
 * A standing notice rather than a toast: it is true for the whole session, not
 * an event within it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { laidOut } from '../model/testFixtures';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { scopeTree } from '../projects/scope'
import { registerStrings, useStrings } from '../i18n'
import type { SourceStatus } from '../platform/sourceProvider'
import type { AgentAnswer, AgentRequest } from '../agent/tools'
import type { AgentGateway } from '../ports/AgentGateway'
import type { ScopeSession } from './useModelSession'
import type { Destination } from '../agent/screen'
import { InMemoryScopeStore } from '../adapters/memory/InMemoryScopeStore'
import { renderApp } from './testing/renderShell'

afterEach(() => cleanup())

/**
 * A provider's *ask me again*, told to every listener.
 *
 * This shell asks the same source in more than one place — the word on the bar,
 * the chip, and which ways in are worth drawing — and one signal means all of
 * them. A fake that kept only the last listener would pass whichever test
 * happened to subscribe last, which is not what a provider is being asked to
 * implement.
 */
function asksAgain() {
  const listeners = new Set<() => void>()
  return {
    onSourceWork: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    tell: () => act(() => { for (const listener of [...listeners]) listener() }),
  }
}

describe('App and the storage it was given', () => {
  it('shows the notice from the first render when nothing will be kept', () => {
    renderApp({ source: { kind: 'memory' } })
    expect(screen.getByTestId('storage-notice').textContent)
      .toContain('This browser could not save the design')
  })

  it('says nothing when storage works, which is the ordinary case', () => {
    renderApp({ source: { kind: 'browserStorage' } })
    expect(screen.queryByTestId('storage-notice')).toBeNull()
  })

  it('assumes storage works when nobody said otherwise', () => {
    renderApp()
    expect(screen.queryByTestId('storage-notice')).toBeNull()
  })
})

describe('what the root’s home says you are working from', () => {
  // The source is a fact about the folder, and the folder is the root: the
  // root's home says it, and the workspace's bar — which has crumbs where
  // the source used to be — does not. The memory case is the one where
  // saying so matters most: the strip at the foot says it, and so does the
  // home.
  const project = {
    path: 'acme/landscape',
    model: {
      name: 'Landscape', elements: [], relations: [],
      diagrams: [laidOut({ id: 'd1', kind: 'layer7' as const, name: 'L7', placements: [] })],
    },
    activeDiagramId: 'd1',
    logoLibrary: [],
  }

  it('names the folder', () => {
    renderApp({ source: { kind: 'folder', name: 'Architecture', root: '/Users/someone/Architecture' } })
    expect(screen.getByTestId('working-source').textContent).toBe('Folder · Architecture')
  })

  /** The sentence per built-in kind, which this tree holds and always has. */
  it('says what a folder costs you when you hover the chip', async () => {
    renderApp({ source: { kind: 'folder', name: 'Architecture', root: '/Users/someone/Architecture' } })
    fireEvent.mouseOver(screen.getByTestId('working-source'))
    expect((await screen.findByRole('tooltip')).textContent)
      .toBe('Your projects are files in this folder. Snapshots go into its history.')
  })

  it('says when it is the browser, and when it is nowhere', () => {
    renderApp({ source: { kind: 'browserStorage' } })
    expect(screen.getByTestId('working-source').textContent).toBe('In this browser')
    cleanup()
    renderApp({ source: { kind: 'memory' } })
    expect(screen.getByTestId('working-source').textContent).toBe('Not kept anywhere')
    expect(screen.getByTestId('storage-notice')).toBeDefined()
  })

  it('keeps it off the bar over an open scope, where the crumbs are', () => {
    renderApp({ initialProject: project, source: { kind: 'memory' } })
    expect(screen.queryByTestId('working-source')).toBeNull()
    expect(screen.getByTestId('storage-notice')).toBeDefined()
  })
})

/**
 * A source a provider registered (`platform/sourceProvider.ts`).
 *
 * Nothing in this tree knows what kind of place it is, which is the point: the
 * bar calls it what its provider called it, and whether work may be written
 * there is the source's own answer rather than the constant the workspace
 * passed while a folder was the only thing a source could be.
 */
describe('a source a provider answers for', () => {
  const elsewhere = {
    kind: 'registered' as const, provider: 'elsewhere', name: 'Elsewhere', key: 'one',
  }
  const scope = {
    path: 'acme/landscape',
    model: {
      name: 'Landscape', elements: [], relations: [],
      diagrams: [laidOut({ id: 'd1', kind: 'layer7' as const, name: 'L7', placements: [] })],
    },
    activeDiagramId: 'd1',
    logoLibrary: [],
  }

  it('is called on the home what its provider called it, with no word of ours in front', () => {
    renderApp({ source: elsewhere })
    expect(screen.getByTestId('working-source').textContent).toBe('Elsewhere')
    // Not the nothing-is-kept strip: that is memory's, and this keeps things.
    expect(screen.queryByTestId('storage-notice')).toBeNull()
  })

  it('offers what a folder offers when it writes', async () => {
    renderApp({ initialProject: scope, source: elsewhere })
    fireEvent.click(await screen.findByText('Roadmap'))
    expect(await screen.findByText('New plan')).toBeDefined()
  })

  /**
   * The bar asks the provider again when the provider says so, and a provider
   * with work of its own outstanding has nothing else to hang that on: no
   * keystroke, no write, nothing the document's own machine can see.
   */
  it('says what the provider now says, without the document\u2019s machine moving', async () => {
    let held: SourceStatus = 'clean'
    const asked = asksAgain()
    renderApp({
      initialProject: scope,
      source: elsewhere,
      sourceStatus: () => held,
      onSourceWork: asked.onSourceWork,
    })
    const bar = await screen.findByTestId('saved-indicator')
    expect(bar.textContent).toBe('Not saved yet')

    held = 'dirty'
    asked.tell()
    expect(screen.getByTestId('saved-indicator').textContent).toBe('Unsaved changes')
  })

  /**
   * And it says where work is kept in the provider's own words, from the
   * provider's own table. There is a sentence per built-in kind because this
   * tree knows what a folder and a browser's storage cost you; what a registered
   * source costs you is the one thing only its provider can say.
   */
  it('describes where work is kept in the provider\'s own sentence', async () => {
    registerStrings('en', { 'elsewhere.kept': 'Your work is kept elsewhere, and elsewhere says when.' })
    renderApp({ source: elsewhere, sourceDescription: 'elsewhere.kept' })
    fireEvent.mouseOver(screen.getByTestId('working-source'))
    expect((await screen.findByRole('tooltip')).textContent)
      .toBe('Your work is kept elsewhere, and elsewhere says when.')
  })

  /**
   * And nothing at all where the provider gave none: a sentence of ours about
   * somewhere this shell has never heard of could promise a copy that cannot be
   * made or a folder that does not exist.
   */
  it('says nothing about where work is kept where the provider gave no sentence', async () => {
    renderApp({ source: elsewhere })
    fireEvent.mouseOver(screen.getByTestId('working-source'))
    await act(() => Promise.resolve())
    expect(screen.queryByRole('tooltip')).toBeNull()
    // The chip itself is still there, saying what the provider called it.
    expect(screen.getByTestId('working-source').textContent).toBe('Elsewhere')
  })

  it('hides what writes when it says it only reads', async () => {
    renderApp({ initialProject: scope, source: { ...elsewhere, readOnly: true } })
    fireEvent.click(await screen.findByText('Roadmap'))
    // The page is up; what is missing is the one thing on it that writes.
    expect(await screen.findByText('Roadmap', { selector: 'p' })).toBeDefined()
    expect(screen.queryByText('New plan')).toBeNull()
  })
})

/**
 * The chrome a registered provider brought.
 *
 * A provider's way in is a label this shell draws a button from and its words
 * about the work are five the bar already says — but a source that has something
 * of its own to show had nowhere in this tree to show it. The only place left
 * was a container on `document.body`: outside the theme, outside the language,
 * and over or under whatever the app had drawn. So the app draws it, beside its
 * own notices, and hands it the scope that is open while one is.
 *
 * One per REGISTRATION, and drawn whether or not that provider answers for the
 * source that is open: the press that opens a source happens while that
 * provider is nobody's source, so a chrome that waited for its own source to be
 * open was a connect dialog with nowhere to be. The session is what tells the
 * two apart.
 */
describe('the chrome a registered provider brought', () => {
  const elsewhere = {
    kind: 'registered' as const, provider: 'elsewhere', name: 'Elsewhere', key: 'one',
  }
  const scope = {
    path: 'acme/landscape',
    model: {
      name: 'Landscape', elements: [], relations: [],
      diagrams: [laidOut({ id: 'd1', kind: 'layer7' as const, name: 'L7', placements: [] })],
    },
    activeDiagramId: 'd1',
    logoLibrary: [],
  }

  /** A strip of a provider's own: what it says, and what it was told. */
  function Strip({ session }: { session?: ScopeSession }) {
    const { language } = useStrings()
    return (
      <p data-testid="provider-strip">
        {`${language}: ${session ? session.scope : 'nothing open'}`}
      </p>
    )
  }

  it('is drawn with nothing open, where the source is still the source', () => {
    renderApp({ source: elsewhere, chrome: [{ kind: 'elsewhere', chrome: Strip }] })
    expect(screen.getByTestId('provider-strip').textContent).toBe('en: nothing open')
    // Beside the app's own screen rather than instead of it.
    expect(screen.getByTestId('working-source').textContent).toBe('Elsewhere')
  })

  it('is handed the session of the scope that is open, and told when it closes', async () => {
    renderApp({
      initialProject: scope, source: elsewhere, chrome: [{ kind: 'elsewhere', chrome: Strip }],
    })
    await waitFor(() => {
      expect(screen.getByTestId('provider-strip').textContent).toBe('en: acme/landscape')
    })
    // Back to the organisation: the workspace lets the session go, and so does
    // the strip — a strip naming a session whose model has been unmounted would
    // be a strip describing something that is not there.
    fireEvent.click(screen.getByTestId('crumb-'))
    await waitFor(() => {
      expect(screen.getByTestId('provider-strip').textContent).toBe('en: nothing open')
    })
  })

  /** Inside the app's language, which is the whole reason it is not on `body`. */
  it('renders in the language the app is in', () => {
    renderApp({ source: elsewhere, chrome: [{ kind: 'elsewhere', chrome: Strip }] }, { language: 'nl' })
    expect(screen.getByTestId('provider-strip').textContent).toBe('nl: nothing open')
  })

  /**
   * And the subscription the provider already had is untouched: the shell holds
   * the session for the chrome beside handing it over, never instead of it.
   */
  it('leaves the provider\'s own subscription exactly where it was', async () => {
    const seen: string[] = []
    renderApp({
      initialProject: scope,
      source: elsewhere,
      chrome: [{ kind: 'elsewhere', chrome: Strip }],
      onScopeSession: (session) => {
        seen.push(session.scope)
        return () => seen.push('let go')
      },
    })
    await waitFor(() => expect(seen).toEqual(['acme/landscape']))
  })

  /** Every build in this repository: nothing registered, nothing drawn. */
  it('draws nothing where no provider registered one', () => {
    renderApp({ source: elsewhere })
    expect(screen.queryByTestId('provider-strip')).toBeNull()
  })

  /**
   * The case the strip exists for: a provider that is not the source at all.
   *
   * A way in is pressed on a screen where work is still kept in a folder, so the
   * dialog that asks where to connect to has to be drawn by a provider that
   * answers for nothing yet. Drawn, and handed no session — there is none of its
   * to hand.
   */
  it('is drawn for a provider that answers for nothing here', () => {
    renderApp({
      source: { kind: 'folder', name: 'Architecture', root: '/work' },
      chrome: [{ kind: 'elsewhere', chrome: Strip }],
    })
    expect(screen.getByTestId('provider-strip').textContent).toBe('en: nothing open')
    expect(screen.getByTestId('working-source').textContent).toBe('Folder \u00b7 Architecture')
  })

  /**
   * Two registrations, one open source: both draw, and the session goes to the
   * provider that answers for the source and to nobody else. A strip handed
   * somebody else's session would be describing a document its provider has
   * never seen.
   */
  it('hands the session to the provider whose source is open, and to no other', async () => {
    function Other({ session }: { session?: ScopeSession }) {
      return <p data-testid="other-strip">{session ? session.scope : 'nothing open'}</p>
    }
    renderApp({
      initialProject: scope,
      source: elsewhere,
      chrome: [{ kind: 'elsewhere', chrome: Strip }, { kind: 'other', chrome: Other }],
    })
    await waitFor(() => {
      expect(screen.getByTestId('provider-strip').textContent).toBe('en: acme/landscape')
    })
    expect(screen.getByTestId('other-strip').textContent).toBe('nothing open')
  })

  /**
   * A boundary of its own, for the reason the canvas has one: a strip somebody
   * else wrote falling over costs the strip and not the window.
   */
  it('falls over on its own, with the app still standing', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      renderApp({
        source: elsewhere,
        chrome: [{ kind: 'elsewhere', chrome: () => { throw new Error('the strip fell over') } }],
      })
      expect(screen.getByTestId('crash-fallback')).toBeDefined()
      expect(screen.getByTestId('working-source').textContent).toBe('Elsewhere')
    } finally {
      spy.mockRestore()
    }
  })

  /**
   * The way out of a notice (ADR-0022, eighth amendment).
   *
   * A strip that names where the work it is about is kept, and cannot take the
   * person there, is a sentence asking them to go and find it in the tree. It is
   * handed the same `open` the agent drives the app with, so the path in the
   * sentence is the pressable part of it.
   */
  function Notice({ open, to }: { open: (to: Destination) => void; to: Destination }) {
    return (
      <button type="button" data-testid="provider-open" onClick={() => open(to)}>
        open the board
      </button>
    )
  }

  it('is handed a way to a scope, and takes the person there', async () => {
    renderApp({
      scopes: new InMemoryScopeStore([scope]),
      source: elsewhere,
      chrome: [{
        kind: 'elsewhere',
        chrome: ({ open }) => <Notice open={open} to={{ scope: 'acme/landscape' }} />,
      }],
    })
    // Nothing is open: the home is up, and the strip is the way off it.
    expect(screen.getByTestId('working-source')).toBeDefined()
    fireEvent.click(screen.getByTestId('provider-open'))
    await waitFor(() => {
      expect(screen.getByTestId('crumb-current').textContent).toBe('Landscape')
    })
  })

  /**
   * No scope named is the scope that is open, which is what it means to the
   * agent — a provider's notice is usually about the landscape in front of the
   * person, and a second grammar for the same three words is what this avoids.
   */
  it('takes the scope that is open where the destination names none', async () => {
    renderApp({
      scopes: new InMemoryScopeStore([scope]),
      initialProject: scope,
      source: elsewhere,
      chrome: [{
        kind: 'elsewhere',
        chrome: ({ open }) => <Notice open={open} to={{ page: 'roadmap' }} />,
      }],
    })
    fireEvent.click(screen.getByTestId('provider-open'))
    expect(await screen.findByText('Roadmap', { selector: 'p' })).toBeDefined()
    expect(screen.getByTestId('crumb-current').textContent).toBe('Landscape')
  })

  /** A boundary EACH, so one provider's strip does not cost the next one's. */
  it('leaves the next provider\'s strip standing when one falls over', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      renderApp({
        source: elsewhere,
        chrome: [
          { kind: 'falls', chrome: () => { throw new Error('the strip fell over') } },
          { kind: 'elsewhere', chrome: Strip },
        ],
      })
      expect(screen.getByTestId('crash-fallback')).toBeDefined()
      expect(screen.getByTestId('provider-strip').textContent).toBe('en: nothing open')
    } finally {
      spy.mockRestore()
    }
  })
})

/**
 * The way in a registered provider brought.
 *
 * The provider owns the dialog and the shell owns the button, so what the shell
 * owes is a button per way in, labelled what the provider said, and the press
 * arriving where the provider is composed. Core registers no such provider, so
 * the list is empty in every build here — what is tested is that a build which
 * registers one is offered on the two screens that ask where work should live.
 */
describe('a way in a registered provider brought', () => {
  const waysIn = [
    { kind: 'elsewhere', labelKey: 'Connect to elsewhere\u2026', onConnect: () => {} },
    { kind: 'somewhere', labelKey: 'Connect to somewhere\u2026', onConnect: () => {} },
  ]

  it('is a button each on the root\u2019s home, beside the one that chooses a folder', () => {
    renderApp({ waysIn, onChooseWorkingDirectory: () => {} })
    expect(screen.getByTestId('connect-source-elsewhere').textContent).toBe('Connect to elsewhere\u2026')
    expect(screen.getByTestId('connect-source-somewhere').textContent).toBe('Connect to somewhere\u2026')
    expect(screen.getByText('Choose folder\u2026')).toBeDefined()
  })

  it('presses through to whoever registered it', () => {
    let pressed = ''
    renderApp({ waysIn: [{ ...waysIn[0], onConnect: () => { pressed = 'elsewhere' } }] })
    fireEvent.click(screen.getByTestId('connect-source-elsewhere'))
    expect(pressed).toBe('elsewhere')
  })

  /**
   * The screen that asks where work should live at all. A desktop composed with
   * a provider of its own and offered only a folder would be offered the one
   * thing that build exists not to use.
   */
  it('is offered on the first-run screen too', () => {
    renderApp({ waysIn, needsFolder: true, onChooseWorkingDirectory: () => {} })
    expect(screen.getByTestId('choose-folder')).toBeDefined()
    expect(screen.getByTestId('connect-source-elsewhere')).toBeDefined()
  })

  /**
   * And is not asked again once it has been answered: a source a provider
   * answers for keeps work as surely as a folder does.
   */
  it('leaves the first-run screen behind once a source is open', () => {
    renderApp({
      waysIn,
      needsFolder: true,
      onChooseWorkingDirectory: () => {},
      source: { kind: 'registered', provider: 'elsewhere', name: 'Elsewhere', key: 'one' },
    })
    expect(screen.queryByTestId('choose-folder')).toBeNull()
    expect(screen.getByTestId('working-source').textContent).toBe('Elsewhere')
  })

  /** Nothing registered, nothing drawn: every build in this repository. */
  it('draws nothing where a build registered none', () => {
    renderApp({ onChooseWorkingDirectory: () => {} })
    expect(screen.queryByTestId('connect-source-elsewhere')).toBeNull()
  })

  /**
   * And it is asked whether it is worth drawing where it is about to be drawn.
   *
   * A standing button per registration is right on a screen asking where work
   * should live for the first time, and wrong for the provider that already
   * answers for the open source: *connect to…* then offers a person the place
   * they are already working from, and pressing it shakes the same hand again to
   * arrive where they already are. Only the provider can tell those apart.
   */
  const open = { kind: 'registered' as const, provider: 'elsewhere', name: 'Elsewhere', key: 'one' }

  it('is not drawn at all where its provider says not here', () => {
    renderApp({
      source: open,
      waysIn: [{ ...waysIn[0], offer: () => null }, waysIn[1]],
      onChooseWorkingDirectory: () => {},
    })
    expect(screen.queryByTestId('connect-source-elsewhere')).toBeNull()
    // Its own button and nobody else's: the other provider's stands, and so does
    // the folder's, which is offered wherever a folder can be chosen.
    expect(screen.getByTestId('connect-source-somewhere')).toBeDefined()
    expect(screen.getByText('Choose folder\u2026')).toBeDefined()
  })

  it('says what its provider now says on it, where it gave a word', () => {
    renderApp({
      source: open,
      waysIn: [{ ...waysIn[0], offer: () => ({ labelKey: 'Sign in to elsewhere\u2026' }) }],
      onChooseWorkingDirectory: () => {},
    })
    expect(screen.getByTestId('connect-source-elsewhere').textContent).toBe('Sign in to elsewhere\u2026')
  })

  it('is told which source is open when it is asked', () => {
    const asked: unknown[] = []
    renderApp({
      source: open,
      waysIn: [{ ...waysIn[0], offer: (source) => { asked.push(source); return null } }],
    })
    expect(asked[0]).toEqual(open)
  })

  /**
   * Asked again on the provider's own *ask me again*, which is the signal the
   * chip and the bar are re-read on: signing out of somewhere is exactly the
   * moment its way in becomes worth offering again, and no keystroke happens.
   */
  it('asks again when the provider says its answer has moved', () => {
    let said: { labelKey: string } | null = null
    const asked = asksAgain()
    renderApp({
      source: open,
      waysIn: [{ ...waysIn[0], offer: () => said }],
      onSourceWork: asked.onSourceWork,
      onChooseWorkingDirectory: () => {},
    })
    expect(screen.queryByTestId('connect-source-elsewhere')).toBeNull()

    said = { labelKey: 'Sign in to elsewhere\u2026' }
    asked.tell()
    expect(screen.getByTestId('connect-source-elsewhere').textContent).toBe('Sign in to elsewhere\u2026')
  })

  /**
   * A provider's own code runs while a screen draws, so one that throws costs
   * its own button the label it asked for and nothing else: the button stands as
   * it was registered, and the trail takes the cause.
   */
  it('stands as registered where the provider throws, with the cause in the trail', () => {
    const { diagnostics } = renderApp({
      source: open,
      waysIn: [{ ...waysIn[0], offer: () => { throw new Error('asked too soon') } }, waysIn[1]],
      onChooseWorkingDirectory: () => {},
    })
    expect(screen.getByTestId('connect-source-elsewhere').textContent).toBe('Connect to elsewhere\u2026')
    expect(screen.getByTestId('connect-source-somewhere')).toBeDefined()
    expect(diagnostics.messages()).toContain('elsewhere')
  })
})

/**
 * What a refused write says, where the source is not this browser.
 *
 * Our sentence is *this browser could not save the design (storage full or
 * blocked)*, which is right for the three sources that ship and wrong for
 * anywhere else: it names the wrong place, blames a quota that is not the one
 * that ran out, and tells somebody to keep a working file when the copy that
 * matters is somewhere else. Only the provider knows what its store said no for.
 */
describe('a refusal where the source keeps work', () => {
  const elsewhere = {
    kind: 'registered' as const, provider: 'elsewhere', name: 'Elsewhere', key: 'one',
  }

  /**
   * A store that will not read, and the act that reports it through the notice:
   * copying the example into this scope has to read before it writes, and a read
   * that refuses is a store refusing.
   */
  function refuse(over: Partial<Parameters<typeof renderApp>[0]> = {}) {
    return renderApp({
      source: elsewhere,
      scopes: {
        list: () => Promise.resolve(scopeTree([])),
        load: () => Promise.reject(new Error('signed out')),
        save: () => Promise.resolve(),
        remove: () => Promise.resolve(),
      },
      examples: [{
        key: 'acme',
        path: 'acme/landscape',
        label: 'Acme Logistics',
        description: 'an example',
        folder: {
          'scope.json': {
            type: 'lionsville-architecture', version: 5, name: 'Warehouse landscape',
            activeDiagramId: 'l7', diagrams: ['l7'],
          },
          'model.json': { elements: [], relations: [] },
          'diagrams/l7.json': { id: 'l7', kind: 'layer7', name: 'Landscape', members: [] },
          'diagrams/l7.geometry.json': { nodes: [] },
        },
      }],
      ...over,
    })
  }

  const copy = async () => fireEvent.click(await screen.findByText('Copy into this folder\u2026'))

  it('says the provider\u2019s sentence instead of ours', async () => {
    refuse({ storageFailure: () => 'Elsewhere is not taking changes: sign in again.' })
    await copy()
    await waitFor(() => expect(screen.getByRole('alert').textContent)
      .toContain('Elsewhere is not taking changes'))
    expect(screen.getByRole('alert').textContent).not.toContain('could not save the design')
  })

  /**
   * And nothing where the provider answered nothing: it has said so somewhere of
   * its own, and two sentences for one refusal read as two failures.
   */
  it('says nothing where the provider answered nothing', async () => {
    const { diagnostics } = refuse({ storageFailure: () => undefined })
    await copy()
    // The failure still reached the trail, which is where a failure always goes.
    await waitFor(() => expect(diagnostics.recent()
      .some((entry) => entry.where === 'organisation.copyExample')).toBe(true))
    expect(screen.queryByText(/could not save the design/)).toBeNull()
  })

  /** And the three that ship say what they have always said, byte for byte. */
  it('says what it has always said where the source gives no sentence', async () => {
    refuse({ source: { kind: 'browserStorage' } })
    await copy()
    await waitFor(() => expect(screen.getByRole('alert').textContent)
      .toContain('could not save the design'))
  })
})

/**
 * A gateway that keeps whoever subscribed, so a test can ask as an agent
 * would. The same fake as `App.driving.test.tsx`'s, cut to what is asked here.
 */
function listeningGateway() {
  let handler: ((request: AgentRequest) => Promise<AgentAnswer>) | undefined
  const connected = {
    kind: 'connected' as const, port: 51733, token: 't'.repeat(24),
    client: { name: 'Claude Code', version: '2.0' },
  }
  const gateway: AgentGateway = {
    id: 'fake',
    on(next) { handler = next; return () => { if (handler === next) handler = undefined } },
    status: () => Promise.resolve(connected),
    onStatus: () => () => {},
    configure: () => Promise.resolve(connected),
    newToken: () => Promise.resolve(connected),
  }
  let n = 0
  return {
    gateway,
    bound: () => handler !== undefined,
    ask: (tool: string, args: unknown = {}): Promise<AgentAnswer> => {
      if (!handler) throw new Error('nobody is listening')
      return handler({ id: `r${n += 1}`, tool, args })
    },
  }
}

/**
 * An agent can do what a person can (ADR-0011) — and no more. A source that
 * says work here is only read is the one fact that has to reach the agent as
 * well as the buttons: `agent.readOnly` was a refusal nothing had ever
 * answered until a source could say no.
 */
describe('an agent on a source that only reads', () => {
  const readOnly = {
    kind: 'registered' as const,
    provider: 'elsewhere', name: 'Elsewhere', key: 'one', readOnly: true,
  }
  const scope = {
    path: 'acme/landscape',
    model: {
      name: 'Landscape',
      elements: [{ id: 'billing', kind: 'application' as const, name: 'Billing', lifecycle: 'live' as const, isManaged: true, aspects: {} }],
      relations: [],
      diagrams: [laidOut({ id: 'd1', kind: 'layer7' as const, name: 'L7', placements: [{ id: 'billing', x: 0, y: 0 }] })],
    },
    activeDiagramId: 'd1',
    logoLibrary: [],
  }

  async function open(source: typeof readOnly | undefined) {
    const wire = listeningGateway()
    renderApp({ initialProject: scope, agent: wire.gateway, ...(source ? { source } : {}) })
    await waitFor(() => expect(wire.bound()).toBe(true))
    return wire
  }

  it('refuses a write, and still answers a read', async () => {
    const { ask } = await open(readOnly)
    const refused = await ask('element.add', { kind: 'application', name: 'Ledger' })
    expect(refused.ok).toBe(false)
    expect(refused.ok === false && refused.refusal).toBe('agent.readOnly')
    // Looking is not writing: the tree, the landscape and the reports still answer.
    expect((await ask('elements.list')).ok).toBe(true)
  })

  it('refuses nothing where the source writes', async () => {
    const { ask } = await open(undefined)
    expect((await ask('element.add', { kind: 'application', name: 'Ledger' })).ok).toBe(true)
  })
})

/**
 * The lines a provider puts in the app's own menu.
 *
 * A provider with actions of its own — somewhere to sign in, pages of its own,
 * something to do to the scope that is open — has two places to put them: the
 * menu this app already has, or a strip of its own floating over it. The second
 * is a second place to look for what can be done here, so the seam is lines and
 * not a screen: the provider says what it offers, the shell draws it the way it
 * draws its own, and the section comes after everything of ours.
 */
describe('the lines a registered provider puts in the menu', () => {
  const elsewhere = {
    kind: 'registered' as const, provider: 'elsewhere', name: 'Elsewhere', key: 'one',
  }
  const scope = {
    path: 'acme/landscape',
    model: {
      name: 'Landscape', elements: [], relations: [],
      diagrams: [laidOut({ id: 'd1', kind: 'layer7' as const, name: 'L7', placements: [] })],
    },
    activeDiagramId: 'd1',
    logoLibrary: [],
  }

  const open = () => fireEvent.click(screen.getByTestId('overflow-button'))
  const provided = () => [...document.querySelectorAll('[data-testid^="source-entry-"]')]

  it('draws them in their own section after ours, and fires what a press means', () => {
    registerStrings('en', {
      'elsewhere.account': 'Your account…',
      'elsewhere.pages': 'Open elsewhere',
    })
    const pressed: string[] = []
    renderApp({
      source: elsewhere,
      sourceMenu: [{
        kind: 'elsewhere',
        menu: () => [
          { key: 'account', labelKey: 'elsewhere.account', onSelect: () => pressed.push('account') },
          {
            key: 'pages', labelKey: 'elsewhere.pages', divider: true,
            onSelect: () => pressed.push('pages'),
          },
        ],
      }],
    })
    open()
    const lines = provided()
    expect(lines.map((line) => line.textContent)).toEqual(['Your account…', 'Open elsewhere'])
    // After everything of ours: the last of our own items comes before the first
    // of theirs, wherever in the list it happens to be.
    const items = [...document.querySelectorAll('[data-testid="overflow-menu"] li')]
    expect(items.indexOf(lines[0])).toBeGreaterThan(items.indexOf(items.find((item) => item.textContent === 'Preferences…')!))

    fireEvent.click(lines[1])
    open()
    fireEvent.click(provided()[0])
    expect(pressed).toEqual(['pages', 'account'])
  })

  /**
   * A line that is a way somewhere is told how to go there (ADR-0022, eighth
   * amendment): the same `open` a chrome is handed, so *Open the board* is one
   * line and not a sentence about the tree.
   */
  it('tells a line how to send the person to a scope', async () => {
    registerStrings('en', { 'elsewhere.board': 'Open the board' })
    renderApp({
      scopes: new InMemoryScopeStore([scope]),
      source: elsewhere,
      sourceMenu: [{
        kind: 'elsewhere',
        menu: ({ open: go }) => [{
          key: 'board',
          labelKey: 'elsewhere.board',
          onSelect: () => go({ scope: 'acme/landscape' }),
        }],
      }],
    })
    open()
    fireEvent.click(provided()[0])
    await waitFor(() => {
      expect(screen.getByTestId('crumb-current').textContent).toBe('Landscape')
    })
  })

  /** Core's three register none, and the menu is then character for character the menu. */
  it('adds nothing at all for the sources that ship', () => {
    renderApp({ source: { kind: 'browserStorage' } })
    open()
    expect(provided()).toEqual([])
  })

  /**
   * Asked when the menu opens and again when the provider says its own answer
   * has moved — a handshake finishing behind an open menu is the case a list
   * held from the first open would get wrong.
   */
  it('asks again while the menu is open, when the provider says so', () => {
    registerStrings('en', { 'elsewhere.signIn': 'Sign in…', 'elsewhere.signedIn': 'Anna Berg' })
    let signedIn = false
    let tell: (() => void) | undefined
    renderApp({
      source: elsewhere,
      onSourceWork: (listener) => { tell = listener; return () => { tell = undefined } },
      sourceMenu: [{
        kind: 'elsewhere',
        menu: () => [{
          key: 'who',
          labelKey: signedIn ? 'elsewhere.signedIn' : 'elsewhere.signIn',
          onSelect: () => {},
        }],
      }],
    })
    open()
    expect(screen.getByTestId('source-entry-who').textContent).toBe('Sign in…')

    signedIn = true
    act(() => tell?.())
    expect(screen.getByTestId('source-entry-who').textContent).toBe('Anna Berg')
  })

  /**
   * The provider is told the two things it has to know before it decides: the
   * scope that is open as it sees it, and whether work here may be written at
   * all. The session goes to the provider whose source is open and to no other,
   * which is the rule the chrome is drawn by.
   */
  it('tells the provider whose source is open about the scope, and the others nothing', async () => {
    const seen: { kind: string; hasSession: boolean; readOnly: boolean }[] = []
    const watcher = (kind: string) => ({
      kind,
      menu: (context: { session?: ScopeSession; readOnly: boolean }) => {
        seen.push({ kind, hasSession: context.session !== undefined, readOnly: context.readOnly })
        return []
      },
    })
    renderApp({
      initialProject: scope,
      source: { ...elsewhere, readOnly: true },
      sourceMenu: [watcher('elsewhere'), watcher('other')],
    })
    await screen.findByTestId('shell-toolbar')
    open()
    expect(seen).toEqual([
      { kind: 'elsewhere', hasSession: true, readOnly: true },
      { kind: 'other', hasSession: false, readOnly: true },
    ])
  })

  /** A provider's own code runs here, so a provider that throws costs its own lines. */
  it('keeps the rest of the menu when a provider’s lines throw', () => {
    registerStrings('en', { 'elsewhere.account': 'Your account…' })
    const { diagnostics } = renderApp({
      source: elsewhere,
      sourceMenu: [
        { kind: 'falls', menu: () => { throw new Error('asked at a bad moment') } },
        {
          kind: 'elsewhere',
          menu: () => [{ key: 'account', labelKey: 'elsewhere.account', onSelect: () => {} }],
        },
      ],
    })
    open()
    expect(provided().map((line) => line.textContent)).toEqual(['Your account…'])
    expect(diagnostics.recent().some((entry) => entry.where === 'sourceMenu')).toBe(true)
  })
})

/**
 * The chip that names the source, in the provider's words.
 *
 * `WorkingSource.name` is what the source was called when it was opened, and for
 * a source somebody has to be known to before it answers anything that word is
 * decided at the handshake — who is signed in is an answer that arrives after it
 * and moves again while the window is open.
 */
describe('the chip a registered provider names', () => {
  const elsewhere = {
    kind: 'registered' as const, provider: 'elsewhere', name: 'Elsewhere', key: 'one',
  }

  it('says the provider’s word rather than the name the source was opened under', async () => {
    registerStrings('en', { 'elsewhere.signedIn': 'Signed in as Anna Berg.' })
    renderApp({
      source: elsewhere,
      sourceChip: () => ({ label: 'Anna Berg', tipKey: 'elsewhere.signedIn' }),
    })
    expect(screen.getByTestId('working-source').textContent).toBe('Anna Berg')
    fireEvent.mouseOver(screen.getByTestId('working-source'))
    expect((await screen.findByRole('tooltip')).textContent).toBe('Signed in as Anna Berg.')
  })

  it('asks again when the provider says its own answer has moved', () => {
    let label = 'Not signed in'
    const asked = asksAgain()
    renderApp({
      source: elsewhere,
      sourceChip: () => ({ label }),
      onSourceWork: asked.onSourceWork,
    })
    expect(screen.getByTestId('working-source').textContent).toBe('Not signed in')

    label = 'Anna Berg'
    asked.tell()
    expect(screen.getByTestId('working-source').textContent).toBe('Anna Berg')
  })

  /**
   * And it is something to press where the provider gave something to press — a
   * real button, because this bar is the window's drag surface on the desktop
   * and the rule that keeps a control clickable in it names elements.
   */
  it('runs what the provider gave it to do when it is pressed', () => {
    const pressed: number[] = []
    renderApp({
      source: elsewhere,
      sourceChip: () => ({ label: 'Anna Berg', onClick: () => pressed.push(1) }),
    })
    const chip = screen.getByTestId('working-source')
    expect(chip.tagName).toBe('BUTTON')
    fireEvent.click(chip)
    expect(pressed).toEqual([1])
  })

  /** And stays what it was where no provider gave a chip at all. */
  it('is the name it was opened under, and a fact and not a control, with no chip', () => {
    renderApp({ source: elsewhere })
    const chip = screen.getByTestId('working-source')
    expect(chip.textContent).toBe('Elsewhere')
    expect(chip.tagName).not.toBe('BUTTON')
  })
})

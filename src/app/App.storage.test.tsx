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
import { useStrings } from '../i18n'
import type { SourceStatus } from '../platform/sourceProvider'
import type { AgentAnswer, AgentRequest } from '../agent/tools'
import type { AgentGateway } from '../ports/AgentGateway'
import type { ScopeSession } from './useModelSession'
import { renderApp } from './testing/renderShell'

afterEach(() => cleanup())

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
    let tell: (() => void) | undefined
    renderApp({
      initialProject: scope,
      source: elsewhere,
      sourceStatus: () => held,
      onSourceWork: (listener) => { tell = listener; return () => { tell = undefined } },
    })
    const bar = await screen.findByTestId('saved-indicator')
    expect(bar.textContent).toBe('Not saved yet')

    held = 'dirty'
    act(() => tell?.())
    expect(screen.getByTestId('saved-indicator').textContent).toBe('Unsaved changes')
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

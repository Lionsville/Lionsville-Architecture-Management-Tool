// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * Snapshots, from the menu that offers them to the page that reads them back.
 *
 * Every source keeps a history (ADR-0031 §1), and the ways for it to be wrong
 * in public are the same wherever it is kept: an explanation that never
 * appears the first time, a snapshot taken of a scope that does not yet hold
 * what is on screen, a history of one thing that lists what never touched it.
 * Those are the tests.
 *
 * The editor is stubbed — what is under test is the conversation between the
 * workspace, the history and the scopes.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { laidOut } from '../../model/testFixtures';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { heldRepositories } from '../testing/heldRepositories'
import type { HeldRepositories } from '../testing/heldRepositories'
import { changesInWords, mergedLines } from './HistoryPage'
import { translator } from '../../i18n'
import { fakeHistory } from '../testing/fakeHistory'
import type { FakeEntry, FakeHistory } from '../testing/fakeHistory'
import type { HostModel } from '../../model/hostModel'
import type { HostCommand } from '../../platform/hostCommands'
import type { ScopeSnapshot } from '../../projects/scope'
import { renderApp } from '../testing/renderShell'
import { WINDOW_BAR } from '../../widgets/kit/windowArea'
import { chooseValue } from '../../widgets/kit/testing/select';

vi.mock('../../editor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../editor')>()
  return {
    ...actual,
    SolutionDesignEditor: (props: {
      diagrams: { onSettingsChange?: (id: string, settings: { name: string }) => void }
      history?: { onDiagram?: (id: string) => void }
    }) => (
      <>
        <button
          data-testid="edit-the-diagram"
          onClick={() => props.diagrams.onSettingsChange?.('d1', { name: 'Edited' })}
        >
          edit
        </button>
        {props.history?.onDiagram && (
          <button data-testid="history-of-the-diagram" onClick={() => props.history?.onDiagram?.('d1')}>
            history
          </button>
        )}
      </>
    ),
  }
})

afterEach(() => cleanup())

const model = (over: Partial<HostModel> = {}): HostModel => ({
  name: 'Landscape',
  elements: [],
  relations: [],
  diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [] })],
  ...over,
})

/** A snapshot read: the row pressed, as a person does. Nothing is open until then. */
const readFirst = async () => {
  const list = await screen.findByTestId('history-list')
  const row = await waitFor(() => {
    const found = list.querySelector<HTMLElement>('[data-kit-row^="row:"]')
    if (!found) throw new Error('no row yet')
    return found
  })
  fireEvent.click(row)
}

const project = (): ScopeSnapshot => ({
  path: 'acme/landscape',
  model: model(),
  activeDiagramId: 'd1',
  logoLibrary: [],
})

/** The scopes a test starts from, and a history over them written by hand. */
function kept(
  scopes: readonly ScopeSnapshot[] = [project()], entries: FakeEntry[] = [], made?: 'entries' | 'nothing' | Error,
): { repositories: HeldRepositories; history: FakeHistory } {
  const held = heldRepositories(scopes)
  const history = fakeHistory(held.scopes, entries, made)
  return { repositories: { ...held, history }, history }
}

function show(entries: FakeEntry[] = [], made?: 'entries' | 'nothing' | Error) {
  const { repositories, history } = kept([project()], entries, made)
  return { ...renderApp({ repositories, boot: { initialProject: project() } }), projects: repositories, history }
}

/**
 * The desktop: a menu bar of its own, whose items arrive as commands on the
 * stream. With `open: false` the organisation screen is up rather than a
 * landscape.
 */
function showDesktop(entries: FakeEntry[] = [], options: { open?: boolean } = {}) {
  const listeners: ((command: HostCommand) => void)[] = []
  const { repositories, history } = kept([project()], entries)
  const view = renderApp({
    repositories,
    boot: { initialProject: options.open === false ? undefined : project() },
    host: {
      hostMenu: true,
      commands: (listener) => {
        listeners.push(listener)
        return () => { listeners.splice(listeners.indexOf(listener), 1) }
      },
    },
  })
  const send = (command: HostCommand) => act(() => { for (const held of [...listeners]) held(command) })
  const settled = () => act(async () => { await Promise.resolve() })
  return { ...view, projects: repositories, history, send, settled }
}

/**
 * The Save menu is gone (ADR-0005): on the web the items live in the toolbar's
 * overflow, which carries the same list as the desktop's File menu.
 */
const openSaveMenu = async () => {
  fireEvent.click(screen.getByTestId('overflow-button'))
  // The menu itself, not one of its items: with no scope open the items about
  // one are not offered (ADR-0005, amended), and this opens it on the
  // organisation screen too.
  await screen.findByRole('menu')
}

describe('what the menu offers', () => {
  /** Every source keeps a history (ADR-0031 §1): a browser tab's as well as a folder's. */
  it('offers both wherever work is kept', async () => {
    show()
    await openSaveMenu()
    await waitFor(() => expect(screen.getByText('Take a snapshot…')).toBeDefined())
    expect(screen.getByText('History…')).toBeDefined()
  })

  it('offers both on the organisation screen too: a snapshot is of every scope', async () => {
    renderApp({ repositories: kept().repositories })
    await screen.findByTestId('shell-toolbar')
    await openSaveMenu()
    await waitFor(() => expect(screen.getByText('Take a snapshot…')).toBeDefined())
    expect(screen.getByText('History…')).toBeDefined()
  })
})

describe('from the menu bar', () => {
  it('takes a snapshot from the organisation screen', async () => {
    // A snapshot is of every scope, so it means the same from the front door
    // as from inside a landscape.
    const view = showDesktop([{ id: 'abc1234', address: '', subject: 'Before the merger', at: 1_757_000_000_000, by: 'W. Simons', state: { ...project(), path: '' } }], { open: false })
    await screen.findByTestId('shell-toolbar')
    await view.settled()
    view.send({ type: 'snapshot' })
    await screen.findByLabelText('What changed')
    fireEvent.click(screen.getByText('Take snapshot'))

    await waitFor(() => expect(view.history.recorded).toEqual([{ subject: 'Snapshot' }]))
    expect(await screen.findByText('Snapshot taken.')).toBeDefined()
  })

  it('opens the history from the organisation screen, over the home scope’s own document', async () => {
    const view = showDesktop([{
      id: 'abc1234', address: '', subject: 'Before the merger', at: 1_757_000_000_000, by: 'W. Simons',
      state: {
        ...project(),
        path: '',
        model: model({
          elements: [{ id: 'crews', kind: 'application', name: 'Crews', lifecycle: 'live', isManaged: true, aspects: {} }],
        }),
      },
    }], { open: false })
    await screen.findByTestId('shell-toolbar')
    await view.settled()
    view.send({ type: 'history' })

    expect(within(await screen.findByTestId('history-list')).getByText('Before the merger')).toBeDefined()
    await readFirst()
    // The root holds nothing now, and the snapshot held Crews: removed since.
    expect(await screen.findByText('Removed Crews')).toBeDefined()
  })
})

describe('the History page as a place', () => {
  it('has an address of its own, which Back leaves and which opens it again', async () => {
    const view = showDesktop([{ id: 'abc1234', address: '', subject: 'Before the merger', at: 1_757_000_000_000, by: 'W. Simons', state: { ...project(), path: '' } }], { open: false })
    await screen.findByTestId('shell-toolbar')
    await view.settled()
    view.send({ type: 'history' })
    await screen.findByTestId('history-list')
    await waitFor(() => expect(window.location.hash).toBe('#/-/history'), { timeout: 6000 })
    // Row two does not call it Home while it is up.
    expect(document.querySelector('.kit-frame__row--two [aria-current="page"]')?.textContent ?? '').not.toBe('Home')
    act(() => { window.history.back() })
    await waitFor(() => expect(screen.queryByTestId('history-list')).toBeNull(), { timeout: 6000 })
    act(() => { window.history.forward() })
    expect(await screen.findByTestId('history-list', {}, { timeout: 6000 })).toBeDefined()
  })

  it('opens from its address as the app comes up', async () => {
    const { repositories } = kept([project()], [{ id: 'abc1234', address: '', subject: 'Before the merger', at: 1_757_000_000_000, by: 'W. Simons', state: { ...project(), path: '' } }])
    renderApp({ repositories, boot: { initialFramePage: 'history' } })
    expect(await screen.findByTestId('history-list')).toBeDefined()
  })
})

describe('taking a snapshot', () => {
  const takeOne = async (entries: FakeEntry[] = [], made?: 'entries' | 'nothing') => {
    const view = show(entries, made)
    await openSaveMenu()
    await waitFor(() => expect(screen.getByText('Take a snapshot…')).toBeDefined())
    fireEvent.click(screen.getByText('Take a snapshot…'))
    await waitFor(() => expect(screen.getByLabelText('What changed')).toBeDefined())
    return view
  }
  const earlier: FakeEntry = { id: 'c1', address: 'acme/landscape', subject: 'Earlier', at: 1_757_000_000_000 }

  it('asks first, and says what starting a history means', async () => {
    await takeOne()
    expect(await screen.findByText(/Take a snapshot of/)).toBeDefined()
  })

  it('says where the history is kept, in the source\'s own sentence', async () => {
    const { repositories } = kept()
    renderApp({
      repositories, boot: { initialProject: project() },
      provider: { historyNoteKey: 'browser.historyNote' },
    })
    await openSaveMenu()
    await waitFor(() => expect(screen.getByText('Take a snapshot…')).toBeDefined())
    fireEvent.click(screen.getByText('Take a snapshot…'))
    expect(await screen.findByText(/The first snapshot starts one\. Every snapshot you take is recorded in this browser/)).toBeDefined()
  })

  it('does not explain itself again once the scope has a history', async () => {
    await takeOne([earlier])
    await waitFor(() => expect(screen.queryByText(/Nothing here keeps a history yet/)).toBeNull())
  })

  it('drafts the message from what was actually done', async () => {
    show([earlier])
    act(() => { screen.getByTestId('edit-the-diagram').click() })
    await openSaveMenu()
    await waitFor(() => expect(screen.getByText('Take a snapshot…')).toBeDefined())
    fireEvent.click(screen.getByText('Take a snapshot…'))

    const field = await screen.findByLabelText('What changed')
    expect((field as HTMLTextAreaElement).value).toContain('Changed the settings of Edited')
  })

  it('writes the project out before recording it', async () => {
    // A snapshot of a scope that does not yet hold what is on screen is a
    // snapshot of the wrong thing, and it would be silently so.
    const view = show([earlier])
    act(() => { screen.getByTestId('edit-the-diagram').click() })
    await openSaveMenu()
    await waitFor(() => expect(screen.getByText('Take a snapshot…')).toBeDefined())
    fireEvent.click(screen.getByText('Take a snapshot…'))
    await screen.findByLabelText('What changed')
    fireEvent.click(screen.getByText('Take snapshot'))

    await waitFor(() => expect(view.history.recorded).toHaveLength(1))
    const stored = await view.projects.read('acme/landscape')
    expect(stored?.model.diagrams[0].name).toBe('Edited')
  })

  it('says so when there was nothing to record', async () => {
    await takeOne([earlier], 'nothing')
    fireEvent.click(screen.getByText('Take snapshot'))

    await waitFor(() => expect(
      screen.getByText('Nothing has changed since the last snapshot.'),
    ).toBeDefined())
  })
})

describe('reading one back', () => {
  const entry = (over: Partial<FakeEntry> = {}): FakeEntry => ({
    id: 'abc1234', address: 'acme/landscape', subject: 'Before the merger', at: 1_757_000_000_000, by: 'W. Simons', ...over,
  })
  const openIt = async () => {
    await openSaveMenu()
    await waitFor(() => expect(screen.getByText('History…')).toBeDefined())
    fireEvent.click(screen.getByText('History…'))
  }

  it('lists the snapshots and says what changed since the chosen one', async () => {
    show([entry({
      state: {
        ...project(),
        model: model({
          elements: [{ id: 'crews', kind: 'application', name: 'Crews', lifecycle: 'live', isManaged: true, aspects: {} }],
        }),
      },
    })])
    await openIt()
    expect(within(await screen.findByTestId('history-list')).getByText('Before the merger')).toBeDefined()
    await readFirst()
    // The element is in the snapshot and not on screen now, so it was removed
    // since — which is the direction somebody standing in a history reads in.
    expect(await screen.findByText('Removed Crews')).toBeDefined()
  })

  it('says so when the scope was not there then', async () => {
    show([entry()])
    await openIt()
    await readFirst()
    expect(await screen.findByText('This scope did not exist yet at that snapshot.')).toBeDefined()
  })

  it('says when there is nothing to show yet', async () => {
    show()
    await openIt()
    expect(await screen.findByText('No snapshots yet.')).toBeDefined()
  })

  it('leaves the window to row one: a page keeps clear of nothing and drags nothing', async () => {
    renderApp({
      repositories: kept().repositories,
      boot: { initialProject: project() },
    })
    await openIt()
    const heading = await screen.findByRole('heading', { name: 'History' })
    expect(screen.getByTestId('shell-toolbar').classList.contains(WINDOW_BAR)).toBe(true)
    expect(heading.closest(`.${WINDOW_BAR}`)).toBeNull()
  })
})

describe('the history of one thing (ADR-0008)', () => {
  const at = 1_757_000_000_000
  const described = (): HostModel => model({
    elements: [{
      id: 'billing', kind: 'application', name: 'Billing', lifecycle: 'live', isManaged: true,
      aspects: {}, description: 'Sends the invoices.',
    }],
    decisions: [{
      id: 'adr-1', number: 1, title: 'One writer', status: 'proposed', date: '2026-09-01', body: 'Why.', signers: [],
    }],
  })
  const withDescribed = (): ScopeSnapshot => ({ ...project(), model: described() })

  /** Three snapshots: one touched the diagram, one the description, one the decision. */
  const threeSnapshots = (): FakeEntry[] => [
    {
      id: 'c3', address: 'acme/landscape', subject: 'Retitled the decision', at: at + 2000,
      records: [{ kind: 'decision', id: 'adr-1' }],
      state: { ...withDescribed(), model: { ...described(), decisions: [{ ...described().decisions![0], title: 'Two writers' }] } },
    },
    {
      id: 'c2', address: 'acme/landscape', subject: 'Wrote about billing', at: at + 1000,
      records: [{ kind: 'element', id: 'billing' }],
      state: withDescribed(),
    },
    {
      id: 'c1', address: 'acme/landscape', subject: 'Moved everything', at,
      records: [{ kind: 'diagram', id: 'd1' }],
      state: { ...withDescribed(), model: { ...described(), diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'Old name', placements: [] })] } },
    },
  ]

  function showDescribed(entries: FakeEntry[]) {
    const { repositories } = kept([withDescribed()], entries)
    return renderApp({ repositories, boot: { initialProject: withDescribed() } })
  }

  it('opens on a diagram from its tab, listing only the snapshots that touched it', async () => {
    showDescribed(threeSnapshots())
    fireEvent.click(await screen.findByTestId('history-of-the-diagram'))
    const list = await screen.findByTestId('history-list')
    await waitFor(() => expect(within(list).getByText('Moved everything')).toBeDefined())
    expect(within(list).queryByText('Wrote about billing')).toBeNull()
    expect((screen.getByLabelText('Show the history of') as HTMLSelectElement).value).toBe('diagram:d1')
    // And the changes are the diagram's own: renamed since, nothing about the decision.
    await readFirst()
    const diff = await screen.findByTestId('history-diff')
    expect(await within(diff).findByText('Changed the view L7 (name)')).toBeDefined()
    expect(within(diff).queryByText(/One writer/)).toBeNull()
  })

  it('opens on a decision from its page, by number, so the retitled one is found', async () => {
    showDescribed(threeSnapshots())
    fireEvent.click(screen.getByText('Decisions'))
    fireEvent.click(within(await screen.findByTestId('adr-list')).getByText('One writer'))
    fireEvent.click(await screen.findByRole('button', { name: 'History…' }))
    const list = await screen.findByTestId('history-list')
    await waitFor(() => expect(within(list).getByText('Retitled the decision')).toBeDefined())
    expect(within(list).queryByText('Moved everything')).toBeNull()
    expect((screen.getByLabelText('Show the history of') as HTMLSelectElement).value).toBe('decision:adr-1')
  })

  it('widens back to the whole project from the picker', async () => {
    showDescribed(threeSnapshots())
    fireEvent.click(await screen.findByTestId('history-of-the-diagram'))
    const list = await screen.findByTestId('history-list')
    await waitFor(() => expect(within(list).getByText('Moved everything')).toBeDefined())
    chooseValue(screen.getByLabelText('Show the history of'), '')
    await waitFor(() => expect(within(screen.getByTestId('history-list')).getByText('Wrote about billing')).toBeDefined())
    chooseValue(screen.getByLabelText('Show the history of'), 'description:billing')
    await waitFor(() => expect(within(screen.getByTestId('history-list')).queryByText('Moved everything')).toBeNull())
    expect(within(screen.getByTestId('history-list')).getByText('Wrote about billing')).toBeDefined()
  })

  /**
   * An id is organisation-wide (ADR-0012 §7): the scope that answers for an
   * element holds the owner's account, and every scope that draws it holds a
   * perspective of its own. The history of the id is the union of those pages.
   */
  it('lists a stand-in’s perspective beside the master’s own page', async () => {
    const master = (): ScopeSnapshot => ({
      ...withDescribed(),
      path: 'acme',
      model: { ...described(), name: 'Acme' },
    })
    // The landscape only DRAWS it: its page for the element is its own account
    // of what the thing means here, and the owner's is in the scope above.
    const drawing = (): ScopeSnapshot => ({
      ...withDescribed(),
      model: {
        ...described(),
        elements: [{ ...described().elements[0], ref: 'acme', description: 'What it means to us.' }],
      },
    })
    const { repositories } = kept([master(), drawing()], [
      {
        id: 'c2', address: 'acme/landscape', subject: 'What billing means to us', at: at + 1000,
        records: [{ kind: 'element', id: 'billing' }], state: drawing(),
      },
      {
        id: 'c1', address: 'acme', subject: 'What billing is', at,
        records: [{ kind: 'element', id: 'billing' }], state: master(),
      },
    ])
    renderApp({ repositories, boot: { initialProject: drawing() } })
    fireEvent.click(await screen.findByTestId('history-of-the-diagram'))
    chooseValue(await screen.findByLabelText('Show the history of'), 'description:billing')
    const list = await screen.findByTestId('history-list')
    await waitFor(() => expect(within(list).getByText('What billing means to us')).toBeDefined())
    expect(within(list).getByText('What billing is')).toBeDefined()
    // And the page says where it is looking, and that a restore is per scope.
    const where = await screen.findByTestId('history-everywhere')
    // The master scope's own name (scopeDisplayName), not its raw path.
    expect(where.textContent).toContain('Acme')
    expect(where.textContent).toContain('what this scope holds')
  })

  it('says what changed in words, and each repeated line once with how many times', () => {
    const s = translator('en')
    expect(changesInWords([
      { what: 'element', kind: 'added', id: 'a', name: 'A' }, { what: 'element', kind: 'added', id: 'b', name: 'B' },
      { what: 'element', kind: 'removed', id: 'c', name: 'C' },
    ] as never, s)).toBe('Since this snapshot: 2 added, 1 removed')
    expect(mergedLines(['x', 'y', 'x'])).toEqual([{ line: 'x', count: 2 }, { line: 'y', count: 1 }])
  })

  it('says so when no snapshot touched the thing', async () => {
    showDescribed([
      { id: 'c1', address: 'acme/landscape', subject: 'Something else', at, records: [{ kind: 'element', id: 'other' }] },
    ])
    fireEvent.click(await screen.findByTestId('history-of-the-diagram'))
    expect(await screen.findByText('No snapshot has touched this yet.')).toBeDefined()
  })
})

describe('going back, as going forward (ADR-0008)', () => {
  const at = 1_757_000_000_000
  const day = new Date(at)
  const pad = (n: number) => String(n).padStart(2, '0')
  const asOf = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`

  const before = (over: Partial<HostModel> = {}): ScopeSnapshot => ({
    ...project(),
    model: model({
      diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'Old name', placements: [] })],
      decisions: [{ id: 'adr-1', number: 1, title: 'One writer', status: 'proposed', date: '2026-09-01', body: 'Why.', signers: [] }],
      ...over,
    }),
  })
  const oneSnapshot = (held: ScopeSnapshot = before()): FakeEntry[] => [{
    id: 'c1', address: 'acme/landscape', subject: 'Before the mess', at,
    records: [{ kind: 'diagram', id: 'd1' }, { kind: 'decision', id: 'adr-1' }],
    state: held,
  }]

  const now = (over: Partial<HostModel> = {}): ScopeSnapshot => ({
    ...project(),
    model: model({
      decisions: [{ id: 'adr-1', number: 1, title: 'One writer', status: 'accepted', date: '2026-09-02', body: 'Final.', signers: [] }],
      ...over,
    }),
  })

  /**
   * Press Restore and let the page go. The toast is up at once, but hidden from
   * assistive technology until the full-screen page has finished leaving,
   * which is MUI's exit transition — a timer, so the clock is the test's for it
   * and a second passes at once.
   */
  const restoreAndLetThePageGo = () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Restore' }))
      act(() => { vi.advanceTimersByTime(1_000) })
    } finally {
      vi.useRealTimers()
    }
    return screen.getByRole('alert')
  }

  const openHistoryOfTheDiagram = async () => {
    fireEvent.click(await screen.findByTestId('history-of-the-diagram'))
    await readFirst()
    return within(await screen.findByTestId('history-diff')).findByText('Changed the view L7 (name)')
  }

  it('restores one diagram as a new step: named in the Activity list, undoable, and offered a snapshot', async () => {
    const { repositories: projects, history } = kept([now()], oneSnapshot())
    renderApp({ repositories: projects, boot: { initialProject: now() } })
    await openHistoryOfTheDiagram()
    fireEvent.click(screen.getByRole('button', { name: 'Restore this version…' }))
    // The copy says what a restore is before the first one is taken.
    expect(await screen.findByText(/as a new change/)).toBeDefined()

    const toast = restoreAndLetThePageGo()
    expect(toast.textContent).toContain(`Restored Old name as of ${asOf}.`)
    // The page has closed, so the person sees what came back.
    expect(screen.queryByTestId('history-list')).toBeNull()

    act(() => { fireEvent.click(screen.getByTestId('frame-activity')) })
    expect(screen.getByRole('list', { name: 'Activity' }).firstElementChild?.textContent).toContain(`Restored the view Old name as of ${asOf}`)
    act(() => { fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' }) })

    // Offered, not taken: the snapshot is the toast's button, and its draft
    // is written from the restore.
    fireEvent.click(within(toast).getByRole('button', { name: 'Snapshot' }))
    const field = await screen.findByLabelText('What changed')
    expect((field as HTMLTextAreaElement).value).toContain('Restored the view Old name')
    fireEvent.click(screen.getByText('Take snapshot'))
    await waitFor(() => expect(history.recorded).toHaveLength(1))
    // And the folder now holds the old diagram, through the store that always writes it.
    const stored = await projects.read('acme/landscape')
    expect(stored?.model.diagrams[0].name).toBe('Old name')
  })

  it('refuses to restore a locked decision, and says why', async () => {
    renderApp({ repositories: kept([now()], oneSnapshot()).repositories, boot: { initialProject: now() } })
    fireEvent.click(screen.getByText('Decisions'))
    fireEvent.click(within(await screen.findByTestId('adr-list')).getByText('One writer'))
    fireEvent.click(await screen.findByRole('button', { name: 'History…' }))
    await readFirst()
    await within(await screen.findByTestId('history-diff')).findByText(/Changed the decision/)
    // Said in a sentence, with no dead button: an ended record has no version to go back to.
    expect((await screen.findByTestId('history-refused')).textContent).toContain('This decision is accepted, so it stays as it is.')
    expect(screen.queryByRole('button', { name: 'Restore this version…' })).toBeNull()
  })

  it('restores the whole project behind its own confirm', async () => {
    const { repositories } = kept([now({ decisions: [] })], oneSnapshot(before({ decisions: [] })))
    renderApp({ repositories, boot: { initialProject: now({ decisions: [] }) } })
    await openSaveMenu()
    await waitFor(() => expect(screen.getByText('History…')).toBeDefined())
    fireEvent.click(screen.getByText('History…'))
    await readFirst()
    await within(await screen.findByTestId('history-diff')).findByText('Changed the view L7 (name)')
    // Under ⋯: the heaviest act there is does not stand on every snapshot.
    fireEvent.click(screen.getByRole('button', { name: 'More' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Restore the whole scope…' }))
    expect(await screen.findByText(/Every element, connection, diagram and decision/)).toBeDefined()

    expect(restoreAndLetThePageGo().textContent).toContain(`Restored the whole scope as of ${asOf}.`)
    act(() => { fireEvent.click(screen.getByTestId('frame-activity')) })
    expect(screen.getByRole('list', { name: 'Activity' }).firstElementChild?.textContent).toContain('Restored the whole scope')
  })
})

describe('a label on a snapshot (ADR-0008)', () => {
  const at = 1_757_000_000_000
  const twoSnapshots = (): FakeEntry[] => [
    { id: 'c2', address: 'acme/landscape', subject: 'Two', at: at + 1000, state: project(), labels: ['Shown to the board'] },
    { id: 'c1', address: 'acme/landscape', subject: 'One', at, state: project() },
  ]

  const openHistory = async () => {
    await openSaveMenu()
    await waitFor(() => expect(screen.getByText('History…')).toBeDefined())
    fireEvent.click(screen.getByText('History…'))
    return screen.findByTestId('history-list')
  }

  it('shows a label beside the subject, never instead of it', async () => {
    show(twoSnapshots())
    const list = await openHistory()
    expect(within(list).getByText('Two')).toBeDefined()
    expect(within(list).getByText('Shown to the board')).toBeDefined()
  })

  it('labels the chosen snapshot and reads the list again', async () => {
    const entries = twoSnapshots()
    show(entries)
    const list = await openHistory()
    fireEvent.click(within(list).getByText('One'))
    fireEvent.click(await screen.findByRole('button', { name: 'Label…' }))
    expect(await screen.findByText(/never instead of it/)).toBeDefined()
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Release 1.2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Label' }))

    await waitFor(() => expect(within(screen.getByTestId('history-list')).getByText('Release 1.2')).toBeDefined())
    expect((await screen.findByRole('alert', { hidden: true })).textContent).toContain('Labelled.')
    expect(entries.map((one) => one.labels)).toEqual([['Shown to the board'], ['Release 1.2']])
  })

  it('refuses a second label with the same name, and says so', async () => {
    show(twoSnapshots())
    const list = await openHistory()
    fireEvent.click(within(list).getByText('One'))
    fireEvent.click(await screen.findByRole('button', { name: 'Label…' }))
    fireEvent.change(await screen.findByLabelText('Label'), { target: { value: 'shown to the BOARD' } })
    fireEvent.click(screen.getByRole('button', { name: 'Label' }))
    expect((await screen.findByRole('alert', { hidden: true })).textContent).toContain('A label with that name is already here')
  })
})

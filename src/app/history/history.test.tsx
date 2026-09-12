// @vitest-environment jsdom
/**
 * Snapshots, from the menu that offers them to the page that reads them back.
 *
 * Layer two of ADR-0003 is opt-in, degradable and desktop-only, and every one
 * of those is a way for it to be wrong in public: an item that cannot work, a
 * consent step that never appears, a snapshot taken of a folder that does not
 * yet hold what is on screen. Those are the tests.
 *
 * The editor is stubbed — what is under test is the conversation between the
 * workspace, the history seam and the store.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { laidOut } from '../../model/testFixtures';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { InMemoryProjectHistory } from '../../adapters/memory/InMemoryProjectHistory'
import { InMemoryScopeStore } from '../../adapters/memory/InMemoryScopeStore'
import type { HostModel } from '../../model/fromInterchange'
import type { ScopeSnapshot } from '../../projects/scope'
import type { HistoryEntry, ProjectHistory } from '../../ports/ProjectHistory'
import { renderApp } from '../testing/renderShell'

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

const project = (): ScopeSnapshot => ({
  path: 'acme/landscape',
  model: model(),
  activeDiagramId: 'd1',
  logoLibrary: [],
})

/** A history that says yes, and remembers what it was asked. */
function fakeHistory(over: Omit<Partial<ProjectHistory>, 'entries'> & { entries?: HistoryEntry[] } = {}) {
  const calls = { started: 0, snapshots: [] as string[] }
  // Pulled out of the overrides: `entries` is a method here and a list there,
  // and spreading one over the other replaces the method with an array.
  const { entries: listed = [], ...rest } = over
  const history: ProjectHistory = {
    available: () => Promise.resolve(true),
    keeping: () => Promise.resolve(false),
    start: () => { calls.started += 1; return Promise.resolve() },
    snapshot: (message) => { calls.snapshots.push(message); return Promise.resolve(true) },
    entries: () => Promise.resolve(listed),
    projectAt: () => Promise.resolve(undefined),
    label: () => Promise.resolve('done'),
    ...rest,
  }
  return { history, calls }
}

function show(history?: ProjectHistory) {
  const projects = new InMemoryScopeStore([project()])
  return { ...renderApp({ scopes: projects, initialProject: project(), history }), projects }
}

/**
 * The Save menu is gone (ADR-0005): on the web the items live in the toolbar's
 * overflow, which carries the same list as the desktop's File menu.
 */
const openSaveMenu = async () => {
  fireEvent.click(screen.getByTestId('overflow-button'))
  await waitFor(() => expect(screen.getByText('Export Working File…')).toBeDefined())
}

describe('what the menu offers', () => {
  it('offers nothing about history in a browser tab', async () => {
    show()
    await openSaveMenu()
    expect(screen.queryByText('Snapshot…')).toBeNull()
  })

  it('offers nothing on a machine with no git', async () => {
    // An item that cannot work is worse than an item that is missing.
    show(fakeHistory({ available: () => Promise.resolve(false) }).history)
    await openSaveMenu()
    await waitFor(() => expect(screen.queryByText('Snapshot…')).toBeNull())
  })

  it('offers both once there is a git and a folder', async () => {
    show(fakeHistory().history)
    await openSaveMenu()
    await waitFor(() => expect(screen.getByText('Snapshot…')).toBeDefined())
    expect(screen.getByText('History…')).toBeDefined()
  })
})

describe('taking a snapshot', () => {
  const takeOne = async (held: { history: ProjectHistory }) => {
    show(held.history)
    await openSaveMenu()
    await waitFor(() => expect(screen.getByText('Snapshot…')).toBeDefined())
    fireEvent.click(screen.getByText('Snapshot…'))
    await waitFor(() => expect(screen.getByLabelText('What changed')).toBeDefined())
  }

  it('asks first, and says what starting a history means', async () => {
    await takeOne(fakeHistory())
    expect(screen.getByText(/does not keep a history yet/)).toBeDefined()
  })

  it('does not explain itself again once the folder is keeping one', async () => {
    await takeOne(fakeHistory({ keeping: () => Promise.resolve(true) }))
    expect(screen.queryByText(/does not keep a history yet/)).toBeNull()
  })

  it('drafts the message from what was actually done', async () => {
    const held = fakeHistory({ keeping: () => Promise.resolve(true) })
    show(held.history)
    act(() => { screen.getByTestId('edit-the-diagram').click() })
    await openSaveMenu()
    await waitFor(() => expect(screen.getByText('Snapshot…')).toBeDefined())
    fireEvent.click(screen.getByText('Snapshot…'))

    const field = await screen.findByLabelText('What changed')
    expect((field as HTMLTextAreaElement).value).toContain('Changed the settings of Edited')
  })

  it('writes the project out before recording it', async () => {
    // A snapshot of a folder that does not yet hold what is on screen is a
    // snapshot of the wrong thing, and it would be silently so.
    const held = fakeHistory({ keeping: () => Promise.resolve(true) })
    const view = show(held.history)
    act(() => { screen.getByTestId('edit-the-diagram').click() })
    await openSaveMenu()
    await waitFor(() => expect(screen.getByText('Snapshot…')).toBeDefined())
    fireEvent.click(screen.getByText('Snapshot…'))
    await screen.findByLabelText('What changed')
    fireEvent.click(screen.getByText('Take snapshot'))

    await waitFor(async () => {
      const stored = await view.projects.load('acme/landscape')
      expect(stored?.model.diagrams[0].name).toBe('Edited')
    })
    expect(held.calls.snapshots).toHaveLength(1)
  })

  it('starts the history the first time, and only then', async () => {
    const held = fakeHistory()
    await takeOne(held)
    fireEvent.click(screen.getByText('Take snapshot'))

    await waitFor(() => expect(held.calls.started).toBe(1))
    await waitFor(() => expect(screen.getByText('Snapshot taken.')).toBeDefined())
  })

  it('says so when there was nothing to record', async () => {
    const held = fakeHistory({
      keeping: () => Promise.resolve(true),
      snapshot: () => Promise.resolve(false),
    })
    await takeOne(held)
    fireEvent.click(screen.getByText('Take snapshot'))

    await waitFor(() => expect(
      screen.getByText('Nothing has changed since the last snapshot.'),
    ).toBeDefined())
  })
})

describe('reading one back', () => {
  const entry: HistoryEntry = {
    id: 'abc1234', subject: 'Before the merger', at: 1_757_000_000_000, author: 'W. Simons', labels: [],
  }

  it('lists the snapshots and says what changed since the chosen one', async () => {
    const held = fakeHistory({
      entries: [entry],
      keeping: () => Promise.resolve(true),
      projectAt: () => Promise.resolve({
        ...project(),
        model: model({
          elements: [{
            id: 'crews', kind: 'application', name: 'Crews',
            lifecycle: 'live', isManaged: true, aspects: {},
          }],
        }),
      }),
    })
    show(held.history)
    await openSaveMenu()
    await waitFor(() => expect(screen.getByText('History…')).toBeDefined())
    fireEvent.click(screen.getByText('History…'))

    expect(within(await screen.findByTestId('history-list')).getByText('Before the merger')).toBeDefined()
    // The element is in the snapshot and not on screen now, so it was removed
    // since — which is the direction somebody standing in a history reads in.
    expect(await screen.findByText('Removed Crews')).toBeDefined()
  })

  it('says so when the project was not in the folder then', async () => {
    const held = fakeHistory({ entries: [entry], keeping: () => Promise.resolve(true) })
    show(held.history)
    await openSaveMenu()
    await waitFor(() => expect(screen.getByText('History…')).toBeDefined())
    fireEvent.click(screen.getByText('History…'))

    expect(await screen.findByText('This project was not in the folder at that snapshot.'))
      .toBeDefined()
  })

  it('says when there is nothing to show yet', async () => {
    const held = fakeHistory({ keeping: () => Promise.resolve(true) })
    show(held.history)
    await openSaveMenu()
    await waitFor(() => expect(screen.getByText('History…')).toBeDefined())
    fireEvent.click(screen.getByText('History…'))

    expect(await screen.findByText('No snapshots yet.')).toBeDefined()
  })

  it('gives the window something to be dragged by, as every full page must', async () => {
    const held = fakeHistory({ keeping: () => Promise.resolve(true) })
    renderApp({
      scopes: new InMemoryScopeStore([project()]),
      initialProject: project(),
      history: held.history,
      windowChrome: { draggable: true, controlsInset: 78 },
    })
    await openSaveMenu()
    await waitFor(() => expect(screen.getByText('History…')).toBeDefined())
    fireEvent.click(screen.getByText('History…'))

    const bar = await screen.findByTestId('history-topbar')
    expect(getComputedStyle(bar).paddingLeft).toBe('90px')
    const css = [...document.querySelectorAll('style')].map((tag) => tag.textContent).join('')
    expect(css).toContain('-webkit-app-region:drag')
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
  const threeSnapshots = () => new InMemoryProjectHistory([
    {
      id: 'c3', subject: 'Retitled the decision', at: at + 2000, author: 'W.',
      touched: ['acme/landscape/decisions/0001-one-writer.md'],
      projects: [{ ...withDescribed(), model: { ...described(), decisions: [{ ...described().decisions![0], title: 'Two writers' }] } }],
    },
    {
      id: 'c2', subject: 'Wrote about billing', at: at + 1000, author: 'W.',
      touched: ['acme/landscape/docs/billing.md'],
      projects: [withDescribed()],
    },
    {
      id: 'c1', subject: 'Moved everything', at, author: 'W.',
      touched: ['acme/landscape/diagrams/d1.geometry.json', 'acme/landscape/diagrams/d1.json'],
      projects: [{ ...withDescribed(), model: { ...described(), diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'Old name', placements: [] })] } }],
    },
  ])

  function showDescribed(history: InMemoryProjectHistory) {
    const projects = new InMemoryScopeStore([withDescribed()])
    return renderApp({ scopes: projects, initialProject: withDescribed(), history })
  }

  it('opens on a diagram from its tab, listing only the snapshots that touched it', async () => {
    showDescribed(threeSnapshots())
    fireEvent.click(await screen.findByTestId('history-of-the-diagram'))
    const list = await screen.findByTestId('history-list')
    await waitFor(() => expect(within(list).getByText('Moved everything')).toBeDefined())
    expect(within(list).queryByText('Wrote about billing')).toBeNull()
    expect((screen.getByLabelText('Show the history of') as HTMLSelectElement).value).toBe('diagram:d1')
    // And the changes are the diagram's own: renamed since, nothing about the decision.
    const diff = screen.getByTestId('history-diff')
    expect(await within(diff).findByText('Changed the diagram L7 (name)')).toBeDefined()
    expect(within(diff).queryByText(/One writer/)).toBeNull()
  })

  it('opens on a decision from its page, by number, so the retitled one is found', async () => {
    showDescribed(threeSnapshots())
    fireEvent.click(screen.getByText('Decisions'))
    fireEvent.click(within(await screen.findByTestId('adr-list')).getByText('One writer'))
    fireEvent.click(within(await screen.findByTestId('adr-reader')).getByRole('button', { name: 'History…' }))
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
    fireEvent.change(screen.getByLabelText('Show the history of'), { target: { value: '' } })
    await waitFor(() => expect(within(screen.getByTestId('history-list')).getByText('Wrote about billing')).toBeDefined())
    fireEvent.change(screen.getByLabelText('Show the history of'), { target: { value: 'description:billing' } })
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
    const projects = new InMemoryScopeStore([master(), drawing()])
    renderApp({
      scopes: projects,
      initialProject: drawing(),
      history: new InMemoryProjectHistory([
        {
          id: 'c2', subject: 'What billing means to us', at: at + 1000, author: 'W.',
          touched: ['acme/landscape/docs/billing.md'],
          projects: [drawing()],
        },
        {
          id: 'c1', subject: 'What billing is', at, author: 'W.',
          touched: ['acme/docs/billing.md'],
          projects: [drawing()],
        },
      ]),
    })
    fireEvent.click(await screen.findByTestId('history-of-the-diagram'))
    fireEvent.change(await screen.findByLabelText('Show the history of'), { target: { value: 'description:billing' } })
    const list = await screen.findByTestId('history-list')
    await waitFor(() => expect(within(list).getByText('What billing means to us')).toBeDefined())
    expect(within(list).getByText('What billing is')).toBeDefined()
    // And the page says where it is looking, and that a restore is per scope.
    const where = await screen.findByTestId('history-everywhere')
    expect(where.textContent).toContain('acme')
    expect(where.textContent).toContain('what this scope holds')
  })

  it('says so when no snapshot touched the thing', async () => {
    showDescribed(new InMemoryProjectHistory([
      { id: 'c1', subject: 'Something else', at, author: 'W.', touched: ['acme/landscape/model.json'] },
    ]))
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
  const oneSnapshot = (held: ScopeSnapshot = before()) => new InMemoryProjectHistory([{
    id: 'c1', subject: 'Before the mess', at, author: 'W.',
    touched: ['acme/landscape/diagrams/d1.json', 'acme/landscape/decisions/0001-one-writer.md'],
    projects: [held],
  }])

  const now = (over: Partial<HostModel> = {}): ScopeSnapshot => ({
    ...project(),
    model: model({
      decisions: [{ id: 'adr-1', number: 1, title: 'One writer', status: 'accepted', date: '2026-09-02', body: 'Final.', signers: [] }],
      ...over,
    }),
  })

  const openHistoryOfTheDiagram = async () => {
    fireEvent.click(await screen.findByTestId('history-of-the-diagram'))
    return within(await screen.findByTestId('history-diff')).findByText('Changed the diagram L7 (name)')
  }

  it('restores one diagram as a new step: named in the Activity list, undoable, and offered a snapshot', async () => {
    const history = oneSnapshot()
    const projects = new InMemoryScopeStore([now()])
    renderApp({ scopes: projects, initialProject: now(), history })
    await openHistoryOfTheDiagram()
    fireEvent.click(screen.getByRole('button', { name: 'Restore this version…' }))
    // The copy says what a restore is before the first one is taken.
    expect(await screen.findByText(/as a new change/)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))

    const toast = await screen.findByRole('alert')
    expect(toast.textContent).toContain(`Restored Old name as of ${asOf}.`)
    // The page has closed, so the person sees what came back.
    expect(screen.queryByTestId('history-list')).toBeNull()

    act(() => { fireEvent.click(screen.getByText('Activity')) })
    expect(screen.getAllByRole('menuitem')[0].textContent).toContain(`Restored the diagram Old name as of ${asOf}`)
    act(() => { fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' }) })

    // Offered, not taken: the snapshot is the toast's button, and its draft
    // is written from the restore.
    fireEvent.click(within(toast).getByRole('button', { name: 'Snapshot' }))
    const field = await screen.findByLabelText('What changed')
    expect((field as HTMLTextAreaElement).value).toContain('Restored the diagram Old name')
    fireEvent.click(screen.getByText('Take snapshot'))
    await waitFor(() => expect(history.calls.snapshots).toHaveLength(1))
    // And the folder now holds the old diagram, through the store that always writes it.
    const stored = await projects.load('acme/landscape')
    expect(stored?.model.diagrams[0].name).toBe('Old name')
  })

  it('refuses to restore a locked decision, and says why', async () => {
    const history = oneSnapshot()
    renderApp({ scopes: new InMemoryScopeStore([now()]), initialProject: now(), history })
    fireEvent.click(screen.getByText('Decisions'))
    fireEvent.click(within(await screen.findByTestId('adr-list')).getByText('One writer'))
    fireEvent.click(within(await screen.findByTestId('adr-reader')).getByRole('button', { name: 'History…' }))
    await within(await screen.findByTestId('history-diff')).findByText(/Changed the decision/)
    fireEvent.click(screen.getByRole('button', { name: 'Restore this version…' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Restore' }))

    // Hidden to assistive technology while the full-screen page is up, which
    // is MUI's doing; the words are there all the same.
    expect((await screen.findByRole('alert', { hidden: true })).textContent).toContain('locked record is not changed')
    // Nothing happened: the page is still up and the Activity list is empty.
    expect(screen.getByTestId('history-list')).toBeDefined()
  })

  it('restores the whole project behind its own confirm', async () => {
    const history = oneSnapshot(before({ decisions: [] }))
    renderApp({ scopes: new InMemoryScopeStore([now({ decisions: [] })]), initialProject: now({ decisions: [] }), history })
    await openSaveMenu()
    await waitFor(() => expect(screen.getByText('History…')).toBeDefined())
    fireEvent.click(screen.getByText('History…'))
    await within(await screen.findByTestId('history-diff')).findByText('Changed the diagram L7 (name)')
    fireEvent.click(screen.getByRole('button', { name: 'Restore the whole project…' }))
    expect(await screen.findByText(/Every element, connection, diagram and decision/)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }))

    expect((await screen.findByRole('alert')).textContent).toContain(`Restored the whole project as of ${asOf}.`)
    act(() => { fireEvent.click(screen.getByText('Activity')) })
    expect(screen.getAllByRole('menuitem')[0].textContent).toContain('Restored the whole project')
  })
})

describe('a label on a snapshot (ADR-0008)', () => {
  const at = 1_757_000_000_000
  const twoSnapshots = () => new InMemoryProjectHistory([
    { id: 'c2', subject: 'Two', at: at + 1000, author: 'W.', projects: [project()], labels: ['Shown to the board'] },
    { id: 'c1', subject: 'One', at, author: 'W.', projects: [project()] },
  ])

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
    const history = twoSnapshots()
    show(history)
    const list = await openHistory()
    fireEvent.click(within(list).getByText('One'))
    fireEvent.click(await screen.findByRole('button', { name: 'Label…' }))
    expect(await screen.findByText(/never instead of it/)).toBeDefined()
    fireEvent.change(screen.getByLabelText('Label'), { target: { value: 'Release 1.2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Label' }))

    await waitFor(() => expect(within(screen.getByTestId('history-list')).getByText('Release 1.2')).toBeDefined())
    expect((await screen.findByRole('alert', { hidden: true })).textContent).toContain('Labelled.')
    expect(await history.entries()).toMatchObject([{ labels: ['Shown to the board'] }, { labels: ['Release 1.2'] }])
  })

  it('refuses a second label with the same name, and says so', async () => {
    show(twoSnapshots())
    const list = await openHistory()
    fireEvent.click(within(list).getByText('One'))
    fireEvent.click(await screen.findByRole('button', { name: 'Label…' }))
    fireEvent.change(await screen.findByLabelText('Label'), { target: { value: 'shown to the BOARD' } })
    fireEvent.click(screen.getByRole('button', { name: 'Label' }))
    expect((await screen.findByRole('alert', { hidden: true })).textContent).toContain('already has a label with that name')
  })
})

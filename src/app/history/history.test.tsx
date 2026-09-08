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
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { InMemoryProjectHistory } from '../../adapters/memory/InMemoryProjectHistory'
import { InMemoryProjectStore } from '../../adapters/memory/InMemoryProjectStore'
import type { HostModel } from '../../model/fromInterchange'
import type { ProjectSnapshot } from '../../projects/project'
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
  customerName: 'Acme',
  elements: [],
  connections: [],
  diagrams: [{ id: 'd1', kind: 'layer7', name: 'L7', placements: [] }],
  ...over,
})

const project = (): ProjectSnapshot => ({
  ref: { group: 'acme', project: 'landscape' },
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
    ...rest,
  }
  return { history, calls }
}

function show(history?: ProjectHistory) {
  const projects = new InMemoryProjectStore([project()])
  return { ...renderApp({ projects, initialProject: project(), history }), projects }
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
      const stored = await view.projects.load({ group: 'acme', project: 'landscape' })
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
    id: 'abc1234', subject: 'Before the merger', at: 1_757_000_000_000, author: 'W. Simons',
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
            lifecycle: 'live', isManaged: true, aspects: {}, parameters: {},
          }],
        }),
      }),
    })
    show(held.history)
    await openSaveMenu()
    await waitFor(() => expect(screen.getByText('History…')).toBeDefined())
    fireEvent.click(screen.getByText('History…'))

    expect(await screen.findByText('Before the merger')).toBeDefined()
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
      projects: new InMemoryProjectStore([project()]),
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
      aspects: {}, parameters: {}, description: 'Sends the invoices.',
    }],
    decisions: [{
      id: 'adr-1', number: 1, title: 'One writer', status: 'proposed', date: '2026-09-01', body: 'Why.', signers: [],
    }],
  })
  const withDescribed = (): ProjectSnapshot => ({ ...project(), model: described() })

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
      touched: ['acme/landscape/diagrams/d1.placements.json', 'acme/landscape/diagrams/d1.json'],
      projects: [{ ...withDescribed(), model: { ...described(), diagrams: [{ id: 'd1', kind: 'layer7', name: 'Old name', placements: [] }] } }],
    },
  ])

  function showDescribed(history: InMemoryProjectHistory) {
    const projects = new InMemoryProjectStore([withDescribed()])
    return renderApp({ projects, initialProject: withDescribed(), history })
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

  it('says so when no snapshot touched the thing', async () => {
    showDescribed(new InMemoryProjectHistory([
      { id: 'c1', subject: 'Something else', at, author: 'W.', touched: ['acme/landscape/model.json'] },
    ]))
    fireEvent.click(await screen.findByTestId('history-of-the-diagram'))
    expect(await screen.findByText('No snapshot has touched this yet.')).toBeDefined()
  })
})

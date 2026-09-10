// @vitest-environment jsdom
/**
 * Git sync as the shell drives it (ADR-0005): the notice with its two
 * answers, the push after a snapshot, and what the boot's pull is turned into.
 *
 * The seam is faked and git is not here; what is under test is that every
 * answer git can give ends up as a notice or a strip, never a modal and never
 * a blocked save — and that *take theirs* re-reads the open project from
 * disk while *keep ours* leaves it alone.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { InMemoryProjectStore } from '../adapters/memory/InMemoryProjectStore'
import type { PullOutcome, PushOutcome, ResolveOutcome, SyncSide } from '../platform/sync'
import type { LocalSettings } from '../projects/folderSettings'
import type { ProjectSnapshot } from '../projects/project'
import type { FolderSettingsStore } from '../ports/FolderSettings'
import type { ProjectHistory } from '../ports/ProjectHistory'
import { renderApp } from './testing/renderShell'

vi.mock('../editor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor')>()
  return { ...actual, SolutionDesignEditor: () => <div data-testid="editor" /> }
})

afterEach(() => cleanup())

const project = (name = 'Landscape'): ProjectSnapshot => ({
  ref: { group: 'acme', project: 'landscape' },
  model: {
    name, customerName: 'Acme', elements: [], relations: [],
    diagrams: [{ id: 'd1', kind: 'layer7', name: 'L7', placements: [] }],
  },
  activeDiagramId: 'd1',
  logoLibrary: [],
})

/** A promise, and the way to settle it from somewhere else. */
function deferred() {
  let settle = () => {}
  const promise = new Promise<void>((resolve) => { settle = resolve })
  return { promise, settle }
}

/**
 * The seam, and a way to wait for the work rather than for the clock.
 *
 * `asked.push` and `asked.resolve` settle the moment the fake is called, and
 * every test here waits for one inside `act`. That is deterministic where
 * polling the DOM is not: everything behind a snapshot in this file is
 * microtasks — a save that writes nothing, a fake that answers at once — and
 * an awaited `act` drains the microtask queue and flushes React before it
 * returns, so the notice is on screen by then. `findBy*` would instead race a
 * one-second timer against a machine running the rest of the suite beside it,
 * which measures the machine rather than the shell.
 */
function fakeHistory(answers: {
  push?: PushOutcome
  pull?: PullOutcome
  resolve?: ResolveOutcome
} = {}) {
  const calls = { pushes: 0, resolved: [] as SyncSide[], snapshots: 0 }
  const asked = { push: deferred(), resolve: deferred() }
  const history: ProjectHistory = {
    available: () => Promise.resolve(true),
    keeping: () => Promise.resolve(true),
    start: () => Promise.resolve(),
    snapshot: () => { calls.snapshots += 1; return Promise.resolve(true) },
    entries: () => Promise.resolve([]),
    projectAt: () => Promise.resolve(undefined),
    label: () => Promise.resolve('done'),
    sync: {
      remote: () => Promise.resolve({ name: 'origin', branch: 'main' }),
      pull: () => Promise.resolve(answers.pull ?? 'done'),
      push: () => {
        calls.pushes += 1
        asked.push.settle()
        return Promise.resolve(answers.push ?? 'done')
      },
      resolve: (side) => {
        calls.resolved.push(side)
        asked.resolve.settle()
        return Promise.resolve(answers.resolve ?? 'done')
      },
    },
  }
  return { history, calls, asked: { push: asked.push.promise, resolve: asked.resolve.promise } }
}

function folderSettings(local: LocalSettings): FolderSettingsStore {
  return {
    id: 'fake',
    readFolder: () => Promise.resolve({}),
    readLocal: () => Promise.resolve(local),
    writeLocal: () => Promise.resolve(),
  }
}

const pushing = folderSettings({ git: { pullOnOpen: false, pushAfterSnapshot: true } })
const quiet = folderSettings({ git: { pullOnOpen: false, pushAfterSnapshot: false } })

function show(over: Parameters<typeof renderApp>[0] = {}) {
  const projects = new InMemoryProjectStore([project()])
  return { ...renderApp({ projects, initialProject: project(), ...over }), projects }
}

/** Everything the fakes have queued, carried out and drawn. */
function settled(work: Promise<void> = Promise.resolve()) {
  return act(() => work)
}

/** Take a snapshot through the overflow, the way a person on the web would. */
async function takeSnapshot() {
  // The menu offers a snapshot only once the seam has answered `available()`,
  // which is one microtask; from there every click renders inside `act`.
  await settled()
  fireEvent.click(screen.getByTestId('overflow-button'))
  fireEvent.click(screen.getByText('Snapshot…'))
  fireEvent.click(screen.getByText('Take snapshot'))
}

describe('what the boot’s pull becomes', () => {
  it('nothing, when it went well or was never asked for', () => {
    show({ initialSync: 'done' })
    expect(screen.queryByTestId('sync-notice')).toBeNull()
    cleanup()
    show()
    expect(screen.queryByTestId('sync-notice')).toBeNull()
  })

  it('a notice, when the remote refused — the folder still opened', () => {
    show({ initialSync: 'credentials' })
    expect(screen.getByText(/refused this machine/)).toBeDefined()
    expect(screen.getByTestId('editor')).toBeDefined()
  })

  it('the standing strip, when the two sides disagree', () => {
    show({ initialSync: 'diverged', ...fakeHistory() })
    expect(screen.getByTestId('sync-notice')).toBeDefined()
    expect(screen.getByText('Take theirs')).toBeDefined()
    expect(screen.getByText('Keep ours')).toBeDefined()
  })
})

describe('the push after a snapshot', () => {
  it('happens when this machine says so, and says it did', async () => {
    const held = fakeHistory({ push: 'done' })
    show({ history: held.history, folderSettings: pushing })
    await takeSnapshot()
    await settled(held.asked.push)
    expect(held.calls.pushes).toBe(1)
    expect(screen.getByText('Pushed to the remote.')).toBeDefined()
  })

  it('does not happen when this machine does not say so', async () => {
    const held = fakeHistory()
    show({ history: held.history, folderSettings: quiet })
    await takeSnapshot()
    await settled()
    expect(held.calls.pushes).toBe(0)
  })

  it('does not happen without the folder scope at all', async () => {
    const held = fakeHistory()
    show({ history: held.history })
    await takeSnapshot()
    await settled()
    expect(held.calls.pushes).toBe(0)
  })

  it('never unmakes the snapshot: a refusal is a notice', async () => {
    const held = fakeHistory({ push: 'unreachable' })
    show({ history: held.history, folderSettings: pushing })
    await takeSnapshot()
    await settled(held.asked.push)
    expect(screen.getByText(/was not pushed/)).toBeDefined()
    expect(held.calls.snapshots).toBe(1)
    expect(screen.queryByTestId('sync-notice')).toBeNull()
  })

  it('turns a rejection into the same strip a diverged pull gives', async () => {
    const held = fakeHistory({ push: 'rejected' })
    show({ history: held.history, folderSettings: pushing })
    await takeSnapshot()
    await settled(held.asked.push)
    expect(screen.getByTestId('sync-notice')).toBeDefined()
  })
})

describe('the two answers', () => {
  it('take theirs: the remote stands, and the open project is read again from disk', async () => {
    const held = fakeHistory()
    const view = show({ initialSync: 'diverged', history: held.history, folderSettings: quiet })
    // What "disk" now holds, as the remote left it.
    await view.projects.save(project('From the remote'))
    fireEvent.click(screen.getByText('Take theirs'))

    await settled(held.asked.resolve)
    expect(held.calls.resolved).toEqual(['theirs'])
    expect(screen.queryByTestId('sync-notice')).toBeNull()
    expect(screen.getByText('From the remote')).toBeDefined()
  })

  it('keep ours: our version stands, unread and unmoved', async () => {
    const held = fakeHistory()
    const view = show({ initialSync: 'diverged', history: held.history, folderSettings: quiet })
    await view.projects.save(project('From the remote'))
    fireEvent.click(screen.getByText('Keep ours'))

    await settled(held.asked.resolve)
    expect(held.calls.resolved).toEqual(['ours'])
    expect(screen.queryByTestId('sync-notice')).toBeNull()
    expect(screen.getByText('Landscape')).toBeDefined()
    expect(screen.queryByText('From the remote')).toBeNull()
    // Not pushed: this machine did not say so.
    expect(held.calls.pushes).toBe(0)
  })

  it('keep ours pushes straight away where this machine pushes after a snapshot', async () => {
    const held = fakeHistory()
    show({ initialSync: 'diverged', history: held.history, folderSettings: pushing })
    fireEvent.click(screen.getByText('Keep ours'))
    await settled(held.asked.push)
    expect(held.calls.pushes).toBe(1)
  })

  it('a refusal leaves the folder as it was, and the question standing', async () => {
    const held = fakeHistory({ resolve: 'unreachable' })
    show({ initialSync: 'diverged', history: held.history, folderSettings: quiet })
    fireEvent.click(screen.getByText('Take theirs'))
    await settled(held.asked.resolve)
    expect(screen.getByText(/Nothing was changed/)).toBeDefined()
    expect(screen.getByTestId('sync-notice')).toBeDefined()
  })
})

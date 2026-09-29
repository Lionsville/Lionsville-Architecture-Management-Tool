// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The index, held read-only by the session (ADR-0012 §2, §10).
 *
 * Three things here are easy to get wrong and invisible when they are. Reading
 * on a keystroke — a pass over every scope in the organisation, while somebody
 * is typing a name. Emptying the index when a read fails — which turns one
 * unreadable folder into a finding on every stand-in in the tree. And watching
 * the open scope rather than the whole folder, which would make the drift
 * check blind to exactly the change it exists for: a sibling domain renaming
 * the thing this one draws.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import type { DesignElement } from '../model'
import type { IndexRead, OrganisationIndex } from '../ports/OrganisationIndex'
import type { ScopeModel } from '../projects/scope'
import { useIndex } from './useIndex'
import type { IndexHook } from './useIndex'

afterEach(() => cleanup())

function element(id: string, over: Partial<DesignElement> = {}): DesignElement {
  return {
    id, kind: 'application', name: id, lifecycle: 'live', isManaged: true, aspects: {}, ...over,
  }
}

/**
 * An index over what `models` answers, each scope's identity its address. It
 * answers `since` where the test says what changed, and nothing — read it all
 * again — where it does not.
 */
function indexOver(models: () => Promise<ScopeModel[]>, since?: OrganisationIndex['since']): OrganisationIndex {
  let reads = 0
  return {
    id: 'an index for a test',
    read: async (): Promise<IndexRead> => ({
      revision: `read ${reads += 1}`,
      scopes: (await models()).map(({ path, model }) => ({ id: path, address: path, model })),
    }),
    since: since ?? (() => Promise.resolve(undefined)),
  }
}

function mount(deps: {
  models?: () => Promise<ScopeModel[]>
  since?: OrganisationIndex['since']
  watch?: (onChanged: () => void) => () => void
  onFailure?: (where: string, cause: unknown) => void
}) {
  let hook!: IndexHook
  // One index for the life of the host, the way `App` holds the one it was
  // handed: the hook reads again when that object is swapped, so a fresh
  // literal per render would be a read per render.
  const index = indexOver(deps.models ?? (() => Promise.resolve([])), deps.since)
  function Host(props: { index: OrganisationIndex }) {
    hook = useIndex({
      index: props.index,
      watch: deps.watch,
      onFailure: deps.onFailure ?? (() => {}),
    })
    return null
  }
  const mounted = render(<Host index={index} />)
  const read = () => hook
  /** The same host, over another source's index — what opening a folder after the boot does. */
  read.swap = (models: () => Promise<ScopeModel[]>) => mounted.rerender(<Host index={indexOver(models)} />)
  return read
}

describe('useIndex', () => {
  it('reads the tree once when the app starts', async () => {
    const models = vi.fn(() => Promise.resolve([
      { path: 'retail', model: { elements: [element('erp')], relations: [] } },
    ]))
    const hook = mount({ models })
    await waitFor(() => expect(hook().index.lookup('erp')?.master).toBe('retail'))
    expect(models).toHaveBeenCalledTimes(1)
  })

  /**
   * Before the first read has landed, and for the whole of a browser tab that
   * has nothing. An index over nothing has heard of no id, so every scope
   * answers for its own records — which is what this app did before the tree
   * had an index at all, and is why nothing below has a loading state.
   */
  it('answers for every id from the first render, having read nothing', () => {
    const hook = mount({})
    expect(hook().index.lookup('erp')).toBeUndefined()
    expect(hook().index.takenIds().size).toBe(0)
  })

  /**
   * The desktop opens a folder from the Recent menu by rendering the same
   * `App` again over the folder's store (`main.tsx`, `workIn`). An index read
   * once, over the store the boot had, would stand for the whole session:
   * every stand-in dangling, every application unowned, and the map's
   * columns said by their ids.
   */
  it('reads it again when the index it reads from is swapped', async () => {
    const before = vi.fn(() => Promise.resolve<ScopeModel[]>([]))
    const hook = mount({ models: before })
    await waitFor(() => expect(before).toHaveBeenCalledTimes(1))
    expect(hook().index.lookup('erp')).toBeUndefined()

    hook.swap(() => Promise.resolve([
      { path: 'retail', model: { elements: [element('erp')], relations: [] } },
    ]))
    await waitFor(() => expect(hook().index.lookup('erp')?.master).toBe('retail'))
    expect(before).toHaveBeenCalledTimes(1)
  })

  it('reads it again when the folder changes under us', async () => {
    let held: ScopeModel[] = [{ path: 'retail', model: { elements: [element('erp')], relations: [] } }]
    let tell = () => {}
    const hook = mount({
      models: () => Promise.resolve(held),
      watch: (onChanged) => { tell = onChanged; return () => {} },
    })
    await waitFor(() => expect(hook().index.lookup('erp')?.master).toBe('retail'))

    held = [{ path: 'finance', model: { elements: [element('erp')], relations: [] } }]
    await act(async () => { tell() })
    await waitFor(() => expect(hook().index.lookup('erp')?.master).toBe('finance'))
  })

  /**
   * The watcher already coalesces a burst of file events into one report; what
   * this adds is the guard it cannot give. Three reports arriving while the
   * first read is in flight are one more pass, not three.
   */
  it('does not start a second read over one already in flight', async () => {
    let settle: (models: ScopeModel[]) => void = () => {}
    const models = vi.fn(() => new Promise<ScopeModel[]>((resolve) => { settle = resolve }))
    let tell = () => {}
    const hook = mount({ models, watch: (onChanged) => { tell = onChanged; return () => {} } })

    expect(models).toHaveBeenCalledTimes(1)
    act(() => { tell(); tell(); tell() })
    expect(models).toHaveBeenCalledTimes(1)

    await act(async () => { settle([{ path: 'retail', model: { elements: [element('erp')], relations: [] } }]) })
    expect(models).toHaveBeenCalledTimes(2)
    await act(async () => { settle([]) })
    expect(models).toHaveBeenCalledTimes(2)
    expect(hook().index.lookup('erp')).toBeUndefined()
  })

  /**
   * An empty index is not a safe default: it says every stand-in in the tree
   * is dangling and every application is owned by nobody — findings about a
   * read that did not happen, drawn over work that is perfectly fine.
   */
  it('keeps the index it had when a read fails, and reports it', async () => {
    let fail = false
    const onFailure = vi.fn()
    let tell = () => {}
    const hook = mount({
      models: () => (fail
        ? Promise.reject(new Error('drive gone'))
        : Promise.resolve([{ path: 'retail', model: { elements: [element('erp')], relations: [] } }])),
      watch: (onChanged) => { tell = onChanged; return () => {} },
      onFailure,
    })
    await waitFor(() => expect(hook().index.lookup('erp')?.master).toBe('retail'))

    fail = true
    await act(async () => { tell() })
    await waitFor(() => expect(onFailure).toHaveBeenCalledWith('index', expect.any(Error)))
    expect(hook().index.lookup('erp')?.master).toBe('retail')
  })

  /** What changed since the index it holds, where the source can say, rather than the whole of it again. */
  it('folds in what changed since the index it holds, and reads all of it only where that cannot be said', async () => {
    const models = vi.fn(() => Promise.resolve<ScopeModel[]>([
      { path: 'retail', model: { elements: [element('erp')], relations: [] } },
      { path: 'finance', model: { elements: [element('ledger')], relations: [] } },
    ]))
    const since = vi.fn(() => Promise.resolve({
      revision: 'later',
      changed: [{ id: 'retail', address: 'retail', model: { elements: [element('erp'), element('pos')], relations: [] } }],
      removed: ['finance'],
    }))
    let tell = () => {}
    const hook = mount({ models, since, watch: (onChanged) => { tell = onChanged; return () => {} } })
    await waitFor(() => expect(hook().index.lookup('ledger')?.master).toBe('finance'))

    await act(async () => { tell() })
    await waitFor(() => expect(hook().index.lookup('pos')?.master).toBe('retail'))
    expect(hook().index.lookup('ledger')).toBeUndefined()
    expect(since).toHaveBeenCalledWith('read 1')
    expect(models).toHaveBeenCalledTimes(1)
  })

  it('stops watching when it goes away', async () => {
    const off = vi.fn()
    mount({ watch: () => off })
    await waitFor(() => expect(off).not.toHaveBeenCalled())
    cleanup()
    expect(off).toHaveBeenCalled()
  })
})

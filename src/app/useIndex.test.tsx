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
import { scopeTree } from '../projects/scope'
import type { ScopeModel, ScopeSnapshot, ScopeSummary } from '../projects/scope'
import type { ScopePath } from '../projects/scopePath'
import { useIndex } from './useIndex'
import type { IndexHook } from './useIndex'

afterEach(() => cleanup())

function element(id: string, over: Partial<DesignElement> = {}): DesignElement {
  return {
    id, kind: 'application', name: id, lifecycle: 'live', isManaged: true, aspects: {}, ...over,
  }
}

const listing = (paths: readonly ScopePath[]): ScopeSummary => scopeTree(
  paths.map((path) => ({ path, name: path, diagrams: 0, children: [] })),
)

function mount(deps: {
  models?: () => Promise<ScopeModel[]>
  list?: () => Promise<ScopeSummary>
  load?: (path: ScopePath) => Promise<ScopeSnapshot | undefined>
  watch?: (onChanged: () => void) => () => void
  onFailure?: (where: string, cause: unknown) => void
}) {
  let hook!: IndexHook
  function Host() {
    hook = useIndex({
      scopes: {
        ...(deps.models ? { models: deps.models } : {}),
        list: deps.list ?? (() => Promise.resolve(listing([]))),
        load: deps.load ?? (() => Promise.resolve(undefined)),
      },
      watch: deps.watch,
      onFailure: deps.onFailure ?? (() => {}),
    })
    return null
  }
  render(<Host />)
  return () => hook
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

  it('stops watching when it goes away', async () => {
    const off = vi.fn()
    mount({ watch: () => off })
    await waitFor(() => expect(off).not.toHaveBeenCalled())
    cleanup()
    expect(off).toHaveBeenCalled()
  })
})

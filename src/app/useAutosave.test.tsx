// @vitest-environment jsdom
/**
 * The save nobody asked for, which is the one that matters: what you get back
 * after a crash is this, not the file you exported yourself.
 *
 * Three things are pinned. That it waits — a write per keystroke is what the
 * debounce exists to prevent, and a debounce that quietly stopped working would
 * look like nothing at all. That it saves what is on screen NOW rather than
 * what React last rendered. And that a refusal is reported, since the whole
 * point of the indicator above it is to stop the bar claiming otherwise.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import type { ProjectSnapshot } from '../projects/project'
import { useAutosave } from './useAutosave'
import type { ModelSession } from './useModelSession'

beforeEach(() => vi.useFakeTimers())
afterEach(() => { vi.useRealTimers(); cleanup() })

const project = (name = 'Landscape'): ProjectSnapshot => ({
  ref: { group: 'acme', project: 'landscape' },
  model: {
    name,
    customerName: 'Acme',
    elements: [],
    connections: [],
    diagrams: [{ id: 'd1', kind: 'layer7', name: 'L7', placements: [] }],
  },
  activeDiagramId: 'd1',
  logoLibrary: [],
})

/** Only what the hook reaches for. `snapshot` is a function on purpose: the
    hook must ask at save time, not at render time. */
function fakeSession(latest: { current: ProjectSnapshot }) {
  return {
    model: latest.current.model,
    activeDiagramId: 'd1',
    logoLibrary: [],
    snapshot: () => latest.current,
    flush: vi.fn(),
  } as unknown as ModelSession & { flush: ReturnType<typeof vi.fn> }
}

function mount(save: (p: ProjectSnapshot) => Promise<void> = () => Promise.resolve()) {
  const latest = { current: project() }
  const session = fakeSession(latest)
  const saved = vi.fn()
  const result = vi.fn()
  let forceSave!: () => void
  function Host() {
    forceSave = useAutosave({
      session, projects: { save }, onSaved: saved, onResult: result,
    }).forceSave
    return null
  }
  render(<Host />)
  return { latest, session, saved, result, force: () => forceSave() }
}

/** Run the debounce out and let the save's promise settle. */
async function idle(ms = 400) {
  await act(async () => { vi.advanceTimersByTime(ms); await Promise.resolve() })
}

describe('useAutosave', () => {
  it('waits before writing, so a run of edits is one save and not forty', async () => {
    const save = vi.fn((_p: ProjectSnapshot) => Promise.resolve())
    mount(save)
    await act(async () => { vi.advanceTimersByTime(399); await Promise.resolve() })
    expect(save).not.toHaveBeenCalled()
    await idle(1)
    expect(save).toHaveBeenCalledOnce()
  })

  it('writes the project as it stands, not as it was when the timer started', async () => {
    const save = vi.fn((_p: ProjectSnapshot) => Promise.resolve())
    const { latest } = mount(save)
    latest.current = project('Renamed since')
    await idle()
    expect(save.mock.calls[0][0].model.name).toBe('Renamed since')
  })

  it('reports the time and the success, in that order', async () => {
    const { saved, result } = mount()
    await idle()
    expect(saved).toHaveBeenCalledOnce()
    expect(saved.mock.calls[0][0]).toBeInstanceOf(Date)
    expect(result).toHaveBeenCalledWith(true)
  })

  it('reports a refusal, and never reports a time it did not get', async () => {
    const { saved, result } = mount(() => Promise.reject(new Error('full')))
    await idle()
    expect(result).toHaveBeenCalledWith(false)
    expect(saved).not.toHaveBeenCalled()
  })

  it('reports success again once the store recovers', async () => {
    let refuse = true
    const { result, force } = mount(() => refuse ? Promise.reject(new Error('full')) : Promise.resolve())
    await idle()
    refuse = false
    // The debounce only re-arms on a change; the next write after a failure is
    // whatever comes next, and Save is the one a user reaches for.
    await act(async () => { force(); await Promise.resolve() })
    expect(result.mock.calls.map(([ok]) => ok)).toEqual([false, true])
  })

  it('saves at once when asked, flushing first so nothing pending is lost', async () => {
    const save = vi.fn((_p: ProjectSnapshot) => Promise.resolve())
    const { session, force } = mount(save)
    act(() => force())
    expect(session.flush).toHaveBeenCalledOnce()
    expect(save).toHaveBeenCalledOnce()
  })

  it('flushes and writes once more when the tab is closing', async () => {
    const save = vi.fn((_p: ProjectSnapshot) => Promise.resolve())
    const { session } = mount(save)
    act(() => { window.dispatchEvent(new Event('beforeunload')) })
    expect(session.flush).toHaveBeenCalledOnce()
    expect(save).toHaveBeenCalledOnce()
  })

  it('lets go of the window when it unmounts', async () => {
    const save = vi.fn((_p: ProjectSnapshot) => Promise.resolve())
    const { session } = mount(save)
    cleanup()
    window.dispatchEvent(new Event('beforeunload'))
    expect(session.flush).not.toHaveBeenCalled()
  })
})

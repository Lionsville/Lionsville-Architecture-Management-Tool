// @vitest-environment jsdom
/**
 * The save nobody asked for, which is the one that matters: what you get back
 * after a crash is this, not the file you exported yourself.
 *
 * What is pinned here is the machine as it is actually driven — the state
 * machine's own table is tested without React in
 * `projects/documentSession.test.ts`, and repeating it here would only prove
 * that the reducer is still the reducer. These are the things only the wiring
 * can get wrong: that the wait is a wait and restarts, that a save writes what
 * is on screen at that moment rather than at render time, that a refusal leaves
 * the document dirty and says so, and that closing the window with unsaved work
 * is interrupted rather than mourned.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { AUTOSAVE_IDLE_MS } from '../projects/documentSession'
import type { ProjectSnapshot } from '../projects/project'
import { useDocumentSession } from './useDocumentSession'
import type { DocumentSessionHook, SavableSession } from './useDocumentSession'

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

function mount(
  save: (p: ProjectSnapshot) => Promise<void> = () => Promise.resolve(),
  onDisk?: { current: ProjectSnapshot | undefined },
) {
  const latest = { current: project() }
  const saved = vi.fn()
  const result = vi.fn()
  const writes: ProjectSnapshot[] = []
  const adopted: ProjectSnapshot[] = []
  let hook!: DocumentSessionHook
  let announce: (() => void) | undefined
  let watching = 0

  // The session's own array, not a fresh one per render: the hook watches these
  // three by identity, exactly as `useEffect` does.
  const logoLibrary: unknown[] = []

  /** Only what the hook reaches for. `snapshot` is a function on purpose: the
      hook must ask at save time, not at render time. */
  function Host({ model }: { model: unknown }) {
    const session: SavableSession = {
      model, activeDiagramId: 'd1', logoLibrary, snapshot: () => latest.current,
    }
    hook = useDocumentSession({
      session,
      projects: {
        save: (p) => { writes.push(p); return save(p) },
        load: () => Promise.resolve(onDisk?.current),
      },
      onSaved: saved,
      onResult: result,
      watch: onDisk && ((onChanged) => {
        watching += 1
        announce = onChanged
        return () => { watching -= 1 }
      }),
      onAdopt: (held) => adopted.push(held),
    })
    return null
  }

  const view = render(<Host model={latest.current.model} />)
  return {
    latest,
    saved,
    result,
    writes,
    adopted,
    watching: () => watching,
    status: () => hook.state.status,
    somebodyElseWrote: () => act(() => announce?.()),
    takeTheirs: () => act(() => hook.takeTheirs()),
    keepMine: () => act(() => hook.keepMine()),
    unmount: () => view.unmount(),
    force: () => act(() => hook.forceSave()),
    /** What editing looks like from here: the model the session holds changes. */
    edit: (name: string) => act(() => {
      latest.current = project(name)
      view.rerender(<Host model={latest.current.model} />)
    }),
    idle: (ms = AUTOSAVE_IDLE_MS) => act(async () => { await vi.advanceTimersByTimeAsync(ms) }),
    leaveWindow: () => act(() => { window.dispatchEvent(new Event('blur')) }),
    close: () => {
      const event = new Event('beforeunload', { cancelable: true })
      act(() => { window.dispatchEvent(event) })
      return event.defaultPrevented
    },
  }
}

describe('a document that has just been opened', () => {
  it('is clean, and writing nothing is the point', async () => {
    const view = mount()
    expect(view.status()).toBe('clean')

    await view.idle()

    expect(view.writes).toHaveLength(0)
  })

  it('is dirty the moment something changes, and says so before it saves', async () => {
    const view = mount()
    view.edit('Edited')
    expect(view.status()).toBe('dirty')

    await view.idle(AUTOSAVE_IDLE_MS - 1)
    expect(view.writes).toHaveLength(0)

    await view.idle(1)
    expect(view.writes).toHaveLength(1)
    expect(view.status()).toBe('clean')
  })

  it('waits for the typing to stop, not for the first keystroke to age', async () => {
    // The bug this exists for: a timer armed on the change of status alone is
    // armed once and never again, because the fortieth keystroke leaves the
    // status where the first one put it.
    const view = mount()
    view.edit('One')
    await view.idle(AUTOSAVE_IDLE_MS - 500)
    view.edit('Two')
    await view.idle(AUTOSAVE_IDLE_MS - 500)

    expect(view.writes).toHaveLength(0)

    await view.idle(500)
    expect(view.writes).toHaveLength(1)
    expect(view.writes[0].model.name).toBe('Two')
  })

  it('writes what is on screen now, not what React last rendered', async () => {
    const view = mount()
    view.edit('Edited')
    view.latest.current = project('Newer still')

    await view.idle()

    expect(view.writes[0].model.name).toBe('Newer still')
  })
})

describe('when the store refuses', () => {
  it('stays dirty and reports it — the bar must not claim otherwise', async () => {
    const view = mount(() => Promise.reject(new Error('quota')))
    view.edit('Edited')
    await view.idle()

    expect(view.status()).toBe('dirty')
    expect(view.result).toHaveBeenCalledWith(false)
    expect(view.saved).not.toHaveBeenCalled()
  })

  it('tries again after the next edit', async () => {
    const view = mount(() => Promise.reject(new Error('quota')))
    view.edit('One')
    await view.idle()
    view.edit('Two')
    await view.idle()

    expect(view.writes).toHaveLength(2)
  })
})

describe('an edit while a write is in flight', () => {
  it('leaves the document dirty rather than clean', async () => {
    // The worst kind of loss is the one the app calls a success: a save that
    // started before the last keystroke lands and reports everything is fine.
    let settle!: () => void
    const view = mount(() => new Promise<void>((resolve) => { settle = resolve }))
    view.edit('One')
    await view.idle()
    expect(view.status()).toBe('saving')

    view.edit('Two')
    await act(async () => { settle(); await Promise.resolve() })

    expect(view.status()).toBe('dirty')

    await view.idle()
    expect(view.writes).toHaveLength(2)
  })
})

describe('the other two triggers', () => {
  it('leaving the window saves without waiting', () => {
    const view = mount()
    view.edit('Edited')
    view.leaveWindow()

    expect(view.writes).toHaveLength(1)
  })

  it('closing the window with unsaved work is interrupted', () => {
    const view = mount()
    view.edit('Edited')

    expect(view.close()).toBe(true)
  })

  it('closing with nothing outstanding is not', () => {
    // A prompt on every close is a prompt nobody reads by the third day.
    expect(mount().close()).toBe(false)
  })

  it('asks the store one last time on the way out', () => {
    const view = mount()
    view.edit('Edited')
    view.close()

    expect(view.writes).toHaveLength(1)
  })
})

describe('forceSave', () => {
  it('writes now, for the moments the editor knows there is something to lose', () => {
    const view = mount()
    view.edit('Edited')
    view.force()

    expect(view.writes).toHaveLength(1)
  })

  it('writes nothing when there is nothing to write', () => {
    const view = mount()
    view.force()

    expect(view.writes).toHaveLength(0)
  })
})

describe('when somebody else changes the folder', () => {
  const theirs = { current: project('Theirs') }

  it('says so, without touching what is on screen', () => {
    const view = mount(undefined, theirs)
    view.somebodyElseWrote()

    expect(view.status()).toBe('external-changed')
    expect(view.adopted).toEqual([])
  })

  it('becomes a conflict the moment we edit as well', () => {
    // The transition most implementations miss: what could have been answered
    // by reloading is now a question only a person can settle.
    const view = mount(undefined, theirs)
    view.somebodyElseWrote()
    view.edit('Mine')

    expect(view.status()).toBe('conflict')
  })

  it('refuses to save over their version behind their back', () => {
    const view = mount(undefined, theirs)
    view.edit('Mine')
    view.somebodyElseWrote()
    view.leaveWindow()

    expect(view.writes).toEqual([])
    expect(view.status()).toBe('conflict')
  })

  it('takes their version onto the screen when asked', async () => {
    const view = mount(undefined, theirs)
    view.somebodyElseWrote()
    view.takeTheirs()
    await act(async () => { await Promise.resolve() })

    expect(view.adopted.map((held) => held.model.name)).toEqual(['Theirs'])
    expect(view.status()).toBe('clean')
  })

  it('keeps ours when asked, and then writes over theirs', async () => {
    const view = mount(undefined, theirs)
    view.edit('Mine')
    view.somebodyElseWrote()
    expect(view.status()).toBe('conflict')

    view.keepMine()
    expect(view.status()).toBe('dirty')

    await view.idle()
    expect(view.writes.map((held) => held.model.name)).toEqual(['Mine'])
  })

  it('stops listening when the workspace goes', () => {
    // The workspace is remounted per project; a listener per project ever
    // opened is a leak with a slow fuse.
    const view = mount(undefined, theirs)
    expect(view.watching()).toBe(1)
    view.unmount()
    expect(view.watching()).toBe(0)
  })

  it('subscribes once, not once per render', () => {
    const view = mount(undefined, theirs)
    view.edit('One')
    view.edit('Two')

    expect(view.watching()).toBe(1)
  })
})

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
import { laidOut } from '../model/testFixtures';
import { act, cleanup, render } from '@testing-library/react'
import { AUTOSAVE_IDLE_MS } from '../projects/documentSession'
import type { ScopeSnapshot } from '../projects/scope'
import type { SourceStatus, SourceWork, SourceWorkChanged } from '../platform/sourceProvider'
import { useDocumentSession } from './useDocumentSession'
import type { DocumentSessionHook, SavableSession, ScopeWriter } from './useDocumentSession'
import type { PendingStep, SessionJournal } from './useModelSession'
import { ShellError } from '../platform/errors'
import type { ScopeStep } from '../projects/scopeState'

beforeEach(() => vi.useFakeTimers())
afterEach(() => { vi.useRealTimers(); cleanup() })

const project = (name = 'Landscape'): ScopeSnapshot => ({
  path: 'acme/landscape',
  model: {
    name,
    elements: [],
    relations: [],
    diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [] })],
  },
  activeDiagramId: 'd1',
  logoLibrary: [],
})

function mount(
  save: (p: ScopeSnapshot) => Promise<void> = () => Promise.resolve(),
  onDisk?: { current: ScopeSnapshot | undefined },
  sourceStatus?: (work: SourceWork) => SourceStatus,
  onSourceWork?: SourceWorkChanged,
) {
  const latest = { current: project() }
  const saved = vi.fn()
  const result = vi.fn()
  /** What was on screen at each write, as the steps written said it. */
  const writes: ScopeSnapshot[] = []
  /** The steps each write carried, and what it expected. */
  const sent: { steps: readonly ScopeStep[]; expects?: string }[] = []
  const adopted: ScopeSnapshot[] = []
  const reported: boolean[] = []
  let hook!: DocumentSessionHook
  let announce: (() => void) | undefined
  let watching = 0

  // The session's own array, not a fresh one per render: the hook watches these
  // three by identity, exactly as `useEffect` does.
  const logoLibrary: unknown[] = []
  // What the session has done and not yet written, as the session keeps it.
  let pending: PendingStep[] = []
  const journal: SessionJournal = {
    pending: () => pending,
    written: (count) => { pending = pending.slice(count) },
    adopted: () => adopted.length,
  }
  let revision = 0
  const writer: ScopeWriter = {
    write: (steps, expects) => {
      sent.push({ steps, ...(expects !== undefined ? { expects } : {}) })
      writes.push({ ...latest.current })
      return save(latest.current).then(() => `r${++revision}`)
    },
    read: () => Promise.resolve(onDisk?.current),
    put: () => Promise.reject(new Error('no pictures here')),
  }

  /** Only what the hook reaches for. `snapshot` is a function on purpose: the
      hook must ask at save time, not at render time. */
  function Host({ model, active = 'd1' }: { model: unknown; active?: string }) {
    const session: SavableSession = {
      model, activeDiagramId: active, logoLibrary, snapshot: () => latest.current, journal,
    }
    hook = useDocumentSession({
      session,
      writer,
      onSaved: saved,
      onResult: result,
      onUnsavedWork: (held) => reported.push(held),
      watch: onDisk && ((onChanged) => {
        watching += 1
        announce = onChanged
        return () => { watching -= 1 }
      }),
      onAdopt: (held) => adopted.push(held),
      sourceStatus,
      onSourceWork,
    })
    return null
  }

  const view = render(<Host model={latest.current.model} />)
  return {
    latest,
    saved,
    result,
    writes,
    sent,
    adopted,
    reported,
    watching: () => watching,
    status: () => hook.state.status,
    somebodyElseWrote: () => act(() => announce?.()),
    takeTheirs: () => act(() => hook.takeTheirs()),
    keepMine: () => act(() => hook.keepMine()),
    unmount: () => view.unmount(),
    /** Another tab up, the document as it was. */
    switchTab: (id: string) => act(() => { view.rerender(<Host model={latest.current.model} active={id} />) }),
    // The callback returns nothing on purpose: `act` given a promise becomes
    // the async form, which has to be awaited, and one that is not leaves React
    // unable to render anything afterwards.
    force: () => act(() => { void hook.forceSave() }),
    /** What editing looks like from here: the model the session holds changes. */
    edit: (name: string) => act(() => {
      latest.current = project(name)
      pending = [...pending, { stepId: `step-${pending.length}`, command: { type: 'project.settings', patch: { name } }, at: 0 }]
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

  it('is not made dirty by switching tabs: which diagram is up rides with the next save', async () => {
    // Opening a landscape used to say "Unsaved changes" and then "Saved" a
    // few seconds later, on a document nobody had touched.
    const view = mount()
    view.switchTab('d2')
    expect(view.status()).toBe('clean')
    expect(view.reported).not.toContain(true)
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
    const refusal = new Error('quota')
    const view = mount(() => Promise.reject(refusal))
    view.edit('Edited')
    await view.idle()

    expect(view.status()).toBe('dirty')
    // The cause travels with the fact, which it did not before: a source that
    // keeps work somewhere other than this browser says in its own words what a
    // refusal there means, and this is the one place holding both the refusal
    // and the thing refused.
    expect(view.result).toHaveBeenCalledWith(false, refusal)
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

  it('interrupts the close with unsaved work, and not without, asking the store one last time', () => {
    const view = mount()
    view.edit('Edited')

    expect(view.close()).toBe(true)
    cleanup()
    // A prompt on every close is a prompt nobody reads by the third day.
    expect(mount().close()).toBe(false)
    cleanup()
    const view2 = mount()
    view2.edit('Edited')
    view2.close()

    expect(view2.writes).toHaveLength(1)
  })

})

describe('forceSave', () => {
  it('writes now for the moments the editor knows there is something to lose, and nothing otherwise', () => {
    const view = mount()
    view.edit('Edited')
    view.force()

    expect(view.writes).toHaveLength(1)
    cleanup()
    const view2 = mount()
    view2.force()

    expect(view2.writes).toHaveLength(0)
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

  /**
   * Theirs removed what this session changed: every step of mine replayed on
   * theirs is refused as one, at every try. So what is on screen lands whole,
   * over the state just read and expecting it — mine over theirs, as asked.
   */
  it('keeps ours whole where a step of ours cannot land on theirs', async () => {
    const onDisk = { current: { ...project('Theirs'), revision: 'r-theirs' } as ScopeSnapshot | undefined }
    let tries = 0
    const view = mount(() => (tries++ === 0 ? Promise.reject(new ShellError('command.gone')) : Promise.resolve()), onDisk)
    view.edit('Mine')
    view.somebodyElseWrote()
    view.keepMine()
    await view.idle()

    expect(view.sent.map((one) => [one.steps.map((step) => step.command.type), one.expects])).toEqual([
      [['project.settings'], undefined],
      [['scope.replace'], 'r-theirs'],
    ])
    const replaced = view.sent[1].steps[0].command
    expect(replaced.type === 'scope.replace' && replaced.content.model.name).toBe('Mine')
    expect(view.status()).toBe('clean')
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

describe('what the window is told', () => {
  it('says there is nothing to lose while clean, that there is the moment there is, and takes it back', async () => {
    // The desktop window belongs to another process and cannot know unless it
    // is told; a browser tab has `beforeunload` and is told nothing.
    expect(mount().reported).toEqual([false])
    cleanup()
    const view = mount()
    view.edit('Edited')
    expect(view.reported.at(-1)).toBe(true)
    cleanup()
    const view2 = mount()
    view2.edit('Edited')
    await view2.idle()
    expect(view2.reported.at(-1)).toBe(false)
    cleanup()
    const view3 = mount()
    view3.edit('Edited')
    view3.unmount()
    expect(view3.reported.at(-1)).toBe(false)
  })

})

/**
 * A source that keeps work somewhere other than a file means something else by
 * the five words, and says so through its provider
 * (`platform/sourceProvider.ts`). What it may never do is change what this
 * hook DOES: when it writes, whether anything is outstanding, and whether
 * closing the window is interrupted are the hook's questions, decided on the
 * machine's own answer.
 */
describe('a source with a word of its own on the status', () => {
  it('is what the bar reads, in place of the machine\'s own answer', () => {
    const view = mount(undefined, undefined, () => 'conflict')
    expect(view.status()).toBe('conflict')
  })

  it('is told what the machine made of it, and what it kept beside it', () => {
    const seen: SourceWork[] = []
    const view = mount(undefined, undefined, (work) => { seen.push(work); return work.status })
    view.edit('Renamed')
    expect(view.status()).toBe('dirty')
    expect(seen.at(-1)).toEqual({ status: 'dirty', editedWhileSaving: false })
  })

  it('does not move when a save happens, or whether the window may close', async () => {
    // Everything it renames still writes on the same schedule and still
    // interrupts a close with work in hand.
    const view = mount(undefined, undefined, () => 'clean')
    view.edit('Renamed')

    await view.idle()

    // It calls everything clean, and the write still happened on the machine's
    // schedule; with nothing outstanding the close is not interrupted.
    expect(view.writes).toHaveLength(1)
    expect(view.close()).toBe(false)

    // And with something outstanding it still is, whatever the source calls it.
    view.edit('Again')
    expect(view.close()).toBe(true)
  })

  it('is only ever asked about the five words it answers for', () => {
    // Nothing to be attached to is the one state that is genuinely about a
    // file, and a provider hearing about it would be answering for somewhere
    // it does not keep anything. Its type says so; this says the wiring does.
    const five = ['clean', 'dirty', 'saving', 'external-changed', 'conflict']
    const asked: string[] = []
    const view = mount(undefined, undefined, (work) => { asked.push(work.status); return work.status })
    view.edit('Renamed')
    expect(asked.length).toBeGreaterThan(0)
    expect(asked.filter((status) => !five.includes(status))).toEqual([])
  })
})

/**
 * The same source, saying its answer has moved.
 *
 * `statusOf` is asked again whenever the document's machine moves, which is
 * every answer a file has. A source that keeps work somewhere else has answers
 * the machine knows nothing about — and no keystroke to hang them on.
 */
describe('a source that says its own answer has moved', () => {
  it('is asked again, and the bar says what it now says', () => {
    let word: SourceStatus = 'clean'
    let tell: (() => void) | undefined
    const view = mount(undefined, undefined, () => word, (listener) => {
      tell = listener
      return () => { tell = undefined }
    })
    expect(view.status()).toBe('clean')

    // Nothing has been typed and nothing has been written: the machine has not
    // moved at all, and the word on the bar has.
    word = 'dirty'
    act(() => tell?.())
    expect(view.status()).toBe('dirty')
    expect(view.writes).toEqual([])

    // And back again, which is why this is a counter and not a flag.
    word = 'clean'
    act(() => tell?.())
    expect(view.status()).toBe('clean')
  })

  it('is let go of when the workspace goes', () => {
    let listeners = 0
    const view = mount(undefined, undefined, () => 'clean', () => {
      listeners += 1
      return () => { listeners -= 1 }
    })
    expect(listeners).toBe(1)
    view.unmount()
    expect(listeners).toBe(0)
  })
})

/**
 * What is written is what was done here (ADR-0031 §1): the session's own
 * commands as steps, expecting the revision last known, with what the scope
 * says about itself and its library beside them — and never the scope whole.
 */
describe('what a write carries', () => {
  type Written = { steps: readonly ScopeStep[]; expects?: string }

  function writing(answer: (written: Written) => Promise<string> = () => Promise.resolve('r2')) {
    const written: Written[] = []
    let pending: PendingStep[] = []
    let snapshot: ScopeSnapshot = { ...project(), revision: 'r1', images: [] }
    let hook!: DocumentSessionHook
    const journal: SessionJournal = {
      pending: () => pending,
      written: (count) => { pending = pending.slice(count) },
      adopted: () => 0,
    }
    const writer: ScopeWriter = {
      write: (steps, expects) => {
        const one = { steps, ...(expects !== undefined ? { expects } : {}) }
        written.push(one)
        return answer(one)
      },
      read: () => Promise.resolve({ ...snapshot, revision: 'theirs' }),
      put: () => Promise.reject(new Error('no pictures here')),
    }
    function Host({ model }: { model: unknown }) {
      hook = useDocumentSession({
        session: { model, activeDiagramId: snapshot.activeDiagramId, logoLibrary: snapshot.logoLibrary, snapshot: () => snapshot, journal },
        writer, onSaved: () => {}, onResult: () => {}, onAdopt: () => {},
      })
      return null
    }
    const view = render(<Host model={snapshot.model} />)
    return {
      written,
      hook: () => hook,
      change: (next: Partial<ScopeSnapshot>, command?: PendingStep['command']) => act(() => {
        snapshot = { ...snapshot, ...next }
        if (command) pending = [...pending, { stepId: `s${pending.length}`, command, at: 0 }]
        view.rerender(<Host model={snapshot.model} />)
      }),
    }
  }

  const rename = (name: string) => ({ type: 'project.settings', patch: { name } }) as const
  const picture = {
    name: 'map.png', mediaType: 'image/png', size: 3, width: 1, height: 1,
    contentAddress: `sha256:${'a'.repeat(64)}`,
  }

  it('writes the session’s commands as steps, expecting the revision last known, and the next from the answer', async () => {
    const view = writing()
    view.change({ model: { ...project().model, name: 'One' } }, rename('One'))
    await act(async () => { await view.hook().forceSave() })
    view.change({ model: { ...project().model, name: 'Two' } }, rename('Two'))
    await act(async () => { await view.hook().forceSave() })
    expect(view.written.map((one) => [one.steps.map((step) => step.command), one.expects])).toEqual([
      [[rename('One')], 'r1'],
      [[rename('Two')], 'r2'],
    ])
  })

  it('writes the view it opens on, the marks and the library beside them, and never the scope whole', async () => {
    const view = writing()
    view.change({ activeDiagramId: 'd2', images: [picture], model: { ...project().model, name: 'One' } }, rename('One'))
    await act(async () => { await view.hook().forceSave() })
    const kinds = view.written.flatMap((one) => one.steps.map((step) => step.command.type))
    expect(kinds).toEqual(['project.settings', 'scope.describe', 'image.add'])
    expect(kinds).not.toContain('scope.replace')
    view.change({ images: [], model: { ...project().model, name: 'Two' } }, rename('Two'))
    await act(async () => { await view.hook().forceSave() })
    expect(view.written[1].steps.map((step) => step.command)).toEqual([rename('Two'), { type: 'image.remove', name: 'map.png' }])
  })

  it('says a scope somebody changed since as the conflict it is, and writes nothing over it', async () => {
    const view = writing(() => Promise.reject(new ShellError('shell.scopeMoved')))
    view.change({ model: { ...project().model, name: 'Mine' } }, rename('Mine'))
    await act(async () => { await view.hook().forceSave() })
    expect(view.hook().state.status).toBe('conflict')
  })

  it('writes at once when asked, a change made a moment ago included, and says where it did not land', async () => {
    const view = writing()
    act(() => { view.change({ model: { ...project().model, name: 'Now' } }, rename('Now')) })
    await act(async () => { await view.hook().flush() })
    expect(view.written).toHaveLength(1)
    const refusing = writing(() => Promise.reject(new Error('gone')))
    refusing.change({ model: { ...project().model, name: 'Now' } }, rename('Now'))
    await act(async () => { await expect(refusing.hook().flush()).rejects.toThrow('gone') })
  })
})

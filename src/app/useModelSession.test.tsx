// @vitest-environment jsdom
/**
 * The editing session: the one place a change enters, and the one stack over
 * everything that has changed (ADR-0002).
 *
 * What used to be intricate here — batches buffered per diagram, temporary ids
 * swapped for permanent keys on the first flush, an alias map carried between
 * them — is gone with the batch. What is left has two failure modes that still
 * look like nothing: a container diagram vanishing without a word, and an
 * editor that will not lay out a document it has "already seen".
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { placedNodes } from '../model/placement';
import { placeOn } from '../model/commands';
import { laidOut } from '../model/testFixtures';
import { act, cleanup, render } from '@testing-library/react'
import { translator } from '../i18n'
import { transaction } from '../model'
import type { DesignElement, PlacedNode } from '../model'
import type { HostModel } from '../model/hostModel'
import type { ScopeSnapshot } from '../projects/scope'
import { useModelSession } from './useModelSession'
import type { ModelSession, SessionChange } from './useModelSession'

/** The full shape, so a test does not have to repeat five fields it never reads. */
function element(id: string, name: string): DesignElement {
  return { id, kind: 'application', name, lifecycle: 'live', isManaged: true, aspects: {} }
}

const at = (id: string): PlacedNode => ({ id, x: 0, y: 0 })

afterEach(() => cleanup())

const model = (over: Partial<HostModel> = {}): HostModel => ({
  name: 'Landscape',
  elements: [element('billing', 'Billing')],
  relations: [],
  diagrams: [
    laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [at('billing')] }),
    laidOut({ id: 'd2', kind: 'layer7', name: 'Second', placements: [] }),
  ],
  ...over,
})

const project = (over: Partial<ScopeSnapshot> = {}): ScopeSnapshot => ({
  path: 'acme/landscape',
  model: model(),
  activeDiagramId: 'd1',
  logoLibrary: [],
  ...over,
})

function mount(initial = project(), takenInTree?: () => Iterable<string>) {
  const notify = vi.fn()
  let session!: ModelSession
  function Host() {
    session = useModelSession({
      initialProject: initial, notify, s: translator('en'), takenInTree,
    })
    return null
  }
  render(<Host />)
  return { notify, session: () => session }
}

/** Renaming the one element — enough to watch a change land. */
const rename = (name: string) =>
  ({ type: 'element.update', id: 'billing', patch: { name } }) as const

describe('useModelSession — landing changes', () => {
  it('lands a change at once, and a reader sees it without waiting for a render', () => {
    const { session } = mount()
    act(() => { session().dispatch(rename('Renamed')) })
    expect(session().current().elements[0].name).toBe('Renamed')
  })

  it('hands the new model straight back, so a gesture can read its own first half', () => {
    const { session } = mount()
    let answer: string | undefined
    act(() => { answer = session().dispatch(rename('Renamed'))?.elements[0].name })
    expect(answer).toBe('Renamed')
  })

  it('is one step however many rows the change touches', () => {
    const { session } = mount()
    act(() => {
      session().dispatch(transaction([
        rename('Renamed'),
        { type: 'diagram.rename', id: 'd1', name: 'Landscape 2027' },
      ]))
    })
    expect(session().history()).toHaveLength(1)
    act(() => session().undo())
    expect(session().current().elements[0].name).toBe('Billing')
    expect(session().current().diagrams[0].name).toBe('L7')
  })
})

describe('useModelSession — a container view whose application left', () => {
  const withContainer = () => project({
    model: model({
      diagrams: [
        laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [at('billing')] }),
        laidOut({ id: 'cd1', kind: 'container', name: 'Billing · containers', applicationElementId: 'billing', placements: [] }),
      ],
    }),
    activeDiagramId: 'cd1',
  })

  it('says so, because nobody asked for the view to go', () => {
    const { session, notify } = mount(withContainer())
    act(() => { session().dispatch({ type: 'element.delete', id: 'billing' }) })
    expect(session().current().diagrams.map((d) => d.id)).toEqual(['d1'])
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Billing · containers'))
  })

  it('does not leave you standing on a view that no longer exists', () => {
    const { session } = mount(withContainer())
    act(() => { session().dispatch({ type: 'element.delete', id: 'billing' }) })
    expect(session().currentActiveId()).toBe('d1')
  })

  it('says nothing when the tab was the one you asked to delete', () => {
    const { session, notify } = mount(withContainer())
    act(() => { session().dispatch({ type: 'diagram.delete', id: 'cd1' }) })
    expect(session().current().diagrams.map((d) => d.id)).toEqual(['d1'])
    expect(notify).not.toHaveBeenCalled()
  })
})

describe('useModelSession — taking on another document', () => {
  it('remounts the editor when the document has to be laid out again', () => {
    const { session } = mount()
    const before = session().editorKey
    act(() => session().adopt(project({ model: model({ name: 'Another' }) }), true))
    expect(session().editorKey).toBe(before + 1)
  })

  it('keeps the editor and only empties the stack when it need not remount', () => {
    const { session } = mount()
    const key = session().editorKey
    act(() => { session().dispatch(rename('Renamed')) })
    // The same diagrams, laid out already: the editor keeps viewport and panels,
    // but the history is about a document that no longer exists.
    act(() => session().adopt(project({ model: model({ name: 'Renamed' }) }), false))
    expect(session().editorKey).toBe(key)
    expect(session().canUndo).toBe(false)
  })
})

describe('useModelSession — the snapshot', () => {
  it('keeps the ref it was mounted with, whatever else changes', () => {
    const { session } = mount()
    act(() => session().adopt(project({
      path: 'somebody/else', model: model({ name: 'Opened file' }),
    }), false))
    // The address belongs to the workspace, which is remounted on a project
    // switch. A session that could change its own would autosave one project's
    // edits onto another.
    expect(session().snapshot().path).toEqual('acme/landscape')
    expect(session().snapshot().model.name).toBe('Opened file')
  })

  it('carries the mark library, which belongs to this browser and not the model', () => {
    const { session } = mount()
    act(() => session().setLogoLibrary([{ key: 'lib:house', label: 'house', url: 'data:,' }]))
    expect(session().snapshot().logoLibrary).toHaveLength(1)
  })

  it('writes the scope back as the scope it was opened as: kind, client, links', () => {
    // The organisation screen sets these; an autosave from the editor must not
    // erase them. It did: a team became a scope of no kind on the first edit.
    const opened = project({
      kind: 'team', client: 'Acme BV', links: [{ label: 'Wiki', url: 'https://example.test/wiki' }],
    })
    const { session } = mount(opened)
    act(() => { session().dispatch(rename('Renamed')) })
    const written = session().snapshot()
    expect(written.kind).toBe('team')
    expect(written.client).toBe('Acme BV')
    expect(written.links).toEqual(opened.links)
  })

  it('takes the header of a project it adopts, and drops one it no longer has', () => {
    const { session } = mount(project({ kind: 'team', client: 'Acme BV' }))
    act(() => session().adopt(project({ kind: 'domain' }), false))
    const written = session().snapshot()
    expect(written.kind).toBe('domain')
    expect(written).not.toHaveProperty('client')
  })
})

/**
 * Ids exist when the thing exists (ADR-0002).
 *
 * There used to be two: a `tmp-…` the editor minted and a key the session
 * swapped in on the first flush, with an alias map carried between them. What
 * replaced both is one policy, here, over the model the session actually holds
 * — and none of it had a test at this level, which is how the alias path was
 * quietly lost halfway through moving the session onto commands.
 */
describe('useModelSession — where an id comes from', () => {
  it('gives a name the key the file would have, and never one that is taken here or anywhere in the tree', () => {
    const { session } = mount()
    expect(session().ids.element('Warehouse')).toBe('warehouse')
    cleanup()
    const { session: session2 } = mount()
    const first = session2().ids.element('Warehouse')
    const second = session2().ids.element('Warehouse')
    expect(second).not.toBe(first)
    cleanup()
    const { session: session3 } = mount()
    expect(session3().ids.element('Billing')).not.toBe('billing')
    cleanup()
    const { session: session4 } = mount()
    expect(session4().ids.element('d1')).not.toBe('d1')
    cleanup()
    // ADR-0012 §2: an id names one thing across the whole organisation, not
    // across one document. The landscape below has never heard of `warehouse`
    // and must still not mint it, because a sibling domain defines it — and two
    // definitions of one id are a conflict finding, which this app should not be
    // in the business of creating by itself.
    const { session: session5 } = mount(project(), () => ['warehouse', 'erp'])
    expect(session5().ids.element('Warehouse')).toBe('warehouse-2')
  })

  it('reads the tree again for every ask, because the index is rebuilt under it', () => {
    let held: string[] = []
    const { session } = mount(project(), () => held)
    expect(session().ids.element('Warehouse')).toBe('warehouse')
    held = ['depot']
    expect(session().ids.element('Depot')).toBe('depot-2')
  })

  it('lands what the editor drew under the id the editor already gave it', () => {
    const { session } = mount()
    const id = session().ids.element('Warehouse')
    act(() => {
      session().dispatch(transaction([
        { type: 'element.create', element: element(id, 'Warehouse') },
        placeOn('d1', [at(id)]),
      ]))
    })
    expect(session().current().elements.map((e) => e.id)).toEqual(['billing', 'warehouse'])
    expect(placedNodes(session().current().diagrams[0]).map((p) => p.id))
      .toEqual(['billing', 'warehouse'])
  })
})

/** The point of the phase: one stack, over everything. */
describe('useModelSession — undo and redo', () => {
  it('has nothing to undo until something is dispatched', () => {
    const { session } = mount()
    expect(session().canUndo).toBe(false)
    expect(session().canRedo).toBe(false)
  })

  it('undoes and redoes a change that never went near the editor', () => {
    const { session } = mount()
    act(() => { session().dispatch({ type: 'diagram.rename', id: 'd1', name: 'Renamed' }) })
    expect(session().current().diagrams[0].name).toBe('Renamed')
    expect(session().canUndo).toBe(true)

    act(() => session().undo())
    expect(session().current().diagrams[0].name).toBe('L7')
    expect(session().canUndo).toBe(false)
    expect(session().canRedo).toBe(true)

    act(() => session().redo())
    expect(session().current().diagrams[0].name).toBe('Renamed')
  })

  it('covers what came out of the editor as well, in the one order', () => {
    const { session } = mount()
    act(() => { session().dispatch(rename('Renamed')) })
    act(() => { session().dispatch({ type: 'diagram.rename', id: 'd1', name: 'Second thoughts' }) })

    act(() => session().undo())
    expect(session().current().diagrams[0].name).toBe('L7')
    expect(session().current().elements[0].name).toBe('Renamed')

    act(() => session().undo())
    expect(session().current().elements[0].name).toBe('Billing')
    expect(session().canUndo).toBe(false)
  })

  it('folds a run of changes that share a coalesce key into one step', () => {
    const { session } = mount()
    act(() => {
      for (const name of ['R', 'Re', 'Ren']) {
        session().dispatch({ type: 'diagram.rename', id: 'd1', name, coalesce: 'name:d1' })
      }
    })
    expect(session().history()).toHaveLength(1)
    act(() => session().undo())
    expect(session().current().diagrams[0].name).toBe('L7')
    act(() => session().redo())
    expect(session().current().diagrams[0].name).toBe('Ren')
  })

  it('drops the redo tail when a fresh change lands', () => {
    const { session } = mount()
    act(() => { session().dispatch({ type: 'diagram.rename', id: 'd1', name: 'One' }) })
    act(() => session().undo())
    act(() => { session().dispatch({ type: 'diagram.rename', id: 'd1', name: 'Two' }) })
    expect(session().canRedo).toBe(false)
  })

  /**
   * The editor reporting that it has laid a diagram out is not an edit anybody
   * made, and ⌘Z after opening a document must not ask for the layout back.
   */
  it('keeps a change that is not a user’s edit off the stack', () => {
    const { session } = mount(project({
      model: model({
        diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [], needsLayout: true })],
      }),
    }))
    act(() => session().onLayoutSettled('d1'))
    expect(session().current().diagrams[0].geometry?.needsLayout).toBeUndefined()
    expect(session().canUndo).toBe(false)
  })

  /**
   * A gesture that wrote two scopes (ADR-0012 §10) has only half of itself on
   * this stack, so ⌘Z stops at it — with the reason, because a key that did
   * nothing and said nothing would read as a broken shortcut.
   */
  describe('a step that crossed two scopes', () => {
    const promote = () => {
      const held = mount()
      act(() => { held.session().dispatch({ type: 'diagram.rename', id: 'd1', name: 'Before' }) })
      act(() => {
        held.session().dispatch({
          type: 'element.link', id: 'billing', name: 'Billing', ref: 'acme',
          barrier: 'gesture.barrier',
        })
      })
      return held
    }

    it('undoes the steps after it, and then stops', () => {
      const { session } = promote()
      act(() => { session().dispatch({ type: 'diagram.rename', id: 'd1', name: 'After' }) })
      act(() => session().undo())
      expect(session().current().diagrams[0].name).toBe('Before')
      act(() => session().undo())
      expect(session().current().elements[0].ref).toBe('acme')
    })

    it('says why, and leaves the step on the stack', () => {
      const { session, notify } = promote()
      act(() => session().undo())
      expect(notify).toHaveBeenCalledWith(expect.stringContaining('two scopes'), 'warning')
      expect(session().history()).toHaveLength(2)
      expect(session().canRedo).toBe(false)
    })
  })

  it('says why a command was refused, and changes nothing', () => {
    const { session, notify } = mount(project({
      model: model({ diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [] })] }),
    }))
    let accepted: unknown = 'unset'
    act(() => { accepted = session().dispatch({ type: 'diagram.delete', id: 'd1' }) })
    expect(accepted).toBeUndefined()
    expect(session().current().diagrams).toHaveLength(1)
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('last landscape'), 'error')
  })

  it('forgets the stack when it takes on another document', () => {
    const { session } = mount()
    act(() => { session().dispatch({ type: 'diagram.rename', id: 'd1', name: 'Renamed' }) })
    act(() => session().adopt(project({ model: model({ name: 'Opened file' }) }), false))
    expect(session().canUndo).toBe(false)
    expect(session().canRedo).toBe(false)
  })
})

/**
 * A change can be made somewhere other than this keyboard (step 24a). The
 * session is still the one door it comes through: the same reducer, the same
 * stack, the same Activity list — with two differences that are the whole
 * point. It is marked as somebody else's, and ⌘Z steps over it.
 */
describe('useModelSession — a step made by another author', () => {
  const elsewhere = { by: 'A. Author' }

  it('gives every step a name of its own, so a step can be spoken about', () => {
    const { session } = mount()
    act(() => { session().dispatch(rename('One')) })
    act(() => { session().dispatch({ type: 'diagram.rename', id: 'd1', name: 'Two' }) })
    const ids = session().history().map((step) => step.stepId)
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true)
    expect(new Set(ids).size).toBe(2)
  })

  it('keeps one name over a run that coalesces, because it is one step', () => {
    const { session } = mount()
    act(() => {
      for (const name of ['R', 'Re', 'Ren']) {
        session().dispatch({ type: 'diagram.rename', id: 'd1', name, coalesce: 'name:d1' })
      }
    })
    expect(session().history()).toHaveLength(1)
    expect(session().history()[0].stepId).toBeTruthy()
  })

  it('carries what the log needs to say whose a step was', () => {
    const { session } = mount()
    act(() => { session().steps.applyExternal(rename('Theirs'), { ...elsewhere, at: 1_700_000 }) })
    const [step] = session().history()
    expect(session().current().elements[0].name).toBe('Theirs')
    expect(step.origin).toBe('remote')
    expect(step.by).toBe('A. Author')
    expect(step.at).toBe(1_700_000)
    // Named the way every other step is, against the model as it was.
    expect(step.summary.key).toBeTruthy()
    expect(step.inverses).toHaveLength(1)
  })

  /**
   * And what they made it with, where the step said. A client is not a person:
   * the two travel side by side, and the Activity list says both — one author
   * working from two clients is two lines worth telling apart.
   */
  it('carries the client the author made it with, and nothing where none was said', () => {
    const { session } = mount()
    act(() => {
      session().steps.applyExternal(rename('Theirs'), { ...elsewhere, via: 'their client' })
    })
    act(() => { session().steps.applyExternal(rename('Again'), elsewhere) })
    const [said, unsaid] = session().history()
    expect(said.by).toBe('A. Author')
    expect(said.via).toBe('their client')
    // Nothing invented: this session has no way to know what anyone else was
    // working in, and a guess in a log is worse than a gap.
    expect(unsaid.via).toBeUndefined()
    expect('via' in unsaid).toBe(false)
  })

  it('takes the name a step already travels under, and mints one where it has none', () => {
    const { session } = mount()
    act(() => { session().steps.applyExternal(rename('Theirs'), { ...elsewhere, stepId: 'their-step' }) })
    act(() => { session().steps.applyExternal(rename('Again'), elsewhere) })
    const [first, second] = session().history()
    expect(first.stepId).toBe('their-step')
    expect(second.stepId).not.toBe('their-step')
  })

  it('moves the revision, because the model moved', () => {
    const { session } = mount()
    const before = session().revision()
    act(() => { session().steps.applyExternal(rename('Theirs'), elsewhere) })
    expect(session().revision()).toBeGreaterThan(before)
  })

  it('says so and changes nothing when the reducer refuses their command', () => {
    const { session, notify } = mount()
    let answer: unknown = 'unset'
    act(() => { answer = session().steps.applyExternal(rename('x'), elsewhere) })
    // The row they renamed is here, so this one lands; the one below does not.
    expect(answer).toBeDefined()
    act(() => { answer = session().steps.applyExternal({ type: 'element.delete', id: 'nobody' }, elsewhere) })
    expect(answer).toBeUndefined()
    expect(notify).toHaveBeenCalledWith(expect.anything(), 'error')
    expect(session().history()).toHaveLength(1)
  })

  /**
   * A colleague typing is not a reason to take this person's redo away. The
   * redo that no longer applies is refused by the reducer and said, which is
   * cheaper than deciding for them that it is gone.
   */
  it('leaves the redo tail standing', () => {
    const { session } = mount()
    act(() => { session().dispatch({ type: 'diagram.rename', id: 'd1', name: 'Mine' }) })
    act(() => session().undo())
    expect(session().canRedo).toBe(true)
    act(() => { session().steps.applyExternal(rename('Theirs'), elsewhere) })
    expect(session().canRedo).toBe(true)
    act(() => session().redo())
    expect(session().current().diagrams[0].name).toBe('Mine')
  })

  /**
   * The policy reads what is taken when it is asked, but it is minted once for
   * the life of the session and an id another author took is not in anything
   * it was reading. So it is asked again once their step has landed.
   */
  it('mints no id another author has just taken', () => {
    const { session } = mount()
    expect(session().ids.element('Orders')).toBe('orders')
    act(() => {
      session().steps.applyExternal({
        type: 'element.create',
        element: {
          id: 'orders', kind: 'application', name: 'Orders',
          lifecycle: 'live', isManaged: true, aspects: {},
        },
      }, elsewhere)
    })
    expect(session().ids.element('Orders')).not.toBe('orders')
  })
})

describe('useModelSession — undo, where somebody else has been editing too', () => {
  const elsewhere = { by: 'A. Author' }

  it('steps over their step and takes back the newest of ours', () => {
    const { session } = mount()
    act(() => { session().dispatch({ type: 'diagram.rename', id: 'd1', name: 'Mine' }) })
    act(() => { session().steps.applyExternal(rename('Theirs'), elsewhere) })
    act(() => session().undo())
    expect(session().current().diagrams[0].name).toBe('L7')
    // Theirs is untouched, and still on the stack because it happened.
    expect(session().current().elements[0].name).toBe('Theirs')
    expect(session().history()).toHaveLength(1)
    expect(session().history()[0].origin).toBe('remote')
  })

  it('has nothing to undo when every step on the stack is somebody else’s', () => {
    const { session } = mount()
    act(() => { session().steps.applyExternal(rename('Theirs'), elsewhere) })
    expect(session().canUndo).toBe(false)
    act(() => session().undo())
    expect(session().current().elements[0].name).toBe('Theirs')
  })

  it('still stops at a step that crossed two scopes, under theirs', () => {
    const { session, notify } = mount()
    act(() => {
      session().dispatch({
        type: 'element.link', id: 'billing', name: 'Billing', ref: 'acme',
        barrier: 'gesture.barrier',
      })
    })
    act(() => { session().steps.applyExternal({ type: 'diagram.rename', id: 'd1', name: 'Theirs' }, elsewhere) })
    act(() => session().undo())
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('two scopes'), 'warning')
    expect(session().current().elements[0].ref).toBe('acme')
  })
})

describe('useModelSession — rebase', () => {
  const elsewhere = { by: 'A. Author' }

  /** Two own steps on the stack, and their ids. */
  function pending(session: () => ModelSession) {
    act(() => { session().dispatch({ type: 'diagram.rename', id: 'd1', name: 'Mine' }) })
    act(() => { session().dispatch({ type: 'diagram.rename', id: 'd2', name: 'Also mine' }) })
    return session().history().map((step) => step.stepId)
  }

  it('lands their step underneath ours, and puts ours back on top', () => {
    const { session } = mount()
    const stepIds = pending(session)
    let report!: ReturnType<ModelSession['steps']['rebase']>
    act(() => {
      report = session().steps.rebase({
        stepIds,
        between: () => {
          // What they changed is what this session was NOT holding back.
          session().steps.applyExternal(rename('Theirs'), elsewhere)
        },
      })
    })
    expect(report.reapplied).toEqual(stepIds)
    expect(report.dropped).toEqual([])
    expect(session().current().diagrams[0].name).toBe('Mine')
    expect(session().current().diagrams[1].name).toBe('Also mine')
    expect(session().current().elements[0].name).toBe('Theirs')
    // The stack is in the order the model was built: theirs, then ours.
    expect(session().history().map((step) => step.origin))
      .toEqual(['remote', undefined, undefined])
  })

  it('drops the one step the reducer now refuses, and says which', () => {
    const { session } = mount()
    act(() => { session().dispatch(rename('Mine')) })
    act(() => { session().dispatch({ type: 'diagram.rename', id: 'd1', name: 'Also mine' }) })
    const stepIds = session().history().map((step) => step.stepId)
    let report!: ReturnType<ModelSession['steps']['rebase']>
    act(() => {
      report = session().steps.rebase({
        stepIds,
        between: () => {
          session().steps.applyExternal({ type: 'element.delete', id: 'billing' }, elsewhere)
        },
      })
    })
    expect(report.dropped).toEqual([{ stepId: stepIds[0], reason: 'command.gone' }])
    expect(report.reapplied).toEqual([stepIds[1]])
    expect(session().current().diagrams[0].name).toBe('Also mine')
    // Theirs, then the one of ours that survived. The refused step is gone.
    const left = session().history()
    expect(left.map((step) => step.origin)).toEqual(['remote', undefined])
    expect(left[1].stepId).toBe(stepIds[1])
  })

  it('reports an id that names no step, and rebases the rest', () => {
    const { session } = mount()
    const stepIds = pending(session)
    let report!: ReturnType<ModelSession['steps']['rebase']>
    act(() => { report = session().steps.rebase({ stepIds: [...stepIds, 'never-seen'] }) })
    expect(report.unknown).toEqual(['never-seen'])
    expect(report.reapplied).toEqual(stepIds)
  })

  it('is one undo step per step, after the run has been back and forth', () => {
    const { session } = mount()
    const stepIds = pending(session)
    act(() => {
      session().steps.rebase({
        stepIds,
        between: () => { session().steps.applyExternal(rename('Theirs'), elsewhere) },
      })
    })
    act(() => session().undo())
    expect(session().current().diagrams[1].name).toBe('Second')
    act(() => session().undo())
    expect(session().current().diagrams[0].name).toBe('L7')
    // Theirs is all that is left, and it is not ours to take back.
    expect(session().canUndo).toBe(false)
    expect(session().current().elements[0].name).toBe('Theirs')
  })
})

describe('useModelSession — saying that a change was made here', () => {
  const elsewhere = { by: 'A. Author' }

  /** Everything the session said, in the order it said it. */
  function listening(session: () => ModelSession) {
    const heard: SessionChange[] = []
    let stop!: () => void
    act(() => { stop = session().steps.onChange((change) => heard.push(change)) })
    return { heard, stop: () => act(() => stop()) }
  }

  it('says what was applied, under the name the step goes by', () => {
    const { session } = mount()
    const { heard } = listening(session)
    act(() => { session().dispatch(rename('One')) })
    expect(heard).toHaveLength(1)
    expect(heard[0].kind).toBe('step')
    expect(heard[0].stepId).toBe(session().history()[0].stepId)
    expect(heard[0].commands).toEqual([rename('One')])
    expect(heard[0].revision).toBe(session().revision())
    expect(heard[0].origin).toBeUndefined()
  })

  it('says only what a coalescing step just grew by, not the run again', () => {
    const { session } = mount()
    const { heard } = listening(session)
    act(() => {
      for (const name of ['R', 'Re'] as const) {
        session().dispatch({ type: 'diagram.rename', id: 'd1', name, coalesce: 'name:d1' })
      }
    })
    // One step on the stack, two changes to carry, and the second carries one
    // command — applying the run again elsewhere would rename it twice.
    expect(session().history()).toHaveLength(1)
    expect(heard.map((change) => change.commands.length)).toEqual([1, 1])
    expect(new Set(heard.map((change) => change.stepId)).size).toBe(1)
  })

  it('says an undo is an undo, and hands over the inverses that were applied', () => {
    const { session } = mount()
    act(() => { session().dispatch(rename('One')) })
    const { heard } = listening(session)
    act(() => session().undo())
    expect(heard).toHaveLength(1)
    expect(heard[0].kind).toBe('undo')
    // The step it took back, by name — not the name this change would go under.
    expect(heard[0].stepId).toBeTruthy()
    expect(heard[0].commands).toEqual([rename('Billing')])
    act(() => session().redo())
    expect(heard[1].kind).toBe('redo')
    expect(heard[1].commands).toEqual([rename('One')])
  })

  it('marks another author’s step as theirs, so a listener lets it be', () => {
    const { session } = mount()
    const { heard } = listening(session)
    act(() => { session().steps.applyExternal(rename('Theirs'), elsewhere) })
    expect(heard[0].origin).toBe('remote')
    expect(heard[0].by).toBe('A. Author')
  })

  it('says nothing about a change it does not record, because nothing can take it back', () => {
    const { session } = mount()
    const { heard } = listening(session)
    act(() => {
      session().dispatch({ type: 'element.update', id: 'billing', patch: { name: 'Quietly' }, undoable: false })
    })
    expect(session().current().elements[0].name).toBe('Quietly')
    expect(heard).toEqual([])
  })

  it('says nothing about a rebase, which the caller asked for and has the report of', () => {
    const { session } = mount()
    act(() => { session().dispatch({ type: 'diagram.rename', id: 'd1', name: 'Mine' }) })
    const stepIds = session().history().map((step) => step.stepId)
    const { heard } = listening(session)
    act(() => {
      session().steps.rebase({
        stepIds,
        between: () => { session().steps.applyExternal(rename('Theirs'), elsewhere) },
      })
    })
    // Their step, which arrived through the door that announces; not one word
    // about ours coming off the model and going back on.
    expect(heard.map((change) => change.origin)).toEqual(['remote'])
  })

  it('stops when the listener is dropped', () => {
    const { session } = mount()
    const { heard, stop } = listening(session)
    act(() => { session().dispatch(rename('One')) })
    stop()
    act(() => { session().dispatch(rename('Two')) })
    expect(heard).toHaveLength(1)
  })
})

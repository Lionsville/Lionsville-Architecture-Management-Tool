// @vitest-environment jsdom
/**
 * The editing session — the one genuinely intricate part of this shell.
 *
 * Batches arrive per diagram and are applied after a pause; temporary ids
 * become permanent keys on the first flush and must keep resolving afterwards;
 * and taking on a different document sometimes needs the editor remounted and
 * sometimes only its undo stack cleared. Each of those has a failure mode that
 * looks like nothing: an older batch overwriting newer work, a container
 * diagram vanishing without a word, an editor that will not lay out a document
 * it has "already seen".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { translator } from '../i18n'
import type { DiagramContentBatch } from '../model'
import type { DesignElement, DiagramPlacement } from '../model'
import type { HostModel } from '../model/fromInterchange'
import type { ProjectSnapshot } from '../projects/project'
import { useModelSession } from './useModelSession'
import type { ModelSession } from './useModelSession'

/** The full shape, so a test does not have to repeat five fields it never reads. */
function element(id: string, name: string): DesignElement {
  return { id, kind: 'application', name, lifecycle: 'live', isManaged: true, aspects: {}, parameters: {} }
}

const at = (elementId: string): DiagramPlacement => ({ elementId, x: 0, y: 0 })


beforeEach(() => vi.useFakeTimers())
afterEach(() => { vi.useRealTimers(); cleanup() })

const model = (over: Partial<HostModel> = {}): HostModel => ({
  name: 'Landscape',
  customerName: 'Acme',
  elements: [element('billing', 'Billing')],
  connections: [],
  diagrams: [
    { id: 'd1', kind: 'layer7', name: 'L7', placements: [at('billing')] },
    { id: 'd2', kind: 'layer7', name: 'Second', placements: [] },
  ],
  ...over,
})

const project = (over: Partial<ProjectSnapshot> = {}): ProjectSnapshot => ({
  ref: { group: 'acme', project: 'landscape' },
  model: model(),
  activeDiagramId: 'd1',
  logoLibrary: [],
  ...over,
})

function mount(initial = project()) {
  const notify = vi.fn()
  let session!: ModelSession
  function Host() {
    session = useModelSession({ initialProject: initial, notify, s: translator('en') })
    return null
  }
  render(<Host />)
  return { notify, session: () => session }
}

/** An empty batch for one diagram: the shape the editor always sends. */
const emptyBatch = (diagramId: string): DiagramContentBatch => ({
  diagramId,
  elements: [],
  deletedElementIds: [],
  connections: [],
  deletedConnectionIds: [],
  placements: [],
  removedPlacementElementIds: [],
  edgeRoutes: [],
})

/** A batch that renames the one element — enough to watch it land. */
const batchFor = (diagramId: string, elementName: string): DiagramContentBatch => ({
  ...emptyBatch(diagramId),
  elements: [element('billing', elementName)],
  placements: [at('billing')],
})

/** A batch that empties a diagram: every placement gone, the element deleted. */
const clearing = (diagramId: string): DiagramContentBatch => ({
  ...emptyBatch(diagramId),
  deletedElementIds: ['billing'],
  removedPlacementElementIds: ['billing'],
})

describe('useModelSession — landing changes', () => {
  it('waits before applying, so a run of edits is one commit', () => {
    const { session } = mount()
    act(() => session().onChange(batchFor('d1', 'Renamed')))
    expect(session().current().elements[0].name).toBe('Billing')
    act(() => { vi.advanceTimersByTime(250) })
    expect(session().current().elements[0].name).toBe('Renamed')
  })

  it('applies in the order the batches arrived, not the order they were first seen', () => {
    // Two diagrams, the older one edited again last. Applied by insertion order
    // alone, the stale batch from d1 would land after d2's newer one.
    const { session } = mount()
    act(() => {
      session().onChange(batchFor('d1', 'First'))
      session().onChange(batchFor('d2', 'Second'))
      session().onChange(batchFor('d1', 'Third'))
      session().flush()
    })
    expect(session().current().elements[0].name).toBe('Third')
  })

  it('lets a reader see the new model straight after a flush, without a render', () => {
    const { session } = mount()
    act(() => { session().onChange(batchFor('d1', 'Renamed')); session().flush() })
    expect(session().current().elements[0].name).toBe('Renamed')
  })

  it('drops what is pending for a diagram that is going away', () => {
    const { session } = mount()
    act(() => { session().onChange(batchFor('d1', 'Renamed')); session().forget('d1') })
    act(() => { vi.advanceTimersByTime(250) })
    expect(session().current().elements[0].name).toBe('Billing')
  })
})

describe('useModelSession — a container view whose application left', () => {
  const withContainer = () => project({
    model: model({
      diagrams: [
        { id: 'd1', kind: 'layer7', name: 'L7', placements: [at('billing')] },
        { id: 'cd1', kind: 'container', name: 'Billing · containers', applicationElementId: 'billing', placements: [] },
      ],
    }),
    activeDiagramId: 'cd1',
  })

  it('says so, because undo does not bring the view back', () => {
    const { session, notify } = mount(withContainer())
    act(() => {
      session().onChange(clearing('d1'))
      session().flush()
    })
    expect(session().current().diagrams.map((d) => d.id)).toEqual(['d1'])
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Billing · containers'))
  })

  it('does not leave you standing on a view that no longer exists', () => {
    const { session } = mount(withContainer())
    act(() => {
      session().onChange(clearing('d1'))
      session().flush()
    })
    expect(session().currentActiveId()).toBe('d1')
  })
})

describe('useModelSession — taking on another document', () => {
  it('remounts the editor when the document has to be laid out again', () => {
    const { session } = mount()
    const before = session().editorKey
    act(() => session().adopt(project({ model: model({ name: 'Another' }) }), true))
    expect(session().editorKey).toBe(before + 1)
  })

  it('keeps the editor and only clears its undo stack when it need not remount', () => {
    const { session } = mount()
    const key = session().editorKey
    const token = session().historyToken
    // The same diagrams, laid out already: the editor keeps viewport and panels,
    // but its history is about a document that no longer exists.
    act(() => session().adopt(project({ model: model({ name: 'Renamed' }) }), false))
    expect(session().editorKey).toBe(key)
    expect(session().historyToken).toBe(token + 1)
  })

  it('drops everything pending, so the old document cannot land on the new one', () => {
    const { session } = mount()
    act(() => session().onChange(batchFor('d1', 'From the old document')))
    act(() => session().adopt(project({ model: model({ name: 'Fresh' }) }), false))
    act(() => { vi.advanceTimersByTime(250) })
    expect(session().current().elements[0].name).toBe('Billing')
  })
})

describe('useModelSession — the snapshot', () => {
  it('keeps the ref it was mounted with, whatever else changes', () => {
    const { session } = mount()
    act(() => session().adopt(project({
      ref: { group: 'somebody', project: 'else' }, model: model({ name: 'Opened file' }),
    }), false))
    // The address belongs to the workspace, which is remounted on a project
    // switch. A session that could change its own would autosave one project's
    // edits onto another.
    expect(session().snapshot().ref).toEqual({ group: 'acme', project: 'landscape' })
    expect(session().snapshot().model.name).toBe('Opened file')
  })

  it('carries the mark library, which belongs to this browser and not the model', () => {
    const { session } = mount()
    act(() => session().setLogoLibrary([{ key: 'lib:house', label: 'house', url: 'data:,' }]))
    expect(session().snapshot().logoLibrary).toHaveLength(1)
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
  const drawn = (id: string): DiagramContentBatch => ({
    ...emptyBatch('d1'),
    elements: [element(id, 'Warehouse')],
    placements: [at('billing'), at(id)],
  })

  it('gives a name the key the file would have had', () => {
    const { session } = mount()
    expect(session().ids.element('Warehouse')).toBe('warehouse')
  })

  it('does not hand out a key twice, even before the first one is in the model', () => {
    const { session } = mount()
    const first = session().ids.element('Warehouse')
    const second = session().ids.element('Warehouse')
    expect(second).not.toBe(first)
  })

  it('does not hand out a key the model already has', () => {
    const { session } = mount()
    expect(session().ids.element('Billing')).not.toBe('billing')
  })

  it('stays clear of the diagram ids, which share the same namespace', () => {
    const { session } = mount()
    expect(session().ids.element('d1')).not.toBe('d1')
  })

  it('lands what the editor drew under the id the editor already gave it', () => {
    const { session } = mount()
    act(() => { session().onChange(drawn('warehouse')); session().flush() })
    expect(session().current().elements.map((e) => e.id)).toEqual(['billing', 'warehouse'])
    expect(session().current().diagrams[0].placements.map((p) => p.elementId))
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
    act(() => { session().onChange(batchFor('d1', 'Renamed')); session().flush() })
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
        diagrams: [{ id: 'd1', kind: 'layer7', name: 'L7', placements: [], needsLayout: true }],
      }),
    }))
    act(() => session().onLayoutSettled('d1'))
    expect(session().current().diagrams[0].needsLayout).toBe(false)
    expect(session().canUndo).toBe(false)
  })

  it('says why a command was refused, and changes nothing', () => {
    const { session, notify } = mount(project({
      model: model({ diagrams: [{ id: 'd1', kind: 'layer7', name: 'L7', placements: [] }] }),
    }))
    let accepted = true
    act(() => { accepted = session().dispatch({ type: 'diagram.delete', id: 'd1' }) })
    expect(accepted).toBe(false)
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

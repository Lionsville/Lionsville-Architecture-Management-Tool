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
import { translator } from '@lionsville/solution-design'
import type { DiagramContentBatch } from '@lionsville/solution-design'
import type { DesignElement, DiagramPlacement } from '@lionsville/solution-design'
import type { HostModel } from '../core/model/fromInterchange'
import type { ProjectSnapshot } from '../core/project'
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

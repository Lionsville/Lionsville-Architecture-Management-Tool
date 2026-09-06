// @vitest-environment jsdom
/**
 * One undo stack, over the whole app (ADR-0002).
 *
 * The reducer's own tests prove a command and its inverse; this proves the
 * wiring — that a change made in the shell and a change made in the editor land
 * on the SAME stack in the order they happened, and that the editor's buttons
 * reach it. Before this, ⌘Z undid a node move and was deaf to a diagram rename.
 *
 * The editor is stubbed down to the four things this is about: a batch in, the
 * host's undo, the host's redo, and what it is told about `canUndo`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { InMemoryProjectStore } from '../adapters/memory/InMemoryProjectStore'
import type { DiagramContentBatch } from '../model'
import type { ProjectSnapshot } from '../projects/project'
import { renderApp } from './testing/renderShell'

vi.mock('../editor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor')>()
  return {
    ...actual,
    SolutionDesignEditor: (props: {
      model: { name: string; diagrams: { id: string; name: string }[] }
      onChange: (batch: DiagramContentBatch) => void
      onRenameDiagram?: (id: string, name: string) => void
      onUndo?: () => void
      onRedo?: () => void
      canUndo?: boolean
      canRedo?: boolean
    }) => (
      <div>
        <p data-testid="diagram-name">{props.model.diagrams[0].name}</p>
        <p data-testid="can-undo">{String(props.canUndo)}</p>
        <p data-testid="can-redo">{String(props.canRedo)}</p>
        <button data-testid="rename" onClick={() => props.onRenameDiagram?.('d1', 'Renamed')}>rename</button>
        <button
          data-testid="draw"
          onClick={() => props.onChange({
            diagramId: 'd1',
            elements: [{
              id: 'tmp-1', kind: 'application', name: 'Warehouse',
              lifecycle: 'live', isManaged: true, aspects: {}, parameters: {},
            }],
            deletedElementIds: [],
            connections: [],
            deletedConnectionIds: [],
            placements: [{ elementId: 'tmp-1', x: 0, y: 0 }],
            removedPlacementElementIds: [],
            edgeRoutes: [],
          })}
        >draw</button>
        <button data-testid="undo" onClick={() => props.onUndo?.()}>undo</button>
        <button data-testid="redo" onClick={() => props.onRedo?.()}>redo</button>
      </div>
    ),
  }
})

afterEach(() => { vi.useRealTimers(); cleanup() })

const project = (): ProjectSnapshot => ({
  ref: { group: 'acme', project: 'landscape' },
  model: {
    name: 'Landscape',
    customerName: 'Acme',
    elements: [],
    connections: [],
    diagrams: [{ id: 'd1', kind: 'layer7', name: 'L7', placements: [] }],
  },
  activeDiagramId: 'd1',
  logoLibrary: [],
})

function show() {
  const initial = project()
  const projects = new InMemoryProjectStore([initial])
  renderApp({ projects, initialProject: initial })
  return projects
}

const click = (id: string) => act(() => { fireEvent.click(screen.getByTestId(id)) })
const text = (id: string) => screen.getByTestId(id).textContent

describe('the app has one undo stack', () => {
  it('offers nothing to undo until something happens', () => {
    show()
    expect(text('can-undo')).toBe('false')
    expect(text('can-redo')).toBe('false')
  })

  it('undoes a rename the editor never saw as a change of its own', () => {
    show()
    click('rename')
    expect(text('diagram-name')).toBe('Renamed')
    expect(text('can-undo')).toBe('true')

    click('undo')
    expect(text('diagram-name')).toBe('L7')
    expect(text('can-redo')).toBe('true')

    click('redo')
    expect(text('diagram-name')).toBe('Renamed')
  })

  /**
   * The two roads into the model, on one stack, in the order they happened —
   * which is the thing that could not be done with two.
   */
  it('interleaves what the editor did with what the shell did', () => {
    vi.useFakeTimers()
    show()
    click('draw')
    act(() => { vi.advanceTimersByTime(250) })
    click('rename')

    click('undo')
    expect(text('diagram-name')).toBe('L7')

    click('undo')
    expect(text('can-undo')).toBe('false')
  })
})

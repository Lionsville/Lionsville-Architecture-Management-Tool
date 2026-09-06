// @vitest-environment jsdom
/**
 * The activity list, end to end: something happens in the app, and the toolbar
 * can say what it was (ADR-0002, step 9).
 *
 * `model/activity.test.ts` pins what a step is called; this pins that the log
 * reaches the screen at all, in the order a person reads a log in, and that a
 * change nobody made — the settling pass clearing `needsLayout` — stays out of
 * it exactly as it stays off the undo stack.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { InMemoryProjectStore } from '../adapters/memory/InMemoryProjectStore'
import { transaction } from '../model'
import type { Command } from '../model'
import type { EditorHistory } from '../editor'
import type { ProjectSnapshot } from '../projects/project'
import { renderApp } from './testing/renderShell'

vi.mock('../editor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor')>()
  return {
    ...actual,
    SolutionDesignEditor: (props: {
      dispatch: (command: Command) => unknown
      history: EditorHistory
      onRenameDiagram?: (id: string, name: string) => void
      onLayoutSettled?: (diagramId: string) => void
    }) => (
      <div>
        <button data-testid="rename" onClick={() => props.onRenameDiagram?.('d1', 'Renamed')}>rename</button>
        <button
          data-testid="draw"
          onClick={() => props.dispatch(transaction([
            {
              type: 'element.create',
              element: {
                id: 'warehouse', kind: 'application', name: 'Warehouse',
                lifecycle: 'live', isManaged: true, aspects: {}, parameters: {},
              },
            },
            { type: 'placement.set', diagramId: 'd1', placements: [{ elementId: 'warehouse', x: 0, y: 0 }] },
          ]))}
        >draw</button>
        <button data-testid="settled" onClick={() => props.onLayoutSettled?.('d1')}>settled</button>
      </div>
    ),
  }
})

afterEach(() => cleanup())

const project = (): ProjectSnapshot => ({
  ref: { group: 'acme', project: 'landscape' },
  model: {
    name: 'Landscape',
    customerName: 'Acme',
    elements: [],
    connections: [],
    diagrams: [{ id: 'd1', kind: 'layer7', name: 'L7', placements: [], needsLayout: true }],
  },
  activeDiagramId: 'd1',
  logoLibrary: [],
})

function show() {
  const initial = project()
  renderApp({ projects: new InMemoryProjectStore([initial]), initialProject: initial })
}

const click = (id: string) => act(() => { fireEvent.click(screen.getByTestId(id)) })
// By its words, not its accessible name: every button on this bar takes that
// from its tooltip.
const openActivity = () => act(() => { fireEvent.click(screen.getByText('Activity')) })
const lines = () =>
  screen.getAllByRole('menuitem').map((item) => item.textContent?.replace(/\d\d:\d\d$/, '') ?? '')

describe('the activity list', () => {
  it('says nothing has happened yet', () => {
    show()
    openActivity()
    expect(screen.getByText('Nothing yet')).toBeDefined()
  })

  it('names what happened, newest first, whichever half of the app did it', () => {
    show()
    click('draw')
    click('rename')
    openActivity()

    expect(lines()).toEqual(['Renamed a diagram to Renamed', 'Added Warehouse'])
  })

  it('leaves out a change nobody made', () => {
    show()
    click('settled')
    openActivity()
    expect(screen.getByText('Nothing yet')).toBeDefined()
  })
})

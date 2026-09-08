// @vitest-environment jsdom
/**
 * The client an exported diagram names comes from the group's record when the
 * group has said one, and is the group's name otherwise.
 *
 * The editor is stubbed to print what it was handed: what is under test is the
 * wiring from the record to the export, not the drawing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import { InMemoryGroupStore } from '../adapters/memory/InMemoryGroupStore'
import { InMemoryProjectStore } from '../adapters/memory/InMemoryProjectStore'
import type { ProjectSnapshot } from '../projects/project'
import { renderApp } from './testing/renderShell'

vi.mock('../editor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor')>()
  return {
    ...actual,
    SolutionDesignEditor: (props: { exportTitleBlock?: { client: string } }) => (
      <output data-testid="export-client">{props.exportTitleBlock?.client}</output>
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
    diagrams: [{ id: 'd1', kind: 'layer7', name: 'L7', placements: [] }],
  },
  activeDiagramId: 'd1',
  logoLibrary: [],
})

describe('the client on an export', () => {
  it('is the group name when the group has not said otherwise', async () => {
    renderApp({ projects: new InMemoryProjectStore([project()]), initialProject: project() })
    expect((await screen.findByTestId('export-client')).textContent).toBe('Acme')
  })

  it('is what the group record says once it says something', async () => {
    renderApp({
      projects: new InMemoryProjectStore([project()]),
      groupRecords: new InMemoryGroupStore([{ group: 'acme', name: 'Acme', client: 'Acme Logistics BV' }]),
      initialProject: project(),
    })
    await screen.findByText('Acme Logistics BV')
  })
})

// @vitest-environment jsdom
/**
 * The client an exported diagram names, walked up the tree (ADR-0012 §1).
 *
 * The nearest scope that says one wins; where nobody says one it is the
 * organisation's name, which is what the title block meant before a scope could
 * say otherwise. The editor is stubbed to print what it was handed: what is
 * under test is the walk, not the drawing.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { laidOut } from '../model/testFixtures';
import { cleanup, screen } from '@testing-library/react'
import { InMemoryScopeStore } from '../adapters/memory/InMemoryScopeStore'
import type { ScopeSnapshot } from '../projects/scope'
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

const project = (): ScopeSnapshot => ({
  path: 'acme/landscape',
  model: {
    name: 'Landscape',
    elements: [],
    relations: [],
    diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [] })],
  },
  activeDiagramId: 'd1',
  logoLibrary: [],
})

const parent = (over: Partial<ScopeSnapshot> = {}): ScopeSnapshot => ({
  path: 'acme',
  model: { name: 'Acme', elements: [], relations: [], diagrams: [] },
  activeDiagramId: '',
  logoLibrary: [],
  ...over,
})

describe('the client on an export', () => {
  it('is the organisation\'s name when nothing above has said otherwise', async () => {
    renderApp({
      scopes: new InMemoryScopeStore([parent(), project()]),
      initialProject: project(),
    })
    expect((await screen.findByTestId('export-client')).textContent).toBe('Acme')
  })

  it('is what the scope above says once it says something', async () => {
    renderApp({
      scopes: new InMemoryScopeStore([parent({ client: 'Acme Logistics BV' }), project()]),
      initialProject: project(),
    })
    await screen.findByText('Acme Logistics BV')
  })

  /** The closest record to the drawing is the one that knows. */
  it('is the scope\'s own client where it has one, over its parent\'s', async () => {
    renderApp({
      scopes: new InMemoryScopeStore([
        parent({ client: 'Acme Logistics BV' }),
        { ...project(), client: 'Acme Rail BV' },
      ]),
      initialProject: { ...project(), client: 'Acme Rail BV' },
    })
    await screen.findByText('Acme Rail BV')
  })
})

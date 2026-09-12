// @vitest-environment jsdom
/**
 * One decision list, read up the tree (ADR-0012 §7).
 *
 * The page's own behaviour is pinned where it lives; what is under test here is
 * the wiring the shell does around it — the scopes above the open one are read
 * when it is entered, their records arrive as sections, and nothing here can
 * write them, because a record is edited where it lives.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { InMemoryScopeStore } from '../adapters/memory/InMemoryScopeStore'
import { laidOut } from '../model/testFixtures'
import type { ScopeSnapshot } from '../projects/scope'
import { renderApp } from './testing/renderShell'

vi.mock('../editor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor')>()
  return { ...actual, SolutionDesignEditor: () => <output data-testid="editor" /> }
})

afterEach(() => cleanup())

/** The organisation: a capability, and a decision about it. */
const root = (): ScopeSnapshot => ({
  path: '',
  model: {
    name: 'Acme Logistics',
    elements: [{
      id: 'fulfilment', kind: 'function', name: 'Fulfilment',
      lifecycle: 'live', isManaged: false, aspects: {},
    }],
    relations: [],
    diagrams: [],
    decisions: [{
      id: 'a1', number: 1, title: 'Fulfilment is one capability', status: 'accepted',
      date: '2026-09-01', body: 'Because.', signers: [], subjectId: 'fulfilment',
    }],
  },
  activeDiagramId: '',
  logoLibrary: [],
})

const landscape = (): ScopeSnapshot => ({
  path: 'landscape',
  model: {
    name: 'Application landscape',
    elements: [],
    relations: [],
    diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [] })],
    decisions: [{
      id: 'l1', number: 1, title: 'One warehouse system', status: 'proposed',
      date: '2026-09-02', body: 'Ours.', signers: [],
    }],
  },
  activeDiagramId: 'd1',
  logoLibrary: [],
})

describe('a decision from the scope above', () => {
  const open = () => renderApp({
    scopes: new InMemoryScopeStore([root(), landscape()]),
    initialProject: landscape(),
  })

  it('shows it in a From section, read-only, beside this scope’s own list', async () => {
    open()
    fireEvent.click(await screen.findByText('Decisions'))
    const tree = await screen.findByTestId('adr-tree')
    await waitFor(() => expect(within(tree).getByText('From Acme Logistics')).toBeDefined())

    // This scope's own list is what the page opens on.
    expect(within(screen.getByTestId('adr-list')).getByText('One warehouse system')).toBeDefined()

    fireEvent.click(within(tree).getByTestId('adr-scope-from:'))
    fireEvent.click(within(await screen.findByTestId('adr-list')).getByText('Fulfilment is one capability'))
    expect(await screen.findByTestId('adr-from-ancestor')).toBeDefined()
    const reader = screen.getByTestId('adr-reader')
    expect(within(reader).queryByRole('button', { name: 'Edit' })).toBeNull()
  })

  /** A record is edited where it lives, so the way out is the scope itself. */
  it('offers to open the scope that holds it', async () => {
    open()
    fireEvent.click(await screen.findByText('Decisions'))
    const tree = await screen.findByTestId('adr-tree')
    await waitFor(() => expect(within(tree).getByText('From Acme Logistics')).toBeDefined())
    fireEvent.click(within(tree).getByTestId('adr-scope-from:'))
    fireEvent.click(within(await screen.findByTestId('adr-list')).getByText('Fulfilment is one capability'))
    fireEvent.click(await screen.findByRole('button', { name: 'Open Acme Logistics' }))

    // The shell reads that scope and makes it the one that is open — where the
    // same record is this scope's own, with nothing above it and an Edit
    // button on it.
    // The page closes as the other scope opens, and the workspace remounts on
    // it — so the bar under it is a different one, and has to be there first.
    await waitFor(() => expect(screen.queryByTestId('adr-tree')).toBeNull())
    fireEvent.click(await screen.findByText('Decisions'))
    const there = await screen.findByTestId('adr-tree')
    await waitFor(() => expect(within(there).getByTestId('adr-scope-subject:fulfilment')).toBeDefined())
    expect(within(there).queryByText('From Acme Logistics')).toBeNull()
    fireEvent.click(within(there).getByTestId('adr-scope-subject:fulfilment'))
    fireEvent.click(within(await screen.findByTestId('adr-list')).getByText('Fulfilment is one capability'))
    expect(screen.queryByTestId('adr-from-ancestor')).toBeNull()
  })
})

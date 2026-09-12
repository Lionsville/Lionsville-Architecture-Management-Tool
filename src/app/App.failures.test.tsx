// @vitest-environment jsdom
/**
 * The stores refusing, in each of the places that used to carry on regardless.
 *
 * Every one of these was a `void store.x().then(...)` with a success handler
 * and nothing else. A store that started refusing mid-session left the screen
 * looking exactly as it does when everything is fine: an empty picker that
 * reads as "you have no projects", a group half renamed, a project quietly
 * filed at two addresses.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { laidOut } from '../model/testFixtures';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { InMemoryScopeStore } from '../adapters/memory/InMemoryScopeStore'
import type { ScopeLibrary } from './App'
import { scopeTree } from '../projects/scope'
import { renderApp } from './testing/renderShell'

afterEach(() => cleanup())

const refused = () => Promise.reject(new Error('storage refused'))

const project = (key: string, name: string) => ({
  path: `acme/${key}`,
  model: {
    name,
    elements: [],
    relations: [],
    diagrams: [laidOut({ id: 'd1', kind: 'layer7' as const, name: 'L7', placements: [] })],
  },
  activeDiagramId: 'd1',
  logoLibrary: [],
})

/** The whole app on the picker, with one seam replaced by a refusing one. */
function show(projects: Partial<ScopeLibrary>) {
  return renderApp({
    scopes: {
      list: () => Promise.resolve(scopeTree([])),
      load: () => Promise.resolve(undefined),
      save: () => Promise.resolve(),
      remove: () => Promise.resolve(),
      ...projects,
    },
    examples: [{
      key: 'acme',
      path: 'acme/landscape',
      label: 'Acme Logistics',
      description: 'an example',
      folder: {
        'scope.json': {
          type: 'lionsville-architecture', version: 5, name: 'Warehouse landscape',
          activeDiagramId: 'l7', diagrams: ['l7'],
        },
        'model.json': { elements: [], relations: [] },
        'diagrams/l7.json': { id: 'l7', kind: 'layer7', name: 'Landscape', members: [] },
        'diagrams/l7.geometry.json': { nodes: [] },
      },
    }],
  })
}

describe('the picker, when the store refuses', () => {
  it('says the list could not be read instead of showing an empty one', async () => {
    show({ list: refused })
    await waitFor(() => expect(screen.getByRole('alert').textContent)
      .toContain('Your projects could not be read.'))
  })

  it('puts the cause in the trail, not only on the screen', async () => {
    const { diagnostics } = show({ list: refused })
    await waitFor(() => expect(diagnostics.messages()).toContain('picker.listFailed'))
    expect((diagnostics.recent()[0].cause as Error).message).toBe('storage refused')
  })
})

describe('copying an example, when the store refuses', () => {
  it('does not sit there looking as though nothing was pressed', async () => {
    const { diagnostics } = show({ load: refused })
    fireEvent.click(await screen.findByText(/Copy to a project|Open/))
    await waitFor(() => expect(diagnostics.recent().some((e) => e.where === 'copyExample')).toBe(true))
    // A load that will not read is a store refusing, so the standing storage
    // message is the honest one — and it is latched, so it arrives once.
    await waitFor(() => expect(screen.getByRole('alert').textContent)
      .toContain('could not save the design'))
  })
})

/**
 * What used to be here: a group's rename sweeping every project filed under it,
 * naming the ones it could not reach. There is no sweep any more — a scope's
 * name is its own `scope.json` and nothing else holds a copy (ADR-0012 §1) — so
 * the failure it guarded against cannot happen and the message it showed is
 * gone with it. A save that refuses is one write refusing, which
 * `applyScopeSettings` reports as `group.saveFailed`.
 */
describe('a scope whose record will not save', () => {
  it('says so rather than leaving the dialog looking as though it landed', async () => {
    const projects = new InMemoryScopeStore([project('warehouse', 'Warehouse')])
    vi.spyOn(projects, 'save').mockRejectedValue(new Error('quota'))

    const { diagnostics } = renderApp({ scopes: projects })

    fireEvent.click(await screen.findByRole('button', { name: 'Settings for Warehouse' }))
    fireEvent.change(await screen.findByLabelText('Group name'), {
      target: { value: 'Warehouse renamed' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(diagnostics.messages()).toContain('group.saveFailed'))
  })
})

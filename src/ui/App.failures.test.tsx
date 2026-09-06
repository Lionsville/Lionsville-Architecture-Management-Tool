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
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { InMemoryProjectStore } from '../adapters/memory/InMemoryProjectStore'
import type { ProjectLibrary } from './App'
import { renderApp } from './testing/renderShell'

afterEach(() => cleanup())

const refused = () => Promise.reject(new Error('storage refused'))

const project = (key: string, name: string) => ({
  ref: { group: 'acme', project: key },
  model: {
    name,
    customerName: 'Acme',
    elements: [],
    connections: [],
    diagrams: [{ id: 'd1', kind: 'layer7' as const, name: 'L7', placements: [] }],
  },
  activeDiagramId: 'd1',
  logoLibrary: [],
})

/** The whole app on the picker, with one seam replaced by a refusing one. */
function show(projects: Partial<ProjectLibrary>) {
  return renderApp({
    projects: {
      list: () => Promise.resolve([]),
      load: () => Promise.resolve(undefined),
      save: () => Promise.resolve(),
      remove: () => Promise.resolve(),
      ...projects,
    },
    examples: [{
      key: 'acme',
      ref: { group: 'acme', project: 'landscape' },
      groupName: 'Acme',
      label: 'Acme Logistics',
      description: 'an example',
      document: {
        formatVersion: '1',
        design: { name: 'Warehouse landscape' },
        elements: [], connections: [], diagrams: [],
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

describe('renaming a group when the sweep cannot finish', () => {
  it('names the projects it did not reach instead of stopping in silence', async () => {
    const projects = new InMemoryProjectStore([
      project('warehouse', 'Warehouse'),
      project('rolling-stock', 'Rolling stock'),
    ])
    // One of the two refuses. The old sweep returned at the first failure, so
    // the second project kept the old label and nobody was told which.
    vi.spyOn(projects, 'save').mockImplementation((held) =>
      held.ref.project === 'rolling-stock'
        ? Promise.reject(new Error('quota'))
        : Promise.resolve())

    const { diagnostics } = renderApp({ projects })

    fireEvent.click(await screen.findByRole('button', { name: 'Settings for Acme' }))
    fireEvent.change(await screen.findByLabelText('Group name'), {
      target: { value: 'Acme Logistics' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.getByRole('alert').textContent)
      .toContain('these projects still carry the old name: Rolling stock'))
    expect(diagnostics.recent().some((e) => e.where === 'applyGroupSettings.relabel')).toBe(true)
  })
})

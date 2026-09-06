// @vitest-environment jsdom
/**
 * Applying project settings, with a project open and being edited.
 *
 * Two things went wrong here at once, and they hid each other. The dialog's
 * result was applied to the project as the App last saw it — a model from
 * before this afternoon's editing — and the saved result never reached the open
 * session, which went on holding a model from before the dialog and wrote it
 * back out on its next autosave. So the maturity columns you had just chosen
 * were both invisible and, a moment later, gone.
 *
 * The editor is stubbed: what is under test is the wiring between the dialog,
 * the session and the store, and a real canvas would only slow it down.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { InMemoryProjectStore } from '../adapters/memory/InMemoryProjectStore'
import type { ProjectSnapshot } from '../core/project'
import { renderApp } from './testing/renderShell'

/** The one thing the stub does: land a change on the model, as editing would. */
vi.mock('@lionsville/solution-design', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@lionsville/solution-design')>()
  return {
    ...actual,
    SolutionDesignEditor: (props: {
      onDiagramSettingsChange?: (
        id: string,
        settings: { name: string; author?: string },
      ) => void
    }) => (
      <button
        data-testid="edit-the-diagram"
        onClick={() => props.onDiagramSettingsChange?.('d1', { name: 'L7', author: 'Grace' })}
      >
        edit
      </button>
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

function show(initial: ProjectSnapshot) {
  const projects = new InMemoryProjectStore([initial])
  renderApp({ projects, initialProject: initial })
  return projects
}

/** Fill in the dialog and save it. */
function applySettings(fields: { name?: string; author?: string }) {
  fireEvent.click(screen.getByText('Settings…'))
  if (fields.name !== undefined) {
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: fields.name } })
  }
  if (fields.author !== undefined) {
    fireEvent.change(screen.getByLabelText('Author'), { target: { value: fields.author } })
  }
  fireEvent.click(screen.getByText('Save'))
}

const saved = (store: InMemoryProjectStore) =>
  store.load({ group: 'acme', project: 'landscape' })

describe('project settings on an open project', () => {
  it('keeps the editing the session has done', async () => {
    const store = show(project())
    fireEvent.click(screen.getByTestId('edit-the-diagram'))

    applySettings({ author: 'Ada' })

    await waitFor(async () => {
      const held = await saved(store)
      expect(held?.model.defaultAuthor).toBe('Ada')
      // The session's edit, which the App itself never saw.
      expect(held?.model.diagrams[0].author).toBe('Grace')
    })
  })

  it('hands the saved project back to the session, so the next save keeps it', async () => {
    const store = show(project())
    applySettings({ name: 'Renamed', author: 'Ada' })

    // The toolbar reads the session's model: seeing the new name is the proof
    // that the session took the saved project on.
    await waitFor(() => expect(screen.getByText('Renamed')).toBeTruthy())

    // A later change must not carry a pre-dialog model back over the defaults.
    fireEvent.click(screen.getByTestId('edit-the-diagram'))
    await waitFor(async () => {
      const held = await saved(store)
      expect(held?.model.diagrams[0].author).toBe('Grace')
      expect(held?.model.defaultAuthor).toBe('Ada')
      expect(held?.model.name).toBe('Renamed')
    })
  })
})

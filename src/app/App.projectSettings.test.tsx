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
import type { ProjectSnapshot } from '../projects/project'
import type { ProjectRef } from '../projects/projectRef'
import { renderApp } from './testing/renderShell'

/** The one thing the stub does: land a change on the model, as editing would. */
vi.mock('../editor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor')>()
  return {
    ...actual,
    SolutionDesignEditor: (props: {
      diagrams: {
        onSettingsChange?: (id: string, settings: { name: string; author?: string }) => void
      }
    }) => (
      <button
        data-testid="edit-the-diagram"
        onClick={() => props.diagrams.onSettingsChange?.('d1', { name: 'L7', author: 'Grace' })}
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

/**
 * The autosave waits three seconds now (ADR-0003), which is longer than a test
 * wants to sit still for. Leaving the window is the other trigger and needs no
 * clock: it is what a person does when they believe they are finished.
 */
function leaveTheWindow() {
  fireEvent.blur(window)
}

describe('project settings on an open project', () => {
  it('does not let a pending save put the project back where it was', async () => {
    // A move is save-here, remove-there, and the workspace showing the project
    // is still mounted in between. An autosave landing on the old address a
    // millisecond after it was removed leaves two copies — and the one the user
    // goes on editing is the one that disappears next time.
    //
    // The remove is held open so the window is real rather than a matter of
    // microseconds: the stale save is fired while it is in flight.
    const store = new InMemoryProjectStore([project()])
    let release: (() => void) | undefined
    const written: ProjectRef[] = []
    const held = {
      list: () => store.list(),
      load: (ref: ProjectRef) => store.load(ref),
      save: (project: ProjectSnapshot) => { written.push(project.ref); return store.save(project) },
      remove: async (ref: ProjectRef) => {
        await new Promise<void>((resolve) => { release = resolve })
        await store.remove(ref)
      },
    }
    renderApp({ projects: held, initialProject: project() })
    fireEvent.click(screen.getByTestId('edit-the-diagram'))

    fireEvent.click(screen.getByText('Settings…'))
    fireEvent.mouseDown(screen.getByLabelText('Group'))
    fireEvent.click(screen.getByText('New group…'))
    // Two fields answer to "Group" now: the select, and the name for the new
    // one it revealed.
    const named = screen.getAllByLabelText('Group').find((el) => el.tagName === 'INPUT')!
    fireEvent.change(named, { target: { value: 'Globex' } })
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => expect(release).toBeDefined())
    written.length = 0 // the move's own save, which went to the new address
    leaveTheWindow()
    release!()

    await waitFor(async () => {
      expect(await store.load({ group: 'globex', project: 'landscape' })).toBeTruthy()
    })
    // Nothing was written to the address the project left, at any point after
    // the move began. Whether the remove happened to run first is a matter of
    // microseconds and not something to depend on.
    expect(written.filter((ref) => ref.group === 'acme')).toEqual([])
    expect(await store.load({ group: 'acme', project: 'landscape' })).toBeUndefined()
  })

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
    leaveTheWindow()
    await waitFor(async () => {
      const held = await saved(store)
      expect(held?.model.diagrams[0].author).toBe('Grace')
      expect(held?.model.defaultAuthor).toBe('Ada')
      expect(held?.model.name).toBe('Renamed')
    })
  })
})

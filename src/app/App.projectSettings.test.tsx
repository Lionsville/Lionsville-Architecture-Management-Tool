// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
import { laidOut } from '../model/testFixtures';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { answering, heldRepositories } from './testing/heldRepositories'
import type { HeldRepositories } from './testing/heldRepositories'
import { bareScope } from '../projects/scope'
import type { ScopeSnapshot } from '../projects/scope'
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

function show(initial: ScopeSnapshot) {
  const projects = heldRepositories([initial])
  renderApp({ repositories: projects, boot: { initialProject: initial } })
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

const saved = (store: HeldRepositories) =>
  store.read('acme/landscape')

/**
 * The autosave waits three seconds now (ADR-0003), which is longer than a test
 * wants to sit still for. Leaving the window is the other trigger and needs no
 * clock: it is what a person does when they believe they are finished.
 */
function leaveTheWindow() {
  fireEvent.blur(window)
}

/** File the open scope under Globex, through the dialog. */
async function moveUnderGlobex() {
  fireEvent.click(screen.getByText('Settings…'))
  fireEvent.mouseDown(screen.getByLabelText('Group'))
  fireEvent.click(await screen.findByRole('option', { name: 'Globex' }))
  fireEvent.click(screen.getByText('Save'))
}

describe('project settings on an open project', () => {
  /**
   * A move takes the scope to its new address with its identity, so what the
   * session did before it is written where the scope went — and nothing is
   * written at the address it left.
   */
  it('moves the open scope with what was done in it, and leaves nothing behind', async () => {
    const store = heldRepositories([project(), bareScope('globex', 'Globex', 'domain')])
    renderApp({ repositories: store, boot: { initialProject: project() } })
    fireEvent.click(screen.getByTestId('edit-the-diagram'))
    await moveUnderGlobex()

    await waitFor(async () => expect((await store.read('globex/landscape'))?.model.diagrams[0].author).toBe('Grace'))
    leaveTheWindow()
    expect(await store.read('acme/landscape')).toBeUndefined()
  })

  it('moves the scopes filed under the open one with it', async () => {
    const child: ScopeSnapshot = { ...bareScope('acme/landscape/team', 'Team', 'team') }
    const store = heldRepositories([project(), child, bareScope('globex', 'Globex', 'domain')])
    renderApp({ repositories: store, boot: { initialProject: project() } })
    await moveUnderGlobex()

    await waitFor(async () => expect(await store.read('acme/landscape')).toBeUndefined())
    expect((await store.read('globex/landscape/team'))?.model.name).toBe('Team')
    expect(await store.read('globex/landscape')).toBeTruthy()
  })

  /** A move the repository refuses moves nothing, and says why. */
  it('says so where the move is refused, and moves nothing', async () => {
    const store = answering(
      heldRepositories([project(), bareScope('globex', 'Globex', 'domain')]),
      { move: () => Promise.resolve({ refused: 'shell.scopeTaken' }) },
    )
    renderApp({ repositories: store, boot: { initialProject: project() } })
    await moveUnderGlobex()

    expect(await screen.findByText(/already/)).toBeTruthy()
    expect(await store.read('globex/landscape')).toBeUndefined()
    expect(await store.read('acme/landscape')).toBeTruthy()
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

  it('changes the name and the defaults in the session, so the next save keeps them', async () => {
    const store = show(project())
    applySettings({ name: 'Renamed', author: 'Ada' })

    // The toolbar reads the session's model: seeing the new name is the proof
    // that the change was the session's own.
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

/**
 * The settings rename the scope and can move it. On a scope that is only read
 * they are refused before the dialog opens, with the session's sentence.
 */
describe('project settings on a scope that is only read', () => {
  it('does not open, and says why', async () => {
    const store = show({ ...project(), unreadable: ['model.json'] })
    fireEvent.click(screen.getByText('Settings…'))
    await screen.findByText(/open to be read and not changed/)
    expect(screen.queryByLabelText('Project name')).toBeNull()
    expect((await saved(store))?.model.name).toBe('Landscape')
  })
})

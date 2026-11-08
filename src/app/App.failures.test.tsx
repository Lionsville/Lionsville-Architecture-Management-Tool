// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The stores refusing, in each of the places that used to carry on regardless.
 *
 * Every one of these was a `void store.x().then(...)` with a success handler
 * and nothing else. A store that started refusing mid-session left the screen
 * looking exactly as it does when everything is fine: an empty organisation
 * that reads as "you have nothing here", a scope half renamed, a scope quietly
 * filed at two addresses.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { laidOut } from '../model/testFixtures';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { answering, heldRepositories } from './testing/heldRepositories'
import type { ScopeRepository } from '../ports/ScopeRepository'
import { renderApp } from './testing/renderShell'
import { exampleScopes } from '../adapters/folder/format/exampleFolder'

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

/** The whole app on the organisation screen, some of what the scopes answer replaced by a refusal. */
function show(over: Partial<ScopeRepository>) {
  return renderApp({
    repositories: answering(heldRepositories(), over),
    examples: [{
      key: 'acme',
      path: 'acme/landscape',
      label: 'Acme Logistics',
      description: 'an example',
      scopes: exampleScopes({
        'scope.json': {
          type: 'lionsville-architecture', version: 5, name: 'Warehouse landscape',
          activeDiagramId: 'l7', diagrams: ['l7'],
        },
        'model.json': { elements: [], relations: [] },
        'diagrams/l7.json': { id: 'l7', kind: 'layer7', name: 'Landscape', members: [] },
        'diagrams/l7.geometry.json': { nodes: [] },
      }, 'acme/landscape'),
    }],
  })
}

describe('the organisation screen, when the store refuses', () => {
  it('says the list could not be read instead of showing an empty one', async () => {
    show({ tree: refused })
    await waitFor(() => expect(screen.getByRole('alert').textContent)
      .toContain('The organisations could not be read.'))
  })

  it('puts the cause in the trail, not only on the screen', async () => {
    const { diagnostics } = show({ tree: refused })
    await waitFor(() => expect(diagnostics.messages()).toContain('picker.listFailed'))
    expect((diagnostics.recent()[0].cause as Error).message).toBe('storage refused')
  })
})

/**
 * What used to be here: a group's rename sweeping every project filed under it,
 * naming the ones it could not reach. There is no sweep any more — a scope's
 * name is its own `scope.json` and nothing else holds a copy (ADR-0012 §1) — so
 * the failure it guarded against cannot happen and the message it showed is
 * gone with it. A save that refuses is one write refusing, which
 * `useOrganisation`'s `applySettings` reports as `group.saveFailed`.
 */
describe('a scope whose record will not save', () => {
  it('says so rather than leaving the dialog looking as though it landed', async () => {
    const projects = answering(heldRepositories([project('warehouse', 'Warehouse')]), {
      apply: () => Promise.reject(new Error('quota')),
    })

    const { diagnostics } = renderApp({ repositories: projects })

    // The tree starts folded: the warehouse is under acme.
    fireEvent.click(await screen.findByTestId('fold-acme'))
    fireEvent.click(await screen.findByRole('button', { name: 'More for Warehouse' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Settings…' }))
    const name = await screen.findByTestId('settings-name')
    fireEvent.change(name, { target: { value: 'Warehouse renamed' } })
    fireEvent.blur(name)

    await waitFor(() => expect(diagnostics.messages()).toContain('group.saveFailed'))
  })

  /** The settings page over the warehouse, its writes refused while `refusing.now` says so. */
  async function settingsRefusing(refusing: { now: boolean }) {
    const held = heldRepositories([project('warehouse', 'Warehouse')])
    const projects = answering(held, {
      apply: (work) => (refusing.now ? Promise.reject(new Error('EACCES')) : held.scopes.apply(work)),
    })
    const shown = renderApp({ repositories: projects })
    fireEvent.click(await screen.findByTestId('fold-acme'))
    fireEvent.click(await screen.findByRole('button', { name: 'More for Warehouse' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Settings…' }))
    const name = await screen.findByTestId('settings-name')
    fireEvent.change(name, { target: { value: 'Warehouse renamed' } })
    fireEvent.blur(name)
    await screen.findByTestId('setting-not-kept')
    return { ...shown, held, name: name as HTMLInputElement }
  }

  const word = () => screen.getByTestId('saved-indicator')

  it('says Not saved on the frame and at the field, which keeps what was typed and says it is not kept', async () => {
    await settingsRefusing({ now: true })
    await waitFor(() => expect(word().getAttribute('data-tone')).toBe('problem'))
    expect(word().textContent).toContain('Not saved')
    expect(screen.getByTestId('setting-not-kept')).toBeDefined()
    expect(screen.getByText('Not saved: this was not written where your work is kept.')).toBeDefined()
  })

  it('lands on Try again once the store takes it, and the word is calm again', async () => {
    const refusing = { now: true }
    const { held } = await settingsRefusing(refusing)
    refusing.now = false
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(screen.queryByTestId('setting-not-kept')).toBeNull())
    await waitFor(() => expect(word().getAttribute('data-tone')).not.toBe('problem'))
    expect((await held.read('acme/warehouse'))?.model.name).toBe('Warehouse renamed')
  })

  it('puts the name back as it is kept, and the word is calm again with nothing unkept on screen', async () => {
    const { held, name } = await settingsRefusing({ now: true })
    fireEvent.click(screen.getByRole('button', { name: 'Put back' }))
    await waitFor(() => expect(name.value).toBe('Warehouse'))
    expect(screen.queryByTestId('setting-not-kept')).toBeNull()
    await waitFor(() => expect(word().getAttribute('data-tone')).not.toBe('problem'))
    expect((await held.read('acme/warehouse'))?.model.name).toBe('Warehouse')
  })

  it('offers the refused write again from Your work, where the field is no longer on screen', async () => {
    const refusing = { now: true }
    const { held } = await settingsRefusing(refusing)
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    fireEvent.click(word())
    expect((await screen.findByTestId('work-not-kept')).textContent).toContain('not saved')
    refusing.now = false
    fireEvent.click(screen.getByTestId('work-retry'))
    await waitFor(() => expect(screen.queryByTestId('work-not-kept')).toBeNull())
    expect((await held.read('acme/warehouse'))?.model.name).toBe('Warehouse renamed')
  })
})

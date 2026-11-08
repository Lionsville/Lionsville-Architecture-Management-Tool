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
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { ShellError } from '../platform/errors'
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

  it('makes two refused fields of one scope again from Your work, each keeping the other', async () => {
    const refusing = { now: true }
    const { held, name } = await settingsRefusing(refusing)
    const description = document.querySelector<HTMLElement>('[data-field=description] textarea')!
    fireEvent.focus(description)
    fireEvent.change(description, { target: { value: 'Freight lines' } })
    fireEvent.blur(description, { relatedTarget: document.body })
    await waitFor(() => expect(screen.getAllByTestId('setting-not-kept')).toHaveLength(2))
    expect(name.value).toBe('Warehouse renamed')
    refusing.now = false
    fireEvent.click(word())
    fireEvent.click(await screen.findByTestId('work-retry'))
    await waitFor(() => expect(screen.queryByTestId('work-not-kept')).toBeNull())
    const kept = await held.read('acme/warehouse')
    expect(kept?.model.name).toBe('Warehouse renamed')
    expect(kept?.model.description).toBe('Freight lines')
  })
})


/**
 * A view renamed from its row on a scope's home, where the folder will not be
 * written: the row keeps the name that is kept, the word says Not saved, the
 * toast says the folder's truth and why and points at Your work, and Your
 * work makes it again or puts it back.
 */
describe('a view renamed on a home, where the folder refuses', () => {
  async function renameRefused(refusing: { now: boolean }) {
    const held = heldRepositories([project('warehouse', 'Warehouse')])
    const projects = answering(held, {
      apply: (work) => (refusing.now ? Promise.reject(new ShellError('shell.folderNoAccess')) : held.scopes.apply(work)),
    })
    const shown = renderApp({
      repositories: projects,
      boot: { initialProject: undefined, initialHome: 'acme/warehouse' },
      provider: { sayings: { labelKey: 'shell.sourceFolder', whereKey: 'folder.where', keepFailedKey: 'folder.keepFailed' } },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'More for L7' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Rename view…' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Order flow' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    return { ...shown, held }
  }
  const word = () => screen.getByTestId('saved-indicator')
  const nameKept = async (held: ReturnType<typeof heldRepositories>) => (await held.read('acme/warehouse'))?.model.diagrams[0]?.name

  it('says the folder did not take it and why, never the browser\u2019s sentence, and keeps the old name', async () => {
    await renameRefused({ now: true })
    const toast = await screen.findByRole('alert')
    await waitFor(() => expect(toast.textContent).toContain('The folder did not take the change, so it is not saved.'))
    expect(toast.textContent).toContain('it is read-only, or kept from this app')
    expect(toast.textContent).not.toContain('browser')
    await waitFor(() => expect(word().textContent).toContain('Not saved'))
    expect(screen.getByRole('button', { name: 'More for L7' })).toBeDefined()
    fireEvent.click(within(toast).getByRole('button', { name: 'See Your work' }))
    expect((await screen.findByTestId('work-not-kept')).textContent).toContain('The folder did not take the change')
    // The change by name, and the keyboard where the way out is.
    expect(screen.getByTestId('work-refused-row').textContent).toBe('Renamed a view to Order flow')
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('work-retry')))
    expect(screen.getByTestId('work-put-back')).toBeDefined()
  })

  it('says Still not taken where Try again is refused once more, and keeps the focus on it', async () => {
    await renameRefused({ now: true })
    await waitFor(() => expect(word().textContent).toContain('Not saved'))
    fireEvent.click(word())
    const again = await screen.findByTestId('work-retry')
    again.focus()
    fireEvent.click(again)
    expect((await screen.findByTestId('work-still')).textContent).toBe('Still not taken: This app may not write in that folder: it is read-only, or kept from this app. Give it write access, or work from another folder.')
    expect(document.activeElement).toBe(screen.getByTestId('work-retry'))
    expect(screen.getByTestId('work-not-kept')).toBeDefined()
  })

  it('lands on Try again once the folder may be written, and the row says the new name', async () => {
    const refusing = { now: true }
    const { held } = await renameRefused(refusing)
    await waitFor(() => expect(word().textContent).toContain('Not saved'))
    fireEvent.click(word())
    refusing.now = false
    fireEvent.click(await screen.findByTestId('work-retry'))
    await waitFor(() => expect(screen.queryByTestId('work-not-kept')).toBeNull())
    // Landed, the section is gone: the panel holds the focus.
    await waitFor(() => expect(document.activeElement?.classList.contains('kit-panel__body')).toBe(true))
    expect(await nameKept(held)).toBe('Order flow')
    await waitFor(() => expect(document.querySelector('[aria-label="More for Order flow"]')).not.toBeNull())
    await waitFor(() => expect(word().getAttribute('data-tone')).not.toBe('problem'))
  })

  it('puts it back, leaving the name that is kept and the word calm', async () => {
    const { held } = await renameRefused({ now: true })
    await waitFor(() => expect(word().textContent).toContain('Not saved'))
    fireEvent.click(word())
    fireEvent.click(await screen.findByTestId('work-put-back'))
    await waitFor(() => expect(screen.queryByTestId('work-not-kept')).toBeNull())
    await waitFor(() => expect(word().getAttribute('data-tone')).not.toBe('problem'))
    // The section went with what it said: the panel holds the focus, not the page.
    await waitFor(() => expect(document.activeElement?.classList.contains('kit-panel__body')).toBe(true))
    expect(await nameKept(held)).toBe('L7')
    // By its name rather than its role: the panel open over the home hides the page from role queries.
    expect(document.querySelector('[aria-label="More for L7"]')).not.toBeNull()
  })
})

describe('a view renamed on a home whose folder was moved away', () => {
  it('says the folder is not there rather than closing on nothing, and holds the change in Your work', async () => {
    const held = heldRepositories([project('warehouse', 'Warehouse')])
    const gone = { now: false }
    const projects = answering(held, {
      // The folder moved away: the scope no longer reads, and a write to it fails as the folder does.
      state: (id) => (gone.now ? Promise.resolve(undefined) : held.scopes.state(id)),
      apply: (work) => (gone.now ? Promise.reject(new ShellError('shell.folderUnavailable')) : held.scopes.apply(work)),
    })
    renderApp({
      repositories: projects,
      boot: { initialProject: undefined, initialHome: 'acme/warehouse' },
      provider: { sayings: { labelKey: 'shell.sourceFolder', whereKey: 'folder.where', keepFailedKey: 'folder.keepFailed' } },
    })
    fireEvent.click(await screen.findByRole('button', { name: 'More for L7' }))
    gone.now = true
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Rename view…' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Order flow' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))
    const toast = await screen.findByRole('alert')
    await waitFor(() => expect(toast.textContent).toContain('That folder is not available. Choose it again, or reconnect the drive it is on.'))
    expect(toast.textContent).not.toContain('somebody removed it')
    await waitFor(() => expect(screen.getByTestId('saved-indicator').textContent).toContain('Not saved'))
    fireEvent.click(screen.getByTestId('saved-indicator'))
    expect((await screen.findByTestId('work-refused-row')).textContent).toBe('Renamed a view to Order flow')
    // Back where it was: Try again lands it.
    gone.now = false
    fireEvent.click(screen.getByTestId('work-retry'))
    await waitFor(() => expect(screen.queryByTestId('work-not-kept')).toBeNull())
    expect((await held.read('acme/warehouse'))?.model.diagrams[0]?.name).toBe('Order flow')
  })
})

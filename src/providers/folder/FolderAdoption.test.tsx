// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The question that replaced a side effect. What matters here is that it IS a
 * question — two answers, neither of them a default — because the thing it
 * guards used to happen without one, into every folder somebody made; and
 * that it is asked only where it can mean something.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { memoryRepositories } from '../../adapters/memory/memoryRepositories'
import { RecordingDiagnostics } from '../../adapters/memory/RecordingDiagnostics'
import { LanguageProvider } from '../../i18n'
import type { Language } from '../../i18n'
import { contentOf, placeTogether, readScope } from '../../projects/scopeAccess'
import type { Repositories } from '../../ports/Repositories'
import { FolderChrome } from './FolderChrome'
import { folderOwn } from './folderOwn'

afterEach(() => cleanup())

async function kept(): Promise<Repositories> {
  const repositories = memoryRepositories()
  await placeTogether(repositories, [{
    address: 'acme',
    content: contentOf({ path: 'acme', model: { name: 'Acme Logistics', elements: [], relations: [], diagrams: [] }, activeDiagramId: '', logoLibrary: [] }, []),
  }])
  return repositories
}

function blob(initial: Record<string, unknown> = {}) {
  let held = { ...initial }
  return { read: () => held, write: (patch: Record<string, unknown>) => { held = { ...held, ...patch } } }
}

async function ask(options: {
  from?: Repositories; preferences?: ReturnType<typeof blob>; language?: Language; flush?: () => Promise<void>
} = {}) {
  const from = options.from ?? await kept()
  const into = memoryRepositories()
  const preferences = options.preferences ?? blob()
  const reread = vi.fn()
  const flush = vi.fn(options.flush ?? (() => Promise.resolve()))
  const diagnostics = new RecordingDiagnostics()
  const own = folderOwn({ settings: into.settings, diagnostics, adoption: { from, into, root: '/test2', name: 'test2' } })
  render(
    <LanguageProvider language={options.language ?? 'en'}>
      <FolderChrome
        current own={own} preferences={preferences} reread={reread} flush={flush} notify={vi.fn()}
        open={() => {}} screen={{} as never} movedBy={'person' as never}
      />
    </LanguageProvider>,
  )
  await act(() => new Promise<void>((resolve) => { setTimeout(resolve, 0) }))
  return { from, into, preferences, reread, flush, diagnostics }
}

const settled = () => act(() => new Promise<void>((resolve) => { setTimeout(resolve, 0) }))

/** A promise the test settles when it says so. */
function deferred() {
  let settle!: () => void
  let refuse!: (cause: unknown) => void
  const promise = new Promise<void>((resolve, reject) => { settle = resolve; refuse = reject })
  return { promise, settle, refuse }
}

/** Acme's work, and Globex's, whose state will not read. */
async function keptWithOneUnread(): Promise<Repositories> {
  const from = await kept()
  await placeTogether(from, [{
    address: 'globex',
    content: contentOf({ path: 'globex', model: { name: 'Globex', elements: [], relations: [], diagrams: [] }, activeDiagramId: '', logoLibrary: [] }, []),
  }])
  const globex = (await from.scopes.tree()).root.children.find((node) => node.address === 'globex')!.id
  const scopes = new Proxy(from.scopes, {
    get: (target, member) => (member === 'state'
      ? (id: string) => (id === globex ? Promise.reject(new Error('torn')) : target.state(id))
      : Reflect.get(target, member)),
  })
  return { ...from, scopes }
}

describe('the question a folder pick asks', () => {
  it('names the folder the answer is about, and says neither answer deletes anything', async () => {
    await ask()
    const said = screen.getByTestId('adopt-folder').textContent
    expect(said).toContain('“test2”')
    expect(said).toContain('Nothing is deleted either way')
  })

  it('asks in the language the app is in', async () => {
    await ask({ language: 'nl' })
    expect(screen.getByText('Je werk meenemen naar deze map?')).toBeDefined()
  })

  it('copies the work in on a yes, remembers it, has the folder read again, and says so on screen', async () => {
    const { into, preferences, reread, from, diagnostics } = await ask()
    fireEvent.click(screen.getByTestId('adopt-copy'))
    await settled()
    expect((await readScope(into.scopes, 'acme'))?.model.name).toBe('Acme Logistics')
    expect(preferences.read()).toMatchObject({ migratedFolders: ['/test2'] })
    expect(reread).toHaveBeenCalledTimes(1)
    // Nothing is taken from where it was.
    expect((await readScope(from.scopes, 'acme'))?.model.name).toBe('Acme Logistics')
    // Counts, never names.
    expect(diagnostics.messages()).toEqual(['copied 1 scopes, kept 0, failed 0, unread 0'])
    expect(screen.getByTestId('adopt-outcome').textContent).toBe('1 copied into “test2”.')
    fireEvent.click(screen.getByTestId('adopt-close'))
    await waitFor(() => expect(screen.queryByTestId('adopt-folder')).toBeNull())
  })

  it('stays open and busy until the copy is done, with nothing to press, and writes the open scope first', async () => {
    const writing = deferred()
    const { into, flush } = await ask({ flush: () => writing.promise })
    fireEvent.click(screen.getByTestId('adopt-copy'))
    await settled()
    expect(flush).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('adopt-busy')).toBeDefined()
    expect(screen.getByTestId('adopt-folder').textContent).toContain('Copying your work into “test2”')
    expect(screen.queryByRole('button')).toBeNull()
    // Nothing is copied before the open scope is written.
    expect(await readScope(into.scopes, 'acme')).toBeUndefined()
    writing.settle()
    await settled()
    expect(screen.queryByTestId('adopt-busy')).toBeNull()
    expect(screen.getByTestId('adopt-outcome').textContent).toBe('1 copied into “test2”.')
  })

  it('says on screen which scopes could not be copied', async () => {
    await ask({ from: await keptWithOneUnread() })
    fireEvent.click(screen.getByTestId('adopt-copy'))
    await settled()
    expect(screen.getByTestId('adopt-outcome').textContent).toBe('1 copied; 1 could not be copied: globex.')
  })

  it('says on screen and in the trail a copy that fell over, and remembers nothing, so it is asked again', async () => {
    const from = await kept()
    let asked = 0
    // The tree answers the question, and refuses the copy.
    const scopes = new Proxy(from.scopes, {
      get: (target, member) => (member === 'tree'
        ? () => (asked++ === 0 ? target.tree() : Promise.reject(new Error('this browser refused')))
        : Reflect.get(target, member)),
    })
    const { preferences, reread, diagnostics } = await ask({ from: { ...from, scopes } })
    fireEvent.click(screen.getByTestId('adopt-copy'))
    await settled()
    expect(preferences.read()).toEqual({})
    expect(reread).not.toHaveBeenCalled()
    expect(diagnostics.messages()).toEqual(['rejected'])
    expect(screen.getByRole('alert').textContent).toBe('Nothing was copied: this browser refused')
  })

  it('copies nothing where the open scope could not be written first, and says why', async () => {
    const { into } = await ask({ flush: () => Promise.reject(new Error('the disk is full')) })
    fireEvent.click(screen.getByTestId('adopt-copy'))
    await settled()
    expect(await readScope(into.scopes, 'acme')).toBeUndefined()
    expect(screen.getByRole('alert').textContent).toBe('Nothing was copied: the disk is full')
  })

  it('copies nothing on a no, and remembers the no for this folder', async () => {
    const { into, preferences } = await ask()
    fireEvent.click(screen.getByTestId('adopt-skip'))
    await settled()
    expect(await readScope(into.scopes, 'acme')).toBeUndefined()
    expect(preferences.read()).toMatchObject({ declinedFolders: ['/test2'] })
    await waitFor(() => expect(screen.queryByTestId('adopt-folder')).toBeNull())
  })

  it('does not ask where there is no work to bring', async () => {
    await ask({ from: memoryRepositories() })
    expect(screen.queryByTestId('adopt-folder')).toBeNull()
  })

  it('does not ask once the work has been brought anywhere, nor again about a folder that said no', async () => {
    await ask({ preferences: blob({ migratedFolders: ['/elsewhere'] }) })
    expect(screen.queryByTestId('adopt-folder')).toBeNull()
    cleanup()
    await ask({ preferences: blob({ declinedFolders: ['/test2'] }) })
    expect(screen.queryByTestId('adopt-folder')).toBeNull()
  })
})

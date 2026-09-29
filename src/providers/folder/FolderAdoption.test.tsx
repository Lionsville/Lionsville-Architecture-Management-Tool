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

async function ask(options: { from?: Repositories; preferences?: ReturnType<typeof blob>; language?: Language } = {}) {
  const from = options.from ?? await kept()
  const into = memoryRepositories()
  const preferences = options.preferences ?? blob()
  const reread = vi.fn()
  const diagnostics = new RecordingDiagnostics()
  const own = folderOwn({ settings: into.settings, diagnostics, adoption: { from, into, root: '/test2', name: 'test2' } })
  render(
    <LanguageProvider language={options.language ?? 'en'}>
      <FolderChrome
        current own={own} preferences={preferences} reread={reread} notify={vi.fn()}
        open={() => {}} screen={{} as never} movedBy={'person' as never}
      />
    </LanguageProvider>,
  )
  await act(() => new Promise<void>((resolve) => { setTimeout(resolve, 0) }))
  return { from, into, preferences, reread, diagnostics }
}

const settled = () => act(() => new Promise<void>((resolve) => { setTimeout(resolve, 0) }))

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

  it('copies the work in on a yes, remembers it, and has the folder read again', async () => {
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

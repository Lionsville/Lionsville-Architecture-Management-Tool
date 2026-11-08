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
import { contentOf, landed, placeTogether, readScope, stepOf } from '../../projects/scopeAccess'
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
  from?: Repositories; into?: Repositories; preferences?: ReturnType<typeof blob>; language?: Language; flush?: () => Promise<void>
  back?: () => void
} = {}) {
  const from = options.from ?? await kept()
  const into = options.into ?? memoryRepositories()
  const preferences = options.preferences ?? blob()
  const reread = vi.fn()
  const flush = vi.fn(options.flush ?? (() => Promise.resolve()))
  const diagnostics = new RecordingDiagnostics()
  const own = folderOwn({ settings: into.settings, diagnostics, adoption: { from, into, root: '/test2', name: 'test2' } })
  render(
    <LanguageProvider language={options.language ?? 'en'}>
      <FolderChrome
        current own={own} preferences={preferences} reread={reread} flush={flush} notify={vi.fn()}
        open={() => {}} screen={{} as never} movedBy={'person' as never} {...(options.back ? { back: options.back } : {})}
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
    expect(preferences.read()).toMatchObject({ adoptedFolders: ['/test2'], migratedFolders: ['/test2'] })
    expect(reread).toHaveBeenCalledTimes(1)
    // Nothing is taken from where it was.
    expect((await readScope(from.scopes, 'acme'))?.model.name).toBe('Acme Logistics')
    // Counts, never names.
    expect(diagnostics.messages()).toEqual(['copied 1 scopes, already 0, kept 0, failed 0, unread 0, unlike 0'])
    expect(screen.getByTestId('adopt-outcome').textContent).toContain('“test2” now holds your work, read back and found the same: 1 scope.')
    expect(screen.getByTestId('adopt-outcome').textContent).toContain('Nothing has changed in this browser')
    // The question has been answered, and the title no longer asks it.
    expect(screen.getByRole('dialog', { name: 'Your work is in this folder' })).toBeDefined()
    fireEvent.click(screen.getByTestId('adopt-close'))
    await waitFor(() => expect(screen.queryByTestId('adopt-folder')).toBeNull())
  })

  it('stays open and busy until the copy is done, with only a way to stop it, and writes the open scope first', async () => {
    const writing = deferred()
    const { into, flush } = await ask({ flush: () => writing.promise })
    fireEvent.click(screen.getByTestId('adopt-copy'))
    await settled()
    expect(flush).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('adopt-busy')).toBeDefined()
    expect(screen.getByTestId('adopt-folder').textContent).toContain('Copying your work into “test2”')
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Stop'])
    expect(screen.getByRole('dialog', { name: 'Copying your work into this folder' })).toBeDefined()
    // Nothing is copied before the open scope is written.
    expect(await readScope(into.scopes, 'acme')).toBeUndefined()
    writing.settle()
    await settled()
    expect(screen.queryByTestId('adopt-busy')).toBeNull()
    expect(screen.getByTestId('adopt-outcome').textContent).toContain('read back and found the same: 1 scope.')
  })

  it('says on screen which scopes could not be copied', async () => {
    await ask({ from: await keptWithOneUnread() })
    fireEvent.click(screen.getByTestId('adopt-copy'))
    await settled()
    const said = screen.getByTestId('adopt-outcome').textContent
    expect(said).toContain('Copied into “test2”, read back and found the same: 1 scope.')
    expect(said).toContain('Could not be read whole in this browser, so they are still only here (1): globex.')
    expect(screen.getByRole('dialog', { name: 'Not all of your work was copied' })).toBeDefined()
  })

  it('goes back to where the work was kept before, once a copy that left something behind is closed', async () => {
    const back = vi.fn()
    await ask({ from: await keptWithOneUnread(), back })
    fireEvent.click(screen.getByTestId('adopt-copy'))
    await settled()
    const said = screen.getByTestId('adopt-outcome').textContent
    expect(said).toContain('You go on working in this browser')
    expect(said).not.toContain('Nothing has changed in this browser')
    expect(back).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Go on in this browser' }))
    expect(back).toHaveBeenCalledTimes(1)
  })

  it('goes back as well after a copy that did not run', async () => {
    const back = vi.fn()
    await ask({ flush: () => Promise.reject(new Error('the disk is full')), back })
    fireEvent.click(screen.getByTestId('adopt-copy'))
    await settled()
    fireEvent.click(screen.getByTestId('adopt-close'))
    expect(back).toHaveBeenCalledTimes(1)
  })

  it('stays in the folder after a whole copy, with somewhere to go back to all the same', async () => {
    const back = vi.fn()
    const { reread } = await ask({ back })
    fireEvent.click(screen.getByTestId('adopt-copy'))
    await settled()
    expect(reread).toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('adopt-close'))
    expect(back).not.toHaveBeenCalled()
  })

  it('offers to try again the scopes that could not be written, and asks again at the next pick until they are', async () => {
    const from = await kept()
    await placeTogether(from, [{
      address: 'globex',
      content: contentOf({ path: 'globex', model: { name: 'Globex', elements: [], relations: [], diagrams: [] }, activeDiagramId: '', logoLibrary: [] }, []),
    }])
    const folder = memoryRepositories()
    let refusing = true
    const scopes = new Proxy(folder.scopes, {
      get: (target, member) => (member === 'create'
        ? (...args: Parameters<typeof target.create>) => (refusing && args[0] === 'globex'
          ? Promise.reject(new Error('the disk said no')) : target.create(...args))
        : Reflect.get(target, member)),
    })
    const { preferences } = await ask({ from, into: { ...folder, scopes } })
    fireEvent.click(screen.getByTestId('adopt-copy'))
    await settled()
    expect(screen.getByTestId('adopt-outcome').textContent).toContain('Could not be written (1): globex. the disk said no')
    // Not done: the next pick of this folder asks again.
    expect(preferences.read()).toEqual({})
    refusing = false
    fireEvent.click(screen.getByTestId('adopt-again'))
    await settled()
    const again = screen.getByTestId('adopt-outcome').textContent
    expect(again).toContain('“test2” now holds your work, read back and found the same: 2 scopes.')
    expect((await readScope(folder.scopes, 'globex'))?.model.name).toBe('Globex')
    expect(preferences.read()).toMatchObject({ migratedFolders: ['/test2'] })
    expect(screen.queryByTestId('adopt-again')).toBeNull()
  })

  it('names the scopes left as they were because somebody worked in them while they were copied', async () => {
    const folder = memoryRepositories()
    const acme = landed(await folder.scopes.create('acme', { name: '' })).id
    let worked = false
    const scopes = new Proxy(folder.scopes, {
      get: (target, member) => (member === 'apply'
        ? async (work: Parameters<typeof target.apply>[0]) => {
          // The copy found it empty; somebody writes to it before the copy lands.
          if (!worked) {
            worked = true
            landed(await target.apply([{ scope: acme, steps: [stepOf({ type: 'project.settings', patch: { name: 'Acme, worked on', description: 'Theirs.' } })] }]))
          }
          return target.apply(work)
        }
        : Reflect.get(target, member)),
    })
    await ask({ into: { ...folder, scopes } })
    fireEvent.click(screen.getByTestId('adopt-copy'))
    await settled()
    const said = screen.getByTestId('adopt-outcome').textContent
    expect(said).toContain('Nothing was copied into “test2”.')
    expect(said).toContain('Left as they were, because they changed meanwhile: acme.')
    expect(screen.getByRole('dialog', { name: 'Nothing was copied' })).toBeDefined()
    expect((await readScope(folder.scopes, 'acme'))?.model.name).toBe('Acme, worked on')
  })

  it('offers no second try for a scope this browser could not read, and does not ask about it again in this folder', async () => {
    const { preferences } = await ask({ from: await keptWithOneUnread() })
    fireEvent.click(screen.getByTestId('adopt-copy'))
    await settled()
    expect(screen.queryByTestId('adopt-again')).toBeNull()
    expect(preferences.read()).toEqual({ declinedFolders: ['/test2'] })
  })

  it('says on screen and in the trail a copy that fell over, and remembers nothing, so it is asked again', async () => {
    const from = await kept()
    let asked = 0
    // The tree answers the question and what the folder holds, and refuses the copy.
    const scopes = new Proxy(from.scopes, {
      get: (target, member) => (member === 'tree'
        ? () => (asked++ < 2 ? target.tree() : Promise.reject(new Error('this browser refused')))
        : Reflect.get(target, member)),
    })
    const { preferences, reread, diagnostics } = await ask({ from: { ...from, scopes } })
    fireEvent.click(screen.getByTestId('adopt-copy'))
    await settled()
    expect(preferences.read()).toEqual({})
    expect(reread).not.toHaveBeenCalled()
    expect(diagnostics.messages()).toEqual(['rejected'])
    expect(screen.getByRole('alert').textContent).toContain('Nothing was copied: this browser refused')
  })

  it('copies nothing where the open scope could not be written first, and says why', async () => {
    const { into } = await ask({ flush: () => Promise.reject(new Error('the disk is full')) })
    fireEvent.click(screen.getByTestId('adopt-copy'))
    await settled()
    expect(await readScope(into.scopes, 'acme')).toBeUndefined()
    expect(screen.getByRole('alert').textContent).toContain('Nothing was copied: the disk is full')
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

  it('asks again after a copy by a build that did not check, whose word for it counts for nothing', async () => {
    await ask({ preferences: blob({ migratedFolders: ['/test2'] }) })
    expect(screen.getByTestId('adopt-copy')).toBeDefined()
  })

  it('says what the folder already holds before anybody answers, and that it stays', async () => {
    const folder = memoryRepositories()
    await placeTogether(folder, [{
      address: 'acme',
      content: contentOf({ path: 'acme', model: { name: 'Acme, here', description: 'Theirs.', elements: [], relations: [], diagrams: [] }, activeDiagramId: '', logoLibrary: [] }, []),
    }])
    await ask({ into: folder })
    await settled()
    expect(screen.getByText('This folder already holds other work at 1 of these scopes')).toBeDefined()
    expect(screen.getByTestId('adopt-holds').textContent).toContain('stays exactly as it is, and these scopes are not copied: acme.')
    fireEvent.click(screen.getByTestId('adopt-copy'))
    await settled()
    expect((await readScope(folder.scopes, 'acme'))?.model.name).toBe('Acme, here')
    expect(screen.getByTestId('adopt-outcome').textContent).toContain('The folder holds other work at these')
  })

  it('shows how far it has got, can be stopped, and goes on from there', async () => {
    const from = await kept()
    await placeTogether(from, [{
      address: 'globex',
      content: contentOf({ path: 'globex', model: { name: 'Globex', elements: [], relations: [], diagrams: [] }, activeDiagramId: '', logoLibrary: [] }, []),
    }])
    const writing = deferred()
    const { into, preferences } = await ask({ from, flush: () => writing.promise })
    fireEvent.click(screen.getByTestId('adopt-copy'))
    await settled()
    fireEvent.click(screen.getByTestId('adopt-stop'))
    expect(screen.getByTestId<HTMLButtonElement>('adopt-stop').disabled).toBe(true)
    writing.settle()
    await settled()
    expect(screen.getByRole('dialog', { name: 'Copying stopped' })).toBeDefined()
    expect(screen.getByTestId('adopt-outcome').textContent).toContain('Run it again to go on')
    expect(await readScope(into.scopes, 'acme')).toBeUndefined()
    expect(preferences.read()).toEqual({})
    fireEvent.click(screen.getByTestId('adopt-again'))
    await settled()
    expect(screen.getByRole('dialog', { name: 'Your work is in this folder' })).toBeDefined()
    expect((await readScope(into.scopes, 'globex'))?.model.name).toBe('Globex')
  })

  it('does not ask once the work has been brought whole anywhere, nor again about a folder that said no', async () => {
    await ask({ preferences: blob({ adoptedFolders: ['/elsewhere'] }) })
    expect(screen.queryByTestId('adopt-folder')).toBeNull()
    cleanup()
    await ask({ preferences: blob({ declinedFolders: ['/test2'] }) })
    expect(screen.queryByTestId('adopt-folder')).toBeNull()
  })
})

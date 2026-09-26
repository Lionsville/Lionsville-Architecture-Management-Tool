// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A working file in and out of the whole shell, and whether what it holds
 * arrived (ADR-0023, amended).
 *
 * The flows' own suite holds the check to a store it writes itself; this one
 * holds the shell's wiring to it: which store a landing is written through,
 * what each write says it expects, and what a person is told. The stores
 * here misbehave the ways a real one can — a source that writes the open
 * scope only when a save says what it expects, a store that loses a write
 * without a word, a listing that could not read a scope.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { laidOut } from '../model/testFixtures'
import { InMemoryScopeStore } from '../adapters/memory/InMemoryScopeStore'
import type { HostCommand } from '../platform/hostCommands'
import type { ScopeSnapshot, ScopeSummary } from '../projects/scope'
import { workingFileBytes } from '../projects/workingFile'
import { MANIFEST_FILE, manifestOf, readManifest } from '../projects/workingFileManifest'
import { unsealBytes } from '../projects/sealedFile'
import { unzipSync } from 'fflate'
import { renderApp } from './testing/renderShell'

vi.mock('../editor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor')>()
  return { ...actual, SolutionDesignEditor: () => <div data-testid="editor" /> }
})

afterEach(() => cleanup())

const project = (name = 'Landscape', path = 'acme/landscape'): ScopeSnapshot => ({
  path,
  model: {
    name, elements: [], relations: [],
    diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [] })],
  },
  activeDiagramId: 'd1',
  logoLibrary: [],
})

/**
 * A store that writes the open scope only when a save says what it expects —
 * the rule of a source whose open scope's changes travel as steps, where the
 * session's own save is not a write at all.
 */
class PublishingStore extends InMemoryScopeStore {
  constructor(scopes: ScopeSnapshot[], private readonly open: string) { super(scopes) }
  override save(scope: ScopeSnapshot, expects?: string): Promise<void> {
    if (scope.path === this.open && expects === undefined) return Promise.resolve()
    return super.save(scope, expects)
  }
}

/** A store that loses the write of one scope, and says nothing about it. */
class LosingStore extends InMemoryScopeStore {
  constructor(scopes: ScopeSnapshot[], private readonly losing: string) { super(scopes) }
  override save(scope: ScopeSnapshot, expects?: string): Promise<void> {
    return scope.path === this.losing ? Promise.resolve() : super.save(scope, expects)
  }
}

/** A store whose listing names a scope it could not read. */
class UnreadableStore extends InMemoryScopeStore {
  override async list(): Promise<ScopeSummary> {
    return { ...(await super.list()), unreadable: ['acme/broken'] }
  }
}

function show(scopes: InMemoryScopeStore) {
  const listeners: ((command: HostCommand) => void)[] = []
  const harness = renderApp({
    scopes,
    boot: { initialProject: project() },
    host: {
      commands: (listener) => {
        listeners.push(listener)
        return () => { listeners.splice(listeners.indexOf(listener), 1) }
      },
    },
  })
  return {
    ...harness,
    send: (command: HostCommand) => act(() => { for (const held of [...listeners]) held(command) }),
  }
}

async function goHome() {
  fireEvent.click(screen.getByTestId('crumb-'))
  await waitFor(() => expect(screen.queryByTestId('crumb-')).toBeNull())
}

async function seal(password: string) {
  await waitFor(() => expect(screen.getByTestId('password')).toBeDefined())
  fireEvent.change(screen.getByTestId('password'), { target: { value: password } })
  fireEvent.change(screen.getByTestId('password-repeat'), { target: { value: password } })
  fireEvent.click(screen.getByTestId('password-confirm'))
}

describe('a working file opened over the open scope', () => {
  it('is written to the store too, where the store writes the open scope only when a save says what it expects', async () => {
    const store = new PublishingStore([project()], 'acme/landscape')
    const view = show(store)
    const theirs = [project('From a colleague', 'org'), project('Under it', 'org/under')]
    view.send({ type: 'openDocument', name: 'theirs.lvarch', bytes: workingFileBytes(theirs, await manifestOf(theirs)) })
    await waitFor(() => expect(screen.getByTestId('open-into-here')).toBeDefined())
    fireEvent.click(screen.getByTestId('open-into-here'))
    await waitFor(async () => expect((await store.load('acme/landscape'))?.model.name).toBe('From a colleague'))
    expect((await store.load('acme/landscape/under'))?.model.name).toBe('Under it')
    await waitFor(() => expect(screen.getByText(/loaded and checked against what it says it holds: 2 scopes/)).toBeDefined())
  })
})

describe('a working file opened on a home', () => {
  it('says which scope did not arrive, where a store lost it without a word', async () => {
    const store = new LosingStore([project()], 'fleet')
    const view = show(store)
    await goHome()
    const theirs = [project('Organisation', ''), project('Depots', 'depots'), project('Fleet', 'fleet')]
    view.send({ type: 'openDocument', name: 'org.lvarch', bytes: workingFileBytes(theirs, await manifestOf(theirs)) })
    await waitFor(() => expect(screen.getByTestId('open-into-here')).toBeDefined())
    fireEvent.click(screen.getByTestId('open-into-here'))
    await waitFor(() => expect(screen.getByText(
      'Working file “org.lvarch” did not arrive whole. Not there after loading: the scope “Fleet” (fleet).',
    )).toBeDefined())
  })
})

describe('a working file saved from a home', () => {
  it('is refused, naming the scope, when the listing could not read one', async () => {
    const view = show(new UnreadableStore([project()]))
    await goHome()
    view.send({ type: 'export' })
    await waitFor(() => expect(screen.getByText(
      'The working file was not saved: acme/broken could not be read, and a file without them would not be the whole organisation.',
    )).toBeDefined())
    expect(view.documents.saved).toHaveLength(0)
  })

  it('carries a manifest of what it holds', async () => {
    const view = show(new InMemoryScopeStore([project()]))
    await goHome()
    view.send({ type: 'export' })
    await seal('correct horse')
    await waitFor(() => expect(view.documents.saved).toHaveLength(1))
    const plain = await unsealBytes(view.documents.saved[0].bytes as Uint8Array, 'correct horse')
    const held = unzipSync(plain!)
    expect(readManifest(new TextDecoder().decode(held[MANIFEST_FILE]))?.scopes.map((one) => one.name)).toEqual(['Landscape'])
  })
})

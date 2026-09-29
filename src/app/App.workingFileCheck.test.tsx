// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A working file in and out of the whole shell, and whether what it holds
 * arrived (ADR-0023, amended).
 *
 * The flows' own suite holds the check to a store it writes itself; this one
 * holds the shell's wiring to it: how a landing reaches the repositories, and
 * what a person is told. The repositories here misbehave the ways a real one
 * can — a write lost without a word, a landing refused, a tree that could not
 * read a scope.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { laidOut } from '../model/testFixtures'
import { answering, heldRepositories } from './testing/heldRepositories'
import type { HeldRepositories } from './testing/heldRepositories'
import type { HostCommand } from '../platform/hostCommands'
import type { ScopeSnapshot } from '../projects/scope'
import { nodesOf } from '../projects/scopeAccess'
import { workingFileBytes } from '../adapters/folder/format/workingFile'
import { MANIFEST_FILE, manifestOf, readManifest } from '../adapters/folder/format/workingFileManifest'
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

/** The scopes, with the steps landed on one address dropped without a word: a lost write. */
function losing(scopes: readonly ScopeSnapshot[], lost: string): HeldRepositories {
  const held = heldRepositories(scopes)
  return answering(held, {
    apply: async (work) => {
      const nodes = nodesOf((await held.scopes.tree()).root)
      const kept = work.filter((one) => nodes.find((node) => node.id === one.scope)?.address !== lost)
      return held.scopes.apply(kept)
    },
  })
}

function show(repositories: HeldRepositories) {
  const listeners: ((command: HostCommand) => void)[] = []
  const harness = renderApp({
    repositories,
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
  it('lands the open scope and the scopes under it, and checks what arrived', async () => {
    const store = heldRepositories([project()])
    const view = show(store)
    const theirs = [project('From a colleague', 'org'), project('Under it', 'org/under')]
    view.send({ type: 'openDocument', name: 'theirs.lvarch', bytes: workingFileBytes(theirs, await manifestOf(theirs)) })
    await waitFor(() => expect(screen.getByTestId('open-into-here')).toBeDefined())
    fireEvent.click(screen.getByTestId('open-into-here'))
    await waitFor(async () => expect((await store.read('acme/landscape'))?.model.name).toBe('From a colleague'))
    expect((await store.read('acme/landscape/under'))?.model.name).toBe('Under it')
    await waitFor(() => expect(screen.getByText(/loaded and checked against what it says it holds: 2 scopes/)).toBeDefined())
  })
})

describe('a working file opened on a home', () => {
  it('says which scope did not arrive, where a write of it was lost without a word', async () => {
    const view = show(losing([project()], 'fleet'))
    await goHome()
    const theirs = [project('Organisation', ''), project('Depots', 'depots'), project('Fleet', 'fleet')]
    view.send({ type: 'openDocument', name: 'org.lvarch', bytes: workingFileBytes(theirs, await manifestOf(theirs)) })
    await waitFor(() => expect(screen.getByTestId('open-into-here')).toBeDefined())
    fireEvent.click(screen.getByTestId('open-into-here'))
    // The scope was made to hold it; what it holds is what did not arrive.
    await waitFor(() => expect(screen.getByText(
      /^Working file “org\.lvarch” did not arrive whole\. Not there after loading: the view “L7” in “Fleet”/,
    )).toBeDefined())
  })
})

describe('a working file landed as one (ADR-0023, amendment 2)', () => {
  it('is landed in one apply over every scope it holds, each a content that arrives whole', async () => {
    const held = heldRepositories([project()])
    const applied: string[][] = []
    const store = answering(held, {
      apply: (work) => {
        applied.push(work.flatMap((one) => one.steps.map((step) => step.command.type)))
        return held.scopes.apply(work)
      },
    })
    const view = show(store)
    await goHome()
    const theirs = [project('Organisation', ''), project('Depots', 'depots'), project('Fleet', 'depots/fleet')]
    view.send({ type: 'openDocument', name: 'org.lvarch', bytes: workingFileBytes(theirs, await manifestOf(theirs)) })
    await waitFor(() => expect(screen.getByTestId('open-into-here')).toBeDefined())
    fireEvent.click(screen.getByTestId('open-into-here'))
    await waitFor(() => expect(screen.getByText(/loaded and checked against what it says it holds: 3 scopes/)).toBeDefined())
    expect(applied.filter((types) => types.includes('scope.replace'))).toEqual([['scope.replace', 'scope.replace', 'scope.replace']])
  })

  it('says that nothing of it was written, and why, where the landing was refused', async () => {
    const store = answering(heldRepositories([project()]), {
      apply: () => Promise.resolve({ refused: 'shell.scopeMoved' }),
    })
    const view = show(store)
    await goHome()
    const theirs = [project('Organisation', ''), project('Depots', 'depots'), project('Fleet', 'fleet')]
    view.send({ type: 'openDocument', name: 'org.lvarch', bytes: workingFileBytes(theirs, await manifestOf(theirs)) })
    await waitFor(() => expect(screen.getByTestId('open-into-here')).toBeDefined())
    fireEvent.click(screen.getByTestId('open-into-here'))
    await waitFor(() => expect(screen.getByText(/^The working file was not loaded, and nothing of it was written/)).toBeDefined())
    await expect(store.read('depots')).resolves.toBeUndefined()
    expect(screen.queryByText(/loaded and checked/)).toBeNull()
  })
})

describe('a working file saved from a home', () => {
  it('is refused, naming the scope, when the listing could not read one', async () => {
    const held = heldRepositories([project()])
    const view = show(answering(held, {
      tree: async () => ({ ...await held.scopes.tree(), unreadable: ['acme/broken'] }),
    }))
    await goHome()
    view.send({ type: 'export' })
    await waitFor(() => expect(screen.getByText(
      'The working file was not saved: acme/broken could not be read, and a file without them would not be the whole organisation.',
    )).toBeDefined())
    expect(view.documents.saved).toHaveLength(0)
  })

  it('carries a manifest of what it holds', async () => {
    const view = show(heldRepositories([project()]))
    await goHome()
    view.send({ type: 'export' })
    await seal('correct horse')
    await waitFor(() => expect(view.documents.saved).toHaveLength(1))
    const plain = await unsealBytes(view.documents.saved[0].bytes as Uint8Array, 'correct horse')
    const held = unzipSync(plain!)
    // The landscape, and the scope it is filed under.
    expect(readManifest(new TextDecoder().decode(held[MANIFEST_FILE]))?.scopes.map((one) => one.name)).toEqual(['acme', 'Landscape'])
  })
})

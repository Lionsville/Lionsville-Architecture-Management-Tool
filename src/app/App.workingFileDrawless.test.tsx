// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A working file whose top scope draws nothing, opened in the whole shell.
 *
 * A scope that draws nothing is ordinary — an organisation that files its
 * landscapes under it and draws nothing itself — and the app writes such a
 * file of one. So it opens again: on a home and over an open scope, with the
 * scope shown as empty as it is, no view made up for it, and the scopes under
 * it landed with it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { laidOut } from '../model/testFixtures'
import { heldRepositories } from './testing/heldRepositories'
import type { HostCommand } from '../platform/hostCommands'
import type { ScopeSnapshot } from '../projects/scope'
import { workingFileBytes } from '../adapters/folder/format/workingFile'
import { manifestOf } from '../adapters/folder/format/workingFileManifest'
import { readWorkingFile } from '../platform/node/workingFile'
import { renderApp } from './testing/renderShell'

vi.mock('../editor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor')>()
  return { ...actual, SolutionDesignEditor: () => <div data-testid="editor" /> }
})

afterEach(() => cleanup())

function scope(path: string, name: string, draws: boolean): ScopeSnapshot {
  return {
    path,
    model: {
      name, elements: [], relations: [],
      diagrams: draws ? [laidOut({ id: 'l7', kind: 'layer7', name: 'L7', placements: [] })] : [],
    },
    activeDiagramId: draws ? 'l7' : '',
    logoLibrary: [],
  }
}

/** An organisation whose top draws nothing, and whose scopes under it do. */
const theirs = () => [scope('', 'Globex', false), scope('retail', 'Retail', true), scope('retail/warehouse', 'Warehouse', true)]

function show(held: ScopeSnapshot[], initialProject?: ScopeSnapshot) {
  const repositories = heldRepositories(held)
  const listeners: ((command: HostCommand) => void)[] = []
  const harness = renderApp({
    repositories,
    boot: initialProject ? { initialProject } : { initialProject: undefined },
    host: {
      commands: (listener) => {
        listeners.push(listener)
        return () => { listeners.splice(listeners.indexOf(listener), 1) }
      },
    },
  })
  return {
    ...harness,
    repositories,
    send: (command: HostCommand) => act(() => { for (const one of [...listeners]) one(command) }),
  }
}

async function openHere(view: ReturnType<typeof show>, scopes: readonly ScopeSnapshot[]) {
  view.send({ type: 'openDocument', name: 'globex.lvarch', bytes: workingFileBytes(scopes, await manifestOf(scopes)) })
  await waitFor(() => expect(screen.getByTestId('open-into-here')).toBeDefined())
  fireEvent.click(screen.getByTestId('open-into-here'))
}

describe('a working file whose top draws nothing', () => {
  it('opens on a home, lands every scope, and the home shows the organisation as it is', async () => {
    const view = show([scope('', 'Acme Logistics', true)])
    await screen.findByTestId('organisation-name')
    await openHere(view, theirs())
    await waitFor(() => expect(screen.getByText(/loaded and checked against what it says it holds: 3 scopes/)).toBeDefined())
    expect(screen.queryByText('This working file has no diagrams.')).toBeNull()
    const top = await view.repositories.read('')
    expect(top?.model.name).toBe('Globex')
    expect(top?.model.diagrams).toEqual([])
    expect(top?.activeDiagramId).toBe('')
    expect((await view.repositories.read('retail/warehouse'))?.model.diagrams).toHaveLength(1)
    await waitFor(() => expect(screen.getByTestId('organisation-name').textContent).toBe('Globex'))
  })

  it('opens over an open scope, and leaves no canvas with nothing on it', async () => {
    const open = scope('acme/landscape', 'Landscape', true)
    const view = show([open], open)
    await screen.findByTestId('editor')
    await openHere(view, theirs())
    await waitFor(() => expect(screen.getByText(/loaded and checked against what it says it holds: 3 scopes/)).toBeDefined())
    const top = await view.repositories.read('acme/landscape')
    expect(top?.model.name).toBe('Globex')
    expect(top?.model.diagrams).toEqual([])
    expect((await view.repositories.read('acme/landscape/retail'))?.model.diagrams).toHaveLength(1)
    await waitFor(() => expect(screen.getByTestId('organisation-name').textContent).toBe('Globex'))
    expect(screen.queryByTestId('editor')).toBeNull()
  })

  it('is a first screen: the organisation\'s home, of repositories it was read into with no screen', async () => {
    const repositories = heldRepositories()
    const read = await readWorkingFile(repositories, workingFileBytes(theirs(), await manifestOf(theirs())))
    if ('refused' in read) throw new Error(read.refused)
    renderApp({ repositories })
    expect((await screen.findByTestId('organisation-name')).textContent).toBe('Globex')
    await waitFor(() => expect(screen.getByText('Retail')).toBeDefined())
    expect(screen.queryByTestId('editor')).toBeNull()
  })
})

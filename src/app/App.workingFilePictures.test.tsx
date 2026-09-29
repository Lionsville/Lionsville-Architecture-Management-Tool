// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The pictures of the open scope, through a working file and back.
 *
 * The open scope's session holds its library's entries and never the bytes,
 * and what it holds stands in for what is kept when the file is written: the
 * bytes are read from where the source keeps them. A file opened over the
 * open scope lands its pictures there, and the session draws its library
 * from what landed.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { unzipSync } from 'fflate'
import { laidOut } from '../model/testFixtures'
import { dataUrl } from '../projects/dataUrl'
import type { ScopeSnapshot } from '../projects/scope'
import { unsealBytes } from '../projects/sealedFile'
import type { HostCommand } from '../platform/hostCommands'
import { carryScopes } from '../adapters/folder/format/interchange'
import { png } from '../adapters/folder/format/testing/organisation'
import { heldRepositories } from './testing/heldRepositories'
import type { HeldRepositories } from './testing/heldRepositories'
import { renderApp } from './testing/renderShell'

vi.mock('../editor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor')>()
  return { ...actual, SolutionDesignEditor: () => <div data-testid="editor" /> }
})

afterEach(() => cleanup())

const PASSWORD = 'correct horse'

const landscape = (name: string, pictures: readonly string[] = []): ScopeSnapshot => ({
  path: 'acme/landscape',
  model: {
    name, elements: [], relations: [],
    diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [] })],
  },
  activeDiagramId: 'd1',
  logoLibrary: [],
  ...(pictures.length ? { imageLibrary: pictures.map((file, at) => ({ file, url: dataUrl('image/png', png(at + 1)) })) } : {}),
})

/** The app, with the landscape open as the boot reads it: its library's entries, and no bytes. */
async function show(repositories: HeldRepositories) {
  await repositories.ready
  const initialProject = await repositories.read('acme/landscape')
  const listeners: ((command: HostCommand) => void)[] = []
  const harness = renderApp({
    repositories,
    boot: { initialProject },
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

/** Export, seal, and what the file holds, by path. */
async function exported(view: Awaited<ReturnType<typeof show>>, count: number): Promise<string[]> {
  view.send({ type: 'export' })
  await waitFor(() => expect(screen.getByTestId('password')).toBeDefined())
  fireEvent.change(screen.getByTestId('password'), { target: { value: PASSWORD } })
  fireEvent.change(screen.getByTestId('password-repeat'), { target: { value: PASSWORD } })
  fireEvent.click(screen.getByTestId('password-confirm'))
  await waitFor(() => expect(view.documents.saved).toHaveLength(count))
  const plain = await unsealBytes(view.documents.saved[count - 1].bytes as Uint8Array, PASSWORD)
  return Object.keys(unzipSync(plain!))
}

describe('the open scope\'s pictures in a working file', () => {
  it('are in the file written while the scope is open', async () => {
    const view = await show(heldRepositories([landscape('Landscape', ['depot.png'])]))
    await waitFor(() => expect(screen.getByTestId('editor')).toBeDefined())

    expect(await exported(view, 1)).toContain('landscape/images/depot.png')
  })

  it('stay in the open scope\'s library once a file opened over it has landed', async () => {
    const store = heldRepositories([landscape('Landscape')])
    const view = await show(store)
    await waitFor(() => expect(screen.getByTestId('editor')).toBeDefined())
    const theirs = await carryScopes([landscape('From a colleague', ['yard.png'])])

    view.send({ type: 'openDocument', name: 'theirs.lvarch', bytes: theirs.bytes })
    await waitFor(() => expect(screen.getByTestId('open-into-here')).toBeDefined())
    fireEvent.click(screen.getByTestId('open-into-here'))
    await waitFor(() => expect(screen.getByText(/loaded and checked against what it says it holds/)).toBeDefined())

    expect(await exported(view, 1)).toContain('landscape/images/yard.png')
  })
})

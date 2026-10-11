// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * *Share with a Link…* from a board with an element selected (ADR-0033,
 * amended 11 October 2026): the link carries it as `select`, through the
 * whole shell — the editor's handle, the renderer view, the shell's look at
 * what is selected — and a board with nothing selected carries none.
 */
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, screen, waitFor } from '@testing-library/react'
import { readPlace } from '../agent/place'
import { translator } from '../i18n'
import { laidOut } from '../model/testFixtures'
import type { HostCommand } from '../platform/hostCommands'
import type { ScopeSnapshot } from '../projects/scope'
import { heldRepositories } from './testing/heldRepositories'
import { renderApp } from './testing/renderShell'

/** What the stand-in editor says is selected: set per test. */
const selection: { id?: string } = {}

vi.mock('../editor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor')>()
  function Editor(props: { onHandle?: (handle: unknown) => void }) {
    const { onHandle } = props
    useEffect(() => {
      onHandle?.({
        activeDiagramId: 'board', busy: false, ...(selection.id ? { selectedElementId: selection.id } : {}),
        tidy: async () => {}, routeEdges: async () => {}, capture: async () => new Blob(),
        deleteSelection: () => {}, selectAll: () => {}, showShortcuts: () => {},
      })
      return () => onHandle?.(undefined)
    }, [onHandle])
    return <div data-testid="canvas" />
  }
  return { ...actual, SolutionDesignEditor: Editor }
})

afterEach(() => { cleanup(); selection.id = undefined })
beforeEach(() => { window.history.replaceState(null, '', '/') })

const s = translator('en')
const ADDRESS = 'https://work.example/'

const landscape: ScopeSnapshot = {
  path: 'acme',
  model: {
    name: 'Acme',
    elements: [{ id: 'crm', name: 'CRM', kind: 'application', lifecycle: 'live', isManaged: true, aspects: {} }],
    relations: [],
    diagrams: [laidOut({ id: 'board', kind: 'layer7', name: 'Landscape', placements: [{ id: 'crm', x: 0, y: 0 }] })],
  },
  activeDiagramId: 'board',
  logoLibrary: [],
}
const root: ScopeSnapshot = {
  path: '', model: { name: 'Org', elements: [], relations: [], diagrams: [] }, activeDiagramId: '', logoLibrary: [],
}

function show() {
  const listeners: ((command: HostCommand) => void)[] = []
  const harness = renderApp({
    repositories: heldRepositories([root, landscape]),
    boot: { initialProject: landscape },
    provider: { shareAddress: () => ADDRESS },
    host: {
      commands: (listener) => {
        listeners.push(listener)
        return () => { listeners.splice(listeners.indexOf(listener), 1) }
      },
    },
  })
  const share = () => act(() => { for (const held of [...listeners]) held({ type: 'share' }) })
  return { ...harness, share }
}

const linkShown = () => (screen.getByRole('textbox', { name: s('share.linkLabel') }) as HTMLInputElement).value

describe('Share with a Link… from a board', () => {
  it('carries the element selected on it', async () => {
    selection.id = 'crm'
    const app = show()
    await waitFor(() => expect(readPlace(window.location.hash)).toEqual({ scope: 'acme', page: 'board', id: 'board' }))
    app.share()
    await waitFor(() => expect(readPlace(new URL(linkShown()).hash)).toEqual({ scope: 'acme', page: 'board', id: 'board', select: 'crm' }))
    expect(linkShown()).toContain('&select=crm')
  })

  it('carries nothing where nothing is selected', async () => {
    const app = show()
    await waitFor(() => expect(readPlace(window.location.hash)).toEqual({ scope: 'acme', page: 'board', id: 'board' }))
    app.share()
    await waitFor(() => expect(linkShown()).toBe(`${ADDRESS}#place?scope=acme&page=board&id=board`))
  })
})

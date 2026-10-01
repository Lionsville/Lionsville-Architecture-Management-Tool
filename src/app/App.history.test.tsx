// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * Back goes to the place before (ADR-0033), through the whole shell and the
 * window's own history.
 *
 * Moves are made the two ways the shell has — a person's click on a crumb,
 * and an agent's `app.open` through a fake gateway, which is also how the
 * test asks where the app is — and Back is the window's: `history.back()`,
 * which is what the browser's button does and what the desktop's presses.
 * What is pinned is the confirmation list of the record: the first place
 * replaces the entry the window opened on, a move to another place pushes one
 * entry, another record on the same record page replaces it, a move made by
 * Back pushes nothing, an agent's move pushes one, and a place that is not
 * there any more lands as near as there is.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { laidOut } from '../model/testFixtures'
import { PLACE_STATE_KEY, writePlace } from '../agent/place'
import type { Place } from '../agent/place'
import type { AgentAnswer, AgentRequest } from '../agent/tools'
import type { AgentGateway } from '../ports/AgentGateway'
import type { ScopeSnapshot } from '../projects/scope'
import { heldRepositories } from './testing/heldRepositories'
import { renderApp } from './testing/renderShell'

vi.mock('../editor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor')>()
  const { useEffect } = await import('react')
  return {
    ...actual,
    SolutionDesignEditor: (props: { document: { activeDiagramId: string }; onHandle?: (handle: unknown) => void }) => {
      const { onHandle, document } = props
      useEffect(() => {
        onHandle?.({ activeDiagramId: document.activeDiagramId, busy: false, tidy: async () => {}, routeEdges: async () => {}, capture: async () => ({ arrayBuffer: async () => new ArrayBuffer(0) }) })
        return () => onHandle?.(undefined)
      }, [onHandle, document.activeDiagramId])
      return <div data-testid="canvas">{document.activeDiagramId}</div>
    },
  }
})

afterEach(() => cleanup())
// One window for the file: each test starts on an entry nobody has written a place into.
beforeEach(() => { window.history.replaceState(null, '', '/') })

const root: ScopeSnapshot = {
  path: '',
  model: {
    name: 'Acme Logistics',
    elements: [],
    relations: [],
    diagrams: [{ id: 'sheet-1', kind: 'sheet', name: 'Business architecture', members: [], geometry: { nodes: [] } }],
    decisions: [
      { id: 'adr-1', number: 1, title: 'One warehouse', status: 'proposed', date: '2026-09-01', body: 'One.', signers: [] },
      { id: 'adr-2', number: 2, title: 'Two depots', status: 'proposed', date: '2026-09-02', body: 'Two.', signers: [] },
    ],
  },
  activeDiagramId: 'sheet-1',
  logoLibrary: [],
}

const retail: ScopeSnapshot = {
  path: 'acme/retail',
  model: {
    name: 'Retail',
    elements: [{ id: 'wms', kind: 'application', name: 'Warehouse system', lifecycle: 'live', isManaged: true, aspects: {} }],
    relations: [],
    diagrams: [
      laidOut({ id: 'r7', kind: 'layer7', name: 'Retail board', placements: [{ id: 'wms', x: 0, y: 0 }] }),
      laidOut({ id: 'r8', kind: 'layer7', name: 'Second board', placements: [] }),
    ],
  },
  activeDiagramId: 'r7',
  logoLibrary: [],
}

/** A gateway that keeps whoever subscribed, as `App.driving.test.tsx` has it. */
function fakeGateway() {
  let handler: ((request: AgentRequest) => Promise<AgentAnswer>) | undefined
  const connected = { kind: 'connected' as const, port: 51733, token: 't'.repeat(24), client: { name: 'Claude Code', version: '2.0' } }
  const gateway: AgentGateway = {
    id: 'fake',
    on(next) {
      handler = next
      return () => { if (handler === next) handler = undefined }
    },
    status: () => Promise.resolve(connected),
    onStatus: () => () => {},
    configure: () => Promise.resolve(connected),
    newToken: () => Promise.resolve(connected),
  }
  let n = 0
  const ask = (tool: string, args: unknown = {}): Promise<AgentAnswer> => {
    if (!handler) throw new Error('nobody is listening')
    return handler({ id: `r${++n}`, tool, args })
  }
  return { gateway, ask, bound: () => handler !== undefined }
}

const parsed = (answer: AgentAnswer): Record<string, unknown> => {
  if (!answer.ok || answer.content[0].type !== 'text') throw new Error(`refused: ${JSON.stringify(answer)}`)
  return JSON.parse(answer.content[0].text)
}

/** The place the window's current entry holds. */
const entryPlace = () => (window.history.state as Record<string, unknown> | null)?.[PLACE_STATE_KEY]

/** The organisation screen up, the tree read, and the first entry written. */
async function organisationOnScreen() {
  const wire = fakeGateway()
  renderApp({ agent: wire.gateway, repositories: heldRepositories([root, retail]), boot: { initialProject: undefined } })
  await waitFor(() => expect(wire.bound()).toBe(true))
  await waitFor(async () => expect(parsed(await wire.ask('app.current')).scopes).toBe(3))
  await waitFor(() => expect(entryPlace()).toEqual({ scope: '', page: 'home' }))
  const where = async () => {
    const now = parsed(await wire.ask('app.current'))
    return { open: (now.open as { path?: string; view?: { id: string } } | undefined), home: now.home as { path: string } | undefined, page: now.page }
  }
  return { ...wire, where }
}

/** Wait until the entry holds this place: a move is written once it has settled. */
const settledOn = (place: Place) => waitFor(() => expect(entryPlace()).toEqual(place))

describe('the history the shell writes', () => {
  it('replaces the entry the window opened on with the first place, and pushes nothing for it', async () => {
    const before = window.history.length
    await organisationOnScreen()
    expect(window.history.length).toBe(before)
    expect(window.location.hash).toBe(writePlace({ scope: '', page: 'home' }))
  })

  it('pushes one entry for a move to another place, a person’s and an agent’s alike', async () => {
    const { ask } = await organisationOnScreen()
    const before = window.history.length
    expect(parsed(await ask('app.open', { scope: 'acme/retail' })).arrived).toBe(true)
    await settledOn({ scope: 'acme/retail', page: 'board', id: 'r7' })
    expect(window.history.length).toBe(before + 1)
    expect(window.location.hash).toBe('#place?scope=acme%2Fretail&page=board&id=r7')
    // The person's click on the organisation's crumb.
    fireEvent.click(screen.getByTestId('crumb-'))
    await settledOn({ scope: '', page: 'home' })
    expect(window.history.length).toBe(before + 2)
  })

  it('replaces the entry for another record on the same record page, and pushes for the page itself', async () => {
    const { ask } = await organisationOnScreen()
    const before = window.history.length
    await ask('app.open', { scope: '', page: 'decisions', id: 'adr-1' })
    await settledOn({ scope: '', page: 'decisions', id: 'adr-1' })
    expect(window.history.length).toBe(before + 1)
    await ask('app.open', { scope: '', page: 'decisions', id: 'adr-2' })
    await settledOn({ scope: '', page: 'decisions', id: 'adr-2' })
    expect(window.history.length).toBe(before + 1)
  })

  it('keeps the query and whatever else other code keeps in the entry', async () => {
    window.history.replaceState({ theirs: 'kept' }, '', '/index.html?tenant=t1')
    const { ask } = await organisationOnScreen()
    expect(window.history.state).toMatchObject({ theirs: 'kept' })
    await ask('app.open', { scope: 'acme/retail' })
    await settledOn({ scope: 'acme/retail', page: 'board', id: 'r7' })
    expect(window.location.search).toBe('?tenant=t1')
    expect(window.history.state).toMatchObject({ theirs: 'kept' })
  })
})

describe('Back and Forward', () => {
  it('goes to the place before and back again, and pushes nothing for either move', async () => {
    const { ask, where } = await organisationOnScreen()
    await ask('app.open', { scope: 'acme/retail' })
    await settledOn({ scope: 'acme/retail', page: 'board', id: 'r7' })
    const length = window.history.length
    window.history.back()
    await waitFor(async () => expect((await where()).home).toEqual({ path: '', name: 'Acme Logistics' }))
    // Long enough for a look to have been written, were it going to be.
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(window.history.length).toBe(length)
    expect(entryPlace()).toEqual({ scope: '', page: 'home' })
    window.history.forward()
    await waitFor(async () => expect((await where()).open?.path).toBe('acme/retail'))
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(window.history.length).toBe(length)
    expect(entryPlace()).toEqual({ scope: 'acme/retail', page: 'board', id: 'r7' })
  })

  it('moves the page beneath a dialog, and the dialog goes with the page it was opened on', async () => {
    const { ask, where } = await organisationOnScreen()
    await ask('app.open', { scope: 'acme/retail' })
    await settledOn({ scope: 'acme/retail', page: 'board', id: 'r7' })
    fireEvent.click(screen.getByRole('button', { name: 'Project settings' }))
    expect(await screen.findByRole('dialog')).toBeDefined()
    window.history.back()
    await waitFor(async () => expect((await where()).home?.path).toBe(''))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  /** An entry naming what is gone, as it would after a removal: the history cannot skip it. */
  async function backTo(place: Place) {
    const wire = await organisationOnScreen()
    window.history.pushState({ [PLACE_STATE_KEY]: place }, '', writePlace(place))
    await wire.ask('app.open', { scope: 'acme/retail', page: 'board', id: 'r8' })
    await settledOn({ scope: 'acme/retail', page: 'board', id: 'r8' })
    window.history.back()
    return wire
  }

  it('lands a removed view on its scope’s first view, and writes that over the entry', async () => {
    const { where } = await backTo({ scope: 'acme/retail', page: 'board', id: 'gone' })
    await settledOn({ scope: 'acme/retail', page: 'board', id: 'r7' })
    expect((await where()).open?.view?.id).toBe('r7')
    expect(window.location.hash).toBe('#place?scope=acme%2Fretail&page=board&id=r7')
  })

  it('lands a removed record on its page without one, and writes what that page shows over the entry', async () => {
    const { where } = await backTo({ scope: '', page: 'decisions', id: 'adr-9' })
    await waitFor(async () => expect((await where()).open?.path).toBe(''))
    const page = (await where()).page as { page: string; id?: string }
    // The page as it opens with no record asked for, which picks its own.
    expect(page.page).toBe('decisions')
    expect(page.id).not.toBe('adr-9')
    await settledOn({ scope: '', ...page } as Place)
  })

  it('lands a removed scope on the home of the nearest scope above it', async () => {
    const { where } = await backTo({ scope: 'acme/retail/gone', page: 'decisions' })
    await waitFor(async () => expect((await where()).home?.path).toBe('acme/retail'))
    await settledOn({ scope: 'acme/retail', page: 'home' })
  })
})

describe('the first paint, where a place in the address landed it', () => {
  it('opens the scope on the page the place named, and the entry holds that place', async () => {
    const wire = fakeGateway()
    renderApp({
      agent: wire.gateway, repositories: heldRepositories([root, retail]),
      boot: { initialProject: root, initialPage: { page: 'decisions', id: 'adr-2' } },
    })
    await waitFor(() => expect(wire.bound()).toBe(true))
    await waitFor(async () => expect(parsed(await wire.ask('app.current')).page).toEqual({ page: 'decisions', id: 'adr-2' }))
    await settledOn({ scope: '', page: 'decisions', id: 'adr-2' })
  })

  it('opens the page over a home the place named', async () => {
    const wire = fakeGateway()
    renderApp({
      agent: wire.gateway, repositories: heldRepositories([root, retail]),
      boot: { initialProject: undefined, initialHome: 'acme/retail', initialHomePage: 'register' },
    })
    await waitFor(() => expect(wire.bound()).toBe(true))
    await settledOn({ scope: 'acme/retail', page: 'register' })
  })
})

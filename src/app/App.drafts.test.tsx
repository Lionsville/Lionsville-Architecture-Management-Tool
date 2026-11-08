// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A draft is never dropped by moving away (`widgets/kit/drafts`), through the
 * whole shell: every way to go — the tree, row two, a view's tab, ⌘K, Back,
 * an agent's `app.open` — asks Leave with a draft? first, or, for the agent,
 * is refused with the reason, and Keep writing leaves the app where it was.
 *
 * The draft is held by a box rendered beside the app, which is all a comment
 * box or a new record's form tells the kit; each of those is pinned beside it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { laidOut } from '../model/testFixtures'
import { PLACE_STATE_KEY } from '../agent/place'
import type { AgentAnswer, AgentRequest } from '../agent/tools'
import type { AgentGateway } from '../ports/AgentGateway'
import type { ScopeSnapshot } from '../projects/scope'
import { draftHeld, useDraft } from '../widgets/kit/drafts'
import { heldRepositories } from './testing/heldRepositories'
import { renderApp } from './testing/renderShell'

vi.mock('../editor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor')>()
  const { useEffect } = await import('react')
  return {
    ...actual,
    SolutionDesignEditor: (props: { document: { activeDiagramId: string; onActiveDiagramChange?: (id: string) => void }; onHandle?: (handle: unknown) => void }) => {
      const { onHandle, document } = props
      useEffect(() => {
        onHandle?.({ activeDiagramId: document.activeDiagramId, busy: false, tidy: async () => {}, routeEdges: async () => {}, capture: async () => ({ arrayBuffer: async () => new ArrayBuffer(0) }) })
        return () => onHandle?.(undefined)
      }, [onHandle, document.activeDiagramId])
      // The view tabs are the editor's: this one stands for a press on another view's tab.
      return <div data-testid="canvas">{document.activeDiagramId}<button type="button" data-testid="tab-r8" onClick={() => document.onActiveDiagramChange?.('r8')}>Second board</button></div>
    },
  }
})

afterEach(() => cleanup())
beforeEach(() => { window.history.replaceState(null, '', '/') })

const root: ScopeSnapshot = {
  path: '',
  model: {
    name: 'Acme Logistics',
    elements: [],
    relations: [],
    diagrams: [{ id: 'sheet-1', kind: 'sheet', name: 'Business architecture', members: [], geometry: { nodes: [] } }],
    decisions: [{ id: 'adr-1', number: 1, title: 'One warehouse', status: 'proposed', date: '2026-09-01', body: 'One.', signers: [] }],
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

const entryPlace = () => (window.history.state as Record<string, unknown> | null)?.[PLACE_STATE_KEY]

/** Something written and not sent, as a comment box says it. */
function Draft() {
  useDraft(true)
  return null
}

async function organisationOnScreen() {
  const wire = fakeGateway()
  renderApp({ agent: wire.gateway, repositories: heldRepositories([root, retail]), boot: { initialProject: undefined } })
  await waitFor(() => expect(wire.bound()).toBe(true))
  await waitFor(async () => expect(parsed(await wire.ask('app.current')).scopes).toBe(3))
  await screen.findByTestId('organisation-cards')
  await waitFor(() => expect(entryPlace()).toEqual({ scope: '', page: 'home' }))
  const where = async () => parsed(await wire.ask('app.current'))
  return { ...wire, where }
}

/** The question is up; Keep writing answers it, and nothing moved. */
async function keepWriting() {
  const question = await screen.findByTestId('draft-question')
  fireEvent.click(within(question).getByRole('button', { name: 'Keep writing' }))
  await waitFor(() => expect(screen.queryByTestId('draft-question')).toBeNull())
}

describe('moving away with a draft', () => {
  it('asks first from the tree, and Keep writing stays on the home', async () => {
    const { where } = await organisationOnScreen()
    render(<Draft />)
    fireEvent.click(screen.getByTestId('tree-place-register'))
    await keepWriting()
    expect(screen.queryByTestId('register-topbar')).toBeNull()
    expect((await where()).page).toBeUndefined()
  })

  it('asks first from row two, and leaves on Leave and drop it', async () => {
    await organisationOnScreen()
    render(<Draft />)
    fireEvent.click(within(screen.getByTestId('frame-places')).getByTestId('frame-page-decisions'))
    fireEvent.click(await screen.findByTestId('draft-leave'))
    await waitFor(() => expect(entryPlace()).toMatchObject({ scope: '', page: 'decisions' }))
  })

  it('asks first from a view’s tab', async () => {
    const { ask, where } = await organisationOnScreen()
    expect(parsed(await ask('app.open', { scope: 'acme/retail', page: 'board', id: 'r7' })).arrived).toBe(true)
    render(<Draft />)
    fireEvent.click(await screen.findByTestId('tab-r8'))
    await keepWriting()
    expect(((await where()).open as { view: { id: string } }).view.id).toBe('r7')
  })

  it('asks first from ⌘K', async () => {
    const { where } = await organisationOnScreen()
    render(<Draft />)
    fireEvent.click(screen.getByTestId('frame-find'))
    fireEvent.change(await screen.findByRole('combobox'), { target: { value: 'decisions' } })
    fireEvent.click(await screen.findByTestId('palette-place:decisions'))
    await keepWriting()
    expect((await where()).page).toBeUndefined()
  })

  it('asks first on Back, and Keep writing takes the window back to where the screen still is', async () => {
    const { ask, where } = await organisationOnScreen()
    await ask('app.open', { scope: 'acme/retail', page: 'board', id: 'r7' })
    await waitFor(() => expect(entryPlace()).toEqual({ scope: 'acme/retail', page: 'board', id: 'r7' }))
    render(<Draft />)
    window.history.back()
    await keepWriting()
    await waitFor(() => expect(window.location.hash).toBe('#/acme/retail/-/board/r7'))
    expect(((await where()).open as { path: string }).path).toBe('acme/retail')
    // Long enough for a look to be written, were one going to be: the entry is still the board's.
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(entryPlace()).toEqual({ scope: 'acme/retail', page: 'board', id: 'r7' })
  })

  it('leaves History alone on Back to the screen under it, and keeps the draft there guarded', async () => {
    const { ask, where } = await organisationOnScreen()
    await ask('app.open', { scope: 'acme/retail', page: 'board', id: 'r7' })
    await waitFor(() => expect(entryPlace()).toEqual({ scope: 'acme/retail', page: 'board', id: 'r7' }))
    render(<Draft />)
    await ask('app.open', { scope: 'acme/retail', page: 'history' })
    await waitFor(() => expect(entryPlace()).toEqual({ scope: 'acme/retail', page: 'history' }))
    window.history.back()
    await waitFor(async () => expect((await where()).page).toBeUndefined())
    expect(screen.queryByTestId('draft-question')).toBeNull()
    expect(window.location.hash).toBe('#/acme/retail/-/board/r7')
    // Nothing was asked and nothing was dropped: the next way off still asks.
    expect(draftHeld()).toBe(true)
  })

  it('keeps History up, at its address, on Keep writing from a way past it', async () => {
    const { ask, where } = await organisationOnScreen()
    await ask('app.open', { scope: 'acme/retail', page: 'board', id: 'r7' })
    render(<Draft />)
    await ask('app.open', { scope: 'acme/retail', page: 'history' })
    await waitFor(() => expect(entryPlace()).toEqual({ scope: 'acme/retail', page: 'history' }))
    fireEvent.click(within(screen.getByTestId('frame-places')).getByTestId('frame-page-decisions'))
    await keepWriting()
    expect(((await where()).page as { page: string } | undefined)?.page).toBe('history')
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(entryPlace()).toEqual({ scope: 'acme/retail', page: 'history' })
  })

  it('refuses an agent’s app.open with the reason, and lets it move once the draft is gone', async () => {
    const { ask, where } = await organisationOnScreen()
    const held = render(<Draft />)
    const answer = await ask('app.open', { scope: 'acme/retail' })
    expect(answer.ok ? undefined : answer.refusal).toBe('agent.draftOpen')
    expect(screen.queryByTestId('draft-question')).toBeNull()
    expect((await where()).open).toBeUndefined()
    held.unmount()
    expect(parsed(await ask('app.open', { scope: 'acme/retail' })).arrived).toBe(true)
  })
})

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A record's page opened already being written (`widgets/kit/editOnArrival`),
 * through the whole shell: an agent's `app.open` with `edit`, and an address
 * with `?edit`, which is read on arrival and is no part of the place after.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'
import { laidOut } from '../model/testFixtures'
import { PLACE_STATE_KEY } from '../agent/place'
import type { AgentAnswer, AgentRequest } from '../agent/tools'
import type { AgentGateway } from '../ports/AgentGateway'
import type { ScopeSnapshot } from '../projects/scope'
import { heldRepositories } from './testing/heldRepositories'
import { renderApp } from './testing/renderShell'
import { installReactFlowMocks } from '../editor/reactFlowTestSetup'
import { placeLanding, readPlaceScope } from './bootLanding'
import { readPlace } from '../agent/place'

afterEach(() => cleanup())
beforeAll(() => installReactFlowMocks())
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

async function organisationOnScreen() {
  const wire = fakeGateway()
  renderApp({ agent: wire.gateway, repositories: heldRepositories([root, retail]), boot: { initialProject: undefined } })
  await waitFor(() => expect(wire.bound()).toBe(true))
  await waitFor(async () => expect(parsed(await wire.ask('app.current')).scopes).toBe(3))
  await screen.findByTestId('organisation-cards')
  return wire
}

describe('a record\u2019s page opened already being written', () => {
  it('opens on an agent\u2019s app.open with edit, its text in the editor', async () => {
    const { ask } = await organisationOnScreen()
    const answer = parsed(await ask('app.open', { scope: 'acme/retail', page: 'document', id: 'wms', edit: true }))
    expect(answer.arrived).toBe(true)
    expect(await screen.findByRole('textbox', { name: 'Documentation source (markdown)' })).toBeDefined()
  })

  it('refuses edit on a page that is not written that way', async () => {
    const { ask } = await organisationOnScreen()
    const answer = await ask('app.open', { scope: '', page: 'decisions', id: 'adr-1', edit: true })
    expect(answer.ok ? undefined : answer.refusal).toBe('agent.badArguments')
  })

  it('opens on an address with ?edit, and leaves the word out of the place it writes', async () => {
    window.history.replaceState(null, '', '/#/acme/retail/-/document/wms?edit')
    const repositories = heldRepositories([root, retail])
    const place = readPlace(window.location.hash)!
    renderApp({ repositories, boot: placeLanding(await readPlaceScope(repositories.scopes, place.scope), place) })
    expect(await screen.findByRole('textbox', { name: 'Documentation source (markdown)' })).toBeDefined()
    await waitFor(() => expect(entryPlace()).toEqual({ scope: 'acme/retail', page: 'document', id: 'wms' }))
  })
})

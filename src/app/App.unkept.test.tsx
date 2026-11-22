// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * What the open source cannot keep yet (ADR-0022, amended 22 November 2026),
 * through the whole shell: the provider's one function reaches the agent's
 * door from the parts it handed over, so an argument that names the part is
 * refused in the source's sentence and nothing is written; and a source that
 * says nothing — every core source — writes the part as ever.
 *
 * The field's own half is `observations/ui/ObservationForm.test.tsx`, under
 * the same context this shell provides.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, waitFor } from '@testing-library/react'
import { laidOut } from '../model/testFixtures'
import type { AgentAnswer, AgentRequest } from '../agent/tools'
import { registerStrings } from '../i18n/strings'
import type { SourceCannotKeep } from '../platform/sourceProvider'
import type { AgentGateway } from '../ports/AgentGateway'
import type { ScopeSnapshot } from '../projects/scope'
import { renderApp } from './testing/renderShell'

vi.mock('../editor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../editor')>()
  return { ...actual, SolutionDesignEditor: () => <div data-testid="editor" /> }
})

afterEach(() => cleanup())

const project: ScopeSnapshot = {
  path: 'acme/landscape',
  model: {
    name: 'Landscape',
    elements: [{ id: 'wms', kind: 'application', name: 'Warehouse system', lifecycle: 'live', isManaged: true, aspects: {} }],
    relations: [],
    diagrams: [laidOut({ id: 'd1', kind: 'layer7', name: 'L7', placements: [{ id: 'wms', x: 0, y: 0 }] })],
  },
  activeDiagramId: 'd1',
  logoLibrary: [],
}

/** A gateway that keeps whoever subscribed, as `App.driving.test.tsx`'s does. */
function fakeGateway() {
  let handler: ((request: AgentRequest) => Promise<AgentAnswer>) | undefined
  const connected = { kind: 'connected' as const, port: 51733, token: 't'.repeat(24), client: { name: 'A client', version: '1.0' } }
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

const OBSERVED = { title: 'Labels print twice', where: 'Pick station 3', by: 'Shift lead' }

async function shown(cannotKeep?: SourceCannotKeep) {
  const wire = fakeGateway()
  renderApp({ agent: wire.gateway, boot: { initialProject: project }, ...(cannotKeep ? { provider: { cannotKeep } } : {}) })
  await waitFor(() => expect(wire.bound()).toBe(true))
  await waitFor(async () => expect((await wire.ask('elements.list')).ok).toBe(true))
  return wire
}

describe('a source that cannot keep a part of a record yet', () => {
  it('has an agent refused in its own sentence for naming the part, and writes the rest', async () => {
    registerStrings('en', { 'elsewhere.aboutNotKept': 'Elsewhere cannot keep which elements an observation is about until it is updated.' })
    const { ask } = await shown((part) => (part === 'observation.about' ? 'elsewhere.aboutNotKept' : undefined))
    const refused = await ask('observation.record', { ...OBSERVED, about: ['wms'] })
    expect(refused).toMatchObject({
      ok: false, refusal: 'agent.notKeptHere',
      detail: '"about": Elsewhere cannot keep which elements an observation is about until it is updated.',
    })
    expect(parsed(await ask('observations.list')).observations).toEqual([])
    expect(await ask('observations.list', { about: 'wms' })).toMatchObject({ ok: false, refusal: 'agent.notKeptHere' })
    // The same observation without the part lands, and names no element.
    const recorded = parsed(await ask('observation.record', OBSERVED))
    expect(recorded).not.toHaveProperty('about')
    expect((parsed(await ask('observations.list')).observations as unknown[]).length).toBe(1)
  })

  it('is no source that ships: with nothing said, the part is written as ever', async () => {
    const { ask } = await shown()
    expect(parsed(await ask('observation.record', { ...OBSERVED, about: ['wms'] }))).toMatchObject({ about: ['wms'] })
    expect((parsed(await ask('observations.list', { about: 'wms' })).observations as unknown[]).length).toBe(1)
  })
})

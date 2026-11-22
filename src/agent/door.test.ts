// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The agent's door as a client meets it, through the protocol: what it costs
 * to carry, held by a ceiling, and one pass that pages a list to its end,
 * tries a batch whose second step uses what its first answered, and lands it.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_TRANSLATE } from '../i18n/strings'
import { summarise } from '../model/activity'
import type { StepSummary } from '../model/activity'
import type { Command } from '../model/commands'
import type { HostModel } from '../model/hostModel'
import { idPolicy } from '../model/keys'
import { fromArrays, toArrays } from '../model/normalised'
import { apply } from '../model/reducer'
import { laidOut } from '../model/testFixtures'
import { handle } from './handle'
import type { HistoryEntry, SessionView } from './handle'
import { INSTRUCTIONS, respond } from './mcpProtocol'
import type { JsonRpcResponse, Relay } from './mcpProtocol'

/**
 * What the door costs a client, in characters: `tools/list` as the desktop
 * answers it, and the paragraph handed over at `initialize`. Both are carried
 * on every turn of a conversation, so each has a ceiling held to exactly what
 * it measures, as `build/storageLine.ts` holds its lists: a change that adds
 * to either fails until its ceiling is raised in the same diff, where a reader
 * sees it, and one that takes away fails until the ceiling comes down with it.
 * Raising one is a decision the commit says; the rules a description leaves
 * out are `rules.read`'s (`rules.ts`). A server's list has its own ceiling,
 * where the server is built.
 *
 * Measured 22 November 2026 before the door was made lighter: 311,836 and
 * 10,974. Raised by 94 the same day for `app.open`'s `look` on a comparison
 * and on the observations about an element, which the other lanes opened.
 * Raised by 542 for the elements an observation is about (ADR-0032, amended
 * 22 November 2026): `about` on `observation.record`, `observation.update`
 * and `observations.list`, three arguments an agent cannot use unseen, and
 * a few words in two descriptions; the rest is `rules.read`'s.
 */
export const CEILINGS = {
  toolsList: 203_480,
  instructions: 9_850,
} as const

/**
 * The same two as a client carries them in the other two modes (ADR-0051):
 * the tools of code mode in place of the vocabulary, and both. Held the same
 * way, so the saving a client is told of is the saving it gets: a tool or a
 * sentence added to code mode fails until its number is raised here.
 */
export const CODE_CEILINGS = {
  code: { toolsList: 4_089, instructions: 10_502 },
  both: { toolsList: 207_558, instructions: 10_216 },
} as const

const server = { name: 'Lionsville Architect', version: 'test' }

function relayOver(session: SessionView): Relay {
  return { ask: (request) => handle(request, session), onInitialized: () => {}, onClosed: () => {} }
}

const resultOf = (response: JsonRpcResponse | undefined): Record<string, unknown> => {
  if (!response || !('result' in response)) throw new Error(JSON.stringify(response))
  return response.result as Record<string, unknown>
}

/** A tool's answer through the protocol, its text parsed, or its refusal's text. */
async function call(relay: Relay, name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const result = resultOf(await respond({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, relay, server))
  const text = (result.content as { text: string }[])[0].text
  if (result.isError) throw new Error(text)
  return JSON.parse(text) as Record<string, unknown>
}

describe('what the door costs to carry', () => {
  it('holds tools/list and the instructions to their ceilings, exactly', async () => {
    const quiet: Relay = { ask: () => Promise.reject(new Error('not asked')), onInitialized: () => {}, onClosed: () => {} }
    const listed = JSON.stringify(resultOf(await respond({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, quiet, server)))
    const opened = resultOf(await respond({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }, quiet, server))
    const measured = { toolsList: listed.length, instructions: String(opened.instructions).length }
    expect(opened.instructions).toBe(INSTRUCTIONS)
    const wrong = Object.entries(measured).flatMap(([what, length]) => {
      const ceiling = CEILINGS[what as keyof typeof CEILINGS]
      if (length > ceiling) return [`${what} is ${length} characters, over its ceiling of ${ceiling}: raising it is a decision the change says`]
      if (length < ceiling) return [`${what} is ${length} characters: bring its ceiling down from ${ceiling} to ${length}`]
      return []
    })
    expect(wrong).toEqual([])
  })

  it('holds what a client carries in code mode, and with both, to their ceilings, exactly', async () => {
    const quiet: Relay = { ask: () => Promise.reject(new Error('not asked')), onInitialized: () => {}, onClosed: () => {} }
    const wrong: string[] = []
    for (const mode of ['code', 'both'] as const) {
      const listed = JSON.stringify(resultOf(await respond({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, quiet, server, { mode })))
      const opened = resultOf(await respond({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }, quiet, server, { mode }))
      const measured = { toolsList: listed.length, instructions: String(opened.instructions).length }
      for (const [what, length] of Object.entries(measured)) {
        const ceiling = CODE_CEILINGS[mode][what as keyof typeof measured]
        if (length !== ceiling) wrong.push(`${mode}.${what} is ${length} characters, and its ceiling says ${ceiling}`)
      }
    }
    expect(wrong).toEqual([])
    // What the choice is for: a client in code mode carries a fortieth of the tool list.
    expect(CODE_CEILINGS.code.toolsList * 40).toBeLessThan(CEILINGS.toolsList)
    expect(CODE_CEILINGS.both.toolsList).toBeGreaterThan(CEILINGS.toolsList)
  })
})

// --- one pass through the door --------------------------------------------------------

const application = (n: number) => ({
  id: `app-${String(n).padStart(2, '0')}`, kind: 'application' as const, name: `Application ${n}`,
  lifecycle: 'live' as const, isManaged: true, aspects: {},
})

const host: HostModel = {
  name: 'Acme Logistics',
  elements: Array.from({ length: 12 }, (_, n) => application(n + 1)),
  relations: [],
  diagrams: [laidOut({ id: 'l7', kind: 'layer7', name: 'Landscape', placements: [] })],
}

/** A session over the real reducer, a step per dispatch: what the workspace binds, minus React. */
function session(): SessionView & { history(): readonly HistoryEntry[] } {
  let model = fromArrays(host)
  let revision = 0
  let counter = 0
  const past: HistoryEntry[] = []
  return {
    indexed: () => model,
    current: () => toArrays(model),
    activeDiagramId: () => 'l7',
    scopePath: () => '',
    ancestorDecisions: () => [],
    blocked: () => undefined,
    dispatch: (command: Command) => {
      const result = apply(model, command)
      if (!result.ok) return undefined
      const summary: StepSummary = summarise([command], model)
      past.push({ at: 1_800_000_000_000 + past.length, summary, commands: [command], ...(command.origin ? { origin: command.origin } : {}) })
      model = result.model
      revision += 1
      return toArrays(model)
    },
    ids: idPolicy(() => [...model.order.elements, ...model.order.relations, ...model.order.diagrams]),
    makeId: (prefix) => `${prefix}-${++counter}`,
    today: () => '2026-11-22',
    translate: DEFAULT_TRANSLATE,
    containerName: (name) => `${name} · containers`,
    revision: () => revision,
    history: () => past,
    undo: () => {},
    images: () => [],
    save: () => Promise.resolve(),
  }
}

describe('one pass through the door', () => {
  it('pages a list to its end, dry-runs a batch that refers to an earlier step, then lands it', async () => {
    const open = session()
    const relay = relayOver(open)

    // Five at a time, only the names, to the end.
    const seen: { id: string; name: string }[] = []
    let cursor: string | undefined
    let pages = 0
    do {
      const page = await call(relay, 'elements.list', { kind: 'application', limit: 5, fields: ['name'], ...(cursor ? { cursor } : {}) })
      expect(page.total).toBe(12)
      seen.push(...(page.elements as { id: string; name: string }[]))
      cursor = page.next as string | undefined
      pages += 1
    } while (cursor !== undefined)
    expect(pages).toBe(3)
    expect(seen.map((row) => row.id)).toEqual(host.elements.map((one) => one.id))
    expect(seen[0]).toEqual({ id: 'app-01', name: 'Application 1' })

    // Tried first: the second step names what the first will mint, and nothing lands.
    const steps = [
      { tool: 'element.add', args: { name: 'Billing' } },
      { tool: 'connect', args: { sourceId: { $ref: 'steps[0].id' }, targetId: 'app-01', label: 'invoices' } },
    ]
    const tried = await call(relay, 'batch', { steps, dryRun: true })
    expect(tried).toMatchObject({ dryRun: true, revision: 0, steps: [{ id: 'billing' }, {}] })
    expect((tried.changes as { kind: string; what: string }[]).map((one) => `${one.kind} ${one.what}`).sort())
      .toEqual(['added element', 'added relation'])
    expect(open.history()).toHaveLength(0)

    // Then landed against the revision it was tried at: one step, as tried.
    const landed = await call(relay, 'batch', { steps, ifRevision: tried.revision })
    expect(landed).toMatchObject({ revision: 1, steps: [{ id: 'billing' }, {}] })
    expect(open.history()).toHaveLength(1)
    expect(Object.values(open.indexed().relations)).toEqual([expect.objectContaining({ sourceId: 'billing', targetId: 'app-01' })])

    // The list moved under the cursor of its first page: the next goes on after the row that page ended on.
    const first = await call(relay, 'elements.list', { limit: 5, fields: ['name'] })
    await call(relay, 'element.add', { name: 'Archive' })
    const after = await call(relay, 'elements.list', { limit: 5, fields: ['name'], cursor: first.next })
    expect(after).toMatchObject({ moved: true, total: 14 })
    expect((after.elements as { id: string }[])[0].id).toBe('app-06')
  })
})

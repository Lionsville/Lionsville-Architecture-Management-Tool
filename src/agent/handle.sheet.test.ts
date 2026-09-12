/**
 * What an agent can do with a laid-out view (ADR-0012 §6, ADR-0007).
 *
 * Three answers differ from a board's, and each for the same reason — a sheet
 * has no geometry. The report is the page rather than the pixels; the picture
 * is the whole page rather than a crop, and comes from the page's own handle
 * rather than from the canvas; and tidy and route are refused as questions
 * about the model rather than about the drawing.
 */
import { describe, expect, it, vi } from 'vitest'
import { laidOut } from '../model/testFixtures'
import { DEFAULT_TRANSLATE } from '../i18n/strings'
import { summarise } from '../model/activity'
import type { StepSummary } from '../model/activity'
import type { Command } from '../model/commands'
import type { HostModel } from '../model/fromInterchange'
import { idPolicy } from '../model/keys'
import { fromArrays, toArrays } from '../model/normalised'
import type { Model } from '../model/normalised'
import { apply } from '../model/reducer'
import { shippingScope } from '../business/testFixtures'
import { handle } from './handle'
import type { SessionView } from './handle'
import { RendererRefused } from './renderer'
import type { RendererView, SheetShot } from './renderer'
import type { AgentAnswer } from './tools'

const SHEET = {
  id: 'sh-1',
  kind: 'sheet' as const,
  name: 'Business architecture',
  journeyId: 'ship',
  lanes: ['key-account', 'partner'],
  areas: ['fulfilment', 'billing'],
  members: [],
  geometry: { nodes: [] },
}

const host = (): HostModel => {
  const { elements, relations } = shippingScope()
  return {
    name: 'Landscape',
    customerName: 'Acme',
    elements,
    relations,
    diagrams: [laidOut({ id: 'l7', kind: 'layer7', name: 'L7', placements: [] }), SHEET],
  }
}

/** A page that keeps receipts and answers with a three-byte picture. */
function fakePage(over: Partial<RendererView> = {}) {
  const asked: { diagramId: string; maxPixels: number }[] = []
  const shown: string[] = []
  const shot: SheetShot = { png: new Uint8Array([1, 2, 3]), width: 800, height: 600, pixelRatio: 1 }
  const renderer: RendererView = {
    show: async (id) => { shown.push(id) },
    tidy: async () => {},
    route: async () => {},
    capture: async () => new Uint8Array([9]),
    focus: () => {},
    sheet: async (diagramId, options) => { asked.push({ diagramId, ...options }); return shot },
    ...over,
  }
  return { renderer, asked, shown }
}

function session(over: Partial<SessionView> = {}): SessionView {
  let model: Model = fromArrays(host())
  let counter = 0
  let revision = 0
  const past: { at: number; origin?: 'agent'; summary: StepSummary; commands: Command[]; inverse: Command }[] = []
  return {
    indexed: () => model,
    current: () => toArrays(model),
    activeDiagramId: () => 'l7',
    groupDecisions: () => [],
    blocked: () => undefined,
    dispatch: (command) => {
      const result = apply(model, command)
      if (!result.ok) return undefined
      past.push({ at: 1, summary: summarise([command], model), commands: [command], inverse: result.inverse })
      model = result.model
      revision += 1
      return toArrays(model)
    },
    ids: idPolicy(() => [...model.order.elements, ...model.order.relations, ...model.order.diagrams]),
    makeId: (prefix) => `${prefix}-new-${++counter}`,
    today: () => '2026-09-12',
    translate: DEFAULT_TRANSLATE,
    containerName: (name) => `${name} · containers`,
    revision: () => revision,
    history: () => past,
    undo: () => {},
    images: () => [],
    addImage: () => {},
    save: () => Promise.resolve(),
    ...over,
  }
}

const parsed = (out: AgentAnswer, at = 0): Record<string, unknown> => {
  if (!out.ok || out.content[at].type !== 'text') throw new Error(`not an answer: ${JSON.stringify(out)}`)
  return JSON.parse((out.content[at] as { text: string }).text)
}

describe('diagram.inspect on a sheet', () => {
  it('answers the page rather than the geometry', async () => {
    const out = await handle({ id: '1', tool: 'diagram.inspect', args: { diagramId: 'sh-1' } }, session())
    const report = parsed(out)
    expect(report).toMatchObject({ diagramId: 'sh-1', kind: 'sheet' })
    expect(report.overlaps).toBeUndefined()
    expect(report.bands).toBeUndefined()
  })

  it('says who is on the rail, which lanes the journey has, and what covers what', async () => {
    const out = await handle({ id: '1', tool: 'diagram.inspect', args: { diagramId: 'sh-1' } }, session())
    const report = parsed(out) as never as {
      actors: { some: { id: string; outside: boolean }[] }
      journey: { lanes: { actorId?: string; fork?: string }[] }
      areas: { some: { groupings: { capabilities: { id: string; coverage: string }[] }[] }[] }
      counts: Record<string, number>
    }
    expect(report.actors.some.find((a) => a.id === 'partner')?.outside).toBe(true)
    expect(report.journey.lanes.map((lane) => lane.actorId)).toEqual([undefined, 'key-account', 'partner'])
    expect(report.journey.lanes[1].fork).toBe('quote')
    const capabilities = report.areas.some.flatMap((area) => area.groupings.flatMap((g) => g.capabilities))
    expect(capabilities.find((c) => c.id === 'picking')?.coverage).toBe('covered')
    expect(capabilities.find((c) => c.id === 'packing')?.coverage).toBe('manual')
    expect(report.counts).toMatchObject({ capabilities: 4, uncovered: 1, phases: 4 })
  })

  it('carries a capability made straight under an area, which is where a person makes one', async () => {
    const scope = host()
    const with3c: HostModel = {
      ...scope,
      elements: [...scope.elements, {
        id: 'tracking',
        kind: 'function',
        name: 'Track a consignment',
        parentId: 'fulfilment',
        lifecycle: 'live',
        isManaged: false,
        aspects: {},
      }],
    }
    const indexed = fromArrays(with3c)
    const out = await handle(
      { id: '1', tool: 'diagram.inspect', args: { diagramId: 'sh-1' } },
      session({ indexed: () => indexed, current: () => toArrays(indexed) }),
    )
    const report = parsed(out) as never as {
      areas: { some: { id: string; capabilities: { id: string; coverage: string }[] }[] }
      counts: Record<string, number>
    }
    const fulfilment = report.areas.some.find((area) => area.id === 'fulfilment')!
    expect(fulfilment.capabilities.map((c) => c.id)).toEqual(['tracking'])
    expect(fulfilment.capabilities[0].coverage).toBe('uncovered')
    // And it is counted: five now, one more uncovered.
    expect(report.counts).toMatchObject({ capabilities: 5, uncovered: 2 })
  })

  it('still answers the geometry report for a board', async () => {
    const out = await handle({ id: '1', tool: 'diagram.inspect', args: { diagramId: 'l7' } }, session())
    expect(parsed(out)).toMatchObject({ kind: 'layer7' })
  })
})

describe('diagram.render on a sheet', () => {
  it('opens the page and hands over the whole of it', async () => {
    const { renderer, asked, shown } = fakePage()
    const out = await handle(
      { id: '1', tool: 'diagram.render', args: { diagramId: 'sh-1' } }, session({ renderer }),
    )
    expect(asked).toEqual([{ diagramId: 'sh-1', maxPixels: 4_000_000 }])
    // Nothing is shown on the canvas: a sheet is not a board.
    expect(shown).toEqual([])
    expect(out.ok && out.content[0]).toMatchObject({ type: 'image', mimeType: 'image/png' })
    expect(parsed(out, 1)).toMatchObject({ diagramId: 'sh-1', kind: 'sheet', width: 800, height: 600 })
  })

  it('takes the caller’s pixel budget', async () => {
    const { renderer, asked } = fakePage()
    await handle(
      { id: '1', tool: 'diagram.render', args: { diagramId: 'sh-1', maxPixels: 250_000 } },
      session({ renderer }),
    )
    expect(asked[0].maxPixels).toBe(250_000)
  })

  it('refuses where the host has no page for one', async () => {
    const { renderer } = fakePage({ sheet: undefined })
    expect(await handle({ id: '1', tool: 'diagram.render', args: { diagramId: 'sh-1' } }, session({ renderer })))
      .toMatchObject({ ok: false, refusal: 'agent.noAnswer' })
  })

  it('turns the page’s own refusal into a key', async () => {
    const { renderer } = fakePage({ sheet: () => Promise.reject(new RendererRefused('gone')) })
    expect(await handle({ id: '1', tool: 'diagram.render', args: { diagramId: 'sh-1' } }, session({ renderer })))
      .toMatchObject({ ok: false, refusal: 'agent.noAnswer', detail: 'the page went away' })
  })
})

describe('tidy and route on a sheet', () => {
  it('are refused, because a sheet’s layout is a question about the model', async () => {
    const { renderer } = fakePage()
    for (const tool of ['diagram.tidy', 'diagram.route'] as const) {
      expect(await handle({ id: '1', tool, args: { diagramId: 'sh-1' } }, session({ renderer })))
        .toMatchObject({ ok: false, refusal: 'agent.badArguments' })
    }
  })
})

describe('diagram.create', () => {
  it('makes a sheet over the journey and the areas the project already holds', async () => {
    const held = session()
    const out = await handle(
      { id: '1', tool: 'diagram.create', args: { kind: 'sheet', name: 'Business architecture' } }, held,
    )
    expect(parsed(out)).toMatchObject({
      id: 'sh-new-1', kind: 'sheet', journeyId: 'ship', areas: ['fulfilment', 'billing'],
    })
    expect(held.indexed().diagrams['sh-new-1'].kind).toBe('sheet')
  })

  it('leaves the window on the board it was on', async () => {
    // A sheet is a page; making it active would hand the canvas a view it
    // cannot draw. The dispatch is watched for the option rather than the id.
    const dispatch = vi.fn(() => undefined)
    await handle(
      { id: '1', tool: 'diagram.create', args: { kind: 'sheet', name: 'Sheet' } }, session({ dispatch }),
    )
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'diagram.create' }), undefined)
  })

  it('asks for a name, as a landscape does', async () => {
    expect(await handle({ id: '1', tool: 'diagram.create', args: { kind: 'sheet' } }, session()))
      .toMatchObject({ ok: false, refusal: 'agent.badArguments' })
  })
})

describe('diagrams.list', () => {
  it('says which kind each view is, so an agent knows what it may ask of one', async () => {
    const out = await handle({ id: '1', tool: 'diagrams.list', args: {} }, session())
    expect((parsed(out) as never as { diagrams: { id: string; kind: string }[] }).diagrams)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'l7', kind: 'layer7' }),
        expect.objectContaining({ id: 'sh-1', kind: 'sheet' }),
      ]))
  })
})

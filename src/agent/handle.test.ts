/**
 * The handler over a session view: which tools are answered, which refusals
 * come first, and how the four renderer-only tools go through the view. The
 * read tier's answers themselves are `answer.test.ts`; the write tier's
 * commands are `commandFor.test.ts`.
 */
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_TRANSLATE } from '../i18n/strings'
import { LayoutRefused } from '../layout/elkLayout'
import type { HostModel } from '../model/fromInterchange'
import { idPolicy } from '../model/keys'
import { fromArrays, toArrays } from '../model/normalised'
import type { Model } from '../model/normalised'
import { apply } from '../model/reducer'
import { handle } from './handle'
import type { SessionView } from './handle'
import { RendererRefused, toBase64 } from './renderer'
import type { RendererView } from './renderer'
import { RESOURCE_LIST, RESOURCE_READ } from './tools'
import type { AgentAnswer } from './tools'

const host: HostModel = {
  name: 'Landscape',
  customerName: 'Acme',
  elements: [{
    id: 'billing', kind: 'application', name: 'Billing', lifecycle: 'live', isManaged: true,
    aspects: {}, description: 'Sends the invoices.',
  }],
  connections: [],
  diagrams: [{ id: 'l7', kind: 'layer7', name: 'L7', placements: [{ elementId: 'billing', x: 0, y: 0 }] }],
  decisions: [{ id: 'adr-1', number: 1, title: 'Keep the ledger', status: 'proposed', date: '2026-09-01', body: 'Because.', signers: [] }],
}

/** A renderer that keeps receipts and answers with a three-byte picture. */
function fakeRenderer(over: Partial<RendererView> = {}) {
  const shown: string[] = []
  const focused: string[] = []
  const captured: unknown[] = []
  const renderer: RendererView = {
    show: async (id) => { shown.push(id) },
    tidy: async () => {},
    route: async () => {},
    capture: async (options) => { captured.push(options); return new Uint8Array([1, 2, 3]) },
    focus: (id) => { focused.push(id) },
    ...over,
  }
  return { renderer, shown, focused, captured }
}

/** A session over the real reducer: what the workspace binds, minus React. */
function session(over: Partial<SessionView> = {}): SessionView & { model: () => Model } {
  let model = fromArrays(host)
  let counter = 0
  return {
    model: () => model,
    indexed: () => model,
    current: () => toArrays(model),
    activeDiagramId: () => 'l7',
    groupDecisions: () => [],
    blocked: () => undefined,
    dispatch: (command) => {
      const result = apply(model, command)
      if (!result.ok) return undefined
      model = result.model
      return toArrays(model)
    },
    ids: idPolicy(() => [...model.order.elements, ...model.order.connections, ...model.order.diagrams]),
    makeId: (prefix) => `${prefix}-new-${++counter}`,
    today: () => '2026-09-07',
    translate: DEFAULT_TRANSLATE,
    containerName: (name) => `${name} · containers`,
    ...over,
  }
}

const parsed = (out: AgentAnswer): Record<string, unknown> => {
  if (!out.ok || out.content[0].type !== 'text') throw new Error(`not an answer: ${JSON.stringify(out)}`)
  return JSON.parse(out.content[0].text)
}

describe('handle', () => {
  it('answers a read tool from the session', async () => {
    const out = await handle({ id: '1', tool: 'project.current', args: {} }, session())
    expect(parsed(out)).toMatchObject({ name: 'Landscape', elements: 1 })
  })

  it('refuses a tool it does not know, naming it', async () => {
    expect(await handle({ id: '1', tool: 'elements.destroy', args: {} }, session()))
      .toEqual({ ok: false, refusal: 'agent.unknownTool', detail: 'elements.destroy' })
  })

  it('still answers a read while the session is blocked', async () => {
    const out = await handle({ id: '1', tool: 'elements.list', args: {} }, session({ blocked: () => 'agent.conflict' }))
    expect(out.ok).toBe(true)
  })

  it('hands bad arguments back as a refusal rather than an answer', async () => {
    expect(await handle({ id: '1', tool: 'element.describe', args: { id: 7 } }, session()))
      .toMatchObject({ ok: false, refusal: 'agent.badArguments' })
  })

  it('answers the layout report without a command, even while blocked', async () => {
    const held = session({ blocked: () => 'agent.conflict' })
    expect(parsed(await handle({ id: '1', tool: 'diagram.inspect', args: {} }, held)))
      .toMatchObject({ diagramId: 'l7', drawn: { elements: 1, connections: 0 } })
    expect(await handle({ id: '2', tool: 'diagram.inspect', args: { diagramId: 'nope' } }, held))
      .toMatchObject({ refusal: 'agent.unknownId' })
  })

  it('dispatches a write at the session and answers with the id it minted', async () => {
    const held = session()
    const out = await handle({ id: '1', tool: 'element.add', args: { name: 'CRM' } }, held)
    expect(out).toMatchObject({ ok: true })
    expect(held.model().elements['crm']).toMatchObject({ name: 'CRM', kind: 'application' })
    expect(held.model().diagrams['l7'].placements['crm']).toMatchObject({ zone: 'landscape' })
  })

  it('refuses a write while the session is blocked, and changes nothing', async () => {
    const held = session({ blocked: () => 'agent.conflict' })
    expect(await handle({ id: '1', tool: 'element.add', args: { name: 'CRM' } }, held))
      .toEqual({ ok: false, refusal: 'agent.conflict' })
    expect(held.model().elements['crm']).toBeUndefined()
  })

  it('passes the reducer’s own refusal through with its key', async () => {
    // The builder checks what it can; a connection whose end has gone between
    // the check and the reducer is the reducer's to refuse, and its key comes
    // back as it is.
    const held = session({
      dispatch: () => undefined,
      indexed: () => ({ ...fromArrays(host), elements: {} }),
    })
    expect(await handle({ id: '1', tool: 'element.remove', args: { id: 'billing' } }, held))
      .toEqual({ ok: false, refusal: 'agent.unknownId', detail: 'element billing' })
  })

  it('switches to a diagram it created, the way the shell does', async () => {
    const switched: string[] = []
    const base = session()
    const held = session({
      ...base,
      dispatch: (command, options) => {
        if (options?.activeDiagramId) switched.push(options.activeDiagramId)
        return base.dispatch(command, options)
      },
    })
    const out = await handle({ id: '1', tool: 'diagram.create', args: { kind: 'layer7', name: 'Second' } }, held)
    expect(out.ok).toBe(true)
    expect(switched).toEqual(['l7-new-1'])
  })
})

describe('the four things only the renderer can do', () => {
  it('refuses them all without a canvas', async () => {
    for (const tool of ['diagram.render', 'diagram.tidy', 'diagram.route']) {
      expect(await handle({ id: '1', tool, args: {} }, session())).toMatchObject({ refusal: 'agent.noAnswer', detail: 'no canvas' })
    }
    expect(await handle({ id: '1', tool: 'focus', args: { elementId: 'billing' } }, session()))
      .toMatchObject({ refusal: 'agent.noAnswer' })
  })

  it('points at an element through the renderer, and refuses one that is not there', async () => {
    const { renderer, focused } = fakeRenderer()
    const held = session({ renderer })
    expect(parsed(await handle({ id: '1', tool: 'focus', args: { elementId: 'billing' } }, held)))
      .toEqual({ elementId: 'billing', name: 'Billing', focused: true })
    expect(focused).toEqual(['billing'])
    expect(await handle({ id: '2', tool: 'focus', args: { elementId: 'ghost' } }, held)).toMatchObject({ refusal: 'agent.unknownId' })
  })

  it('renders the board as an image block with the transform beside it', async () => {
    const { renderer, shown, captured } = fakeRenderer()
    const out = await handle({ id: '1', tool: 'diagram.render', args: {} }, session({ renderer }))
    expect(shown).toEqual(['l7'])
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.content[0]).toEqual({ type: 'image', data: 'AQID', mimeType: 'image/png' })
    const transform = JSON.parse((out.content[1] as { text: string }).text)
    // The whole landscape: the board, padded, within four megapixels.
    expect(transform).toMatchObject({ diagramId: 'l7', padding: 40, bounds: { x: 0, y: 0, width: 1680, height: 1040 } })
    expect(transform.width * transform.height).toBeLessThanOrEqual(4_000_000)
    expect(captured[0]).toMatchObject({ padding: 40, pixelRatio: transform.pixelRatio })
  })

  it('crops to the named elements, and refuses one that is not drawn', async () => {
    const { renderer, captured } = fakeRenderer()
    const held = session({ renderer })
    const out = await handle({ id: '1', tool: 'diagram.render', args: { elementIds: ['billing'] } }, held)
    expect(out.ok).toBe(true)
    // A 200x130 card with a 60 margin around it, at two pixels per flow pixel.
    expect(captured[0]).toMatchObject({ bounds: { x: -60, y: -60, width: 320, height: 250 }, pixelRatio: 2 })
    expect(await handle({ id: '2', tool: 'diagram.render', args: { elementIds: ['ghost'] } }, held))
      .toMatchObject({ refusal: 'agent.unknownId' })
  })

  it('turns the renderer’s refusals into keys', async () => {
    const hidden = fakeRenderer({ capture: async () => { throw new RendererRefused('hidden') } })
    expect(await handle({ id: '1', tool: 'diagram.render', args: {} }, session({ renderer: hidden.renderer })))
      .toEqual({ ok: false, refusal: 'agent.windowHidden' })
    const busy = fakeRenderer({ tidy: async () => { throw new RendererRefused('busy') } })
    expect(await handle({ id: '1', tool: 'diagram.tidy', args: {} }, session({ renderer: busy.renderer })))
      .toEqual({ ok: false, refusal: 'agent.busy' })
    const large = fakeRenderer({ tidy: async () => { throw new LayoutRefused('tooLarge', { count: 900, limit: 400 }) } })
    expect(await handle({ id: '1', tool: 'diagram.tidy', args: {} }, session({ renderer: large.renderer })))
      .toEqual({ ok: false, refusal: 'agent.tooLarge', detail: '900 boxes, the cap is 400' })
    const cancelled = fakeRenderer({ route: async () => { throw new LayoutRefused('cancelled') } })
    expect(await handle({ id: '1', tool: 'diagram.route', args: {} }, session({ renderer: cancelled.renderer })))
      .toEqual({ ok: false, refusal: 'agent.cancelled' })
  })

  it('tidies and routes through the renderer and answers with the report afterwards', async () => {
    const tidy = vi.fn(async () => {})
    const route = vi.fn(async () => {})
    const { renderer, shown } = fakeRenderer({ tidy, route })
    const held = session({ renderer })
    expect(parsed(await handle({ id: '1', tool: 'diagram.tidy', args: {} }, held))).toMatchObject({ diagramId: 'l7' })
    expect(parsed(await handle({ id: '2', tool: 'diagram.route', args: {} }, held))).toMatchObject({ diagramId: 'l7' })
    expect(tidy).toHaveBeenCalledTimes(1)
    expect(route).toHaveBeenCalledTimes(1)
    expect(shown).toEqual(['l7', 'l7'])
  })

  it('refuses to tidy while the session is blocked, but still renders', async () => {
    const { renderer } = fakeRenderer()
    const held = session({ renderer, blocked: () => 'agent.conflict' })
    expect(await handle({ id: '1', tool: 'diagram.tidy', args: {} }, held)).toEqual({ ok: false, refusal: 'agent.conflict' })
    expect((await handle({ id: '2', tool: 'diagram.render', args: {} }, held)).ok).toBe(true)
  })
})

describe('resources', () => {
  it('lists the descriptions and the decisions, and reads them back as markdown', async () => {
    const held = session({ groupDecisions: () => [{ id: 'g-1', number: 1, title: 'One identity', status: 'accepted', date: '2026-01-01', body: 'Yes.', signers: [] }] })
    const listed = parsed(await handle({ id: '1', tool: RESOURCE_LIST, args: {} }, held)) as { resources: { uri: string }[] }
    expect(listed.resources.map((r) => r.uri)).toEqual([
      'lvarch://element/billing/description', 'lvarch://decision/g-1', 'lvarch://decision/adr-1',
    ])
    expect(parsed(await handle({ id: '2', tool: RESOURCE_READ, args: { uri: 'lvarch://element/billing/description' } }, held)))
      .toEqual({ contents: [{ uri: 'lvarch://element/billing/description', mimeType: 'text/markdown', text: 'Sends the invoices.' }] })
    const decision = parsed(await handle({ id: '3', tool: RESOURCE_READ, args: { uri: 'lvarch://decision/adr-1' } }, held)) as { contents: { text: string }[] }
    expect(decision.contents[0].text).toBe('# Keep the ledger\n\n*ADR-0001 · proposed · 2026-09-01*\n\nBecause.')
    expect(await handle({ id: '4', tool: RESOURCE_READ, args: { uri: 'lvarch://decision/nope' } }, held)).toMatchObject({ refusal: 'agent.unknownId' })
    expect(await handle({ id: '5', tool: RESOURCE_READ, args: { uri: 'https://elsewhere' } }, held)).toMatchObject({ refusal: 'agent.unknownId' })
  })
})

describe('toBase64', () => {
  it('encodes like the standard does, padding included', () => {
    expect(toBase64(new Uint8Array([]))).toBe('')
    expect(toBase64(new Uint8Array([77]))).toBe('TQ==')
    expect(toBase64(new Uint8Array([77, 97]))).toBe('TWE=')
    expect(toBase64(new Uint8Array([77, 97, 110]))).toBe('TWFu')
    expect(toBase64(new TextEncoder().encode('any carnal pleasure'))).toBe('YW55IGNhcm5hbCBwbGVhc3VyZQ==')
  })
})

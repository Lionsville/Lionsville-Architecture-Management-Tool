/**
 * The handler over a session view: which tools are answered, which refusals
 * come first, and how the four renderer-only tools go through the view. The
 * read tier's answers themselves are `answer.test.ts`; the write tier's
 * commands are `commandFor.test.ts`.
 */
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_TRANSLATE } from '../i18n/strings'
import { LayoutRefused } from '../layout/elkLayout'
import { summarise } from '../model/activity'
import type { StepSummary } from '../model/activity'
import type { Command } from '../model/commands'
import type { HostModel } from '../model/fromInterchange'
import type { DocumentImage } from '../model/types'
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
  relations: [],
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

/**
 * A session over the real reducer: what the workspace binds, minus React.
 * The stack is the session's own two-line version of it — a step per
 * dispatch, whose origin is the command's — so undo and the log can be tested.
 */
function session(over: Partial<SessionView> = {}): SessionView & { model: () => Model; saved: () => number } {
  let model = fromArrays(host)
  let counter = 0
  let revision = 0
  let saved = 0
  const library: DocumentImage[] = []
  const past: { at: number; origin?: 'agent'; summary: StepSummary; commands: Command[]; inverse: Command }[] = []
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
      past.push({ at: 1_700_000_000_000 + past.length, summary: summarise([command], model), commands: [command], inverse: result.inverse, ...(command.origin ? { origin: command.origin } : {}) })
      model = result.model
      revision += 1
      return toArrays(model)
    },
    ids: idPolicy(() => [...model.order.elements, ...model.order.relations, ...model.order.diagrams]),
    makeId: (prefix) => `${prefix}-new-${++counter}`,
    today: () => '2026-09-07',
    translate: DEFAULT_TRANSLATE,
    containerName: (name) => `${name} · containers`,
    revision: () => revision,
    history: () => past,
    undo: () => {
      const top = past.pop()
      if (!top) return
      const result = apply(model, top.inverse)
      if (result.ok) { model = result.model; revision += 1 }
    },
    images: () => library,
    addImage: (image) => { library.push(image) },
    save: () => { saved += 1; return Promise.resolve() },
    saved: () => saved,
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

describe('the session’s own: revision, the log, undo, save', () => {
  const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

  it('says the revision on the orientation answer and on every mutation', async () => {
    const held = session()
    expect(parsed(await handle({ id: '1', tool: 'project.current', args: {} }, held))).toMatchObject({ revision: 0 })
    expect(parsed(await handle({ id: '2', tool: 'element.add', args: { name: 'CRM' } }, held))).toMatchObject({ id: 'crm', revision: 1 })
    expect(parsed(await handle({ id: '3', tool: 'project.current', args: {} }, held))).toMatchObject({ revision: 1 })
  })

  it('refuses a write decided against a revision the project has left, and takes one that matches', async () => {
    const held = session()
    await handle({ id: '1', tool: 'element.add', args: { name: 'CRM' } }, held)
    expect(await handle({ id: '2', tool: 'element.update', args: { id: 'crm', vendor: 'x', ifRevision: 0 } }, held))
      .toMatchObject({ refusal: 'agent.stale', detail: 'the project is at revision 1, not 0' })
    expect(held.model().elements.crm).not.toHaveProperty('vendor')
    expect((await handle({ id: '3', tool: 'element.update', args: { id: 'crm', vendor: 'x', ifRevision: 1 } }, held)).ok).toBe(true)
    expect(held.model().elements.crm.vendor).toBe('x')
  })

  it('lists the steps newest first, saying whose each was and what it did', async () => {
    const held = session()
    held.dispatch({ type: 'element.update', id: 'billing', patch: { vendor: 'Kestrel' } })
    await handle({ id: '1', tool: 'element.add', args: { name: 'CRM' } }, held)
    const out = parsed(await handle({ id: '2', tool: 'activity.list', args: {} }, held)) as { total: number; steps: Record<string, unknown>[] }
    expect(out.total).toBe(2)
    expect(out.steps.map((s) => [s.by, s.what])).toEqual([['agent', 'Added CRM'], ['person', 'Changed Billing']])
    expect(out.steps[0]).toMatchObject({ key: 'activity.elementAdded', name: 'CRM', commands: 1 })
    expect((parsed(await handle({ id: '3', tool: 'activity.list', args: { limit: 1 } }, held)) as { steps: unknown[] }).steps).toHaveLength(1)
  })

  it('undoes the newest steps while they are an agent’s, and stops at a person’s', async () => {
    const held = session()
    held.dispatch({ type: 'element.update', id: 'billing', patch: { vendor: 'Kestrel' } })
    await handle({ id: '1', tool: 'element.add', args: { name: 'CRM' } }, held)
    await handle({ id: '2', tool: 'element.add', args: { name: 'ERP' } }, held)
    const out = parsed(await handle({ id: '3', tool: 'undo', args: { steps: 5 } }, held))
    expect(out).toMatchObject({ undone: ['Added ERP', 'Added CRM'], stopped: 'the next step is a person\'s' })
    expect(held.model().elements.crm).toBeUndefined()
    expect(held.model().elements.billing.vendor).toBe('Kestrel')
    expect(await handle({ id: '4', tool: 'undo', args: {} }, held)).toMatchObject({ refusal: 'agent.notYours' })
    expect(await handle({ id: '5', tool: 'undo', args: {} }, session())).toMatchObject({ refusal: 'agent.badArguments' })
  })

  it('saves through the session, and turns a refusal into a key', async () => {
    const held = session()
    expect(parsed(await handle({ id: '1', tool: 'project.save', args: {} }, held))).toEqual({ saved: true, revision: 0 })
    expect(held.saved()).toBe(1)
    const failing = session({ save: () => Promise.reject(new Error('disk full')) })
    expect(await handle({ id: '2', tool: 'project.save', args: {} }, failing)).toEqual({ ok: false, refusal: 'agent.saveFailed', detail: 'disk full' })
  })

  it('takes a picture in as base64 or a data URL, names it, and lists it with who shows it', async () => {
    const held = session()
    const out = parsed(await handle({ id: '1', tool: 'image.upload', args: { name: 'Target state.png', data: PNG, type: 'image/png' } }, held)) as { file: string; markdown: string; bytes: number }
    expect(out.file).toMatch(/^target-state-[a-z0-9]+\.png$/)
    expect(out.markdown).toBe(`![Target state.png](../images/${out.file})`)
    expect(out.bytes).toBe(70)
    expect(held.images()[0]).toMatchObject({ file: out.file, url: `data:image/png;base64,${PNG}` })
    const asUrl = parsed(await handle({ id: '2', tool: 'image.upload', args: { name: 'deck', data: `data:image/webp;base64,${PNG}` } }, held)) as { file: string }
    expect(asUrl.file).toMatch(/^deck-[a-z0-9]+\.webp$/)
    // Shown by a description, once one refers to it.
    await handle({ id: '3', tool: 'element.update', args: { id: 'billing', description: `See ![](../images/${out.file})` } }, held)
    const listed = parsed(await handle({ id: '4', tool: 'images.list', args: {} }, held)) as { images: { file: string; usedBy: string[] }[] }
    expect(listed.images.map((i) => [i.file, i.usedBy])).toEqual([[out.file, ['Billing']], [asUrl.file, []]])
  })

  it('refuses a picture it cannot take', async () => {
    const held = session()
    expect(await handle({ id: '1', tool: 'image.upload', args: { name: 'x', data: PNG } }, held)).toMatchObject({ refusal: 'agent.badArguments' })
    expect(await handle({ id: '2', tool: 'image.upload', args: { name: 'x', data: 'not base64!', type: 'image/png' } }, held)).toMatchObject({ refusal: 'agent.badArguments' })
    expect(await handle({ id: '3', tool: 'image.upload', args: { name: 'x', data: `data:image/gif;base64,${PNG}` } }, held)).toMatchObject({ refusal: 'agent.badArguments' })
    const big = 'A'.repeat(3 * 1024 * 1024)
    expect(await handle({ id: '4', tool: 'image.upload', args: { name: 'x', data: big, type: 'image/png' } }, held)).toMatchObject({ refusal: 'agent.tooLarge' })
    expect(held.images()).toHaveLength(0)
  })
})

describe('batch', () => {
  it('lands every step as one transaction, each built on the one before, and answers per step', async () => {
    const held = session()
    const out = parsed(await handle({ id: '1', tool: 'batch', args: { steps: [
      { tool: 'element.add', args: { name: 'CRM' } },
      { tool: 'element.add', args: { name: 'CRM' } },
      { tool: 'connect', args: { sourceId: 'crm', targetId: 'billing', label: 'orders' } },
      { tool: 'placeNextTo', args: { elementId: 'crm-2', anchorId: 'billing' } },
    ] } }, held)) as { steps: Record<string, unknown>[]; revision: number }
    expect(out.steps.map((s) => s.id ?? s.elementId)).toEqual(['crm', 'crm-2', expect.any(String), 'crm-2'])
    expect(out.revision).toBe(1)
    expect(held.history()).toHaveLength(1)
    expect(held.history()[0].origin).toBe('agent')
    expect(Object.keys(held.model().elements)).toEqual(['billing', 'crm', 'crm-2'])
    expect(Object.values(held.model().relations)[0]).toMatchObject({ sourceId: 'crm', targetId: 'billing', label: 'orders' })
  })

  it('lands nothing when a step is refused, and says which', async () => {
    const held = session()
    expect(await handle({ id: '1', tool: 'batch', args: { steps: [
      { tool: 'element.add', args: { name: 'CRM' } },
      { tool: 'connect', args: { sourceId: 'crm', targetId: 'ghost' } },
    ] } }, held)).toEqual({ ok: false, refusal: 'agent.unknownId', detail: 'steps[1]: element ghost' })
    expect(held.model().elements.crm).toBeUndefined()
    expect(await handle({ id: '2', tool: 'batch', args: { steps: [{ tool: 'diagram.render' }] } }, held))
      .toMatchObject({ refusal: 'agent.badArguments', detail: 'steps[0]: diagram.render cannot be part of a batch' })
    expect(await handle({ id: '3', tool: 'batch', args: { steps: [{ tool: 'batch', args: { steps: [] } }] } }, held))
      .toMatchObject({ refusal: 'agent.badArguments' })
    expect(await handle({ id: '4', tool: 'batch', args: { steps: [] } }, held)).toMatchObject({ refusal: 'agent.badArguments' })
    expect(await handle({ id: '5', tool: 'batch', args: { steps: [{ tool: 'element.add', args: { name: 'x' } }], ifRevision: 4 } }, held))
      .toMatchObject({ refusal: 'agent.stale' })
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

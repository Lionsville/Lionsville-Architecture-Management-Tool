/**
 * The agent at every scope (ADR-0012 §2, §9; plan step 13).
 *
 * The tree arrives as a plain object, the way the renderer does, so what is
 * pinned here is the handler's half: the three tree-wide reads answer from
 * it, a read with `scope` is answered over the scope it names, anything that
 * needs a session is refused with a key rather than landed on the open scope,
 * and a resource URI carries the path.
 */
import { describe, expect, it } from 'vitest'
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
import { handle } from './handle'
import type { SessionView } from './handle'
import { RESOURCE_LIST, RESOURCE_READ, TOOLS, TREE_WIDE } from './tools'
import type { AgentAnswer } from './tools'
import type { TreeView } from './tree'

const application = (id: string, name: string, over: object = {}) => ({
  id, kind: 'application' as const, name, lifecycle: 'live' as const, isManaged: true, aspects: {}, ...over,
})

/** `acme/finance` is open; `acme/retail` defines the warehouse system finance draws as a stand-in. */
const finance: HostModel = {
  name: 'Finance',
  elements: [
    application('erp', 'Finance system', { description: 'Sends the invoices.' }),
    application('wms', 'Warehouse system', { ref: 'acme/retail' }),
  ],
  relations: [],
  diagrams: [laidOut({ id: 'l7', kind: 'layer7', name: 'L7', placements: [{ id: 'erp', x: 0, y: 0 }] })],
  decisions: [{ id: 'adr-1', number: 1, title: 'Keep the ledger', status: 'proposed', date: '2026-09-01', body: 'Because.', signers: [] }],
}

const retail: HostModel = {
  name: 'Retail',
  elements: [application('wms', 'Warehouse system', { description: 'Runs the warehouse.' })],
  relations: [],
  diagrams: [laidOut({ id: 'r7', kind: 'layer7', name: 'Retail board', placements: [{ id: 'wms', x: 0, y: 0 }] })],
  decisions: [{ id: 'adr-r', number: 1, title: 'Buy, do not build', status: 'accepted', date: '2026-08-01', body: 'Bought.', signers: [] }],
}

function tree(): TreeView & { read: TreeView['read'] & { asked: string[] } } {
  const asked: string[] = []
  const read = Object.assign(async (path: string) => {
    asked.push(path)
    if (path !== 'acme/retail') return undefined
    return { model: retail, activeDiagramId: 'r7', ancestorDecisions: [] }
  }, { asked })
  const entries = {
    erp: { id: 'erp', kind: 'application' as const, name: 'Finance system', master: 'acme/finance', declarations: [], drawnIn: [], stale: [] },
    wms: { id: 'wms', kind: 'application' as const, name: 'Warehouse system', master: 'acme/retail', declarations: [], drawnIn: ['acme/finance'], stale: ['acme/finance'], outside: true as const },
  }
  return {
    scopes: () => [
      { path: '', name: 'Acme Logistics', kind: 'organisation', views: 1 },
      { path: 'acme/retail', name: 'Retail', kind: 'landscape', views: 1 },
      { path: 'acme/finance', name: 'Finance', kind: 'landscape', views: 1 },
    ],
    lookup: (id) => entries[id as keyof typeof entries],
    register: () => [entries.erp, entries.wms],
    initiativesBelow: () => [{
      scope: 'acme/retail',
      transition: {
        id: 'tr-1', number: 1, title: 'One warehouse system', status: 'agreed' as const, initiative: true as const,
        from: '2027-01-01', elements: [], decisions: [], milestones: [], body: '',
      },
    }],
    findings: () => [
      { key: 'check.drift', scope: 'acme/finance', id: 'wms', name: 'Warehouse system', scopes: ['acme/retail'] },
      { key: 'check.unattributed', scope: 'acme/retail', id: 'wms', name: 'Warehouse system' },
      { key: 'check.notDrawn', scope: 'acme/finance', id: 'erp', name: 'Finance system', information: true },
    ],
    read,
  }
}

function session(over: Partial<SessionView> = {}): SessionView & { model: () => Model } {
  let model: Model = fromArrays(finance)
  let counter = 0
  let revision = 0
  const past: { at: number; origin?: 'agent'; summary: StepSummary; commands: Command[]; inverse: Command }[] = []
  return {
    model: () => model,
    indexed: () => model,
    current: () => toArrays(model),
    activeDiagramId: () => 'l7',
    scopePath: () => 'acme/finance',
    ancestorDecisions: () => [],
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
    today: () => '2026-09-13',
    translate: DEFAULT_TRANSLATE,
    containerName: (name) => `${name} · containers`,
    revision: () => revision,
    history: () => past,
    undo: () => {},
    images: () => [],
    addImage: () => {},
    save: () => Promise.resolve(),
    tree: tree(),
    ...over,
  }
}

const parsed = (out: AgentAnswer): Record<string, unknown> => {
  if (!out.ok || out.content[0].type !== 'text') throw new Error(`not an answer: ${JSON.stringify(out)}`)
  return JSON.parse((out.content[0] as { text: string }).text)
}
const refusal = (out: AgentAnswer) => (out.ok ? undefined : out.refusal)

describe('the vocabulary', () => {
  it('gives every tool a scope but the three that are about the whole tree', () => {
    for (const tool of TOOLS) {
      const has = 'scope' in tool.inputSchema.properties
      if (TREE_WIDE.includes(tool.name) && tool.name !== 'checks.list') expect(has, tool.name).toBe(false)
      else expect(has, tool.name).toBe(true)
    }
  })
})

describe('the three reads about the tree', () => {
  it('lists every scope and says which one is open', async () => {
    const out = parsed(await handle({ id: '1', tool: 'scopes.list', args: {} }, session()))
    expect(out.open).toBe('acme/finance')
    expect((out.scopes as { path: string; open: boolean }[]).map((s) => [s.path, s.open])).toEqual([
      ['', false], ['acme/retail', false], ['acme/finance', true],
    ])
  })

  it('answers the register with the master, who draws it, and the findings about it', async () => {
    const out = parsed(await handle({ id: '1', tool: 'register.list', args: {} }, session()))
    expect(out.total).toBe(2)
    const rows = out.some as Record<string, unknown>[]
    expect(rows[1]).toMatchObject({
      id: 'wms', master: 'acme/retail', drawnIn: ['acme/finance'], stale: ['acme/finance'], outside: true,
      findings: ['check.drift', 'check.unattributed'],
    })
    // Information rides along on the register, as it does on the page: a
    // thing can be real and not yet on a board.
    expect(rows[0].findings).toEqual(['check.notDrawn'])
  })

  it('filters the register by a query', async () => {
    const out = parsed(await handle({ id: '1', tool: 'register.list', args: { query: 'retail' } }, session()))
    expect((out.some as { id: string }[]).map((row) => row.id)).toEqual(['wms'])
  })

  it('lists the findings, leaving information out unless asked, and filters by scope and key', async () => {
    const all = parsed(await handle({ id: '1', tool: 'checks.list', args: {} }, session()))
    expect((all.some as { key: string }[]).map((f) => f.key)).toEqual(['check.drift', 'check.unattributed'])
    const withInfo = parsed(await handle({ id: '1', tool: 'checks.list', args: { information: true } }, session()))
    expect(withInfo.total).toBe(3)
    const retailOnly = parsed(await handle({ id: '1', tool: 'checks.list', args: { scope: 'acme/retail' } }, session()))
    expect((retailOnly.some as { key: string }[]).map((f) => f.key)).toEqual(['check.unattributed'])
    const drift = parsed(await handle({ id: '1', tool: 'checks.list', args: { key: 'check.drift' } }, session()))
    expect(drift.total).toBe(1)
  })

  it('answers over nothing when the session has no tree', async () => {
    const out = parsed(await handle({ id: '1', tool: 'register.list', args: {} }, session({ tree: undefined })))
    expect(out).toEqual({ total: 0, some: [] })
  })
})

describe('scope on a read', () => {
  it('answers over the scope it names, read for the call', async () => {
    const view = session()
    const out = parsed(await handle({ id: '1', tool: 'elements.list', args: { scope: 'acme/retail' } }, view))
    expect((out.elements as { id: string; name: string }[]).map((e) => e.id)).toEqual(['wms'])
    expect((view.tree as ReturnType<typeof tree>).read.asked).toEqual(['acme/retail'])
  })

  it('says where it is answering for, and that scope’s own decisions', async () => {
    const current = parsed(await handle({ id: '1', tool: 'project.current', args: { scope: 'acme/retail' } }, session()))
    expect(current).toMatchObject({ name: 'Retail', path: 'acme/retail', decisions: 1 })
    const decisions = parsed(await handle({ id: '1', tool: 'decisions.list', args: { scope: 'acme/retail' } }, session()))
    expect(JSON.stringify(decisions)).toContain('Buy, do not build')
  })

  it('answers the open scope itself without a read when scope names it', async () => {
    const view = session()
    const out = parsed(await handle({ id: '1', tool: 'elements.list', args: { scope: 'acme/finance' } }, view))
    expect((out.elements as { id: string }[]).map((e) => e.id)).toEqual(['erp', 'wms'])
    expect((view.tree as ReturnType<typeof tree>).read.asked).toEqual([])
  })

  it('refuses a path the tree has no scope at', async () => {
    const out = await handle({ id: '1', tool: 'elements.list', args: { scope: 'acme/nowhere' } }, session())
    expect(refusal(out)).toBe('agent.unknownScope')
  })

  it('refuses another scope where there is no tree to read it from', async () => {
    const out = await handle({ id: '1', tool: 'elements.list', args: { scope: 'acme/retail' } }, session({ tree: undefined }))
    expect(refusal(out)).toBe('agent.unknownScope')
  })
})

describe('scope on anything that needs the session', () => {
  it('refuses a write, and lands nothing', async () => {
    const view = session()
    const out = await handle(
      { id: '1', tool: 'element.add', args: { scope: 'acme/retail', kind: 'application', name: 'Ghost' } }, view,
    )
    expect(refusal(out)).toBe('agent.scopeNotOpen')
    expect(view.model().order.elements).toEqual(['erp', 'wms'])
    expect(view.revision()).toBe(0)
  })

  it('refuses a step of a batch addressed elsewhere, and lands none of it', async () => {
    const view = session()
    const out = await handle({ id: '1', tool: 'batch', args: { steps: [
      { tool: 'element.add', args: { kind: 'application', name: 'Here' } },
      { tool: 'element.add', args: { scope: 'acme/retail', kind: 'application', name: 'There' } },
    ] } }, view)
    expect(refusal(out)).toBe('agent.scopeNotOpen')
    expect(view.revision()).toBe(0)
  })

  it('refuses a picture, the log and the pictures list', async () => {
    for (const tool of ['diagram.render', 'activity.list', 'images.list']) {
      const out = await handle({ id: '1', tool, args: { scope: 'acme/retail' } }, session())
      expect(refusal(out), tool).toBe('agent.scopeNotOpen')
    }
  })

  it('lets a write name the open scope, which is where it lands anyway', async () => {
    const view = session()
    const out = await handle(
      { id: '1', tool: 'element.add', args: { scope: 'acme/finance', kind: 'application', name: 'Here' } }, view,
    )
    expect(out.ok).toBe(true)
    expect(view.revision()).toBe(1)
  })
})

describe('the initiatives below (ADR-0012 §7)', () => {
  it('ride along on plans.list with where each lives', async () => {
    const out = parsed(await handle({ id: '1', tool: 'plans.list', args: {} }, session()))
    expect(out.plans).toEqual([])
    expect(out.fromBelow).toEqual([{
      scope: 'acme/retail', id: 'tr-1', label: 'TR-0001', title: 'One warehouse system', status: 'agreed', from: '2027-01-01',
    }])
  })

  it('are flagged and unflagged through plan.create and plan.update', async () => {
    const view = session()
    const made = parsed(await handle({ id: '1', tool: 'plan.create', args: { title: 'Move the ledger', initiative: true } }, view))
    expect(made.initiative).toBe(true)
    const off = parsed(await handle({ id: '2', tool: 'plan.update', args: { id: made.id, initiative: false } }, view))
    expect(off.initiative).toBeUndefined()
    expect(view.current().transitions?.[0].initiative).toBeUndefined()
  })
})

describe('who answers for an id', () => {
  it('is said on element.describe', async () => {
    const out = parsed(await handle({ id: '1', tool: 'element.describe', args: { id: 'wms' } }, session()))
    expect(out.identity).toEqual({ master: 'acme/retail', declarations: [], drawnIn: ['acme/finance'], stale: ['acme/finance'] })
    expect(out.standIn).toBe(true)
  })

  it('is absent where the tree has never seen the id, or there is no tree', async () => {
    const none = parsed(await handle({ id: '1', tool: 'element.describe', args: { id: 'erp' } }, session({ tree: undefined })))
    expect(none.identity).toBeUndefined()
  })
})

describe('resources with a path', () => {
  it('lists the open scope’s resources under its path', async () => {
    const out = parsed(await handle({ id: '1', tool: RESOURCE_LIST, args: {} }, session()))
    expect((out.resources as { uri: string }[]).map((r) => r.uri)).toEqual([
      'lvarch://acme/finance/element/erp/description',
      'lvarch://acme/finance/decision/adr-1',
    ])
  })

  it('lists the organisation’s with no path, which is the form every URI had', async () => {
    const out = parsed(await handle({ id: '1', tool: RESOURCE_LIST, args: {} }, session({ scopePath: () => '' })))
    expect((out.resources as { uri: string }[])[0].uri).toBe('lvarch://element/erp/description')
  })

  it('reads another scope’s description and decision by path', async () => {
    const text = (out: AgentAnswer) => (parsed(out).contents as { text: string }[])[0].text
    const description = await handle({ id: '1', tool: RESOURCE_READ, args: { uri: 'lvarch://acme/retail/element/wms/description' } }, session())
    expect(text(description)).toBe('Runs the warehouse.')
    const decision = await handle({ id: '1', tool: RESOURCE_READ, args: { uri: 'lvarch://acme/retail/decision/adr-r' } }, session())
    expect(text(decision)).toContain('Buy, do not build')
  })

  it('reads the open scope with no path, and with its own path', async () => {
    const text = (out: AgentAnswer) => (parsed(out).contents as { text: string }[])[0].text
    const bare = await handle({ id: '1', tool: RESOURCE_READ, args: { uri: 'lvarch://element/erp/description' } }, session())
    expect(text(bare)).toBe('Sends the invoices.')
    const own = await handle({ id: '1', tool: RESOURCE_READ, args: { uri: 'lvarch://acme/finance/element/erp/description' } }, session())
    expect(text(own)).toBe('Sends the invoices.')
  })

  it('refuses a path the tree has no scope at, and a URI with no element or decision in it', async () => {
    expect(refusal(await handle({ id: '1', tool: RESOURCE_READ, args: { uri: 'lvarch://acme/nowhere/element/x/description' } }, session()))).toBe('agent.unknownScope')
    expect(refusal(await handle({ id: '1', tool: RESOURCE_READ, args: { uri: 'lvarch://acme/retail' } }, session()))).toBe('agent.unknownId')
  })
})

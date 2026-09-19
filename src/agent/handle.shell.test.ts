/**
 * The agent drives the app (ADR-0019): where the app is, what there is to
 * open, opening it with nothing open and with a scope open, and the session
 * the person can stop.
 *
 * The shell arrives as a plain object whose `open` moves a fake screen, the
 * way the renderer and the tree arrive in the other handler tests; what is
 * pinned is the handler's half — what is checked before the shell is asked,
 * what is answered, and what Stop does.
 */
import { describe, expect, it } from 'vitest'
import { laidOut } from '../model/testFixtures'
import { DEFAULT_TRANSLATE } from '../i18n/strings'
import { summarise } from '../model/activity'
import type { StepSummary } from '../model/activity'
import type { Command } from '../model/commands'
import type { HostModel } from '../model/hostModel'
import { idPolicy } from '../model/keys'
import { fromArrays, toArrays } from '../model/normalised'
import type { Model } from '../model/normalised'
import { apply } from '../model/reducer'
import type { ShellView } from './shell'
import { Driving } from './driving'
import { handle } from './handle'
import type { SessionView } from './handle'
import type { Destination, Screen } from './screen'
import { RESOURCE_READ } from './tools'
import type { AgentAnswer } from './tools'
import type { TreeView } from './tree'

const application = (id: string, name: string, over: object = {}) => ({
  id, kind: 'application' as const, name, lifecycle: 'live' as const, isManaged: true, aspects: {}, ...over,
})

const organisation: HostModel = {
  name: 'Acme Logistics',
  elements: [{ id: 'fulfilment', kind: 'function', name: 'Fulfilment', lifecycle: 'live', isManaged: false, aspects: {} }],
  relations: [],
  diagrams: [{ id: 'sheet-1', kind: 'sheet', name: 'Business architecture', members: [], geometry: { nodes: [] } }],
  decisions: [{ id: 'adr-org', number: 1, title: 'One warehouse', status: 'accepted', date: '2026-08-01', body: 'One.', signers: [] }],
}

const finance: HostModel = {
  name: 'Finance',
  elements: [application('erp', 'Finance system')],
  relations: [],
  diagrams: [laidOut({ id: 'l7', kind: 'layer7', name: 'L7', placements: [{ id: 'erp', x: 0, y: 0 }] })],
}

const retail: HostModel = {
  name: 'Retail',
  elements: [
    application('wms', 'Warehouse system'),
    { id: 'openshift', kind: 'platform', name: 'OpenShift', lifecycle: 'live', isManaged: true, aspects: {}, platformArchetype: 'place' },
  ],
  relations: [],
  diagrams: [
    laidOut({ id: 'r7', kind: 'layer7', name: 'Retail board', placements: [{ id: 'wms', x: 0, y: 0 }] }),
    laidOut({ id: 'r7b', kind: 'layer7', name: 'Retail board, next year', placements: [{ id: 'wms', x: 0, y: 0 }] }),
    { id: 'tech', kind: 'technology', name: 'Technology landscape', members: [], geometry: { nodes: [] } },
  ],
  transitions: [{
    id: 'tr-1', number: 1, title: 'One warehouse system', status: 'agreed', from: '2027-01-01',
    elements: [], decisions: [], milestones: [], body: '',
  }],
}

const DOCUMENTS: Record<string, HostModel> = { '': organisation, 'acme/finance': finance, 'acme/retail': retail }
const NAMES: Record<string, string> = { '': 'Acme Logistics', 'acme/finance': 'Finance', 'acme/retail': 'Retail', 'acme/hr': 'HR' }

function tree(): TreeView & { asked: string[] } {
  const asked: string[] = []
  return {
    asked,
    scopes: () => [
      { path: '', name: 'Acme Logistics', kind: 'organisation', views: 1 },
      { path: 'acme/finance', name: 'Finance', kind: 'landscape', views: 1 },
      { path: 'acme/hr', name: 'HR', kind: 'domain', views: 0 },
      { path: 'acme/retail', name: 'Retail', kind: 'landscape', views: 3 },
    ],
    lookup: () => undefined,
    register: () => [],
    initiativesBelow: () => [],
    findings: () => [],
    read: async (path) => {
      asked.push(path)
      const model = DOCUMENTS[path]
      return model ? { model, activeDiagramId: model.diagrams[0]?.id ?? '', ancestorDecisions: path ? organisation.decisions ?? [] : [] } : undefined
    },
  }
}

/** A shell whose screen moves the way the app's would, and remembers where it was asked to go. */
function shell({ screen: seed, client, ...over }: Partial<Omit<ShellView, 'screen' | 'client'>> & { screen?: Screen; client?: string } = {}) {
  let screen: Screen = seed ?? { home: { path: '', name: 'Acme Logistics' } }
  const opened: (Destination & { scope: string })[] = []
  const driving = new Driving(() => '2026-09-19T10:00:00.000Z')
  const view: ShellView = {
    tree: tree(),
    screen: () => screen,
    open: (to) => {
      opened.push(to)
      const path = to.scope
      const name = NAMES[path] ?? path
      if (to.page === undefined || to.page === 'home' || to.page === 'register' || to.page === 'technologyRegister') {
        screen = to.page === undefined
          ? { open: { path, name, view: firstView(path) } }
          : { home: { path, name }, ...(to.page === 'home' ? {} : { page: { page: to.page } }) }
        return
      }
      const document = DOCUMENTS[path]
      const diagram = document?.diagrams.find((held) => held.id === to.id)
      const view = diagram ? { id: diagram.id, name: diagram.name, kind: diagram.kind } : firstView(path)
      const page = to.page === 'decisions' ? { page: 'decisions' as const, ...(to.id ? { id: to.id } : {}) }
        : to.page === 'roadmap' ? { page: 'roadmap' as const }
          : to.page === 'plan' || to.page === 'platform' || to.page === 'service' ? { page: to.page, id: to.id! }
            : undefined
      screen = { open: { path, name, ...(view ? { view } : {}) }, ...(page ? { page } : {}) }
    },
    client: () => client ?? 'Claude Code',
    driving,
    ...over,
  }
  return { view, opened, driving, moveTo: (next: Screen) => { screen = next } }
}

function firstView(path: string) {
  const held = DOCUMENTS[path]?.diagrams[0]
  return held ? { id: held.id, name: held.name, kind: held.kind } : undefined
}

/** A session over finance, the way the workspace binds one. */
function session(over: Partial<SessionView> = {}): SessionView {
  let model: Model = fromArrays(finance)
  let counter = 0
  let revision = 0
  const past: { at: number; origin?: 'agent'; summary: StepSummary; commands: Command[]; inverse: Command }[] = []
  return {
    indexed: () => model,
    current: () => toArrays(model),
    activeDiagramId: () => 'l7',
    scopePath: () => 'acme/finance',
    ancestorDecisions: () => organisation.decisions ?? [],
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
    today: () => '2026-09-19',
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
const detail = (out: AgentAnswer) => (out.ok ? undefined : out.detail)
const call = (tool: string, args: unknown = {}) => ({ id: 'r', tool, args })

describe('with nothing open', () => {
  it('says whose home is up, and what to do about it', async () => {
    const { view } = shell()
    const out = parsed(await handle(call('app.current'), undefined, view))
    expect(out.home).toEqual({ path: '', name: 'Acme Logistics' })
    expect(out.open).toBeUndefined()
    expect(out.scopes).toBe(4)
    expect(out.agent).toEqual({ client: 'Claude Code' })
    expect(String(out.hint)).toContain('app.open')
  })

  it('still answers the tree, and a read with a scope, from disk', async () => {
    const { view } = shell()
    const scopes = parsed(await handle(call('scopes.list'), undefined, view))
    expect(scopes.open).toBeNull()
    expect((scopes.scopes as { open: boolean }[]).every((held) => !held.open)).toBe(true)
    const elements = parsed(await handle(call('elements.list', { scope: 'acme/retail' }), undefined, view))
    expect((elements.elements as { id: string }[]).map((held) => held.id)).toEqual(['wms', 'openshift'])
    expect(parsed(await handle(call('decision.read', { scope: '', id: 'adr-org' }), undefined, view)).title).toBe('One warehouse')
  })

  it('refuses what needs a session with agent.noProject, and starts no session for it', async () => {
    const { view, driving } = shell()
    expect(refusal(await handle(call('elements.list'), undefined, view))).toBe('agent.noProject')
    expect(refusal(await handle(call('element.add', { kind: 'application', name: 'Ghost' }), undefined, view))).toBe('agent.noProject')
    expect(refusal(await handle(call('element.add', { scope: 'acme/retail', kind: 'application', name: 'Ghost' }), undefined, view))).toBe('agent.noProject')
    expect(refusal(await handle(call('diagram.render', {}), undefined, view))).toBe('agent.noProject')
    expect(driving.current().session).toBeUndefined()
  })

  it('reads a resource as the organisation\'s when its URI has no path, and by path otherwise', async () => {
    const { view } = shell()
    const read = parsed(await handle({ id: 'r', tool: RESOURCE_READ, args: { uri: 'lvarch://decision/adr-org' } }, undefined, view))
    expect((read.contents as { text: string }[])[0].text).toContain('One warehouse')
    expect(refusal(await handle({ id: 'r', tool: RESOURCE_READ, args: { uri: 'lvarch://element/erp/description' } }, undefined, view))).toBe('agent.unknownId')
    expect(refusal(await handle({ id: 'r', tool: RESOURCE_READ, args: { uri: 'lvarch://acme/finance/element/erp/description' } }, undefined, view))).toBeUndefined()
  })

  it('lists every view in the organisation, reading only the scopes that hold one', async () => {
    const { view } = shell()
    const out = parsed(await handle(call('views.list'), undefined, view))
    expect(out.total).toBe(5)
    expect(out.scopesRead).toBe(3)
    expect((view.tree as ReturnType<typeof tree>).asked).toEqual(['', 'acme/finance', 'acme/retail'])
    expect((out.some as { scope: string; id: string; kind: string; onTab?: boolean }[]).map((row) => [row.scope, row.id, row.kind, row.onTab ?? false])).toEqual([
      ['', 'sheet-1', 'sheet', true],
      ['acme/finance', 'l7', 'layer7', true],
      ['acme/retail', 'r7', 'layer7', true],
      ['acme/retail', 'r7b', 'layer7', false],
      ['acme/retail', 'tech', 'technology', false],
    ])
    const boards = parsed(await handle(call('views.list', { kind: 'layer7', scope: 'acme/retail' }), undefined, view))
    expect((boards.some as { id: string }[]).map((row) => row.id)).toEqual(['r7', 'r7b'])
  })

  it('opens a scope on its canvas, and answers once the screen says so', async () => {
    const { view, opened, driving } = shell()
    const out = parsed(await handle(call('app.open', { scope: 'acme/retail' }), undefined, view))
    expect(opened).toEqual([{ scope: 'acme/retail' }])
    expect(out.arrived).toBe(true)
    expect(out.open).toEqual({ path: 'acme/retail', name: 'Retail', view: { id: 'r7', name: 'Retail board', kind: 'layer7' } })
    // A move is driving: the session started, under the client's name.
    expect(out.agent).toMatchObject({ client: 'Claude Code', session: { client: 'Claude Code', calls: 1 } })
    expect(driving.current().session?.calls).toBe(1)
  })

  it('opens a scope that draws nothing on its home, and the registers on the organisation\'s', async () => {
    const { view, opened } = shell()
    const hr = parsed(await handle(call('app.open', { scope: 'acme/hr' }), undefined, view))
    expect(opened.at(-1)).toEqual({ scope: 'acme/hr', page: 'home' })
    expect(hr.home).toEqual({ path: 'acme/hr', name: 'HR' })
    const register = parsed(await handle(call('app.open', { scope: '', page: 'register', id: 'ignored' }), undefined, view))
    expect(opened.at(-1)).toEqual({ scope: '', page: 'register' })
    expect(register.page).toEqual({ page: 'register' })
    expect(register.arrived).toBe(true)
  })

  it('checks the destination against the scope\'s own document before asking the shell', async () => {
    const { view, opened } = shell()
    expect(refusal(await handle(call('app.open', { scope: 'acme/nowhere' }), undefined, view))).toBe('agent.unknownScope')
    expect(refusal(await handle(call('app.open', { scope: 'acme/retail', page: 'plan' }), undefined, view))).toBe('agent.badArguments')
    expect(refusal(await handle(call('app.open', { scope: 'acme/retail', page: 'plan', id: 'tr-9' }), undefined, view))).toBe('agent.unknownId')
    expect(refusal(await handle(call('app.open', { scope: 'acme/retail', page: 'sheet' }), undefined, view))).toBe('agent.unknownId')
    expect(detail(await handle(call('app.open', { scope: 'acme/retail', page: 'sheet' }), undefined, view))).toContain('diagram.create')
    // Two boards: say which.
    const which = await handle(call('app.open', { scope: 'acme/retail', page: 'board' }), undefined, view)
    expect(refusal(which)).toBe('agent.badArguments')
    expect(detail(which)).toContain('r7b')
    // A platform report over an application.
    expect(refusal(await handle(call('app.open', { scope: 'acme/retail', page: 'platform', id: 'wms' }), undefined, view))).toBe('agent.badArguments')
    expect(refusal(await handle(call('app.open', { scope: 'acme/retail', page: 'board', id: 'tech' }), undefined, view))).toBe('agent.badArguments')
    expect(opened).toEqual([])
  })

  it('infers the page from an id: a view, an element, a plan, a record', async () => {
    const { view, opened } = shell()
    await handle(call('app.open', { scope: 'acme/retail', id: 'tech' }), undefined, view)
    await handle(call('app.open', { scope: 'acme/retail', id: 'openshift' }), undefined, view)
    await handle(call('app.open', { scope: 'acme/retail', id: 'tr-1' }), undefined, view)
    await handle(call('app.open', { scope: 'acme/retail', id: 'adr-org' }), undefined, view)
    expect(opened).toEqual([
      { scope: 'acme/retail', page: 'technology', id: 'tech' },
      { scope: 'acme/retail', page: 'element', id: 'openshift' },
      { scope: 'acme/retail', page: 'plan', id: 'tr-1' },
      { scope: 'acme/retail', page: 'decisions', id: 'adr-org' },
    ])
    const only = parsed(await handle(call('app.open', { scope: 'acme/retail', page: 'technology' }), undefined, view))
    expect(opened.at(-1)).toEqual({ scope: 'acme/retail', page: 'technology', id: 'tech' })
    expect(only.page).toBeUndefined()
    expect((only.open as { view: { id: string } }).view.id).toBe('tech')
  })

  it('needs a scope when nothing is open and none is said', async () => {
    const { view } = shell({ screen: {} })
    expect(refusal(await handle(call('app.open', { page: 'decisions' }), undefined, view))).toBe('agent.badArguments')
  })
})

describe('with a scope open', () => {
  it('says where it is, with the view on the tab and the revision', async () => {
    const { view, moveTo } = shell()
    moveTo({ open: { path: 'acme/finance', name: 'Finance', view: { id: 'l7', name: 'L7', kind: 'layer7' } }, page: { page: 'roadmap' } })
    const out = parsed(await handle(call('app.current'), session(), view))
    expect(out.open).toEqual({ path: 'acme/finance', name: 'Finance', view: { id: 'l7', name: 'L7', kind: 'layer7' } })
    expect(out.page).toEqual({ page: 'roadmap' })
    expect(out.revision).toBe(0)
    expect(out.activeDiagramId).toBe('l7')
    expect(out.hint).toBeUndefined()
  })

  it('describes the screen from the session alone when there is no shell', async () => {
    const out = parsed(await handle(call('app.current'), session()))
    expect(out.open).toEqual({ path: 'acme/finance', name: 'Finance', view: { id: 'l7', name: 'L7', kind: 'layer7' } })
    expect(refusal(await handle(call('app.open', { page: 'roadmap' }), session()))).toBe('agent.noAnswer')
  })

  it('moves within the open scope, checked against the model on screen', async () => {
    const { view, opened, moveTo } = shell()
    moveTo({ open: { path: 'acme/finance', name: 'Finance' } })
    const held = session()
    const out = parsed(await handle(call('app.open', { page: 'decisions', id: 'adr-org' }), held, view))
    expect(opened).toEqual([{ scope: 'acme/finance', page: 'decisions', id: 'adr-org' }])
    expect(out.page).toEqual({ page: 'decisions', id: 'adr-org' })
    expect(out.revision).toBe(0)
    await handle(call('app.open', { id: 'erp' }), held, view)
    expect(opened.at(-1)).toEqual({ scope: 'acme/finance', page: 'element', id: 'erp' })
    expect(refusal(await handle(call('app.open', { page: 'document', id: 'wms' }), held, view))).toBe('agent.unknownId')
  })

  it('lists the open scope\'s views from the session, and the rest from disk', async () => {
    const { view } = shell()
    const out = parsed(await handle(call('views.list'), session(), view))
    expect(out.open).toBe('acme/finance')
    expect((view.tree as ReturnType<typeof tree>).asked).toEqual(['', 'acme/retail'])
    const finance = (out.some as { scope: string; onScreen?: boolean }[]).find((row) => row.scope === 'acme/finance')
    expect(finance?.onScreen).toBe(true)
  })

  it('starts a session on the first write, with the purpose session.start gives it', async () => {
    const { view, driving } = shell()
    await handle(call('elements.list'), session(), view)
    expect(driving.current().session).toBeUndefined()
    const held = session()
    const added = await handle(call('element.add', { kind: 'application', name: 'Ledger' }), held, view)
    expect(added.ok).toBe(true)
    expect(driving.current().session).toMatchObject({ client: 'Claude Code', calls: 1 })
    const started = parsed(await handle(call('session.start', { purpose: 'Adding the ledger' }), held, view))
    expect((started.agent as { session: { purpose: string; calls: number } }).session).toMatchObject({ purpose: 'Adding the ledger', calls: 2 })
    expect(parsed(await handle(call('session.end'), held, view))).toEqual({ ended: true })
    expect(driving.current()).toEqual({})
  })

  it('answers agent.stopped after the person\'s Stop, until session.start is called again', async () => {
    const { view, driving } = shell()
    const held = session()
    await handle(call('element.add', { kind: 'application', name: 'Ledger' }), held, view)
    driving.end('person')
    expect(refusal(await handle(call('element.add', { kind: 'application', name: 'Ghost' }), held, view))).toBe('agent.stopped')
    expect(refusal(await handle(call('focus', { elementId: 'erp' }), held, view))).toBe('agent.stopped')
    // Looking is not driving.
    expect((await handle(call('elements.list'), held, view)).ok).toBe(true)
    expect(parsed(await handle(call('app.current'), held, view)).agent).toMatchObject({ stopped: { client: 'Claude Code' } })
    expect((await handle(call('session.start', { purpose: 'Going on, as asked' }), held, view)).ok).toBe(true)
    expect((await handle(call('element.add', { kind: 'application', name: 'Ghost' }), held, view)).ok).toBe(true)
  })

  it('answers a call in flight with agent.stopped the moment Stop is pressed', async () => {
    let release: () => void = () => {}
    const { view, driving } = shell({ open: () => new Promise<void>((resolve) => { release = resolve }) })
    const pending = handle(call('app.open', { page: 'roadmap' }), session(), view)
    await Promise.resolve()
    driving.end('person')
    const out = await pending
    expect(refusal(out)).toBe('agent.stopped')
    expect(detail(out)).toContain('while this call was running')
    release()
  })
})

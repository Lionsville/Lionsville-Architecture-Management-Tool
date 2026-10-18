// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The tree of scopes as an agent keeps it (ADR-0040 §1, §2), over a fake
 * host: every refusal the handler says itself, the person's words that alone
 * let a scope with work in it go, a subtree never taken in one call, the
 * host's own refusals passed — and the four driving with nothing open, Stop
 * refusing them, no batch holding one.
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_TRANSLATE } from '../i18n/strings'
import { idPolicy } from '../model/keys'
import { fromArrays, toArrays } from '../model/normalised'
import { Driving } from './driving'
import { handle } from './handle'
import type { SessionView } from './handle'
import type { ScopeHolds, ScopeRead, ScopesView, TreeRefused } from './scopeTree'
import { isTreeTool, TREE_TOOLS } from './scopeTree'
import type { ShellView } from './shell'
import { ON_THE_TREE, REFUSAL_SENTENCE, TOOLS, toolSpec } from './tools'
import type { AgentAnswer } from './tools'
import type { TreeView } from './tree'

const NOTHING: ScopeHolds = {
  views: 0, elements: 0, relations: 0, decisions: 0, plans: 0, observations: 0, causes: 0, solutions: 0, experiments: 0,
  assignments: 0, comments: 0, marks: 0, operatingModel: 0, pictures: 0, viewNames: [],
}

type Held = { name: string; holds?: Partial<ScopeHolds>; hidden?: number }

/** A host over a map of paths: what each holds, and every call it was asked to make. */
function host(start: Record<string, Held> = {}, refuse: Partial<Record<keyof ScopesView, TreeRefused>> = {}) {
  const scopes = new Map<string, Held>(Object.entries({ '': { name: 'Acme Logistics' }, acme: { name: 'Acme' }, ...start }))
  const asked: unknown[][] = []
  const below = (path: string) => [...scopes.keys()].filter((one) => one !== path && (path === '' || one.startsWith(`${path}/`)))
  const view: ScopesView = {
    read: async (path) => {
      const held = scopes.get(path)
      if (!held) return undefined
      const read: ScopeRead = {
        path, name: held.name, revision: `r-${path}`, holds: { ...NOTHING, ...held.holds }, below: below(path), hiddenBelow: held.hidden ?? 0,
      }
      return read
    },
    create: async (made) => {
      asked.push(['create', made])
      if (refuse.create) return refuse.create
      const path = made.parent ? `${made.parent}/${made.name.toLowerCase()}` : made.name.toLowerCase()
      scopes.set(path, { name: made.name })
      return { path, name: made.name, kind: made.withBoard ? 'landscape' : 'domain', revision: 'r1', ...(made.withBoard ? { board: { id: 'landscape', name: 'Landscape' } } : {}) }
    },
    serve: async (path, unit) => {
      asked.push(['serve', path, unit])
      return refuse.serve ?? { unit, keptIn: 'acme', scopeType: 'ut-team' }
    },
    describe: async (path, header) => {
      asked.push(['describe', path, header])
      return refuse.describe ?? { path, changed: Object.keys(header) as never }
    },
    move: async (path, parent) => {
      asked.push(['move', path, parent])
      return refuse.move ?? { from: path, to: `${parent}/${path.split('/').pop()}`, carried: ['globex'], notCarried: [{ scope: 'initech', reason: 'shell.scopeReadOnly' }] }
    },
    remove: async (path, why) => {
      asked.push(['remove', path, why])
      if (refuse.remove) return refuse.remove
      scopes.delete(path)
      return { removed: [path] }
    },
  }
  return { view, asked, scopes }
}

const tree: TreeView = {
  scopes: () => [],
  lookup: () => undefined,
  register: () => [],
  initiativesBelow: () => [],
  findings: () => [],
  read: async () => undefined,
  units: () => [{ scope: 'acme', unit: { id: 'freight', kind: 'actor', name: 'Freight', unitTypeId: 'ut-team', lifecycle: 'live', isManaged: false, aspects: {} } }],
  operatingModel: () => ({ unitTypes: [{ id: 'ut-team', name: 'Team', within: [], slots: [] }], roles: [], responsibilities: [], operatingRules: [] }),
}

function shell(scopes?: ScopesView, over: Partial<ShellView> = {}): ShellView {
  return {
    tree,
    screen: () => ({ home: { path: '', name: 'Acme Logistics' } }),
    open: () => {},
    client: () => 'Claude Code',
    driving: new Driving(() => '2026-10-18T10:00:00.000Z'),
    ...(scopes ? { scopes } : {}),
    ...over,
  }
}

const call = (tool: string, args: Record<string, unknown> = {}) => ({ id: '1', tool, args })
const parsed = (out: AgentAnswer): Record<string, unknown> => {
  if (!out.ok || out.content[0].type !== 'text') throw new Error(`not an answer: ${JSON.stringify(out)}`)
  return JSON.parse((out.content[0] as { text: string }).text)
}
const refusal = (out: AgentAnswer) => (out.ok ? undefined : out.refusal)
const detail = (out: AgentAnswer) => (out.ok ? '' : out.detail ?? '')
const ask = (tool: string, args: Record<string, unknown>, held = host()) => handle(call(tool, args), undefined, shell(held.view))

describe('scope.create', () => {
  it('makes a domain or a landscape under a parent that is there, and answers where it went', async () => {
    const held = host()
    expect(parsed(await ask('scope.create', { parent: 'acme', name: 'Rail' }, held))).toEqual({ path: 'acme/rail', name: 'Rail', kind: 'domain', revision: 'r1' })
    expect(parsed(await ask('scope.create', { parent: '', name: 'Yard', withBoard: true }, held))).toMatchObject({ kind: 'landscape', board: { id: 'landscape' } })
    expect(held.asked[0]).toEqual(['create', { parent: 'acme', name: 'Rail', withBoard: false }])
  })

  it('refuses a parent that is not there, an empty name and a unit that is not one', async () => {
    const held = host()
    expect(refusal(await ask('scope.create', { parent: 'nowhere', name: 'Rail' }, held))).toBe('agent.unknownScope')
    expect(refusal(await ask('scope.create', { parent: 'acme', name: '  ' }, held))).toBe('agent.badArguments')
    expect(refusal(await ask('scope.create', { parent: 'acme', name: 'Rail', servedBy: 'nobody' }, held))).toBe('agent.unknownId')
    expect(refusal(await ask('scope.create', { name: 'Rail' }, held))).toBe('agent.badArguments')
    expect(held.asked).toEqual([])
  })

  it('links the unit once the scope is there, and keeps the scope where the link is refused', async () => {
    const linked = parsed(await ask('scope.create', { parent: 'acme', name: 'Rail', servedBy: 'freight' }))
    expect(linked.servedBy).toEqual({ unit: 'freight', keptIn: 'acme', scopeType: 'ut-team' })
    const refusedLink = host({}, { serve: { refused: 'agent.readOnly', scope: 'acme' } })
    const kept = parsed(await ask('scope.create', { parent: 'acme', name: 'Rail', servedBy: 'freight' }, refusedLink))
    expect(kept.path).toBe('acme/rail')
    expect(kept.servedBy).toMatchObject({ unit: 'freight', refused: 'agent.readOnly' })
    expect(String((kept.servedBy as { instead: string }).instead)).toContain('element.update in acme')
  })

  it('passes the host\'s own refusal on', async () => {
    const held = host({}, { create: { refused: 'shell.scopeTaken', detail: 'acme/rail' } })
    const out = await ask('scope.create', { parent: 'acme', name: 'Rail' }, held)
    expect([refusal(out), detail(out)]).toEqual(['shell.scopeTaken', 'acme/rail'])
  })
})

describe('scope.update', () => {
  it('describes a scope with the fields given, null clearing, and one of kind and unit type clearing the other', async () => {
    const held = host()
    expect(parsed(await ask('scope.update', { path: 'acme', name: 'Acme Rail', description: null, unitTypeId: 'ut-team' }, held)).changed)
      .toEqual(['name', 'description', 'unitTypeId', 'kind'])
    await ask('scope.update', { path: '', kind: 'organisation', links: [{ label: 'Wiki', url: 'https://example.com' }] }, held)
    expect(held.asked).toEqual([
      ['describe', 'acme', { name: 'Acme Rail', description: null, unitTypeId: 'ut-team', kind: null }],
      ['describe', '', { links: [{ label: 'Wiki', url: 'https://example.com' }], kind: 'organisation', unitTypeId: null }],
    ])
  })

  it('refuses both a kind and a unit type, an unknown unit type, a blank name, nothing to change and a scope not there', async () => {
    const held = host()
    expect(refusal(await ask('scope.update', { path: 'acme', kind: 'team', unitTypeId: 'ut-team' }, held))).toBe('agent.badArguments')
    expect(refusal(await ask('scope.update', { path: 'acme', unitTypeId: 'ut-nothing' }, held))).toBe('agent.unknownId')
    expect(refusal(await ask('scope.update', { path: 'acme', name: ' ' }, held))).toBe('agent.badArguments')
    expect(refusal(await ask('scope.update', { path: 'acme' }, held))).toBe('agent.badArguments')
    expect(refusal(await ask('scope.update', { path: 'acme', kind: 'nothing' }, held))).toBe('agent.badArguments')
    expect(refusal(await ask('scope.update', { path: 'gone', name: 'Gone' }, held))).toBe('agent.unknownScope')
    expect(held.asked).toEqual([])
    const open = host({}, { describe: { refused: 'scope.isOpen', scope: 'acme' } })
    const out = await ask('scope.update', { path: 'acme', name: 'Acme Rail' }, open)
    expect([refusal(out), detail(out)]).toEqual(['scope.isOpen', 'scope acme'])
  })
})

describe('scope.move', () => {
  it('moves a scope and says what was carried and what was not', async () => {
    const held = host({ group: { name: 'Group' } })
    expect(parsed(await ask('scope.move', { path: 'acme', parent: 'group' }, held))).toEqual({
      from: 'acme', to: 'group/acme', carried: ['globex'], notCarried: [{ scope: 'initech', reason: 'shell.scopeReadOnly' }], moved: true,
    })
  })

  it('refuses the organisation, a parent under the scope itself and a parent not there, and moves nothing to where it is', async () => {
    const held = host({ 'acme/rail': { name: 'Rail' } })
    expect(refusal(await ask('scope.move', { path: '', parent: 'acme' }, held))).toBe('scope.organisation')
    expect(refusal(await ask('scope.move', { path: 'acme', parent: 'acme/rail' }, held))).toBe('shell.scopeIntoItself')
    expect(refusal(await ask('scope.move', { path: 'acme', parent: 'acme' }, held))).toBe('shell.scopeIntoItself')
    expect(refusal(await ask('scope.move', { path: 'acme', parent: 'nowhere' }, held))).toBe('agent.unknownScope')
    expect(refusal(await ask('scope.move', { path: 'nowhere', parent: '' }, held))).toBe('agent.unknownScope')
    expect(parsed(await ask('scope.move', { path: 'acme/rail', parent: 'acme' }, held))).toMatchObject({ moved: false })
    expect(held.asked).toEqual([])
  })
})

describe('scope.remove', () => {
  it('removes an empty scope on request: what a scope says about itself is not work', async () => {
    const held = host({ 'acme/rail': { name: 'Rail' } })
    expect(parsed(await ask('scope.remove', { path: 'acme/rail' }, held))).toEqual({ removed: ['acme/rail'], held: {} })
    expect(held.asked).toEqual([['remove', 'acme/rail', { expects: 'r-acme/rail', holds: NOTHING }]])
  })

  it('never takes a subtree in one call, counting the scopes below the person cannot see', async () => {
    const held = host({ 'acme/rail': { name: 'Rail' } })
    const out = await ask('scope.remove', { path: 'acme', removeContents: true, personSaid: 'yes remove all of it' }, held)
    expect([refusal(out), JSON.parse(detail(out))]).toEqual(['scope.scopesBelow', { below: ['acme/rail'] }])
    const hidden = host({ acme: { name: 'Acme', hidden: 2 } })
    const only = await ask('scope.remove', { path: 'acme' }, hidden)
    expect([refusal(only), JSON.parse(detail(only))]).toEqual(['scope.scopesBelow', { below: [], hiddenBelow: 2 }])
    expect([...held.asked, ...hidden.asked]).toEqual([])
  })

  it('refuses a scope that holds work, saying what by kind, and removes it only with the person\'s words carried', async () => {
    const held = host({ 'acme/rail': { name: 'Rail', holds: { views: 1, elements: 4, viewNames: ['Rail board'] } } })
    const out = await ask('scope.remove', { path: 'acme/rail' }, held)
    expect([refusal(out), JSON.parse(detail(out))]).toEqual(['scope.notEmpty', { scope: 'acme/rail', name: 'Rail', holds: { views: 1, elements: 4, viewNames: ['Rail board'] } }])
    expect(REFUSAL_SENTENCE['scope.notEmpty']).toMatch(/own words/)
    const gone = parsed(await ask('scope.remove', { path: 'acme/rail', removeContents: true, personSaid: ' Yes, remove Rail with everything ' }, held))
    expect(gone).toEqual({ removed: ['acme/rail'], held: { views: 1, elements: 4, viewNames: ['Rail board'] }, personSaid: 'Yes, remove Rail with everything' })
    expect(held.asked).toEqual([['remove', 'acme/rail', {
      expects: 'r-acme/rail', holds: { ...NOTHING, views: 1, elements: 4, viewNames: ['Rail board'] }, personSaid: 'Yes, remove Rail with everything',
    }]])
  })

  it('refuses the override without the person\'s words, the words without the override, and the organisation', async () => {
    const held = host({ 'acme/rail': { name: 'Rail', holds: { comments: 1 } } })
    expect(refusal(await ask('scope.remove', { path: 'acme/rail', removeContents: true }, held))).toBe('agent.badArguments')
    expect(refusal(await ask('scope.remove', { path: 'acme/rail', removeContents: true, personSaid: 'yes' }, held))).toBe('agent.badArguments')
    expect(refusal(await ask('scope.remove', { path: 'acme/rail', personSaid: 'yes remove it all' }, held))).toBe('agent.badArguments')
    expect(refusal(await ask('scope.remove', { path: '' }, held))).toBe('scope.organisation')
    expect(refusal(await ask('scope.remove', { path: 'gone' }, held))).toBe('agent.unknownScope')
    expect(held.asked).toEqual([])
  })

  it('passes on a scope somebody changed between the count and the removal', async () => {
    const held = host({ 'acme/rail': { name: 'Rail' } }, { remove: { refused: 'agent.stale', scope: 'acme/rail' } })
    expect(refusal(await ask('scope.remove', { path: 'acme/rail' }, held))).toBe('agent.stale')
  })
})

describe('the four, on the tree and driving', () => {
  it('take no scope and no ifRevision, and are writes', () => {
    expect([...ON_THE_TREE]).toEqual([...TREE_TOOLS])
    for (const name of TREE_TOOLS) {
      const properties = TOOLS.find((tool) => tool.name === name)!.inputSchema.properties
      expect(['scope' in properties, 'ifRevision' in properties, toolSpec(name).tier], name).toEqual([false, false, 'write'])
      expect(isTreeTool(name)).toBe(true)
    }
    expect(isTreeTool('scopes.list')).toBe(false)
  })

  it('are refused where the host lends no tree', async () => {
    expect(refusal(await handle(call('scope.create', { parent: '', name: 'Rail' }), undefined, shell()))).toBe('agent.noTree')
  })

  it('drive with nothing open, and Stop refuses them', async () => {
    const held = host()
    const around = shell(held.view)
    expect((await handle(call('scope.create', { parent: '', name: 'Rail' }), undefined, around)).ok).toBe(true)
    expect(around.driving.current().session).toMatchObject({ client: 'Claude Code', calls: 1 })
    around.driving.end('person')
    expect(refusal(await handle(call('scope.remove', { path: 'rail' }), undefined, around))).toBe('agent.stopped')
    expect(held.asked).toHaveLength(1)
  })

  it('are answered with a scope open too, and no batch holds one', async () => {
    const held = host()
    let model = fromArrays({ name: 'Acme', elements: [], relations: [], diagrams: [] })
    const session: SessionView = {
      indexed: () => model,
      current: () => toArrays(model),
      activeDiagramId: () => '',
      scopePath: () => 'acme',
      ancestorDecisions: () => [],
      blocked: () => undefined,
      dispatch: () => { model = fromArrays(toArrays(model)); return toArrays(model) },
      ids: idPolicy(() => []),
      makeId: (prefix) => `${prefix}-1`,
      today: () => '2026-10-18',
      translate: DEFAULT_TRANSLATE,
      containerName: (name) => name,
      revision: () => 0,
      history: () => [],
      undo: () => {},
      images: () => [],
      addImage: () => {},
      save: () => Promise.resolve(),
    }
    expect(parsed(await handle(call('scope.create', { parent: 'acme', name: 'Rail' }), session, shell(held.view))).path).toBe('acme/rail')
    const batched = await handle(call('batch', { steps: [{ tool: 'scope.create', args: { parent: '', name: 'Yard' } }] }), session, shell(held.view))
    expect(refusal(batched)).toBe('agent.badArguments')
    expect(held.asked).toHaveLength(1)
  })
})

/**
 * What the tree contradicts about itself (ADR-0012 §9).
 *
 * The property that matters most is the one a list of assertions can hide: a
 * tree with five faults in it fires exactly those five and nothing else. A
 * check that is nearly right — one that calls every declaration stale, or
 * every cross-scope row dangling — passes a test per check and drowns the real
 * findings on the first organisation big enough to have any. So the first test
 * below builds one tree with one of each and reads the whole answer.
 */
import { describe, expect, it } from 'vitest'
import { translator } from '../i18n'
import { laidOut } from '../model/testFixtures'
import type { DesignElement, Relation } from '../model'
import type { HostModel } from '../model/hostModel'
import {
  documentFindings, findingSentence, findingsByScope, identityFindings, offeredBeyond, OWNER_DETAIL, scopeFindings, tally,
} from './checks'
import { indexScopes } from './scopeIndex'
import type { ScopeModel } from './scope'

function element(id: string, over: Partial<DesignElement> = {}): DesignElement {
  return {
    id, kind: 'application', name: id, lifecycle: 'live', isManaged: false, aspects: {}, ...over,
  }
}

const standIn = (id: string, ref: string, over: Partial<DesignElement> = {}) =>
  element(id, { ref, ...over })

function scope(path: string, elements: DesignElement[], relations: Relation[] = []): ScopeModel {
  return { path, model: { elements, relations } }
}

function document(over: Partial<HostModel> = {}): HostModel {
  return {
    name: 'A landscape', elements: [], relations: [],
    diagrams: [laidOut({ id: 'l7', kind: 'layer7', name: 'L7', placements: [] })],
    ...over,
  }
}

const keys = (findings: readonly { key: string }[]) => [...new Set(findings.map((f) => f.key))].sort()

describe('the checks over a tree with one of each', () => {
  /**
   * A conflict (`erp`, two domains at the same depth), a drifting stand-in
   * (`wms` in legal, cached under the old name), a dangling one (`crm`, which
   * nobody defines), a proposal (`returns`, a function retail named and the
   * organisation never did), and an unattributed outsider (`post`, outside
   * with nobody said to own it). Nothing else in it is a fault.
   */
  const tree: ScopeModel[] = [
    scope('', [
      element('fulfilment', { kind: 'function', name: 'Fulfilment' }),
      element('customers', { kind: 'actor', name: 'Customers' }),
    ]),
    scope('acme/retail', [
      element('erp', { name: 'Retail ERP' }),
      element('wms', { name: 'Warehouse' }),
      element('returns', { kind: 'function', name: 'Returns' }),
      standIn('fulfilment', '', { kind: 'function', name: 'Fulfilment' }),
      element('post', { name: 'The post office', outside: true }),
    ]),
    scope('acme/finance', [
      element('erp', { name: 'Finance ERP' }),
      standIn('wms', 'acme/retail', { name: 'Warehouse' }),
    ]),
    scope('acme/legal', [
      standIn('wms', 'acme/retail', { name: 'The old name' }),
      standIn('crm', 'acme/sales', { name: 'CRM' }),
    ]),
  ]

  const index = indexScopes(tree)

  it('fires exactly the four the index can see, and no other', () => {
    expect(keys(identityFindings(index)))
      .toEqual(['check.conflict', 'check.dangling', 'check.drift', 'check.proposal'])
  })

  it('puts the conflict on both scopes, each naming the other', () => {
    const conflicts = identityFindings(index).filter((f) => f.key === 'check.conflict')
    expect(conflicts.map((f) => f.scope).sort()).toEqual(['acme/finance', 'acme/retail'])
    expect(conflicts.find((f) => f.scope === 'acme/retail')?.scopes).toEqual(['acme/finance'])
  })

  it('names the scope whose cache is stale, and the master it should follow', () => {
    const drift = identityFindings(index).filter((f) => f.key === 'check.drift')
    expect(drift).toEqual([
      { key: 'check.drift', scope: 'acme/legal', id: 'wms', name: 'Warehouse', scopes: ['acme/retail'] },
    ])
  })

  it('calls the stand-in nobody defines dangling, and says where it is drawn', () => {
    const dangling = identityFindings(index).filter((f) => f.key === 'check.dangling')
    expect(dangling).toEqual([
      { key: 'check.dangling', scope: 'acme/legal', id: 'crm', name: 'CRM' },
    ])
  })

  /**
   * A function a domain named that no ancestor has. It is shown on the
   * organisation's sheet as not yet modelled at that level — a conversation,
   * not a fault — and a domain REFINING one the organisation named (a
   * stand-in with children) is not one.
   */
  it('calls a domain function nobody above named a proposal, and a refinement nothing', () => {
    const proposals = identityFindings(index).filter((f) => f.key === 'check.proposal')
    expect(proposals.map((f) => f.id)).toEqual(['returns'])
  })

  it('finds the outsider nobody has said whose it is, in the scope that holds it', () => {
    const findings = documentFindings({
      scope: 'acme/retail',
      model: document({ elements: tree[1].model.elements as DesignElement[] }),
      index,
    })
    expect(findings.filter((f) => f.key === 'check.unattributed').map((f) => f.id)).toEqual(['post'])
  })

  /**
   * The Done-when of the stretch this arrived in: a hand-built tree with a
   * conflict, a drifting stand-in, a dangling one, a proposal and an
   * unattributed outsider fires exactly those five and no other. Every master
   * is drawn on its own scope's board, so the one piece of information this
   * module can produce stays quiet and the answer is five findings' worth of
   * faults.
   */
  it('fires exactly those five over the whole tree, and nothing else', () => {
    const everything = tree.flatMap((held) => scopeFindings({
      scope: held.path,
      model: document({
        elements: held.model.elements as DesignElement[],
        diagrams: [laidOut({
          id: 'l7', kind: 'layer7', name: 'L7',
          placements: held.model.elements.map((e, at) => ({ id: e.id, x: at * 10, y: 0 })),
        })],
      }),
      index,
    }))
    expect(keys(everything)).toEqual([
      'check.conflict', 'check.dangling', 'check.drift', 'check.proposal', 'check.unattributed',
    ])
  })

  it('groups the whole answer by the scope it is about', () => {
    const byScope = findingsByScope(identityFindings(index))
    expect([...byScope.keys()].sort()).toEqual(['acme/finance', 'acme/legal', 'acme/retail'])
    expect(tally(byScope.get('acme/legal') ?? [])).toEqual({ 'check.drift': 1, 'check.dangling': 1 })
  })
})

describe('what is NOT a finding', () => {
  it('does not call an outsider attributed to somebody unattributed', () => {
    const index = indexScopes([scope('retail', [])])
    const model = document({
      elements: [
        element('customers', { kind: 'actor' }),
        element('post', { outside: true, partyId: 'customers' }),
      ],
    })
    expect(documentFindings({ scope: 'retail', model, index })
      .filter((f) => f.key === 'check.unattributed')).toEqual([])
  })

  /**
   * `partyId` says which ACTOR a thing belongs to, so an outside actor is the
   * party rather than a thing missing one. Customers and Regulators on a
   * stakeholder rail are outside by definition, and a finding on each of them
   * would be the whole rail underlined in orange on the day it was drawn.
   */
  it('does not ask an outside actor which actor it belongs to', () => {
    const index = indexScopes([scope('retail', [])])
    const model = document({
      elements: [
        element('customers', { kind: 'actor', outside: true }),
        element('post', { outside: true }),
      ],
    })
    expect(documentFindings({ scope: 'retail', model, index })
      .filter((f) => f.key === 'check.unattributed').map((f) => f.id)).toEqual(['post'])
  })

  /**
   * A row reaching into another domain is what organisation-wide ids are FOR
   * (§5). Only an end nobody in the tree holds is a dangling one.
   */
  it('does not call a row into another domain a dangling end', () => {
    const index = indexScopes([
      scope('retail', [element('wms')]),
      scope('finance', [element('ledger')]),
    ])
    const model = document({
      elements: [element('wms')],
      relations: [
        { id: 'r1', type: 'flow', sourceId: 'wms', targetId: 'ledger' },
        { id: 'r2', type: 'flow', sourceId: 'wms', targetId: 'nobody' },
        { id: 'r3', type: 'hostedOn', sourceId: 'wms', targetId: 'no-cluster' },
      ],
    })
    const findings = documentFindings({ scope: 'retail', model, index })
      .filter((f) => f.key === 'check.danglingEnd')
    expect(findings).toHaveLength(2)
    expect(findings[0]).toMatchObject({ id: 'r2', fields: ['nobody'] })
    expect(findings[1]).toMatchObject({ id: 'r3', fields: ['no-cluster'] })
  })

  it('does not call the root proposing something a proposal, nor an agreeing declaration stale', () => {
    const index = indexScopes([scope('', [element('returns', { kind: 'function' })])])
    expect(identityFindings(index).filter((f) => f.key === 'check.proposal')).toEqual([])
    const index2 = indexScopes([
      scope('', [element('erp', { name: 'ERP' })]),
      scope('retail', [element('erp', { name: 'ERP' })]),
    ])
    expect(identityFindings(index2).filter((f) => f.key === 'check.drift')).toEqual([])
  })

})

describe('the owner\'s detail on a stand-in', () => {
  const index = indexScopes([
    scope('acme/retail', [element('erp', { name: 'ERP' })]),
    scope('acme/finance', [standIn('erp', 'acme/retail', { name: 'ERP' })]),
  ])

  /**
   * Reported rather than stripped on save (§3): somebody wrote it, and a file
   * quietly losing fields is worse than a line saying which scope answers for
   * them.
   */
  it('names every field of it that was written down, and who answers for them', () => {
    const model = document({
      elements: [standIn('erp', 'acme/retail', {
        name: 'ERP', vendor: 'Someone', lifecycle: 'retiring', owner: 'A team',
      })],
    })
    expect(documentFindings({ scope: 'acme/finance', model, index })[0]).toEqual({
      key: 'check.ownedElsewhere', scope: 'acme/finance', id: 'erp', name: 'ERP',
      fields: ['lifecycle', 'owner', 'vendor'], scopes: ['acme/retail'],
    })
  })

  /**
   * `lifecycle`, `isManaged` and `aspects` are required on the type, so every
   * record read back from a file carries them and their presence says nothing.
   * A stand-in reported for having a lifecycle at all would be every stand-in
   * in every tree.
   */
  it('says nothing about the three fields every record carries, and leaves a stand-in its own view', () => {
    const model = document({ elements: [standIn('erp', 'acme/retail', { name: 'ERP' })] })
    expect(documentFindings({ scope: 'acme/finance', model, index })).toEqual([])
    // Its own perspective and its own presentation stay its own.
    const withView = document({
      elements: [standIn('erp', 'acme/retail', {
        name: 'ERP', description: 'What it means to us.', accentColor: '#c0392b', parentId: 'x',
      })],
    })
    expect(documentFindings({ scope: 'acme/finance', model: withView, index })).toEqual([])
  })

  it('lists the owner\'s detail once, for both readers of it', () => {
    // `mayEdit` refuses exactly these, and a field in one list and not the
    // other is a field the inspector greys out and the agent accepts.
    expect([...OWNER_DETAIL]).toContain('lifecycleDates')
    expect([...OWNER_DETAIL]).not.toContain('description')
  })
})

describe('a master drawn nowhere', () => {
  const index = indexScopes([scope('retail', [element('erp'), element('wms')])])

  it('is information, not a fault, and only about this scope\'s own masters', () => {
    const model = document({
      elements: [element('erp'), element('wms')],
      diagrams: [laidOut({
        id: 'l7', kind: 'layer7', name: 'L7', placements: [{ id: 'erp', x: 0, y: 0 }],
      })],
    })
    const findings = documentFindings({ scope: 'retail', model, index })
      .filter((f) => f.key === 'check.notDrawn')
    expect(findings).toEqual([
      { key: 'check.notDrawn', scope: 'retail', id: 'wms', name: 'wms', information: true },
    ])
  })

  it('says nothing about a stand-in nobody drew: it is not this scope\'s to draw', () => {
    const tree = indexScopes([
      scope('retail', [element('erp')]),
      scope('finance', [standIn('erp', 'retail')]),
    ])
    const model = document({ elements: [standIn('erp', 'retail')] })
    expect(documentFindings({ scope: 'finance', model, index: tree })).toEqual([])
  })
})

describe('the business layer\'s two, handed in', () => {
  it('reports what the caller worked out, named from whichever model holds it', () => {
    const index = indexScopes([scope('', [element('fulfilment', { kind: 'function', name: 'Fulfilment' })])])
    const model = document({ elements: [element('fulfilment', { kind: 'function', name: 'Fulfilment' })] })
    const findings = documentFindings({
      scope: '', model, index, business: { unmapped: ['fulfilment'], uncovered: ['fulfilment'] },
    })
    expect(findings.map((f) => f.key)).toEqual(['check.notDrawn', 'check.unmapped', 'check.uncovered'])
    expect(findings[1].name).toBe('Fulfilment')
  })
})

describe('every finding about one scope', () => {
  it('is the tree\'s about it, then its own document\'s', () => {
    const index = indexScopes([
      scope('retail', [element('erp')]),
      scope('finance', [element('erp'), element('post', { outside: true })]),
    ])
    const model = document({
      elements: [element('erp'), element('post', { outside: true })],
      diagrams: [laidOut({
        id: 'l7', kind: 'layer7', name: 'L7',
        placements: [{ id: 'erp', x: 0, y: 0 }, { id: 'post', x: 10, y: 0 }],
      })],
    })
    expect(keys(scopeFindings({ scope: 'finance', model, index })))
      .toEqual(['check.conflict', 'check.unattributed'])
  })
})

/**
 * An offering nobody marked shared (ADR-0014). The maintainer is an
 * `assigned` row in the platform scope; the consumers are `uses` rows in the
 * landscapes; whose an application is comes from `partyId`. A value somebody
 * typed wins, and where nobody typed one the rows still say.
 */
describe('a service offered beyond its team', () => {
  const row = (id: string, type: Relation['type'], sourceId: string, targetId: string): Relation =>
    ({ id, type, sourceId, targetId })
  const tree = (over: { shared?: true; assignedTo?: string } = {}): ScopeModel[] => [
    scope('', [
      element('platform-team', { kind: 'actor', name: 'Platform team' }),
      element('warehouse-team', { kind: 'actor', name: 'Warehouse team' }),
    ]),
    scope('platforms', [
      element('containers', { kind: 'platformService', name: 'Container platform', ...(over.shared ? { shared: true } : {}) }),
      element('openshift', { kind: 'platform', name: 'OpenShift' }),
    ], over.assignedTo === '' ? [] : [row('a1', 'assigned', over.assignedTo ?? 'platform-team', 'containers')]),
    scope('warehouse', [
      element('wms', { name: 'WMS', partyId: 'warehouse-team' }),
      element('wms-api', { kind: 'component', parentId: 'wms', name: 'WMS API' }),
      element('tooling', { name: 'Tooling', partyId: 'platform-team' }),
      element('nobodys', { name: 'Nobody said whose' }),
      standIn('containers', 'platforms', { kind: 'platformService', name: 'Container platform' }),
    ], [
      row('u1', 'uses', 'wms-api', 'containers'),
      row('u2', 'uses', 'tooling', 'containers'),
      row('u3', 'uses', 'nobodys', 'containers'),
    ]),
  ]

  it('names the consumers whose team is another actor, a container by its application, and nobody else', () => {
    const { maintainers, outside } = offeredBeyond(indexScopes(tree()), 'containers')
    expect(maintainers).toEqual(['platform-team'])
    // The platform team's own tooling is within; an application nobody has
    // said whose is neither, because the tree cannot say.
    expect(outside).toEqual([{ id: 'wms', name: 'WMS', partyId: 'warehouse-team' }])
  })

  it('is a finding on the service, in the scope that answers for it, naming the consumer', () => {
    const found = identityFindings(indexScopes(tree())).filter((f) => f.key === 'check.offeredNotShared')
    expect(found).toEqual([{
      key: 'check.offeredNotShared', scope: 'platforms', id: 'containers', name: 'Container platform',
      fields: ['wms'], detail: 'WMS',
    }])
  })

  it('is not a finding once somebody has ticked shared, and a shared service with no takers is not one either', () => {
    expect(keys(identityFindings(indexScopes(tree({ shared: true }))))).toEqual([])
    const unused = tree({ shared: true })
    unused[2].model.relations = []
    expect(keys(identityFindings(indexScopes(unused)))).toEqual([])
  })

  it('says nothing where no maintainer is named, and judges by whoever the maintainer is', () => {
    expect(offeredBeyond(indexScopes(tree({ assignedTo: '' })), 'containers').outside).toEqual([])
    expect(keys(identityFindings(indexScopes(tree({ assignedTo: '' }))))).toEqual([])
    // Maintained by the warehouse team instead: the WMS is within, and the
    // platform team's tooling is the one from outside.
    expect(offeredBeyond(indexScopes(tree({ assignedTo: 'warehouse-team' })), 'containers').outside.map((one) => one.id))
      .toEqual(['tooling'])
  })
})

/**
 * One finding as words: the table's sentence with the record's name, the
 * other scope it names as the caller calls it, and the detail where there is
 * one — so the register, the technology page and the organisation screen all
 * say the same sentence.
 */
describe('findingSentence', () => {
  const s = translator('en')
  const scopeName = (path: string) => (path === '' ? 'the organisation' : path.toUpperCase())

  it('fills the name, the scope as the caller names it, and the detail', () => {
    expect(findingSentence({ key: 'check.conflict', scope: 'retail', id: 'erp', name: 'ERP', scopes: ['finance'] }, s, scopeName))
      .toBe('ERP is also defined in FINANCE')
    expect(findingSentence({ key: 'check.offeredNotShared', scope: 'p', id: 'b', name: 'Brokering', detail: 'WMS' }, s, scopeName))
      .toBe('Brokering is used by WMS, beyond the team that maintains it, and is not marked shared')
  })

  it('names the organisation where a finding names no other scope', () => {
    expect(findingSentence({ key: 'check.ownedElsewhere', scope: 'retail', id: 'x', name: 'X' }, s, scopeName))
      .toBe('the organisation answers for this')
  })
})

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
import { laidOut } from '../model/testFixtures'
import type { DesignElement, Relation } from '../model'
import type { HostModel } from '../model/fromInterchange'
import {
  documentFindings, findingsByScope, identityFindings, OWNER_DETAIL, scopeFindings, tally,
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
      ],
    })
    const findings = documentFindings({ scope: 'retail', model, index })
      .filter((f) => f.key === 'check.danglingEnd')
    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ id: 'r2', fields: ['nobody'] })
  })

  it('does not call the root proposing something a proposal', () => {
    const index = indexScopes([scope('', [element('returns', { kind: 'function' })])])
    expect(identityFindings(index).filter((f) => f.key === 'check.proposal')).toEqual([])
  })

  it('does not call a declaration that agrees with its master stale', () => {
    const index = indexScopes([
      scope('', [element('erp', { name: 'ERP' })]),
      scope('retail', [element('erp', { name: 'ERP' })]),
    ])
    expect(identityFindings(index).filter((f) => f.key === 'check.drift')).toEqual([])
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
  it('says nothing about the three fields every record carries by default', () => {
    const model = document({ elements: [standIn('erp', 'acme/retail', { name: 'ERP' })] })
    expect(documentFindings({ scope: 'acme/finance', model, index })).toEqual([])
  })

  it('leaves a stand-in its perspective and its presentation', () => {
    const model = document({
      elements: [standIn('erp', 'acme/retail', {
        name: 'ERP', description: 'What it means to us.', accentColor: '#c0392b', parentId: 'x',
      })],
    })
    expect(documentFindings({ scope: 'acme/finance', model, index })).toEqual([])
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

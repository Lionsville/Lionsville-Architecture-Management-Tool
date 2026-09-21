/**
 * The technology register, derived (ADR-0014 §2.6).
 *
 * Nothing here is stored, so what is pinned is that every number on the page
 * and on the card comes from the one index the shell already holds — and
 * that a platform's roll-up walks the tree, since that is the reason the
 * register exists beside the platform scope's own list.
 */
import { describe, expect, it } from 'vitest'
import type { DesignElement, Relation } from '../../model'
import { identityFindings } from '../../projects/checks'
import { indexScopes } from '../../projects/scopeIndex'
import type { ScopeModel } from '../../projects/scope'
import {
  matchingTechnology, sortTechnology, technologyRows, technologySummary, technologyWithin,
} from './technologyRegister'

function element(id: string, over: Partial<DesignElement> = {}): DesignElement {
  return { id, kind: 'application', name: id, lifecycle: 'live', isManaged: false, aspects: {}, ...over }
}
const row = (id: string, type: Relation['type'], sourceId: string, targetId: string): Relation =>
  ({ id, type, sourceId, targetId })
const scope = (path: string, elements: DesignElement[], relations: Relation[] = []): ScopeModel =>
  ({ path, model: { elements, relations } })

/**
 * One of everything the register draws: a shared service realised by a
 * cluster; a service offered across a team boundary and not marked; a service
 * nothing realises; a platform under a platform, hosting through it; a
 * platform outside the organisation; and a service the warehouse keeps for
 * itself.
 */
function tree(): ScopeModel[] {
  return [
    scope('', [
      element('platform-team', { kind: 'actor', name: 'Platform team' }),
      element('warehouse-team', { kind: 'actor', name: 'Warehouse team' }),
    ]),
    scope('platforms', [
      element('containers', { kind: 'platformService', name: 'Container platform', shared: true }),
      element('brokering', { kind: 'platformService', name: 'Message brokering' }),
      element('identity', { kind: 'platformService', name: 'Identity', shared: true }),
      element('account', { kind: 'platform', name: 'Cloud account', outside: true, partyId: 'platform-team', platformArchetype: 'place' }),
      element('openshift', { kind: 'platform', name: 'OpenShift', parentId: 'account', platformArchetype: 'place' }),
      element('ns', { kind: 'platform', name: 'Namespace', parentId: 'openshift', platformArchetype: 'place' }),
      element('kafka', { kind: 'platform', name: 'Event broker' }),
    ], [
      row('a1', 'assigned', 'platform-team', 'containers'),
      row('a2', 'assigned', 'platform-team', 'brokering'),
      row('a3', 'assigned', 'platform-team', 'identity'),
      row('r1', 'realises', 'openshift', 'containers'),
      row('r2', 'realises', 'kafka', 'brokering'),
    ]),
    scope('warehouse', [
      element('wms', { name: 'WMS', partyId: 'warehouse-team' }),
      element('wms-api', { kind: 'component', parentId: 'wms', name: 'WMS API' }),
      element('labels', { kind: 'platformService', name: 'Label printing' }),
      element('containers', { kind: 'platformService', name: 'Container platform', ref: 'platforms' }),
      element('brokering', { kind: 'platformService', name: 'Message brokering', ref: 'platforms' }),
      element('ns', { kind: 'platform', name: 'Namespace', ref: 'platforms' }),
    ], [
      row('a4', 'assigned', 'warehouse-team', 'labels'),
      row('u1', 'uses', 'wms-api', 'containers'),
      row('u2', 'uses', 'wms', 'brokering'),
      row('u3', 'uses', 'wms', 'labels'),
      row('h1', 'hostedOn', 'wms-api', 'ns'),
    ]),
    scope('sales', [
      element('crm', { name: 'CRM', partyId: 'warehouse-team' }),
      element('containers', { kind: 'platformService', name: 'Container platform', ref: 'platforms' }),
      element('openshift', { kind: 'platform', name: 'OpenShift', ref: 'platforms' }),
    ], [
      row('u4', 'uses', 'crm', 'containers'),
      row('h2', 'hostedOn', 'crm', 'openshift'),
    ]),
  ]
}

const index = () => indexScopes(tree())
const rows = () => technologyRows(index(), identityFindings(index()))
const one = (id: string) => rows().find((row) => row.id === id)!

describe('technologyRows', () => {
  it('is every service and platform in the tree, by name, and nothing else', () => {
    expect(rows().map((row) => [row.id, row.kind])).toEqual([
      ['account', 'platform'], ['containers', 'platformService'], ['kafka', 'platform'], ['identity', 'platformService'],
      ['labels', 'platformService'], ['brokering', 'platformService'], ['ns', 'platform'], ['openshift', 'platform'],
    ])
  })

  it('says of a service who maintains it, whether it is shared, who consumes it and what realises it', () => {
    expect(one('containers')).toMatchObject({
      master: 'platforms', drawnIn: ['sales', 'warehouse'], shared: true,
      maintainers: [{ id: 'platform-team', name: 'Platform team' }],
      // The WMS by its container, and the CRM: two applications, two scopes.
      consumers: { applications: 2, scopes: 2 },
      realisedBy: [{ id: 'openshift', name: 'OpenShift' }],
      findings: [],
    })
    // Offered across a team boundary and not marked: the finding rides on the row.
    expect(one('brokering').findings.map((finding) => finding.key)).toEqual(['check.offeredNotShared'])
    // Nothing realises the identity service: a real gap, said by an empty list.
    expect(one('identity').realisedBy).toEqual([])
    // The warehouse's own, consumed only within its team.
    expect(one('labels')).toMatchObject({ master: 'warehouse', consumers: { applications: 1, scopes: 1 }, findings: [] })
    expect(one('labels').shared).toBeUndefined()
  })

  it('says of a platform what it is, what it realises, what it hosts with everything under it, and the service it belongs to', () => {
    expect(one('openshift')).toMatchObject({
      platformArchetype: 'place', realises: [{ id: 'containers', name: 'Container platform' }],
      partOf: { id: 'account', name: 'Cloud account' }, service: { id: 'containers', name: 'Container platform' },
    })
    // The cluster hosts what its namespace hosts (ADR-0014 §2.7), and the account hosts all of it.
    expect(one('openshift').hosts).toBe(2)
    expect(one('ns')).toMatchObject({ hosts: 1, partOf: { id: 'openshift' }, service: { id: 'containers' }, realises: [] })
    expect(one('account')).toMatchObject({ hosts: 2, outside: true, party: 'Platform team' })
    expect(one('kafka')).toMatchObject({ platformArchetype: 'service', realises: [{ id: 'brokering', name: 'Message brokering' }], hosts: 0 })
    expect(one('kafka').partOf).toBeUndefined()
  })
})

describe('technologySummary', () => {
  it('counts what the card says and the page repeats', () => {
    expect(technologySummary(rows())).toEqual({
      services: 4, platforms: 4, shared: 2, offeredNotShared: 1, unrealised: 2, definedTwice: 0, stale: 0,
    })
  })

  it('is all zeroes over an organisation with nothing in it', () => {
    expect(technologySummary([])).toEqual({ services: 0, platforms: 0, shared: 0, offeredNotShared: 0, unrealised: 0, definedTwice: 0, stale: 0 })
  })
})

describe('the filter, the order and the part a scope can speak for', () => {
  it('finds by name, by id, by the scope that answers and by the maintainer', () => {
    expect(matchingTechnology(rows(), 'broker').map((row) => row.id)).toEqual(['kafka', 'brokering'])
    expect(matchingTechnology(rows(), 'warehouse').map((row) => row.id)).toEqual(['labels'])
    expect(matchingTechnology(rows(), 'platform team').length).toBe(3)
  })

  it('puts the services first by kind, and groups by scope with the ones nobody defines last', () => {
    expect(sortTechnology(rows(), 'kind').map((row) => row.kind)).toEqual([
      'platformService', 'platformService', 'platformService', 'platformService', 'platform', 'platform', 'platform', 'platform',
    ])
    const dangling = [...rows(), { ...one('kafka'), id: 'ghost', name: 'Ghost', master: undefined }]
    expect(sortTechnology(dangling, 'scope').map((row) => row.id).at(-1)).toBe('ghost')
    expect(sortTechnology(dangling, 'scope')[0].master).toBe('platforms')
  })

  it('is all of it at the root, and what a scope answers for or draws elsewhere', () => {
    expect(technologyWithin(rows(), '').length).toBe(8)
    expect(technologyWithin(rows(), 'warehouse').map((row) => row.id)).toEqual(['containers', 'labels', 'brokering', 'ns'])
    expect(technologyWithin(rows(), 'sales').map((row) => row.id)).toEqual(['containers', 'openshift'])
  })
})

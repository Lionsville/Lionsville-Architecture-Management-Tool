/**
 * The register, derived (ADR-0012 §2).
 *
 * Nothing here is stored, so what is pinned is that every number on the page
 * and on the card comes from the one index the shell already holds — and that
 * the two agree, because they are the same arithmetic.
 */
import { describe, expect, it } from 'vitest'
import type { DesignElement } from '../../model'
import { identityFindings } from '../../projects/checks'
import { indexScopes } from '../../projects/scopeIndex'
import type { ScopeModel } from '../../projects/scope'
import { isUnattributed, matchingRows, registerRows, registerSummary, registerWithin, sortRows } from './register'

function element(id: string, over: Partial<DesignElement> = {}): DesignElement {
  return {
    id, kind: 'application', name: id, lifecycle: 'live', isManaged: false, aspects: {}, ...over,
  }
}

const scope = (path: string, elements: DesignElement[]): ScopeModel =>
  ({ path, model: { elements, relations: [] } })

/**
 * One of everything the register draws: an application owned by a domain, one
 * the organisation declares and a domain owns, one outside with a party, one
 * outside with none, one nobody defines, and one defined twice at the same
 * depth.
 */
function tree(): ScopeModel[] {
  return [
    scope('', [
      element('wms', { name: 'WMS' }),
      element('erp', { name: 'ERP' }),
      element('carrier', { kind: 'actor', name: 'Carrier' }),
    ]),
    scope('rail', [
      element('wms', { name: 'Rail WMS' }),
      element('post', { name: 'Post office', outside: true, partyId: 'carrier' }),
      element('customs', { name: 'Customs', outside: true }),
      element('ghost', { name: 'Ghost', ref: 'nowhere' }),
      element('erp', { name: 'Old name', ref: '' }),
    ]),
    scope('road', [element('wms', { name: 'Road WMS' })]),
  ]
}

const index = () => indexScopes(tree())
const rows = () => registerRows(index(), identityFindings(index()))

describe('registerRows', () => {
  it('is every application in the tree, by name, and no actor', () => {
    expect(rows().map((row) => row.name))
      .toEqual(['Customs', 'ERP', 'Ghost', 'Post office', 'Rail WMS'])
  })

  it('says who answers for each, and names the party rather than keying it', () => {
    const found = rows()
    expect(found.find((row) => row.id === 'erp')).toMatchObject({ master: '' })
    expect(found.find((row) => row.id === 'post')).toMatchObject({ outside: true, party: 'Carrier' })
    expect(found.find((row) => row.id === 'ghost')?.master).toBeUndefined()
  })

  it('carries the findings about each row', () => {
    const found = rows()
    // One of each kind: the conflict is a finding on both scopes, and the
    // register is about the application rather than about a scope.
    expect(found.find((row) => row.id === 'wms')?.findings.map((one) => one.key))
      .toEqual(['check.conflict', 'check.drift'])
    expect(found.find((row) => row.id === 'ghost')?.findings.map((one) => one.key))
      .toEqual(['check.dangling'])
    expect(found.find((row) => row.id === 'erp')?.findings.map((one) => one.key))
      .toEqual(['check.drift'])
  })

  /** A gap the tool shows rather than a state it stores. */
  it('knows an outsider nobody has said whose it is', () => {
    const found = rows()
    expect(isUnattributed(found.find((row) => row.id === 'customs')!)).toBe(true)
    expect(isUnattributed(found.find((row) => row.id === 'post')!)).toBe(false)
  })
})

describe('registerSummary', () => {
  it('counts what the card says and the page repeats', () => {
    expect(registerSummary(rows())).toEqual({
      applications: 5,
      ownedByADomain: 3,
      outside: 2,
      definedTwice: 1,
      unattributed: 1,
      stale: 2,
    })
  })

  it('is all zeroes over an organisation with nothing in it', () => {
    expect(registerSummary(registerRows(indexScopes([])))).toMatchObject({ applications: 0 })
  })
})

describe('the filter and the order', () => {
  it('finds by name, by id and by the scope that answers for it', () => {
    expect(matchingRows(rows(), 'post').map((row) => row.id)).toEqual(['post'])
    expect(matchingRows(rows(), 'customs').map((row) => row.id)).toEqual(['customs'])
    expect(matchingRows(rows(), '   ').map((row) => row.id)).toHaveLength(5)
  })

  it('groups by scope with the ones nobody defines last', () => {
    expect(sortRows(rows(), 'scope').map((row) => row.master))
      .toEqual(['', 'rail', 'rail', 'rail', undefined])
  })
})

describe('the part of the register a scope can speak for', () => {
  const rows = registerRows(indexScopes(tree()), identityFindings(indexScopes(tree())))

  it('is all of it at the root, because everything is within the root', () => {
    expect(registerWithin(rows, '').map((row) => row.id)).toEqual(rows.map((row) => row.id))
  })

  it('is what a domain answers for or draws, and nothing that only its neighbour has', () => {
    const rail = registerWithin(rows, 'rail').map((row) => row.id).sort()
    expect(rail).toContain('wms')
    expect(rail).toContain('post')
    expect(rail).toContain('customs')
    for (const id of rail) {
      const row = rows.find((one) => one.id === id)!
      expect(
        (row.master ?? 'nobody').startsWith('rail') || row.drawnIn.some((path) => path.startsWith('rail')),
      ).toBe(true)
    }
  })
})

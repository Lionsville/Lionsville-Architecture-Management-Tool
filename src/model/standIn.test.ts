/**
 * What a stand-in may carry (ADR-0012 §3).
 *
 * One list serves three modules — the checks report these fields, `mayEdit`
 * refuses them, and `element.link` drops them — so what is pinned here is the
 * list itself and the two answers derived from it.
 */
import { describe, expect, it } from 'vitest'
import { asStandIn, isLinked, OWNER_DETAIL } from './standIn'
import type { DesignElement } from './types'

const full = (): DesignElement => ({
  id: 'erp',
  kind: 'application',
  name: 'Our ERP',
  description: 'What the ERP means to us',
  parentId: 'platform',
  order: 2,
  iconKey: 'erp',
  accentColor: '#123456',
  category: 'Core',
  vendor: 'Initech',
  technology: 'Java',
  owner: 'Platform team',
  outside: true,
  partyId: 'supplier',
  scopes: ['retail'],
  successorId: 'erp-next',
  lifecycle: 'retiring',
  lifecycleDates: { retiring: '2026-01-01' },
  isManaged: true,
  aspects: { security: { status: 'partial' } },
})

describe('asStandIn', () => {
  const linked = asStandIn(full(), { name: 'ERP', ref: 'acme/retail' })

  it('takes the caches from the tree', () => {
    expect(linked.name).toBe('ERP')
    expect(linked.ref).toBe('acme/retail')
  })

  it('leaves nothing of the owner’s detail behind', () => {
    for (const field of OWNER_DETAIL) {
      expect(linked[field], field).toEqual(
        // The three every record carries are put back to what a record says
        // when it has nothing to say; the other nine are gone.
        field === 'lifecycle' ? 'live' : field === 'isManaged' ? false : field === 'aspects' ? {} : undefined,
      )
    }
  })

  /** The perspective, the presentation and this scope's own trees stay. */
  it('keeps what this scope answers for', () => {
    expect(linked).toMatchObject({
      description: 'What the ERP means to us',
      parentId: 'platform',
      order: 2,
      iconKey: 'erp',
      accentColor: '#123456',
      kind: 'application',
    })
  })
})

describe('isLinked', () => {
  const cache = { name: 'ERP', ref: 'acme/retail' }

  it('is true of exactly what asStandIn makes', () => {
    expect(isLinked(asStandIn(full(), cache), cache)).toBe(true)
  })

  it('is false while a cache disagrees', () => {
    expect(isLinked(asStandIn(full(), cache), { name: 'ERP', ref: 'acme/finance' })).toBe(false)
    expect(isLinked(full(), cache)).toBe(false)
  })

  /**
   * A stand-in still carrying the owner's detail is one a link has something
   * to do about — the checks report those fields, and a link that called
   * itself finished would leave a finding nothing could clear.
   */
  it('is false while the owner’s detail is still on the record', () => {
    const held = asStandIn(full(), cache)
    expect(isLinked({ ...held, vendor: 'Initech' }, cache)).toBe(false)
    expect(isLinked({ ...held, isManaged: true }, cache)).toBe(false)
    expect(isLinked({ ...held, aspects: { security: { status: 'partial' } } }, cache)).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import { coverageFor, coverageOf } from './coverage'
import { relation } from './testFixtures'

/**
 * The three answers of ADR-0012 §9, over one area's capabilities:
 * *picking* is done by two systems, *claims* is done by people, and
 * *forecasting* is done by nobody yet.
 */
const rows = () => [
  relation('s1', 'supports', 'wms', 'picking'),
  relation('s2', 'supports', 'scanner', 'picking'),
  relation('a1', 'assigned', 'clerk', 'picking'),
  relation('a2', 'assigned', 'claims-team', 'claims'),
  // Rows of other types are about other things and do not cover anything.
  relation('f1', 'flow', 'wms', 'scanner'),
  relation('r1', 'realises', 'pick-process', 'picking'),
]

describe('coverageOf', () => {
  it('counts the systems and the people behind one capability', () => {
    const found = coverageOf(rows()).get('picking')
    expect(found).toEqual({
      supportedBy: ['wms', 'scanner'],
      assignedTo: ['clerk'],
      coverage: 'covered',
    })
  })

  it('calls a capability that is only people MANUAL, which is an answer', () => {
    // Not a finding. A map that drew this red would be telling an organisation
    // to buy software for the thing it does by hand.
    expect(coverageOf(rows()).get('claims')).toMatchObject({
      supportedBy: [], assignedTo: ['claims-team'], coverage: 'manual',
    })
  })

  it('says nothing about a capability no row names', () => {
    expect(coverageOf(rows()).has('forecasting')).toBe(false)
  })

  it('counts an end this scope does not hold, rather than dropping it', () => {
    // A relation may name an id this scope holds only as a stand-in, or not at
    // all (ADR-0012 §5) — dropping it here would make a domain's own sheet say
    // its capabilities are uncovered.
    expect(coverageOf([relation('s', 'supports', 'somebody-elses-erp', 'picking')]).get('picking'))
      .toMatchObject({ supportedBy: ['somebody-elses-erp'], coverage: 'covered' })
  })

  it('reads the rows in one pass, not one pass per function', () => {
    const found = coverageOf(rows())
    expect([...found.keys()]).toEqual(['picking', 'claims'])
  })
})

describe('coverageFor', () => {
  it('answers UNCOVERED for a capability nothing and nobody does', () => {
    expect(coverageFor(rows(), 'forecasting')).toEqual({
      supportedBy: [], assignedTo: [], coverage: 'uncovered',
    })
  })

  it('answers the same thing the map does for one that is covered', () => {
    expect(coverageFor(rows(), 'picking').coverage).toBe('covered')
  })
})

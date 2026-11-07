// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** An application's owner as one field: a unit, or a name flagged as not one (ADR-0036, amended). */
import { describe, expect, it } from 'vitest'
import { conwayApplication, conwayMap } from './conway'
import { fromArrays } from './normalised'
import { applicationOwner, ownerPatch } from './ownerField'
import { apply } from './reducer'
import type { DesignElement } from './types'

const application = (over: Partial<DesignElement> = {}): DesignElement => ({
  id: 'billing', name: 'Billing', kind: 'application', lifecycle: 'live', isManaged: true, aspects: {}, ...over,
})
const model = (one: DesignElement) => fromArrays({ name: 'Acme', diagrams: [], elements: [one], relations: [] })

describe('reading older data', () => {
  it('says who owns it, off whichever key a record holds', () => {
    expect(applicationOwner({})).toEqual({ kind: 'none' })
    expect(applicationOwner({ owner: '  ' })).toEqual({ kind: 'none' })
    expect(applicationOwner({ partyId: 'team' })).toEqual({ kind: 'unit', unitId: 'team' })
    expect(applicationOwner({ owner: 'Revenue systems' })).toEqual({ kind: 'named', name: 'Revenue systems' })
    expect(applicationOwner({ owner: { person: 'pe-1' } })).toEqual({ kind: 'named', name: { person: 'pe-1' } })
  })

  it('takes the unit where a record holds both, and keeps what was written beside it', () => {
    expect(applicationOwner({ owner: 'Revenue systems', partyId: 'team' })).toEqual({ kind: 'unit', unitId: 'team', written: 'Revenue systems' })
  })
})

describe('setting it', () => {
  const land = (one: DesignElement, patch: Partial<DesignElement>) => {
    const result = apply(model(one), { type: 'element.update', id: one.id, patch })
    if (!result.ok) throw new Error(result.reason)
    return result
  }

  it('picking a unit clears a name, typing a name clears the unit, in the writer, so everybody gets the same field', () => {
    expect(land(application({ owner: 'Revenue systems' }), { partyId: 'team' }).model.elements.billing).toMatchObject({ partyId: 'team' })
    expect('owner' in land(application({ owner: 'Revenue systems' }), { partyId: 'team' }).model.elements.billing).toBe(false)
    const named = land(application({ partyId: 'team' }), { owner: 'Revenue systems' }).model.elements.billing
    expect(named.owner).toBe('Revenue systems')
    expect('partyId' in named).toBe(false)
  })

  it('undoes to exactly what an older record held, both keys included', () => {
    const start = application({ owner: 'Revenue systems', partyId: 'team' })
    const picked = land(start, { partyId: 'other' })
    const back = apply(picked.model, picked.inverse)
    if (!back.ok) throw new Error(back.reason)
    expect(back.model.elements.billing).toMatchObject({ owner: 'Revenue systems', partyId: 'team' })
  })

  it('clearing one half leaves the other alone, and clearing the field takes both', () => {
    const start = application({ owner: 'Revenue systems', partyId: 'team' })
    expect(land(start, { owner: undefined }).model.elements.billing).toMatchObject({ partyId: 'team' })
    const cleared = land(start, ownerPatch(undefined)).model.elements.billing
    expect(applicationOwner(cleared)).toEqual({ kind: 'none' })
  })

  it('leaves the other kinds their two keys', () => {
    const platform = application({ kind: 'platform', owner: 'Ops' })
    expect(land(platform, { partyId: 'team' }).model.elements.billing).toMatchObject({ owner: 'Ops', partyId: 'team' })
  })
})

describe('the check', () => {
  const findings = (one: DesignElement) => conwayMap({
    units: [], unitTypes: [], applications: [conwayApplication(one)], flows: [], interactions: [],
  }, '2026-11-07').findings

  it('finds nobody owning it only where nobody does, and flags a name apart', () => {
    expect(findings(application())).toEqual([{ kind: 'unowned', applicationId: 'billing' }])
    expect(findings(application({ owner: 'Revenue systems' }))).toEqual([{ kind: 'ownerNamed', applicationId: 'billing' }])
    expect(findings(application({ partyId: 'team' }))).toEqual([])
  })
})

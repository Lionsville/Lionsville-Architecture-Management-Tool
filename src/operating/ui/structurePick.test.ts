// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** What picking a unit type or a role on the structure lights, and what it dims. */
import { describe, expect, it } from 'vitest'
import type { UnitType } from '../../model/operatingModel'
import { pickLooks } from './structurePick'

const types: UnitType[] = [
  { id: 'domain', name: 'Domain', top: true, within: [], slots: [{ role: 'owner', min: 1, max: 1 }] },
  { id: 'cluster', name: 'Cluster', top: true, within: ['domain'], slots: [{ role: 'lead', min: 1, max: 1 }] },
  { id: 'team', name: 'Team', within: ['cluster'], slots: [{ role: 'po', min: 1, max: 1 }, { role: 'coach', min: 0, max: 1 }] },
  { id: 'guild', name: 'Guild', within: [], slots: [{ role: 'coach', min: 1, max: 1 }] },
]

describe('picking on the structure', () => {
  it('leaves everything plain where nothing is picked, or what is picked is not there', () => {
    for (const looks of [pickLooks(types, undefined), pickLooks(types, { kind: 'unitType', id: 'gone' })]) {
      expect(types.map((one) => looks.type(one.id))).toEqual(['plain', 'plain', 'plain', 'plain'])
      expect(looks.organisation).toBe('plain')
      expect(looks.role('po')).toBe('plain')
      expect(looks.line({ type: 'team', sitsIn: 'cluster' })).toBe('plain')
    }
  })

  it('lights where a type may sit, what may sit in it and its roles, and dims the rest', () => {
    const looks = pickLooks(types, { kind: 'unitType', id: 'cluster' })
    expect(types.map((one) => looks.type(one.id))).toEqual(['lit', 'picked', 'lit', 'dim'])
    expect(looks.organisation).toBe('lit')
    expect([looks.role('lead'), looks.role('po')]).toEqual(['lit', 'plain'])
    expect(looks.line({ type: 'cluster' })).toBe('lit')
    expect(looks.line({ type: 'team', sitsIn: 'cluster' })).toBe('lit')
    expect(looks.line({ type: 'domain' })).toBe('dim')
    // A type that may not sit at the top leaves the organisation dim.
    expect(pickLooks(types, { kind: 'unitType', id: 'team' }).organisation).toBe('dim')
  })

  it('lights the types that hold a picked role, and dims the rest with the organisation', () => {
    const looks = pickLooks(types, { kind: 'role', id: 'coach' })
    expect(types.map((one) => looks.type(one.id))).toEqual(['dim', 'dim', 'lit', 'lit'])
    expect(looks.organisation).toBe('dim')
    expect([looks.role('coach'), looks.role('po')]).toEqual(['picked', 'plain'])
    expect(looks.line({ type: 'team', sitsIn: 'cluster' })).toBe('plain')
  })
})

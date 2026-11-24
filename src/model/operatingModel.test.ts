// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import {
  accountabilityGaps, accountableFor, dutiesReplaced, dutiesWith, isOperatingRuleKind, isRaci, isResponsible, nextRaci, raciOf, raciSaid,
  responsibilityGroups, responsibleFor, settledDuty, settledRole, slotRange, typesHolding, RACI_LETTERS,
} from './operatingModel'
import type { Duty, Responsibility, Role, UnitType } from './operatingModel'

const role = (id: string, duties: Role['duties'] = []): Role => ({ id, name: id, duties })
const responsibility = (id: string, group?: string): Responsibility => ({ id, name: id, ...(group ? { group } : {}) })

describe('a role\'s duties', () => {
  it('says its part in a responsibility, or nothing', () => {
    const lead = role('lead', [{ responsibility: 'release', raci: 'A' }])
    expect(raciOf(lead, 'release')).toBe('A')
    expect(raciOf(lead, 'build')).toBeUndefined()
  })

  it('changes a part in place, adds a new one last, and takes one away', () => {
    const duties = [{ responsibility: 'a', raci: 'R' as const }, { responsibility: 'b', raci: 'C' as const }]
    expect(dutiesWith(duties, 'a', 'A')).toEqual([{ responsibility: 'a', raci: 'A' }, { responsibility: 'b', raci: 'C' }])
    expect(dutiesWith(duties, 'c', 'I')).toEqual([...duties, { responsibility: 'c', raci: 'I' }])
    expect(dutiesWith(duties, 'a', undefined)).toEqual([{ responsibility: 'b', raci: 'C' }])
    expect(dutiesWith(duties, 'z', undefined)).toEqual(duties)
    // The list handed in is left alone.
    expect(duties).toHaveLength(2)
  })

  it('cycles a cell through none, R, A, C, I and back to none', () => {
    const seen: (string | undefined)[] = []
    let at: ReturnType<typeof nextRaci> = undefined
    for (let step = 0; step < 5; step += 1) {
      at = nextRaci(at)
      seen.push(at)
    }
    expect(seen).toEqual(['R', 'A', 'C', 'I', undefined])
  })

  it('knows its own words', () => {
    expect(isRaci('A')).toBe(true)
    expect(isRaci('X')).toBe(false)
    expect(isOperatingRuleKind('applicationOwner')).toBe(true)
    expect(isOperatingRuleKind('owner')).toBe(false)
  })
})

describe('what a duty says beside its letter', () => {
  const full: Duty = { responsibility: 'a', raci: 'A', alsoResponsible: true, certainty: 'confirmed', source: 'Role book, page 4' }

  it('reads an A that is responsible too as A/R, among the responsible and once among the accountable', () => {
    expect(raciSaid(full)).toBe('A/R')
    expect(raciSaid({ raci: 'R', alsoResponsible: true })).toBe('R')
    expect(RACI_LETTERS.filter((raci) => isResponsible({ raci }))).toEqual(['R'])
    expect(isResponsible({ raci: 'C', alsoResponsible: true })).toBe(false)
    const roles = [role('both', [full]), role('does', [{ responsibility: 'a', raci: 'R' }]), role('owns', [{ responsibility: 'a', raci: 'A' }])]
    expect(responsibleFor(roles, 'a').map((one) => one.id)).toEqual(['both', 'does'])
    expect(accountableFor(roles, 'a').map((one) => one.id)).toEqual(['both', 'owns'])
  })

  it('keeps the source and drops the mark on another letter, unless the same change says one', () => {
    expect(dutiesWith([full], 'a', 'C')).toEqual([{ responsibility: 'a', raci: 'C', source: 'Role book, page 4' }])
    expect(dutiesWith([full], 'a', 'C', { certainty: 'assumed' }))
      .toEqual([{ responsibility: 'a', raci: 'C', certainty: 'assumed', source: 'Role book, page 4' }])
  })

  it('keeps everything on the same letter, and takes off what is said to go', () => {
    expect(dutiesWith([full], 'a', 'A')).toEqual([full])
    expect(dutiesWith([full], 'a', 'A', { alsoResponsible: false, certainty: null, source: ' ' })).toEqual([{ responsibility: 'a', raci: 'A' }])
    expect(dutiesWith([], 'a', 'R', { alsoResponsible: true, source: 'Interview' })).toEqual([{ responsibility: 'a', raci: 'R', source: 'Interview' }])
  })

  it('takes the whole duty with the letter', () => {
    expect(dutiesWith([full], 'a', undefined, { source: 'Interview' })).toEqual([])
  })

  it('replaces a list without losing what the letters given do not speak of', () => {
    const held: Duty[] = [full, { responsibility: 'b', raci: 'R', certainty: 'assumed', source: 'Interview' }]
    expect(dutiesReplaced(held, [{ responsibility: 'b', raci: 'C' }, { responsibility: 'a', raci: 'A' }, { responsibility: 'c', raci: 'I', source: 'New' }]))
      .toEqual([{ responsibility: 'b', raci: 'C', source: 'Interview' }, full, { responsibility: 'c', raci: 'I', source: 'New' }])
  })

  it('settles every combination once and for all', () => {
    const also = [undefined, true, false], marks = [undefined, 'confirmed', 'guessed'], sources = [undefined, '', '  ', 'Read here']
    for (const raci of RACI_LETTERS) for (const alsoResponsible of also) for (const certainty of marks) for (const source of sources) {
      const settled = settledDuty({ responsibility: 'a', raci, alsoResponsible, certainty, source } as Duty)
      expect(settledDuty(settled)).toBe(settled)
      expect(settled).toStrictEqual({
        responsibility: 'a', raci, ...(raci === 'A' && alsoResponsible ? { alsoResponsible: true } : {}),
        ...(certainty === 'confirmed' ? { certainty } : {}), ...(source === 'Read here' ? { source } : {}),
      })
    }
  })

  it('settles a role\'s description, and only the fields given', () => {
    expect(settledRole({ description: ' \n' })).toStrictEqual({ description: undefined })
    expect(settledRole({ description: '## Activities\n' })).toStrictEqual({ description: '## Activities\n' })
    expect(settledRole({ name: 'Lead' })).toStrictEqual({ name: 'Lead' })
  })
})

describe('accountability', () => {
  const roles = [
    role('owner', [{ responsibility: 'order', raci: 'A' }, { responsibility: 'release', raci: 'A' }]),
    role('lead', [{ responsibility: 'release', raci: 'A' }, { responsibility: 'build', raci: 'C' }]),
    role('dev', [{ responsibility: 'build', raci: 'R' }]),
  ]

  it('names the roles accountable for a responsibility', () => {
    expect(accountableFor(roles, 'release').map((held) => held.id)).toEqual(['owner', 'lead'])
  })

  it('flags a responsibility that is not exactly one role\'s A: nobody\'s, or several', () => {
    const gaps = accountabilityGaps([responsibility('order'), responsibility('release'), responsibility('build')], roles)
    expect(gaps.map((gap) => [gap.responsibility.id, gap.accountable.map((held) => held.id)])).toEqual([
      ['release', ['owner', 'lead']],
      ['build', []],
    ])
  })
})

describe('the shape of a unit type', () => {
  it('says a slot\'s count the way a card does', () => {
    expect(slotRange({ min: 1, max: 1 })).toBe('1')
    expect(slotRange({ min: 0, max: 1 })).toBe('0–1')
    expect(slotRange({ min: 3, max: 9 })).toBe('3–9')
    expect(slotRange({ min: 2 })).toBe('2+')
    expect(slotRange({ min: 0 })).toBe('0+')
  })

  it('finds the types that hold a role', () => {
    const types: UnitType[] = [
      { id: 't', name: 'Team', within: [], slots: [{ role: 'dev', min: 3 }] },
      { id: 'p', name: 'Platform', within: [], slots: [] },
    ]
    expect(typesHolding(types, 'dev').map((type) => type.id)).toEqual(['t'])
  })

  it('groups responsibilities in the order the groups first appear, and the ungrouped last', () => {
    const groups = responsibilityGroups([
      responsibility('a', 'Run'), responsibility('b'), responsibility('c', 'Plan'), responsibility('d', 'Run'), responsibility('e', '  '),
    ])
    expect(groups.map((held) => [held.group, held.responsibilities.map((one) => one.id)])).toEqual([
      ['Run', ['a', 'd']], ['Plan', ['c']], ['', ['b', 'e']],
    ])
  })
})

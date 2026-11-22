// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { Citation } from './citable'
import {
  causesToCommands, citationsToCommands, decisionsToCommands, evaluationsToCommands, experimentsToCommands, listToCommands,
  observationsToCommands, plainCommands, solutionsToCommands,
} from './commands'
import { fromArrays } from './normalised'
import type { Role } from './operatingModel'
import { applyAll } from './reducer'

const lead: Role = { id: 'lead', name: 'Lead', duties: [] }
const coach: Role = { id: 'coach', name: 'Coach', short: 'C', duties: [] }
const scope = (roles?: Role[]) => fromArrays({ name: 'Acme', elements: [], relations: [], diagrams: [], ...(roles ? { roles } : {}) })

describe('the plain three of a list, in its kind’s own words', () => {
  it('says each under the type and the payload its descriptor names', () => {
    const say = plainCommands('operatingRules')
    expect(say.add({ id: 'domainOwner', role: 'lead' })).toEqual({ type: 'operatingRule.add', rule: { id: 'domainOwner', role: 'lead' } })
    expect(say.update('domainOwner', { role: 'coach' })).toEqual({ type: 'operatingRule.update', id: 'domainOwner', patch: { role: 'coach' } })
    expect(say.remove('domainOwner')).toEqual({ type: 'operatingRule.remove', id: 'domainOwner' })
    expect(plainCommands('roles').add(lead)).toEqual({ type: 'role.add', role: lead })
  })
})

describe('a whole list, said as the changes that get there', () => {
  it('says nothing where the list is as it was', () => {
    expect(listToCommands(scope([lead, coach]), 'roles', [lead, { ...coach }])).toEqual([])
    expect(listToCommands(scope(), 'roles', [])).toEqual([])
  })

  it('removes those gone first, then adds and changes in the list’s order', () => {
    const owner: Role = { id: 'owner', name: 'Owner', duties: [] }
    expect(listToCommands(scope([lead, coach]), 'roles', [owner, { ...lead, name: 'Leader' }])).toEqual([
      { type: 'role.remove', id: 'coach' },
      { type: 'role.add', role: owner },
      { type: 'role.update', id: 'lead', patch: { id: 'lead', name: 'Leader', duties: [] } },
    ])
  })

  it('changes a record by the whole row: every key it had cleared, every key it has set', () => {
    const [command] = listToCommands(scope([coach]), 'roles', [{ id: 'coach', name: 'Coach', duties: [], purpose: 'Helps' }])
    expect(command).toEqual({ type: 'role.update', id: 'coach', patch: { id: 'coach', name: 'Coach', short: undefined, duties: [], purpose: 'Helps' } })
    expect(Object.keys((command as { patch: object }).patch)).toEqual(['id', 'name', 'short', 'duties', 'purpose'])
  })

  it('says a rule under the word its add carries it by', () => {
    expect(listToCommands(scope(), 'operatingRules', [{ id: 'applicationOwner', role: 'lead' }]))
      .toEqual([{ type: 'operatingRule.add', rule: { id: 'applicationOwner', role: 'lead' } }])
  })

  it('lands where the list said, through the one writer', () => {
    const before = scope([lead, coach])
    const next = [{ ...coach, name: 'Agile coach' }]
    const result = applyAll(before, listToCommands(before, 'roles', next))
    expect(result.ok && Object.values(result.model.roles ?? {})).toEqual(next)
  })

  it('is what each list’s own function says', () => {
    const citation: Citation = { id: 'ci-1', about: { kind: 'decision', id: 'adr-1' }, principle: { scope: '', id: 'pr-1' }, stance: 'supports', on: '2026-10-25' }
    const empty = scope()
    expect(citationsToCommands(empty, [citation])).toEqual([{ type: 'citation.add', citation }])
    expect(citationsToCommands(fromArrays({ name: 'Acme', elements: [], relations: [], diagrams: [], citations: [citation] }), []))
      .toEqual([{ type: 'citation.remove', id: 'ci-1' }])
    for (const none of [decisionsToCommands, observationsToCommands, causesToCommands, solutionsToCommands, experimentsToCommands, evaluationsToCommands]) {
      expect(none(empty, [])).toEqual([])
    }
  })
})

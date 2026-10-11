// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A finding marked as intended (ADR-0036, amended 11 October 2026): what an
 * instance's key is, kind by kind; that a subject changed brings the finding
 * back; and how a list is split into what is shown and what was accepted.
 * One fictional organisation, Acme Logistics.
 */
import { describe, expect, it } from 'vitest'
import { CHECK_CATALOGUE, CHECK_KEYS, CONWAY_CHECK, DATE_CHECK, TECHNOLOGY_CHECK_KEYS, TREE_CHECK_KEYS } from './checkCatalogue'
import type { CheckKey } from './checkCatalogue'
import {
  checkMarkFor, checkMarkId, findingCheck, findingKey, findingSubjects, isMarkable, splitMarked,
} from './checkMarks'
import type { CheckMark, KeptCheckMark, ScopedFinding } from './checkMarks'
import { findings } from './checks'
import type { Finding as DateFinding, FindingKind } from './checks'
import { conwayMap } from './conway'
import type { ConwayFinding, ConwayInput } from './conway'
import type { DesignElement } from './types'

const ON = '2026-10-11'

const scoped = (key: CheckKey, over: Partial<ScopedFinding> = {}): ScopedFinding => ({ key, scope: 'shipping', id: 'carriers', ...over })
const kept = (scope: string, mark: Pick<CheckMark, 'check' | 'key'> & Partial<CheckMark>): KeptCheckMark => ({ scope, mark: { on: ON, ...mark } })

describe('a finding’s key', () => {
  it('is said for every kind a finding said about a scope can be, its record first', () => {
    for (const key of [...TREE_CHECK_KEYS, ...TECHNOLOGY_CHECK_KEYS]) {
      const subjects = findingSubjects(scoped(key, { fields: ['role-lead'], scopes: ['shipping/rail'], person: 'pe-1' }))
      expect(subjects.length, key).toBeGreaterThan(0)
      expect(subjects[0], key).toBe(key === 'check.personOverloaded' ? 'pe-1' : 'carriers')
      expect(findingCheck(scoped(key)), key).toBe(key)
    }
  })

  it('names the other records that make the instance, and not what a finding only suggests', () => {
    expect(findingKey(scoped('check.roleVacant', { fields: ['role-lead'] }))).toBe('carriers role-lead')
    expect(findingKey(scoped('check.accountability', { id: 'rs-release', fields: ['ro-po', 'ro-sm'] }))).toBe('rs-release ro-po ro-sm')
    expect(findingKey(scoped('check.offeredNotShared', { id: 'containers', fields: ['wms', 'tms'] }))).toBe('containers wms tms')
    expect(findingKey(scoped('check.unitNotServing', { id: 'fn-pricing', fields: ['carriers', 'r-12'] }))).toBe('fn-pricing carriers r-12')
    // The cause, the scope below and its observation — not the cause below that a person is told to link instead.
    expect(findingKey(scoped('check.causeExplainsObservationBelow', { id: 'ca-1', scopes: ['shipping/rail'], fields: ['ob-3', 'ca-9'] })))
      .toBe('ca-1 shipping/rail ob-3')
    // A person over all of their time, in each scope that keeps one of their assignments: the person.
    expect(findingKey(scoped('check.personOverloaded', { id: 'pe-7', person: 'pe-7' }))).toBe('pe-7')
    expect(findingKey(scoped('check.unitSpans'))).toBe('carriers')
  })

  it('is said for every kind the dates find, the plan overdue with the day it was due', () => {
    const kinds = Object.keys(DATE_CHECK) as FindingKind[]
    for (const kind of kinds) {
      const finding: DateFinding = { kind, subject: 'element', id: 'tms', name: 'Transport system', detail: '2026-06-30' }
      expect(findingCheck(finding)).toBe(DATE_CHECK[kind])
      expect(findingSubjects(finding)[0]).toBe('tms')
    }
    expect(findingKey({ kind: 'planOverdue', subject: 'transition', id: 'tr-1', name: 'Retire the rater', detail: '2026-06-30' })).toBe('tr-1 2026-06-30')
    expect(findingKey({ kind: 'retiresWithDependants', subject: 'element', id: 'tms', name: 'Transport system', count: 3 })).toBe('tms')
  })

  it('is said for every kind the Conway map finds: a row and its two ends, never the columns it was drawn in', () => {
    const all: ConwayFinding[] = [
      { kind: 'undeclared', flow: { id: 'f-1', sourceId: 'a-web', targetId: 'a-hub' }, from: 'sales', to: 'data' },
      { kind: 'unused', interaction: { id: 'i-1', sourceId: 'web', targetId: 'ip', mode: 'service' } },
      { kind: 'unowned', applicationId: 'a-bil' },
      { kind: 'overLimit', unitId: 'web', owns: 4, limit: 3 },
    ]
    expect(all.map(findingKey)).toEqual(['f-1 a-web a-hub', 'i-1 web ip', 'a-bil', 'web'])
    expect(all.map(findingCheck)).toEqual(all.map((one) => CONWAY_CHECK[one.kind]))
    // Its over-limit is the organisation's own instance, whichever screen finds it.
    expect(checkMarkId({ check: findingCheck(all[3]), key: findingKey(all[3]) }))
      .toBe(checkMarkId({ check: 'check.unitOverLimit', key: findingKey(scoped('check.unitOverLimit', { id: 'web' })) }))
  })

  it('reads an item that carries a word for its kind beside its key as said about a scope', () => {
    const item = { ...scoped('check.unrealised', { id: 'containers' }), kind: 'unrealised' } as ScopedFinding
    expect(findingCheck(item)).toBe('check.unrealised')
    expect(findingKey(item)).toBe('containers')
  })
})

describe('what may be marked', () => {
  it('is a review or a note, never a fix, and never a kind the catalogue does not know', () => {
    for (const key of CHECK_KEYS) expect(isMarkable(key), key).toBe(CHECK_CATALOGUE[key].weight !== 'fix')
    expect(isMarkable('check.somethingNew')).toBe(false)
  })

  it('is made with the day, and a reason only where one was given', () => {
    const finding = scoped('check.roleVacant', { fields: ['role-lead'] })
    expect(checkMarkFor(finding, { on: ON, reason: '  Hired in November  ' }))
      .toEqual({ check: 'check.roleVacant', key: 'carriers role-lead', reason: 'Hired in November', on: ON })
    expect(checkMarkFor(finding, { on: ON, reason: '   ' })).toEqual({ check: 'check.roleVacant', key: 'carriers role-lead', on: ON })
    expect(checkMarkId(checkMarkFor(finding, { on: ON }))).toBe('check.roleVacant carriers role-lead')
  })
})

describe('a list split by the marks', () => {
  const vacant = scoped('check.roleVacant', { fields: ['role-lead'] })
  const spans = scoped('check.unitSpans')
  const misplaced = scoped('check.unitMisplaced', { fields: ['ut-team'] })

  it('lists apart what a mark kept in the scope the finding is about accepts, each list in the order it came', () => {
    const { shown, marked } = splitMarked([vacant, spans, misplaced], [kept('shipping', { check: 'check.unitSpans', key: 'carriers', reason: 'Serves both' })])
    expect(shown).toEqual([vacant, misplaced])
    expect(marked).toEqual([{ finding: spans, scope: 'shipping', mark: { check: 'check.unitSpans', key: 'carriers', reason: 'Serves both', on: ON } }])
  })

  it('is silenced by no mark kept in another scope, of another check, or with another key', () => {
    const marks = [
      kept('finance', { check: 'check.unitSpans', key: 'carriers' }),
      kept('shipping', { check: 'check.unitOverLimit', key: 'carriers' }),
      kept('shipping', { check: 'check.roleVacant', key: 'carriers role-planner' }),
    ]
    expect(splitMarked([vacant, spans], marks).shown).toEqual([vacant, spans])
  })

  it('never silences a fix, whatever a file carried', () => {
    const marks = [kept('shipping', { check: 'check.unitMisplaced', key: 'carriers ut-team' })]
    expect(splitMarked([misplaced], marks)).toEqual({ shown: [misplaced], marked: [] })
  })

  it('matches the dates’ findings to the marks of the scope they were checked in', () => {
    const overdue: DateFinding = { kind: 'planOverdue', subject: 'transition', id: 'tr-1', name: 'Retire the rater', detail: '2026-06-30' }
    const marks = [kept('shipping', { check: 'check.planOverdue', key: 'tr-1 2026-06-30' })]
    expect(splitMarked([overdue], marks, { scope: 'shipping' }).marked).toHaveLength(1)
    expect(splitMarked([overdue], marks, { scope: 'finance' }).shown).toEqual([overdue])
    // A plan given a new end and overdue again is asked again.
    expect(splitMarked([{ ...overdue, detail: '2026-09-30' }], marks, { scope: 'shipping' }).marked).toEqual([])
  })

  it('matches the Conway map’s findings, which are about the tree, to a mark wherever it is kept', () => {
    const unused: ConwayFinding = { kind: 'unused', interaction: { id: 'i-1', sourceId: 'web', targetId: 'ip' } }
    expect(splitMarked([unused], [kept('shipping/rail', { check: 'check.interactionUnused', key: 'i-1 web ip' })]).marked).toHaveLength(1)
  })
})

describe('a subject changed', () => {
  function actor(id: string, name: string): DesignElement {
    return { id, kind: 'actor', name, lifecycle: 'live', isManaged: false, aspects: {}, unitTypeId: 'ut-team' }
  }
  const input: ConwayInput = {
    units: [actor('web', 'Webshop'), actor('ip', 'Integration Platform'), actor('bil', 'Billing')],
    unitTypes: [{ id: 'ut-team', name: 'Team', top: true, within: [], slots: [] }],
    applications: [{ id: 'a-web', name: 'Webshop', partyId: 'web' }, { id: 'a-hub', name: 'Integration Hub', partyId: 'ip' }],
    flows: [],
    interactions: [{ id: 'i-1', sourceId: 'web', targetId: 'ip', mode: 'collaboration' }],
  }

  it('brings an interaction no interface uses back once it is re-pointed at another unit', () => {
    const [unused] = conwayMap(input, ON).findings
    const marks = [kept('', checkMarkFor(unused, { on: ON, reason: 'They design the API together' }))]
    expect(splitMarked(conwayMap(input, ON).findings, marks)).toMatchObject({ shown: [], marked: [{ finding: unused }] })
    const repointed = { ...input, interactions: [{ id: 'i-1', sourceId: 'web', targetId: 'bil', mode: 'collaboration' as const }] }
    const again = conwayMap(repointed, ON).findings
    expect(again).toHaveLength(1)
    expect(splitMarked(again, marks).shown).toEqual(again)
  })

  it('brings a plan overdue back once it is given another end, read off the dates themselves', () => {
    const plan = (to: string) => ({
      id: 'tr-1', number: 1, title: 'Retire the rater', status: 'agreed' as const, to,
      elements: [], decisions: [], milestones: [], body: '',
    })
    const overdue = (to: string) => findings({ model: { elements: [], relations: [], transitions: [plan(to)] }, today: ON })
    const marks = [kept('shipping', checkMarkFor(overdue('2026-06-30')[0], { on: ON }))]
    expect(splitMarked(overdue('2026-06-30'), marks, { scope: 'shipping' }).shown).toEqual([])
    expect(splitMarked(overdue('2026-08-31'), marks, { scope: 'shipping' }).shown).toHaveLength(1)
  })
})

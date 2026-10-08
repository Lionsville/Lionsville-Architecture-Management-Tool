// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { translator } from '../i18n'
import type { Cause, Observation, ScopeAnalysis, Solution } from '../model/observation'
import { planMerge } from './merge'
import type { MergePlan } from './merge'
import {
  MERGE_LINK_REFUSAL, MERGE_REFUSAL, acrossNote, confirmLabel, mergeBlocked, mergeCandidates, mergedTo, nearestFirst,
  recordAt, recordLabel, recordName, scopeDistance, writtenScopes,
} from './mergeScreen'

const t = translator('en')

const observation = (id: string, number: number, over: Partial<Observation> = {}): Observation => ({
  id, number, title: `Seen ${id}`, date: '2026-09-01', impact: 'minor', seen: 1, body: '', history: [{ date: '2026-09-01', kind: 'recorded' }], ...over,
})
const cause = (id: string, number: number, over: Partial<Cause> = {}): Cause => ({
  id, number, title: `Why ${id}`, state: 'assumed', body: '', explains: [], ...over,
})
const solution = (id: string): Solution => ({
  id, number: 4, title: 'One desk', state: 'idea', addresses: [], validatedWith: [], attempts: [], body: '', history: [],
})
const scope = (path: string, over: Partial<ScopeAnalysis> = {}): ScopeAnalysis => ({
  scope: path, observations: [], causes: [], solutions: [], experiments: [], ...over,
})
const label = (path: string) => (path === '' ? 'Harbour' : path.split('/').at(-1)!.toUpperCase())

describe('the tree, nearest first', () => {
  it('counts the steps up to where two scopes meet and down again', () => {
    expect(scopeDistance('north', 'north')).toBe(0)
    expect(scopeDistance('', 'north/east')).toBe(2)
    expect(scopeDistance('north/east', 'north/west')).toBe(2)
    expect(scopeDistance('north/east', 'south')).toBe(3)
  })
  it('orders scopes by that, and a tie by path', () => {
    expect(nearestFirst(['south', 'north/west', '', 'north/east', 'north'], 'north/east'))
      .toEqual(['north/east', 'north', '', 'north/west', 'south'])
  })
})

describe('mergeCandidates', () => {
  const scopes = [
    scope('north', {
      observations: [
        observation('n1', 1, { where: 'Quay four' }),
        observation('n2', 2, { title: 'Crane idle at night' }),
        observation('n3', 3, { archived: true }),
        observation('n4', 4, { history: [{ date: '2026-09-02', kind: 'absorbed', id: 'n5' }] }),
        observation('n5', 5),
      ],
      causes: [cause('c1', 1), cause('c2', 2, { history: [{ date: '2026-09-03', kind: 'merged', id: 'c1' }] })],
    }),
    scope('', { observations: [observation('r1', 1, { history: [{ date: '2026-09-04', kind: 'absorbed', id: 'n2', scope: 'north' }] })] }),
    scope('south', { observations: [observation('s1', 7)] }),
  ]
  const at = (hits: ReturnType<typeof mergeCandidates>) => hits.map((one) => `${one.at.scope}#${one.at.id}`)

  it('offers this scope’s live records, newest first: not archived, not merged, not absorbed by any scope', () => {
    expect(at(mergeCandidates({ kind: 'observation', scopes, here: 'north', across: false, query: '' }))).toEqual(['north#n4', 'north#n1'])
  })
  it('adds every scope given across scopes, nearest first, each hit with its label', () => {
    const hits = mergeCandidates({ kind: 'observation', scopes, here: 'north', across: true, query: '' })
    expect(at(hits)).toEqual(['north#n4', 'north#n1', '#r1', 'south#s1'])
    expect(hits[3]).toEqual({ at: { scope: 'south', id: 's1' }, label: 'OB-0007', title: 'Seen s1' })
  })
  it('matches every word of the search in the label, the title or where it was seen', () => {
    expect(at(mergeCandidates({ kind: 'observation', scopes, here: 'north', across: true, query: 'quay' }))).toEqual(['north#n1'])
    expect(at(mergeCandidates({ kind: 'observation', scopes, here: 'north', across: true, query: 'ob-0007' }))).toEqual(['south#s1'])
    expect(mergeCandidates({ kind: 'observation', scopes, here: 'north', across: true, query: 'quay seen nothing' })).toEqual([])
  })
  it('offers causes that are not merged', () => {
    expect(at(mergeCandidates({ kind: 'cause', scopes, here: 'north', across: true, query: '' }))).toEqual(['north#c1'])
  })
})

describe('reading a record anywhere', () => {
  const scopes = [scope('north', { observations: [observation('n1', 1)], causes: [cause('c1', 3, { root: true })], solutions: [solution('so1')] })]
  it('finds it by kind and place, and says it as people do', () => {
    expect(recordAt(scopes, 'cause', { scope: 'north', id: 'c1' })?.title).toBe('Why c1')
    expect(recordAt(scopes, 'observation', { scope: 'north', id: 'c1' })).toBeUndefined()
    expect(recordAt(scopes, 'observation', { scope: 'gone', id: 'n1' })).toBeUndefined()
    expect(recordLabel('cause', scopes[0]!.causes[0]!)).toBe('RC-0003')
  })
  it('names an observation, a cause or a solution, with its scope where it is not here', () => {
    expect(recordName(scopes, 'north', label, { scope: 'north', id: 'n1' })).toBe('OB-0001 Seen n1')
    expect(recordName(scopes, '', label, { scope: 'north', id: 'c1' })).toBe('RC-0003 Why c1 (NORTH)')
    expect(recordName(scopes, 'north', label, { scope: 'north', id: 'so1' })).toBe('SO-0004 One desk')
    expect(recordName(scopes, 'north', label, { scope: 'north', id: 'x' })).toBe('x')
  })
})

describe('mergedTo', () => {
  it('reads where a record went off its own history, scope and all', () => {
    const north = scope('north', { causes: [cause('c1', 1, { history: [{ date: '2026-09-05', kind: 'merged', id: 'r9', scope: '' }] })] })
    expect(mergedTo(north, 'cause', 'c1')).toEqual({ scope: '', id: 'r9', date: '2026-09-05' })
  })
  it('or off the survivor of its own scope that absorbed it', () => {
    const north = scope('north', {
      observations: [observation('n1', 1, { history: [{ date: '2026-09-06', kind: 'absorbed', id: 'n2', seen: 1 }] }), observation('n2', 2)],
      causes: [cause('c1', 1, { history: [{ date: '2026-09-07', kind: 'absorbed', id: 'c2' }] }), cause('c2', 2), cause('c3', 3)],
    })
    expect(mergedTo(north, 'observation', 'n2')).toEqual({ scope: 'north', id: 'n1', date: '2026-09-06' })
    expect(mergedTo(north, 'cause', 'c2')).toEqual({ scope: 'north', id: 'c1', date: '2026-09-07' })
    expect(mergedTo(north, 'cause', 'c3')).toBeUndefined()
  })
})

describe('what Merge says, and why it cannot be pressed', () => {
  const north = scope('north', { observations: [observation('n1', 1), observation('n2', 2)] })
  const south = scope('south', { observations: [observation('s1', 1)] })
  const plan = (absorbed: { scope: string; id: string }[]): MergePlan => planMerge({
    kind: 'observation', survivor: { scope: 'north', id: 'n1' }, absorbed, scopes: [scope(''), north, south], date: '2026-10-08',
  })
  const ask = (over: Partial<Parameters<typeof mergeBlocked>[0]> = {}) => mergeBlocked({
    plan: plan([{ scope: 'north', id: 'n2' }]), records: [{ scope: 'north', id: 'n1' }, { scope: 'north', id: 'n2' }], here: 'north',
    readOnly: false, across: true, writable: () => true, scopeLabel: label, t, ...over,
  })

  it('says nothing where it may be pressed', () => {
    expect(ask()).toBeUndefined()
    expect(writtenScopes(plan([{ scope: 'south', id: 's1' }]))).toEqual(['north', 'south'])
    expect(writtenScopes(plan([]))).toEqual([])
  })
  it('says why: read-only, the rule’s refusal, a scope that may not be changed, another scope from a page that writes only here', () => {
    expect(ask({ readOnly: true })).toBe('Nothing may be changed from here.')
    expect(ask({ plan: plan([]) })).toBe(t('observation.mergeNothing'))
    expect(ask({ writable: (path) => path !== 'north' })).toContain('You may read NORTH, but not change it')
    const across = { plan: plan([{ scope: 'south', id: 's1' }]), records: [{ scope: 'north', id: 'n1' }, { scope: 'south', id: 's1' }] }
    expect(ask({ ...across, across: false })).toBe(t('observation.mergeNotFromHere'))
    expect(ask({ ...across, writable: (path) => path !== 'south' })).toContain('SOUTH')
  })
  it('says what it makes', () => {
    expect(confirmLabel('observation', 1, 'OB-0002', t)).toBe('Merge 1 observation into OB-0002')
    expect(confirmLabel('observation', 3, 'OB-0002', t)).toBe('Merge 3 observations into OB-0002')
    expect(confirmLabel('cause', 1, 'RC-0001', t)).toBe('Merge 1 cause into RC-0001')
    expect(confirmLabel('cause', 2, 'CA-0004', t)).toBe('Merge 2 causes into CA-0004')
  })
  it('has words for every refusal', () => {
    for (const key of [...Object.values(MERGE_LINK_REFUSAL), ...Object.values(MERGE_REFUSAL)]) expect(t(key)).not.toBe(key)
  })
})

describe('acrossNote', () => {
  it('names the scopes a merge changed, and says where this scope’s part is not written yet', () => {
    expect(acrossNote({ ok: true, changed: ['south'] }, label, t)).toContain('It changed SOUTH, each')
    const two = acrossNote({ ok: true, changed: ['north', 'south', ''], unsaved: true }, label, t)
    expect(two).toContain('It changed NORTH, SOUTH and Harbour')
    expect(two).toContain('not written yet')
  })
  it('says nothing was merged, and why', () => {
    expect(acrossNote({ ok: false, reason: 'refused', refused: 'merged' }, label, t)).toBe(`Nothing was merged: ${t('observation.mergeAlreadyMerged')}`)
    expect(acrossNote({ ok: false, reason: 'refused', refused: 'odd' }, label, t)).toBe('Nothing was merged: odd')
    expect(acrossNote({ ok: false, reason: 'shell.scopeReadOnly', scope: 'south' }, label, t)).toContain('you may read SOUTH')
    expect(acrossNote({ ok: false, reason: 'shell.scopeReadOnly' }, label, t)).toBe('Nothing was merged.')
    expect(acrossNote({ ok: false, reason: 'shell.scopeMoved' }, label, t)).toContain('Try again')
    expect(acrossNote({ ok: false, reason: 'command.rootExplained' }, label, t)).toContain(t('command.rootExplained'))
    expect(acrossNote({ ok: false, reason: 'gone' }, label, t)).toBe('Nothing was merged.')
    expect(acrossNote({ ok: false, reason: 'partial', changed: ['south'] }, label, t)).toContain('SOUTH were changed')
  })
})

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import {
  NO_FILTERS, SAVED_FILTERS_KEY, activeFilters, applyFilters, filterRecords, readSavedFilters, recallFilter, saveFilter,
} from './filter'
import type { Filters } from './filter'
import { pictureLinks, solutionKey } from './graph'
import type { Cause, Observation, ScopeAnalysis } from './observation'
import type { Experiment, Solution } from './solution'

const observation = (id: string, number: number, title: string, over: Partial<Observation> = {}): Observation => ({
  id, number, title, date: '2026-09-01', impact: 'minor', seen: 1, body: '', history: [{ date: '2026-09-01', kind: 'recorded' }], ...over,
})
const cause = (id: string, number: number, title: string, explains: Cause['explains'], over: Partial<Cause> = {}): Cause => ({
  id, number, title, state: 'assumed', body: '', explains, ...over,
})
const solution = (id: string, number: number, title: string, addresses: string[], over: Partial<Solution> = {}): Solution => ({
  id, number, title, state: 'idea', addresses: addresses.map((one) => ({ id: one, strength: 'normal' })),
  validatedWith: [], attempts: [], body: '', history: [], ...over,
})
const experiment = (id: string, tests: string[], hypothesis: string): Experiment => ({
  id, number: 1, title: id, tests, hypothesis, outcome: 'planned', body: '',
})

/**
 * Two chains in this scope and one below:
 * o1 → c1 → r1 → s1 (pricing), o2 → c2 → r2 (partners), and below
 * a1 → b1, where b1 is explained from here by r2.
 */
const scopes: ScopeAnalysis[] = [
  {
    scope: '',
    observations: [
      observation('o1', 1, 'A customer is quoted one price and billed another', { where: 'Billing' }),
      observation('o2', 2, 'Onboarding a carrier takes nine weeks'),
      observation('o3', 3, 'A second quote differs again', { archived: true }),
    ],
    causes: [
      cause('c1', 1, 'Two systems compute a price', [{ id: 'o1', strength: 'strong' }, { id: 'o3', strength: 'normal' }]),
      cause('c2', 2, 'Every mapping is written by hand', [{ id: 'o2', strength: 'normal' }]),
      cause('r1', 3, 'Pricing rules have no single owner', [{ id: 'c1', strength: 'normal' }], { root: true }),
      cause('r2', 4, 'Partners connect without a shared standard', [{ id: 'c2', strength: 'normal' }, { id: 'b1', scope: 'acme', strength: 'weak' }], { root: true }),
    ],
    solutions: [
      solution('s1', 1, 'One place where a price is decided', ['r1']),
      solution('s2', 2, 'A kit for partners', ['r2'], { state: 'dropped' }),
    ],
    experiments: [experiment('e1', ['s1'], 'Credit notes stop')],
  },
  {
    scope: 'acme',
    observations: [observation('a1', 1, 'Stock counts differ between two screens')],
    causes: [cause('b1', 1, 'Scanner messages use a format of their own', [{ id: 'a1', strength: 'normal' }])],
    solutions: [], experiments: [],
  },
]
const records = filterRecords(scopes, '')
const links = pictureLinks(scopes, '')
const run = (filters: Partial<Filters>) => applyFilters(records, links, { ...NO_FILTERS, ...filters })
const sorted = (keys: Set<string>) => [...keys].sort()

describe('filterRecords', () => {
  it('keys every record as the picture does, with its kind, and counts only what is live', () => {
    const byKey = new Map(records.map((one) => [one.key, one]))
    expect(byKey.get('o1')).toMatchObject({ kind: 'observation', scope: '', counted: true })
    expect(byKey.get('o3')?.counted).toBe(false)
    expect(byKey.get('c1')?.kind).toBe('cause')
    expect(byKey.get('r1')?.kind).toBe('root')
    expect(byKey.get(solutionKey('s2'))).toMatchObject({ kind: 'solution', counted: false })
    expect(byKey.get('ex:e1')).toMatchObject({ kind: 'experiment', counted: false })
    expect(byKey.get('acme#b1')).toMatchObject({ kind: 'cause', scope: 'acme' })
    expect(byKey.get('o1')?.text).toContain('Billing')
  })
})

describe('applyFilters', () => {
  it('leaves everything with no filter on', () => {
    const result = run({})
    expect(result.visible.size).toBe(records.length)
    expect(result.filtering).toBe(false)
    expect(result.matched.size).toBe(0)
    // Live observations, every cause, live solutions: 3 + 5 + 1.
    expect([result.shown, result.total]).toEqual([9, 9])
  })

  it('hides the records of a scope switched off, before any text is read', () => {
    const result = run({ scopesOff: ['acme'] })
    expect(result.visible.has('acme#a1')).toBe(false)
    expect(result.visible.has('acme#b1')).toBe(false)
    expect(result.visible.has('o1')).toBe(true)
    expect(result.filtering).toBe(true)
    // The link from r2 into the scope below carries nothing across once that scope is off.
    expect(sorted(run({ scopesOff: ['acme'], roots: 'partners' }).visible)).toEqual(['c2', 'o2', 'r2', solutionKey('s2')])
  })

  it('keeps an observation that matches and the chain behind it, and nothing beside it', () => {
    const result = run({ observations: 'billed' })
    expect(sorted(result.visible)).toEqual(['c1', 'ex:e1', 'o1', 'r1', solutionKey('s1')])
    expect(sorted(result.matched)).toEqual(['o1'])
    // o3 sits beside o1 under the same cause, and is not behind it.
    expect(result.visible.has('o3')).toBe(false)
  })

  it('matches observations only in the observations box', () => {
    expect(run({ observations: 'price' }).matched).toEqual(new Set(['o1']))
  })

  it('keeps a cause that matches and everything linked to it both ways', () => {
    const result = run({ causes: 'systems' })
    expect(sorted(result.visible)).toEqual(['c1', 'ex:e1', 'o1', 'o3', 'r1', solutionKey('s1')])
    expect(sorted(result.matched)).toEqual(['c1'])
  })

  it('matches root causes only in the RC box, and causes only in the causes box', () => {
    expect(sorted(run({ roots: 'pricing' }).matched)).toEqual(['r1'])
    expect(run({ causes: 'pricing' }).matched.size).toBe(0)
    expect(run({ roots: 'systems' }).visible.size).toBe(0)
  })

  it('follows a root cause above down into the cause below it explains', () => {
    const result = run({ roots: 'partners' })
    expect(sorted(result.visible)).toEqual(['acme#a1', 'acme#b1', 'c2', 'o2', 'r2', solutionKey('s2')])
  })

  it('searches every record, solutions and experiments included, and keeps what is linked both ways', () => {
    expect(sorted(run({ search: 'decided' }).matched)).toEqual([solutionKey('s1')])
    expect(sorted(run({ search: 'decided' }).visible)).toEqual(['c1', 'ex:e1', 'o1', 'o3', 'r1', solutionKey('s1')])
    expect(sorted(run({ search: 'credit notes' }).matched)).toEqual(['ex:e1'])
    expect(sorted(run({ search: 'SO-0002' }).matched)).toEqual([solutionKey('s2')])
  })

  it('keeps only what holds for every filter that is on', () => {
    // The search reaches both chains through the word in two titles; the RC box narrows it to one.
    const both = run({ search: 'a' })
    expect(both.visible.has('o1') && both.visible.has('o2')).toBe(true)
    const narrowed = run({ search: 'a', roots: 'pricing' })
    expect(narrowed.visible.has('o2')).toBe(false)
    expect(narrowed.visible.has('o1')).toBe(true)
    const none = run({ observations: 'billed', roots: 'partners' })
    expect(none.visible.size).toBe(0)
    expect([none.shown, none.total]).toEqual([0, 9])
  })

  it('counts what is shown of the live records', () => {
    const result = run({ observations: 'billed' })
    // o1, c1, r1, s1: the experiment is not counted.
    expect([result.shown, result.total]).toEqual([4, 9])
  })
})

describe('activeFilters', () => {
  it('counts each text filter, and the scopes as one while a scope in view is off', () => {
    expect(activeFilters(NO_FILTERS, ['', 'acme'])).toBe(0)
    expect(activeFilters({ ...NO_FILTERS, observations: 'x', search: ' y ' }, ['', 'acme'])).toBe(2)
    expect(activeFilters({ ...NO_FILTERS, roots: '  ' }, [''])).toBe(0)
    expect(activeFilters({ ...NO_FILTERS, scopesOff: ['acme', 'zeta'] }, ['', 'acme'])).toBe(1)
    expect(activeFilters({ ...NO_FILTERS, scopesOff: ['zeta'] }, ['', 'acme'])).toBe(0)
  })
})

describe('saved filters', () => {
  const pricing: Filters = { ...NO_FILTERS, roots: 'pricing', scopesOff: ['acme', 'gone'] }

  it('saves under a name, replacing one of the same name where it stands', () => {
    const one = saveFilter([], ' Pricing chain ', pricing)
    expect(one).toEqual([{ name: 'Pricing chain', filters: pricing }])
    const two = saveFilter(one, 'Partners', { ...NO_FILTERS, search: 'partner' })
    const again = saveFilter(two, 'Pricing chain', { ...NO_FILTERS, roots: 'owner' })
    expect(again.map((held) => [held.name, held.filters.roots])).toEqual([['Pricing chain', 'owner'], ['Partners', '']])
    expect(saveFilter(two, '  ', pricing)).toEqual(two)
  })

  it('recalls a saved filter without the scopes that are no longer there', () => {
    expect(recallFilter({ name: 'p', filters: pricing }, ['', 'acme'])).toEqual({ ...pricing, scopesOff: ['acme'] })
  })

  it('reads what makes sense out of the stored preferences and drops the rest', () => {
    expect(readSavedFilters(undefined)).toEqual([])
    expect(readSavedFilters({ [SAVED_FILTERS_KEY]: 'no' })).toEqual([])
    expect(readSavedFilters({
      [SAVED_FILTERS_KEY]: [
        { name: 'Pricing', filters: { roots: 'pricing', scopesOff: ['acme', 7], extra: true } },
        { name: '', filters: {} },
        { name: 'No filters' },
        'junk',
      ],
    })).toEqual([{ name: 'Pricing', filters: { ...NO_FILTERS, roots: 'pricing', scopesOff: ['acme'] } }])
  })
})

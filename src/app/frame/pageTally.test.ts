// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The tree beside a record page counts each scope's own records by the rule
 * the page counts by, off the index the shell already read — and over the
 * dense organisation it is a fold of a few milliseconds, never a read.
 */
import { describe, expect, it } from 'vitest'
import { FakeDirectory } from '../../adapters/folder/fakeDirectory'
import { folderRepositories } from '../../adapters/folder/folderRepositories'
import { memoryGit } from '../../adapters/folder/memoryGit'
import { DENSE, DENSE_TEAM, seedDenseOrganisation } from '../../adapters/folder/testing/denseOrganisation'
import { liveObservations } from '../../observations/observation'
import { flattenScopes } from '../../projects/scope'
import type { ScopeModel, ScopeSummary } from '../../projects/scope'
import { modelOf, summaryOf } from '../../projects/scopeAccess'
import { indexScopes } from '../../projects/scopeIndex'
import { holdingsOf } from '../organisation/holdings'
import { TALLIED, talliedPage, tallyOf } from './pageTally'

const node = (path: string, children: ScopeSummary[] = [], personal = false): ScopeSummary => ({ path, name: path || 'Org', diagrams: 0, children, ...(personal ? { personal } : {}) })
const model = (path: string, over: Partial<ScopeModel['model']>): ScopeModel => ({ path, model: { elements: [], relations: [], ...over } })
const seen = (id: string, archived = false) => ({
  id, number: 1, title: id, date: '2026-09-01', where: '', by: '', impact: 'minor' as const, seen: 1, body: '',
  history: [{ date: '2026-09-01', kind: 'recorded' as const }], ...(archived ? { archived } : {}),
})

describe('which page has a tally', () => {
  it('is a page of records kept per scope; an element\'s record is the documentation page', () => {
    expect(talliedPage('decisions')).toBe('decisions')
    expect(talliedPage('document')).toBe('documentation')
    expect(talliedPage('register')).toBeUndefined()
    expect(talliedPage(undefined)).toBeUndefined()
  })
})

describe('a tally', () => {
  const tree = node('', [node('a', [node('a/b')]), node('c'), node('me', [node('me/x')], true)])
  const models = [
    model('', { decisionCount: 1 }),
    model('a/b', {
      decisionCount: 2, observations: [seen('o1'), seen('o2', true)], transitions: [],
      elements: [
        { id: 'e1', kind: 'application', name: 'E1', lifecycle: 'live', isManaged: false, aspects: {} },
        { id: 'e2', kind: 'application', name: 'E2', lifecycle: 'live', isManaged: false, aspects: {}, ref: 'c' },
      ],
    }),
    model('me/x', { decisionCount: 4 }),
  ]
  const holdings = holdingsOf(tree, models)
  const index = indexScopes(models)

  it('counts a scope\'s own, never what is under it, and marks the path down to it', () => {
    const decisions = tallyOf('decisions', tree, models, holdings, index)
    expect([decisions.own(''), decisions.own('a'), decisions.own('a/b'), decisions.own('c')]).toEqual([1, 0, 2, 0])
    expect([...decisions.within].sort()).toEqual(['', 'a', 'a/b'])
  })

  it('leaves a scope only its reader sees out of the path, keeping its own count', () => {
    const decisions = tallyOf('decisions', tree, models, holdings, index)
    expect(decisions.own('me/x')).toBe(4)
    expect(decisions.within.has('me')).toBe(false)
    expect(decisions.within.has('me/x')).toBe(false)
  })

  it('counts observations by the one rule, the live ones, and documentation by the elements kept, not stand-ins', () => {
    expect(tallyOf('observations', tree, models, holdings, index).own('a/b')).toBe(1)
    expect(tallyOf('documentation', tree, models, holdings, index).own('a/b')).toBe(1)
  })
})

describe('over the dense organisation', () => {
  it('says what the pages say, every page in a few milliseconds off the index', async () => {
    const root = new FakeDirectory('dense')
    const repositories = folderRepositories({ root, git: memoryGit(root) })
    await seedDenseOrganisation(repositories)
    const tree = summaryOf(await repositories.scopes.tree())
    const models = (await repositories.index.read()).scopes.map(modelOf)
    const index = indexScopes(models)
    expect(flattenScopes(tree)).toHaveLength(DENSE.scopes)
    const started = performance.now()
    const holdings = holdingsOf(tree, models)
    const tallies = TALLIED.map((kind) => tallyOf(kind, tree, models, holdings, index))
    const took = performance.now() - started
    const observations = tallies[TALLIED.indexOf('observations')]
    const total = flattenScopes(tree).reduce((sum, one) => sum + observations.own(one.path), 0)
    expect(total).toBe(models.reduce((sum, one) => sum + liveObservations(one.model.observations ?? []).length, 0))
    expect(observations.own(DENSE_TEAM)).toBeGreaterThan(0)
    // The owner's open is 100 ms; the tree's share of it is a small part.
    expect(took).toBeLessThan(20)
  })
})

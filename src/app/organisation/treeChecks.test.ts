// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Every finding at or under a home, for the Checks page (3.6.1): the tree's
 * as Needs attention had them, each scope's dates, and the Conway map over
 * the home — each opening where it is fixed, split by the marks as every list
 * splits, and every check of the catalogue on the page whether or not it
 * finds anything.
 */
import { describe, expect, it } from 'vitest'
import { translator } from '../../i18n'
import { CHECK_KEYS } from '../../model/checkCatalogue'
import type { HostModel } from '../../model/hostModel'
import type { DesignElement } from '../../model/types'
import type { Transition } from '../../model/transition'
import { indexScopes } from '../../projects/scopeIndex'
import type { AttentionItem } from './attention'
import { checksByCategory, firstOfWeight, FOUND_WHERE_OPEN, splitInstances, treeInstances } from './treeChecks'

const t = translator('en')
const TODAY = '2026-10-12'

const actor = (id: string, name: string, over: Partial<DesignElement> = {}): DesignElement => ({
  id, kind: 'actor', name, lifecycle: 'live', isManaged: false, aspects: {}, ...over,
})
const app = (id: string, name: string, partyId?: string): DesignElement => ({
  id, kind: 'application', name, lifecycle: 'live', isManaged: true, aspects: {}, ...(partyId ? { partyId } : {}),
})
const overdue: Transition = {
  id: 'tr-1', number: 1, title: 'Move the warehouse', status: 'running', to: '2026-09-01', elements: [], decisions: [], milestones: [], body: '',
}

/** The organisation: two teams that declare they work together and run no interface, and an application nobody owns. */
const ROOT: HostModel = {
  name: 'Acme Logistics',
  elements: [actor('ops', 'Operations', { unitTypeId: 'ut-team' }), actor('sales', 'Sales', { unitTypeId: 'ut-team' }), app('wms', 'WMS', 'ops'), app('billing', 'Billing')],
  relations: [{ id: 'i-1', type: 'interacts', sourceId: 'ops', targetId: 'sales', mode: 'service' }],
  diagrams: [],
  unitTypes: [{ id: 'ut-team', name: 'Team', top: true, within: [], slots: [] }],
  roles: [],
}
const RETAIL: HostModel = { name: 'Retail', elements: [app('pos', 'Point of sale')], relations: [], diagrams: [], transitions: [overdue] }
const models = [{ path: '', model: ROOT }, { path: 'retail', model: RETAIL }]
const index = indexScopes(models)

const ATTENTION: AttentionItem[] = [
  { key: 'check.unattributed', kind: 'unattributed', scope: 'retail', id: 'post', text: 'Post office has no party' },
  { key: 'check.drawingLinkMissing', kind: 'drawingLinkMissing', scope: 'retail', id: 'ctx:b', view: 'ctx', text: 'A shape points at nothing' },
  { key: 'check.unitTypeNowhere', kind: 'unitTypeNowhere', scope: '', id: 'ut-guild', page: 'operating', text: 'Guild sits nowhere' },
  { key: 'check.personOverloaded', kind: 'personOverloaded', scope: 'retail', id: 'pe-1', person: 'pe-1', text: 'Sara is over 100%' },
  { key: 'check.relevantGone', kind: 'relevantGone', scope: 'topics/security', id: 'billing', page: 'topics', fields: ['billing'], text: 'A link to billing' },
]

const all = () => treeInstances({ attention: ATTENTION, models, at: '', today: TODAY, index, home: ROOT, t })

describe('the findings at or under a home', () => {
  it('opens each of the tree\'s where Needs attention did, and keeps the row\'s own names for something outside to find it by', () => {
    const tree = all().filter((one) => ATTENTION.some((item) => item === one.finding))
    expect(tree.map((one) => one.opens)).toEqual([
      { scope: 'retail', page: { page: 'element', id: 'post' } },
      { scope: 'retail', page: { page: 'board', id: 'ctx' } },
      { scope: '', page: { page: 'operating', id: 'ut-guild' } },
      { person: 'pe-1' },
      // A topic's link to nowhere is put right in the catalogue, on the topic (ADR-0042 §5).
      { topic: 'topics/security' },
    ])
    expect(tree[0]!.attributes).toEqual({ 'data-testid': 'attention-retail-post', 'data-finding': 'unattributed' })
  })

  it('checks every scope\'s dates as its roadmap does, kept where they were checked and opened there', () => {
    const dated = all().filter((one) => one.key === 'check.planOverdue')
    expect(dated).toHaveLength(1)
    expect(dated[0]).toMatchObject({ scope: 'retail', checkedIn: 'retail', opens: { scope: 'retail', page: { page: 'plan', id: 'tr-1' } } })
    expect(dated[0]!.text).toContain('Move the warehouse')
    // Only what is filed at or under the home.
    expect(treeInstances({ attention: [], models, at: 'finance', today: TODAY, index, home: undefined, t })).toEqual([])
  })

  it('reads the Conway map over the home, each opening what it is about, and nothing of it before the home is read', () => {
    const conway = all().filter((one) => one.key === 'check.interactionUnused' || one.key === 'check.applicationUnowned')
    expect(conway.map((one) => [one.key, one.scope, one.opens])).toEqual([
      ['check.interactionUnused', '', { scope: '', page: { page: 'element', id: 'ops' } }],
      ['check.applicationUnowned', '', { scope: '', page: { page: 'element', id: 'billing' } }],
      // Over the whole organisation, a domain's own applications too, each kept where it is defined.
      ['check.applicationUnowned', 'retail', { scope: 'retail', page: { page: 'element', id: 'pos' } }],
    ])
    expect(conway[0]!.text).toBe('Operations and Sales declare As a service, and no interface runs between them.')
    expect(treeInstances({ attention: [], models: [], at: '', today: TODAY, index, home: undefined, t })).toEqual([])
  })

  it('says a unit over its type\'s limit once, whichever found it', () => {
    const limited: HostModel = { ...ROOT, unitTypes: [{ id: 'ut-team', name: 'Team', top: true, within: [], slots: [], limit: 0 }] }
    const tight = indexScopes([{ path: '', model: limited }])
    const map = treeInstances({ attention: [], models: [], at: '', today: TODAY, index: tight, home: limited, t })
    expect(map.filter((one) => one.key === 'check.unitOverLimit').map((one) => one.opens)).toEqual([{ scope: '', page: { page: 'element', id: 'ops' } }])
    const said: AttentionItem = { key: 'check.unitOverLimit', kind: 'unitOverLimit', scope: '', id: 'ops', text: 'Operations owns 1' }
    const both = treeInstances({ attention: [said], models: [], at: '', today: TODAY, index: tight, home: limited, t })
    expect(both.filter((one) => one.key === 'check.unitOverLimit')).toHaveLength(1)
  })

  it('splits by the marks: the tree\'s by its scope\'s, the dates\' by the scope checked in, the map\'s wherever kept', () => {
    const { shown, marked } = splitInstances(all(), [
      { scope: 'retail', mark: { check: 'check.unattributed', key: 'post', on: '2026-10-01', reason: 'A supplier of ours' } },
      { scope: 'finance', mark: { check: 'check.planOverdue', key: 'tr-1 2026-09-01', on: '2026-10-01' } },
      { scope: '', mark: { check: 'check.interactionUnused', key: 'i-1 ops sales', on: '2026-10-02' } },
      // A fix is never silenced.
      { scope: 'retail', mark: { check: 'check.drawingLinkMissing', key: 'ctx:b', on: '2026-10-02' } },
    ])
    expect(marked.map((one) => [one.instance.key, one.keptIn, one.mark.reason])).toEqual([
      ['check.unattributed', 'retail', 'A supplier of ours'], ['check.interactionUnused', '', undefined],
    ])
    expect(shown.some((one) => one.key === 'check.planOverdue')).toBe(true)
    expect(shown.some((one) => one.key === 'check.drawingLinkMissing')).toBe(true)
  })
})

describe('the page of every check', () => {
  it('lists every check once, by category, fix before review before note, and says which an open scope finds', () => {
    const rows = checksByCategory(splitInstances(all(), []))
    const keys = rows.flatMap((one) => one.rows.map((row) => row.key))
    expect([...keys].sort()).toEqual([...CHECK_KEYS].sort())
    expect(rows.map((one) => one.category)).toEqual(['landscape', 'plans', 'organisation', 'teams', 'analysis', 'principles'])
    for (const { rows: some } of rows) {
      const ranks = some.map((row) => ['fix', 'review', 'note'].indexOf(row.entry.weight))
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    }
    const uncounted = rows.flatMap((one) => one.rows).filter((row) => !row.counted).map((row) => row.key)
    expect(new Set(uncounted)).toEqual(FOUND_WHERE_OPEN)
    expect(rows.find((one) => one.category === 'teams')!.rows.find((row) => row.key === 'check.interactionUnused')!.shown).toHaveLength(1)
  })

  it('opens a weight on the first of its checks with anything found, in the page\'s order', () => {
    const rows = checksByCategory(splitInstances(all(), []))
    expect(firstOfWeight(rows, 'review')).toBe('check.unattributed')
    expect(firstOfWeight(rows, 'note')).toBe('check.interactionUnused')
    expect(firstOfWeight(checksByCategory({ shown: [], marked: [] }), 'fix')).toBeUndefined()
  })
})

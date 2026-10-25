// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Where a building block's chosen solution is seen (ADR-0043 §8): what an
 * element is, as a solution some scope chose, and which elements are chosen
 * for a scope — the nearest choice of each block winning.
 */
import { describe, expect, it } from 'vitest'
import type { Evaluation } from '../model/evaluation'
import type { DesignElement } from '../model/types'
import { chosenFor, solutionsChosenAs } from './chosenSolutions'
import { indexScopes } from './scopeIndex'

const element = (id: string, over: Partial<DesignElement> = {}): DesignElement => ({ id, kind: 'application', name: id, lifecycle: 'live', isManaged: true, aspects: {}, ...over })
const GATEWAY = element('blk-gw', {
  kind: 'buildingBlock', name: 'Message gateway', isManaged: false,
  sbbs: [{ id: 'sb-a', name: 'Broker A', sort: 'product', status: 'inUse', elements: ['app-broker'] }, { id: 'sb-b', name: 'Managed bus', sort: 'service', status: 'candidate', elements: ['svc-bus'] }],
})
const chose = (option: string | undefined): Evaluation => ({
  id: 'topics.integration~blk-gw', block: { scope: 'topics/integration', id: 'blk-gw' }, contexts: [], options: ['sb-a', 'sb-b'], coverage: {}, ...(option ? { chosen: option } : {}),
})
const model = (name: string, over: object = {}) => ({ name, elements: [] as DesignElement[], relations: [], diagrams: [], ...over })

const index = indexScopes([
  { path: '', model: model('Acme', { elements: [element('app-broker'), element('svc-bus', { kind: 'platformService' })], evaluations: [chose('sb-a')] }) },
  { path: 'topics/integration', model: model('Integration', { elements: [GATEWAY] }) },
  { path: 'sales', model: model('Sales', { evaluations: [chose('sb-b')] }) },
  { path: 'sales/web', model: model('Web') },
  { path: 'stock', model: model('Stock', { evaluations: [chose(undefined)] }) },
])

describe('a chosen solution', () => {
  it('is said on each element that is it, for every scope that chose it', () => {
    expect(solutionsChosenAs(index, 'app-broker')).toEqual([{ block: { id: 'blk-gw', name: 'Message gateway', scope: 'topics/integration' }, sbb: 'Broker A', scope: '' }])
    expect(solutionsChosenAs(index, 'svc-bus').map((one) => one.scope)).toEqual(['sales'])
    expect(solutionsChosenAs(index, 'nothing')).toEqual([])
  })

  it('is offered to a scope by its own choice, or the nearest scope above that chose', () => {
    expect([...chosenFor(index, 'sales/web').keys()]).toEqual(['svc-bus'])
    expect([...chosenFor(index, 'stock').keys()]).toEqual(['app-broker'])
    expect(chosenFor(index, '').get('app-broker')?.sbb).toBe('Broker A')
  })
})

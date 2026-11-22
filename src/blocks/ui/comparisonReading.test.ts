// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { DesignElement } from '../../model/types'
import { readComparison } from './comparisonReading'

const BLOCK: Pick<DesignElement, 'capabilities' | 'contexts' | 'sbbs'> = {
  capabilities: [{ id: 'route', text: 'Routes' }, { id: 'audit', text: 'Audits', must: true }, { id: 'spare', text: 'Spare' }],
  contexts: [{ id: 'cx', name: 'Partners', needs: { route: 4, audit: 2 } }],
  sbbs: [{ id: 'a', name: 'A', sort: 'product', status: 'candidate' }, { id: 'b', name: 'B', sort: 'service', status: 'candidate' }],
}

describe('a comparison read', () => {
  it('ranks the options, a failed must last, and says each cell\'s shortfall, a must short of full', () => {
    const reading = readComparison(BLOCK, {
      contexts: ['cx'], options: ['a', 'b'], chosen: 'b',
      coverage: { a: { route: { level: 4 }, audit: { level: 2, how: 'Logs' } }, b: { route: { level: 2 }, audit: { level: 4 } } },
    })
    expect(reading.options.map((one) => [one.sbb.id, one.rank, one.chosen, one.fit.failsMust])).toEqual([['b', 1, true, []], ['a', 2, false, ['audit']]])
    const [route, audit, spare] = reading.capabilities
    expect(route).toMatchObject({ need: 4, needed: true, covered: false, cells: { a: { level: 4, short: 0 }, b: { level: 2, short: 2 } } })
    expect(audit).toMatchObject({ need: 2, covered: false, cells: { a: { level: 2, how: 'Logs', short: 2, failsMust: true }, b: { short: 0, failsMust: false } } })
    expect(spare).toMatchObject({ need: 0, needed: false, covered: true })
  })

  it('reads a row with no option weighed as covered, so Gaps only does not keep it for nothing', () => {
    expect(readComparison(BLOCK, { contexts: ['cx'], options: [], coverage: {} }).capabilities.every((one) => one.covered)).toBe(true)
  })
})

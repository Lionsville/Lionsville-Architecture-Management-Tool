// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { DesignElement } from '../../model/types'
import { readComparison } from './comparisonReading'
import { asCsv, asTabbed, comparisonFileName, comparisonTable } from './comparisonTable'
import type { TableWords } from './comparisonTable'

const BLOCK: Pick<DesignElement, 'capabilities' | 'contexts' | 'sbbs'> = {
  capabilities: [{ id: 'route', text: 'Routes, by content' }, { id: 'audit', text: 'Audits', must: true }],
  contexts: [{ id: 'cx', name: 'Partners', needs: { route: 4, audit: 2 } }],
  sbbs: [{ id: 'a', name: 'Broker A', sort: 'product', status: 'candidate' }, { id: 'b', name: 'Bus', sort: 'service', status: 'candidate' }],
}

const WORDS: TableWords = {
  capability: 'Capability', must: 'must', needed: 'Needed here', rank: 'Rank', fit: 'Fit', chosen: 'chosen', note: 'note',
  needWord: (level) => `need${level}`, coverWord: (level) => `cover${level}`,
  fitWord: (option) => (option.fit.failsMust.length ? 'fails a must' : `${Math.round((option.fit.fit ?? 0) * 100)} %`),
  short: (count) => `${count} short`,
}

describe('a comparison as a table', () => {
  const reading = readComparison(BLOCK, {
    contexts: ['cx'], options: ['a', 'b'], chosen: 'b',
    coverage: { a: { route: { level: 4 }, audit: { level: 2, how: 'Logs, "signed"' } }, b: { route: { level: 2 }, audit: { level: 4 } } },
  })

  it('says the options in rank order with rank, fit and choice, then each capability\'s need, coverage, shortfall and note', () => {
    expect(comparisonTable(reading, WORDS)).toEqual([
      ['Capability', 'must', 'Needed here', 'Bus', 'Bus: note', 'Broker A', 'Broker A: note'],
      ['Rank', '', '', '1', '', '2', ''],
      ['Fit', '', '', '67 %', '', 'fails a must', ''],
      ['chosen', '', '', 'chosen', '', '', ''],
      ['Routes, by content', '', '4/4 need4', '2/4 cover2, 2 short', '', '4/4 cover4', ''],
      ['Audits', 'must', '2/4 need2', '4/4 cover4', '', '2/4 cover2, 2 short', 'Logs, "signed"'],
    ])
  })

  it('is written tab-separated to paste and as CSV to save, quoting what would break a cell', () => {
    const table = comparisonTable(reading, WORDS)
    expect(asTabbed(table).split('\n')[5]).toBe('Audits\tmust\t2/4 need2\t4/4 cover4\t\t2/4 cover2, 2 short\tLogs, "signed"')
    expect(asCsv(table).split('\n')[5]).toBe('Audits,must,2/4 need2,4/4 cover4,,"2/4 cover2, 2 short","Logs, ""signed"""')
  })

  it('names its file after the block and the scope', () => {
    expect(comparisonFileName('Message gateway', 'Rail / Freight')).toBe('message-gateway-rail-freight.csv')
    expect(comparisonFileName('', '')).toBe('comparison.csv')
  })
})

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { CHECK_CATALOGUE } from '../../model/checkCatalogue'
import type { CheckKey } from '../../model/checkCatalogue'
import { acceptedCount, firstAccepted, firstCheck, foundGroups, heldByTwo, walkable, workSections } from './checksView'
import type { CheckInstance, CheckRow } from './treeChecks'

const instance = (key: CheckKey, over: Partial<CheckInstance> = {}): CheckInstance => ({
  key, scope: 'a', text: 'said', finding: {} as never, id: `${key}-${Math.random()}`, attributes: {}, ...over,
})
const row = (key: CheckKey, found: number, counted = true): CheckRow => ({
  key, entry: CHECK_CATALOGUE[key], shown: Array.from({ length: found }, () => instance(key)), marked: [], counted,
})
const CATEGORIES = [{ category: 'landscape' as const, rows: [row('check.conflict', 2), row('check.drift', 0), row('check.unattributed', 3), row('check.notDrawn', 0, false)] }]

describe('the work list', () => {
  it('lists only what was found under each weight, and folds the rest into a line each', () => {
    const sections = workSections(CATEGORIES, 'weight')
    expect(sections.map((one) => [one.kind, one.count])).toEqual([['fix', 2], ['review', 3], ['nothing', 1], ['notCounted', 1]])
  })

  it('lists a check whose findings were all marked as intended under what was accepted, not among those that found nothing', () => {
    const allMarked: CheckRow = { ...row('check.proposal', 0), marked: Array.from({ length: 46 }, () => ({ instance: instance('check.proposal'), mark: {} as never, keptIn: 'a' })) }
    const categories = [{ category: 'landscape' as const, rows: [...CATEGORIES[0]!.rows, allMarked] }]
    const sections = workSections(categories, 'weight')
    expect(sections.map((one) => [one.kind, one.count])).toEqual([['fix', 2], ['review', 3], ['accepted', 46], ['nothing', 1], ['notCounted', 1]])
    expect(sections.find((one) => one.kind === 'nothing')?.rows.map((one) => one.key)).toEqual(['check.drift'])
    expect(acceptedCount(categories)).toBe(46)
    expect(firstAccepted(categories)).toBe('check.proposal')
    expect(firstAccepted(CATEGORIES)).toBeUndefined()
  })

  it('opens on the first fix, not on a review with more found', () => {
    expect(firstCheck(CATEGORIES)).toBe('check.conflict')
  })

  it('keeps every check, zeros too, grouped by category', () => {
    const sections = workSections(CATEGORIES, 'category')
    expect(sections[0]?.rows.map((one) => one.key)).toContain('check.drift')
  })

  it('says a scope under each scope a check was found in', () => {
    const split = [{ category: 'landscape' as const, rows: [{ ...row('check.conflict', 0), shown: [instance('check.conflict', { scope: 'a' }), instance('check.conflict', { scope: 'b' })] }] }]
    expect(workSections(split, 'scope').map((one) => [one.scope, one.count])).toEqual([['a', 1], ['b', 1]])
  })

  it('says how many two checks hold only where that is most of them', () => {
    expect(heldByTwo([row('check.conflict', 8), row('check.drift', 8), row('check.unattributed', 1)])).toBe(16)
    expect(heldByTwo([row('check.conflict', 1), row('check.drift', 1), row('check.unattributed', 1), row('check.proposal', 1), row('check.dangling', 1)])).toBeUndefined()
  })
})

describe('a found list', () => {
  it('groups by what its findings say, and walks only what can be gone to', () => {
    const shown = [instance('check.roleVacant', { role: 'Lead', opens: { home: '' } }), instance('check.roleVacant', { role: 'Member', scope: 'b' })]
    expect(foundGroups(shown)).toEqual(['role', 'master'])
    expect(walkable({ shown })).toHaveLength(1)
  })
})

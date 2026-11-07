// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { DesignElement } from '../model'
import type { FunctionCoverage } from './coverage'
import { isSheetLens, lensCounts, lensValue, sheetLenses } from './lens'
import type { LensFacts } from './lens'

const fn = (over: Partial<DesignElement> = {}): DesignElement => ({ id: 'f', kind: 'function', name: 'F', lifecycle: 'live', ...over } as DesignElement)
const cover = (over: Partial<FunctionCoverage>): FunctionCoverage => ({ supportedBy: [], assignedTo: [], coverage: 'uncovered', ...over })
const facts = (coverage: FunctionCoverage, over: Partial<LensFacts> = {}): LensFacts => ({ coverage: () => coverage, retiring: () => false, ...over })
const scale = { key: 'maturity', label: 'Maturity', min: 1, max: 5 }

describe('the lens over a function', () => {
  it('says the gap, a complete answer by people, and how many applications', () => {
    expect(lensValue(fn(), 'coveredBy', facts(cover({}))).value).toBe('none')
    expect(lensValue(fn(), 'coveredBy', facts(cover({ assignedTo: ['u'], coverage: 'manual' }))).value).toBe('people')
    expect(lensValue(fn(), 'coveredBy', facts(cover({ supportedBy: ['a', 'b'], coverage: 'covered' })))).toEqual({ value: 'apps', said: '2' })
  })

  it('calls a function moving while one of its applications is on its way out', () => {
    const moving = facts(cover({ supportedBy: ['old', 'new'], coverage: 'covered' }), { retiring: (id) => id === 'old' })
    expect(lensValue(fn(), 'coveredBy', moving).value).toBe('moving')
    expect(lensValue(fn(), 'retiring', moving)).toEqual({ value: 'retiring', names: ['old'] })
  })

  it('names who answers, and says nobody where nobody does', () => {
    expect(lensValue(fn(), 'who', facts(cover({ assignedTo: ['u'], coverage: 'manual' })))).toEqual({ value: 'held', names: ['u'] })
    expect(lensValue(fn(), 'who', facts(cover({}))).value).toBe('nobody')
  })

  it('tells handed on from taken up', () => {
    const none = cover({})
    expect(lensValue(fn({ scopes: ['a'] }), 'domains', facts(none)).value).toBe('handed')
    expect(lensValue(fn({ scopes: ['a'] }), 'domains', facts(none, { takenUpBy: () => ['a'] })).value).toBe('taken')
    expect(lensValue(fn(), 'domains', facts(none, { takenUpBy: () => ['a'] })).value).toBe('unasked')
    expect(lensValue(fn(), 'domains', facts(none)).value).toBe('nobody')
  })

  it('draws a rating in five steps with its number, and leaves an unrated row blank', () => {
    const at = facts(cover({}), { scales: [scale] })
    expect(lensValue(fn({ ratings: { maturity: 1 } }), 'aspect:maturity', at)).toEqual({ value: '1', heat: 1, said: '1' })
    expect(lensValue(fn({ ratings: { maturity: 5 } }), 'aspect:maturity', at)).toEqual({ value: '5', heat: 5, said: '5' })
    expect(lensValue(fn(), 'aspect:maturity', at)).toEqual({ value: 'unrated' })
  })
})

describe('the questions on offer', () => {
  it('lists what the host can answer and each scale', () => {
    expect(sheetLenses([scale], { who: true, domains: false })).toEqual(['coveredBy', 'who', 'lifecycle', 'retiring', 'aspect:maturity'])
  })

  it('takes only a word it knows from an address', () => {
    expect(isSheetLens('who')).toBe(true)
    expect(isSheetLens('aspect:maturity', [scale])).toBe(true)
    expect(isSheetLens('aspect:gone', [scale])).toBe(false)
    expect(isSheetLens('hue')).toBe(false)
  })
})

describe('the counts', () => {
  it('counts each value once per function', () => {
    expect([...lensCounts([{ value: 'a' }, { value: 'b' }, { value: 'a' }])]).toEqual([['a', 2], ['b', 1]])
  })
})

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The index over every kind of record: built once per model, and on a step
 * only the record the step touched is folded again (ADR-0002, ADR-0029).
 */
import { describe, expect, it } from 'vitest'
import { recordIndex } from './recordIndex'
import { apply } from '../model/reducer'
import { fromArrays, toArrays } from '../model/normalised'
import type { HostModel } from '../model/hostModel'
import type { Observation } from '../model/observation'
import type { SearchTable } from '../model/searchable'
import { SEARCHABLE } from '../model/searchable'
import { syntheticModel } from '../model/testing/synthetic'

const observation = (n: number): Observation => ({
  id: `ob-${n}`, number: n, title: `Observation ${n}`, date: '2026-09-01', impact: 'minor', seen: 1, body: `Seen ${n} times.`, history: [],
})

const model: HostModel = { ...syntheticModel('small'), observations: Array.from({ length: 20 }, (_, n) => observation(n + 1)) }

describe('the index over every kind of record', () => {
  it('is built once per model', () => {
    expect(recordIndex(model)).toBe(recordIndex(model))
  })

  it('holds every kind, in its declared order', () => {
    const index = recordIndex(model)
    const elements = index.byKind.get('element') ?? []
    const names = elements.map((entry) => entry.record.title)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
    expect((index.byKind.get('observation') ?? []).map((entry) => entry.record.id)).toEqual(model.observations?.map((one) => one.id))
    expect(index.byKind.get('experiment')).toEqual([])
  })

  it('folds again only the record a step touched', () => {
    const before = recordIndex(model)
    const step = apply(fromArrays(model), { type: 'observation.update', id: 'ob-3', patch: { title: 'Renamed' } })
    if (!step.ok) throw new Error(step.reason)
    const after = recordIndex(toArrays(step.model))
    expect(after).not.toBe(before)
    const entry = (index: typeof before, id: string) => (index.byKind.get('observation') ?? []).find((one) => one.record.id === id)
    expect(entry(after, 'ob-4')).toBe(entry(before, 'ob-4'))
    expect(entry(after, 'ob-3')).not.toBe(entry(before, 'ob-3'))
    expect(entry(after, 'ob-3')?.title).toBe('renamed')
    // The other lists were not touched, so not one of their entries is new.
    const elements = (index: typeof before) => index.byKind.get('element') ?? []
    expect(elements(after).every((one, at) => one === elements(before)[at])).toBe(true)
  })

  it('reads what a table declares and nothing else, so a list gets searched by being declared', () => {
    const only: SearchTable = { ...SEARCHABLE, observations: [], causes: [], solutions: [], experiments: [] }
    expect(recordIndex(model, only).byKind.get('observation')).toEqual([])
    expect(recordIndex(model).byKind.get('observation')).toHaveLength(20)
  })
})

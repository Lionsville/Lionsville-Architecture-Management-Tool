// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { Command } from './commands'
import { fromArrays } from './normalised'
import type { Model } from './normalised'
import { apply } from './reducer'
import { isRecordKind, recordsChanged, sameRecord, sameValue, SCOPE_RECORD, stableText } from './recordKey'
import type { DesignElement } from './types'

function element(id: string, name: string, parentId?: string): DesignElement {
  return { id, kind: 'application', name, lifecycle: 'live', isManaged: true, aspects: {}, ...(parentId ? { parentId } : {}) }
}

function model(): Model {
  return fromArrays({
    name: 'Rail',
    elements: [element('crews', 'Crews'), element('depot', 'Depot'), element('rota', 'Rota', 'crews')],
    relations: [{ id: 'r1', type: 'flow', sourceId: 'crews', targetId: 'depot', isBidirectional: false }],
    diagrams: [
      { id: 'l7', kind: 'layer7', name: 'Landscape', members: [{ id: 'crews' }, { id: 'depot' }], geometry: { nodes: [{ id: 'crews', x: 1, y: 2 }] } },
      { id: 'other', kind: 'layer7', name: 'Other', members: [], geometry: { nodes: [] } },
    ],
  })
}

function after(before: Model, command: Command): Model {
  const result = apply(before, command)
  if (!result.ok) throw new Error(result.reason)
  return result.model
}

describe('a record key', () => {
  it('knows its kinds', () => {
    expect(isRecordKind('image')).toBe(true)
    expect(isRecordKind('row')).toBe(false)
    expect(isRecordKind(3)).toBe(false)
  })

  it('is the same record by kind and id', () => {
    expect(sameRecord({ kind: 'element', id: 'a' }, { kind: 'element', id: 'a' })).toBe(true)
    expect(sameRecord({ kind: 'element', id: 'a' }, { kind: 'diagram', id: 'a' })).toBe(false)
    expect(sameRecord({ kind: 'element', id: 'a' }, { kind: 'element', id: 'b' })).toBe(false)
  })
})

describe('what changed between two models', () => {
  it('is nothing for the same model, and for one the reducer rebuilt with the same values', () => {
    const before = model()
    expect(recordsChanged(before, before)).toEqual([])
    expect(recordsChanged(before, after(before, { type: 'element.update', id: 'crews', patch: { name: 'Crews' } }))).toEqual([])
  })

  it('is the record an update changed', () => {
    const before = model()
    expect(recordsChanged(before, after(before, { type: 'element.update', id: 'crews', patch: { name: 'Crew planning' } })))
      .toEqual([{ kind: 'element', id: 'crews' }])
  })

  it('is everything a delete reached: the record, its relations, the views it was on and its children', () => {
    const before = model()
    const changed = recordsChanged(before, after(before, { type: 'element.delete', id: 'crews' }))
    expect(changed).toEqual(expect.arrayContaining([
      { kind: 'element', id: 'crews' }, { kind: 'relation', id: 'r1' }, { kind: 'diagram', id: 'l7' },
    ]))
    expect(changed).not.toContainEqual({ kind: 'diagram', id: 'other' })
    expect(changed).not.toContainEqual({ kind: 'element', id: 'depot' })
  })

  it('names a record created, and a record in a list the model did not hold before', () => {
    const before = model()
    expect(recordsChanged(before, after(before, { type: 'element.create', element: element('fleet', 'Fleet') })))
      .toEqual([{ kind: 'element', id: 'fleet' }])
    const decided = after(before, {
      type: 'decision.add', decision: { id: 'adr-1', number: 1, title: 'One', status: 'proposed', date: '2026-09-29', body: '', signers: [] },
    })
    expect(recordsChanged(before, decided)).toEqual([{ kind: 'decision', id: 'adr-1' }])
  })

  it('names the scope for its own fields, and for a list only put in another order', () => {
    const before = model()
    expect(recordsChanged(before, after(before, { type: 'project.settings', patch: { description: 'Trains.' } })))
      .toEqual([SCOPE_RECORD])
    const moved = { ...before, order: { ...before.order, elements: ['depot', 'crews', 'rota'] } }
    expect(recordsChanged(before, moved)).toEqual([SCOPE_RECORD])
  })
})

describe('the same value', () => {
  it('is the same object, or the same when written down, whatever order its keys are in', () => {
    const one = { a: 1, b: { c: 2 } }
    expect(sameValue(one, one)).toBe(true)
    expect(sameValue(one, { b: { c: 2 }, a: 1 })).toBe(true)
    expect(sameValue(one, { a: 1, b: { c: 3 } })).toBe(false)
    expect(sameValue(undefined, one)).toBe(false)
    expect(stableText(undefined)).toBe('undefined')
  })
})

import { describe, expect, it } from 'vitest'
import type { ModelChange } from '../../model/diff'
import { changesFor } from './changesFor'

const changes: ModelChange[] = [
  { kind: 'changed', what: 'element', id: 'billing', name: 'Billing', fields: ['description'] },
  { kind: 'changed', what: 'element', id: 'crm', name: 'CRM', fields: ['vendor'] },
  { kind: 'removed', what: 'element', id: 'crews', name: 'Crews' },
  { kind: 'changed', what: 'diagram', id: 'd1', name: 'Landscape', fields: ['name'] },
  { kind: 'changed', what: 'placement', id: 'd1', name: 'Landscape', count: 12 },
  { kind: 'changed', what: 'placement', id: 'd2', name: 'Billing view', count: 1 },
  { kind: 'added', what: 'decision', id: 'adr-1', name: 'ADR-0001' },
]

describe('changesFor', () => {
  it('is everything without a subject', () => {
    expect(changesFor(changes, undefined)).toEqual(changes)
  })

  it('is a diagram\'s own row and its geometry', () => {
    expect(changesFor(changes, { what: 'diagram', id: 'd1' }).map((c) => c.what))
      .toEqual(['diagram', 'placement'])
  })

  it('is an element\'s row only where the description is among what changed', () => {
    expect(changesFor(changes, { what: 'description', id: 'billing' })).toHaveLength(1)
    expect(changesFor(changes, { what: 'description', id: 'crm' })).toHaveLength(0)
    // An element that went took its description with it.
    expect(changesFor(changes, { what: 'description', id: 'crews' })).toHaveLength(1)
  })

  it('is a decision\'s row', () => {
    expect(changesFor(changes, { what: 'decision', id: 'adr-1' })).toHaveLength(1)
    expect(changesFor(changes, { what: 'decision', id: 'd1' })).toHaveLength(0)
  })
})

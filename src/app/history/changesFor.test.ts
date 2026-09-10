import { describe, expect, it } from 'vitest'
import type { ModelChange } from '../../model/diff'
import { changesFor } from './changesFor'

const changes: ModelChange[] = [
  { kind: 'changed', what: 'element', id: 'billing', name: 'Billing', fields: ['description'] },
  { kind: 'changed', what: 'element', id: 'crm', name: 'CRM', fields: ['vendor'] },
  { kind: 'removed', what: 'element', id: 'crews', name: 'Crews' },
  { kind: 'changed', what: 'diagram', id: 'd1', name: 'Landscape', fields: ['name'] },
  { kind: 'changed', what: 'geometry', id: 'd1', name: 'Landscape', count: 12 },
  { kind: 'changed', what: 'geometry', id: 'd2', name: 'Billing view', count: 1 },
  { kind: 'added', what: 'membership', id: 'billing', name: 'Billing', on: 'Landscape', onId: 'd1' },
  { kind: 'added', what: 'decision', id: 'adr-1', name: 'ADR-0001' },
]

describe('changesFor', () => {
  it('is everything without a subject', () => {
    expect(changesFor(changes, undefined)).toEqual(changes)
  })

  it('is a diagram\'s own row, its geometry and what came onto it', () => {
    expect(changesFor(changes, { what: 'diagram', id: 'd1' }).map((c) => c.what))
      .toEqual(['diagram', 'geometry', 'membership'])
  })

  it('files membership under the view, not under the element it names', () => {
    // The row's id is the element's, so filtering on it alone would put "put
    // Billing on Landscape" on Billing's description page and nowhere near the
    // board it happened to.
    expect(changesFor(changes, { what: 'diagram', id: 'd2' }).map((c) => c.what))
      .toEqual(['geometry'])
    expect(changesFor(changes, { what: 'description', id: 'billing' }).map((c) => c.what))
      .toEqual(['element'])
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

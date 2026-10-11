// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** The records that point at a person by id (ADR-0036 §8): what *Points at them* lists. */
import { describe, expect, it } from 'vitest'
import { pointersIn } from './pointers'
import type { PointedModel } from './pointers'

const model: PointedModel = {
  elements: [
    { id: 'shop', kind: 'application', name: 'Webshop', owner: { person: 'pe-eva' }, lifecycle: 'live', isManaged: true, aspects: {} },
    { id: 'erp', kind: 'application', name: 'ERP', owner: 'Eva Lind', lifecycle: 'live', isManaged: true, aspects: {} },
    { id: 'crm', kind: 'application', name: 'CRM', ref: 'sales', lifecycle: 'live', isManaged: false, aspects: {} },
  ],
  transitions: [{ id: 'tr-1', number: 7, title: 'Replace the ERP', status: 'draft', owner: { person: 'pe-old' }, elements: [], decisions: [], milestones: [], body: '' }],
  observations: [{ id: 'ob-1', number: 3, title: 'Orders arrive twice', date: '2026-10-01', by: { person: 'pe-eva' }, impact: 'minor', seen: 1, body: '', history: [] }],
  experiments: [{ id: 'ex-1', number: 1, title: 'Deduplicate', tests: [], hypothesis: 'h', by: { person: 'pe-eva' }, outcome: 'planned', body: '' }],
  decisions: [{
    id: 'ad-1', number: 4, title: 'One order store', status: 'accepted', date: '2026-09-01', body: '',
    proposedBy: { person: 'pe-eva' }, proposedAs: 'Eva Lind',
    signers: [{ name: { person: 'pe-eva' }, verdict: 'approved', signedAt: '2026-09-01', signedAs: 'Eva Lind' }, { name: 'The board' }, { name: { person: 'pe-old' } }],
  }],
}

describe('the records that point at a person', () => {
  it('lists every field that holds one of their ids, in the model’s order, and the names signatures kept', () => {
    expect(pointersIn(model, new Set(['pe-eva', 'pe-old']))).toEqual([
      { kind: 'element', id: 'shop', title: 'Webshop', field: 'owner', person: 'pe-eva' },
      { kind: 'plan', id: 'tr-1', label: 'TR-0007', title: 'Replace the ERP', field: 'owner', person: 'pe-old' },
      { kind: 'observation', id: 'ob-1', label: 'OB-0003', title: 'Orders arrive twice', field: 'seenBy', person: 'pe-eva' },
      { kind: 'experiment', id: 'ex-1', label: 'EX-0001', title: 'Deduplicate', field: 'runBy', person: 'pe-eva' },
      { kind: 'decision', id: 'ad-1', label: 'ADR-0004', title: 'One order store', field: 'proposed', person: 'pe-eva', signedAs: 'Eva Lind' },
      { kind: 'decision', id: 'ad-1', label: 'ADR-0004', title: 'One order store', field: 'signer', person: 'pe-eva', signedAs: 'Eva Lind' },
      { kind: 'decision', id: 'ad-1', label: 'ADR-0004', title: 'One order store', field: 'signer', person: 'pe-old' },
    ])
  })

  it('lists nothing for text, which points at nobody, nor for another person', () => {
    expect(pointersIn(model, new Set(['pe-nobody']))).toEqual([])
    expect(pointersIn({}, new Set(['pe-eva']))).toEqual([])
  })
})

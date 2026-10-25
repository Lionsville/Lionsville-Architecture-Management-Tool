// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { fromArrays, principleList } from '../normalised'
import type { Principle } from '../principle'
import { apply } from '../reducer'

const reuse: Principle = {
  id: 'pr-1', number: 1, title: 'Reuse first', statement: 'Reuse before buy before build.',
  aspects: [{ id: 'a1', number: 1, text: 'Look for one first', nature: 'design' }], lastAspect: 1,
  groups: [], regime: 'flexible', status: 'accepted',
}
const empty = () => fromArrays({ name: 'Acme', elements: [], relations: [], diagrams: [] })
const held = () => fromArrays({ name: 'Acme', elements: [], relations: [], diagrams: [], principles: [reuse] })

function landed(result: ReturnType<typeof apply>) {
  if (!result.ok) throw new Error(result.reason)
  return result
}

describe('a principle\'s commands (ADR-0041 §11)', () => {
  it('adds one, and undoes it', () => {
    const added = landed(apply(empty(), { type: 'principle.add', principle: reuse }))
    expect(principleList(added.model)).toEqual([reuse])
    expect(principleList(landed(apply(added.model, added.inverse)).model)).toEqual([])
  })

  it('refuses one with no aspect, no title, or an id it already holds', () => {
    expect(apply(empty(), { type: 'principle.add', principle: { ...reuse, aspects: [] } })).toEqual({ ok: false, reason: 'command.aspectsEmpty' })
    expect(apply(empty(), { type: 'principle.add', principle: { ...reuse, title: ' ' } })).toEqual({ ok: false, reason: 'command.titleEmpty' })
    expect(apply(held(), { type: 'principle.add', principle: reuse })).toMatchObject({ ok: false, reason: 'command.taken' })
  })

  it('refuses sharpening an accepted principle without its note, and lands it with one', () => {
    expect(apply(held(), { type: 'principle.update', id: 'pr-1', patch: { statement: 'Reuse, always.' } }))
      .toEqual({ ok: false, reason: 'command.sharpenNote' })
    const noted = landed(apply(held(), {
      type: 'principle.update', id: 'pr-1', patch: { statement: 'Reuse, always.', sharpened: [{ on: '2026-10-25', note: 'Plainer' }] },
    }))
    expect(principleList(noted.model)[0].sharpened).toEqual([{ on: '2026-10-25', note: 'Plainer' }])
    // The undo takes the note back with the change, and is let through.
    expect(principleList(landed(apply(noted.model, noted.inverse)).model)).toEqual([reuse])
  })

  it('lets a candidate change freely, and refuses an aspect numbered past the highest given', () => {
    const candidate = fromArrays({ name: 'Acme', elements: [], relations: [], diagrams: [], principles: [{ ...reuse, status: 'candidate' }] })
    landed(apply(candidate, { type: 'principle.update', id: 'pr-1', patch: { statement: 'Anything' } }))
    expect(apply(candidate, { type: 'principle.update', id: 'pr-1', patch: { aspects: [{ ...reuse.aspects[0], number: 5 }] } }))
      .toEqual({ ok: false, reason: 'command.aspectNumber' })
  })

  it('removes one and puts it back where it stood', () => {
    const second = { ...reuse, id: 'pr-2', number: 2 }
    const two = fromArrays({ name: 'Acme', elements: [], relations: [], diagrams: [], principles: [reuse, second] })
    const removed = landed(apply(two, { type: 'principle.remove', id: 'pr-1' }))
    expect(principleList(removed.model)).toEqual([second])
    expect(principleList(landed(apply(removed.model, removed.inverse)).model)).toEqual([reuse, second])
  })
})

describe('the scope\'s groups (ADR-0041 §3)', () => {
  it('are the scope\'s own settings, set whole and undone whole', () => {
    const set = landed(apply(empty(), { type: 'project.settings', patch: { principleGroups: [{ id: 'pg-1', name: 'Data' }] } }))
    expect(set.model.principleGroups).toEqual([{ id: 'pg-1', name: 'Data' }])
    expect(landed(apply(set.model, set.inverse)).model.principleGroups).toBeUndefined()
  })

  it('refuses a group with no name or an id said twice', () => {
    expect(apply(empty(), { type: 'project.settings', patch: { principleGroups: [{ id: 'pg-1', name: '' }] } })).toEqual({ ok: false, reason: 'command.badGroups' })
    expect(apply(empty(), { type: 'project.settings', patch: { principleGroups: [{ id: 'pg-1', name: 'A' }, { id: 'pg-1', name: 'B' }] } }))
      .toEqual({ ok: false, reason: 'command.badGroups' })
  })
})

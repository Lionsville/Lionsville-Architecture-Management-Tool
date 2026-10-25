// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import {
  aspectsRefusal, formatAspectNumber, formatPrincipleNumber, isCitable, mergePrinciples, nextPrincipleNumber, sharpenRefusal,
  sharpens, withAspect,
} from './principle'
import type { Principle } from './principle'

const base: Principle = {
  id: 'pr-1', number: 1, title: 'Reuse first', statement: 'Reuse before buy before build.',
  aspects: [{ id: 'a1', number: 1, text: 'Look for one first', nature: 'design' }], lastAspect: 1,
  groups: ['pg-1'], regime: 'flexible', status: 'accepted',
}

describe('a principle\'s numbers (ADR-0041 §1, §2)', () => {
  it('says PR-0001 and PR-0001.2, and numbers the next after the highest', () => {
    expect(formatPrincipleNumber(7)).toBe('PR-0007')
    expect(formatAspectNumber(7, 2)).toBe('PR-0007.2')
    expect(nextPrincipleNumber([{ number: 3 }, { number: 1 }])).toBe(4)
    expect(nextPrincipleNumber([])).toBe(1)
  })

  it('never gives an aspect a number used before, a removed one\'s included', () => {
    const removed = { ...base, aspects: [], lastAspect: 3 }
    const added = withAspect(removed, { id: 'a4', text: 'New', nature: 'behaviour' })
    expect(added.aspects[0].number).toBe(4)
    expect(added.lastAspect).toBe(4)
  })

  it('refuses no aspect, a number said twice, and one past the highest given', () => {
    expect(aspectsRefusal(base)).toBeUndefined()
    expect(aspectsRefusal({ ...base, aspects: [] })).toBe('aspectsEmpty')
    expect(aspectsRefusal({ ...base, aspects: [...base.aspects, { ...base.aspects[0], id: 'a2' }] })).toBe('aspectNumber')
    expect(aspectsRefusal({ ...base, aspects: [{ ...base.aspects[0], number: 2 }] })).toBe('aspectNumber')
  })
})

describe('sharpening an accepted principle (ADR-0041 §4)', () => {
  it('is a change to its statement or to what its aspects claim, while accepted', () => {
    expect(sharpens(base, { ...base, statement: 'Reuse first, always.' })).toBe(true)
    expect(sharpens(base, { ...base, aspects: [{ ...base.aspects[0], text: 'Look harder' }] })).toBe(true)
    expect(sharpens(base, { ...base, title: 'Renamed' })).toBe(false)
    expect(sharpens({ ...base, status: 'candidate' }, { ...base, status: 'candidate', statement: 'Other' })).toBe(false)
    // Words around the edges are no change.
    expect(sharpens(base, { ...base, statement: ' Reuse before buy before build. ' })).toBe(false)
  })

  it('asks for a note with it, and lets an undo take the note back with the change', () => {
    const sharper = { ...base, statement: 'Reuse first, always.' }
    expect(sharpenRefusal(base, sharper)).toBe('sharpenNote')
    const noted = { ...sharper, sharpened: [{ on: '2026-10-25', note: 'Said more plainly' }] }
    expect(sharpenRefusal(base, noted)).toBeUndefined()
    expect(sharpenRefusal(noted, base)).toBeUndefined()
  })
})

describe('merging principles (ADR-0041 §6)', () => {
  it('brings the absorbed aspects after the survivor\'s own, renumbered, with their groups, and keeps them as history', () => {
    const other: Principle = {
      ...base, id: 'pr-2', number: 2, groups: ['pg-2'], keywords: ['reuse'],
      aspects: [{ id: 'b1', number: 1, text: 'Ask the catalogue', nature: 'behaviour' }, { id: 'b3', number: 3, text: 'Write it down', nature: 'behaviour' }],
      lastAspect: 3, relations: [{ kind: 'refines', to: { scope: '', id: 'pr-1' } }],
    }
    const merged = mergePrinciples(base, [other])
    expect(merged.survivor.aspects.map((one) => [one.number, one.text])).toEqual([[1, 'Look for one first'], [2, 'Ask the catalogue'], [3, 'Write it down']])
    expect(merged.survivor.lastAspect).toBe(3)
    expect(merged.survivor.groups).toEqual(['pg-1', 'pg-2'])
    expect(merged.survivor.keywords).toEqual(['reuse'])
    // A relation to the survivor itself would be one to itself: it goes.
    expect(merged.survivor.relations).toBeUndefined()
    expect(merged.absorbed).toEqual([{ ...other, mergedInto: 'pr-1' }])
    expect(merged.renumbered).toEqual([{ from: 'pr-2', aspect: 1, now: 2 }, { from: 'pr-2', aspect: 3, now: 3 }])
  })

  it('is cited anew only while standing and not retired', () => {
    expect(isCitable(base)).toBe(true)
    expect(isCitable({ ...base, status: 'retired' })).toBe(false)
    expect(isCitable({ ...base, mergedInto: 'pr-9' })).toBe(false)
  })
})

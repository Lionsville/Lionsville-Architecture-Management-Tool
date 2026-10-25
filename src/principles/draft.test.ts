// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { Principle } from '../model/principle'
import { draftOf, draftReady, draftSharpens, principleOf, withNewAspect } from './draft'

const held: Principle = {
  id: 'pr-1', number: 3, title: 'Reuse first', statement: 'Reuse before buy.', question: 'Old',
  aspects: [{ id: 'a1', number: 2, text: 'Look first', nature: 'design' }], lastAspect: 4,
  groups: ['pg-1'], regime: 'flexible', status: 'accepted', acceptedOn: '2026-09-01', keywords: ['reuse'],
}

describe('a principle as its editor holds it (ADR-0041)', () => {
  it('numbers an added aspect past every number given, the principle\'s removed ones included', () => {
    const draft = withNewAspect(draftOf(held), 'a-new')
    expect(draft.aspects.map((one) => one.number)).toEqual([2, 5])
    expect(draft.lastAspect).toBe(5)
    expect(withNewAspect(draftOf(undefined), 'a').aspects[0].number).toBe(1)
  })

  it('says the principle it makes: trimmed, empty fields and aspects left out, the accepted day kept', () => {
    const draft = { ...withNewAspect(draftOf(held), 'a-new'), title: '  Reuse first ', keywords: 'reuse, , catalogue', rationale: '  ' }
    const made = principleOf(draft, held, ['pg-1', 'pg-2'], '2026-10-25')
    expect(made).toMatchObject({ id: 'pr-1', number: 3, title: 'Reuse first', keywords: ['reuse', 'catalogue'], groups: ['pg-1', 'pg-2'], acceptedOn: '2026-09-01', lastAspect: 5 })
    expect(made.aspects.map((one) => one.number)).toEqual([2])
    expect(made).not.toHaveProperty('rationale')
    // A question belongs to a candidate only.
    expect(made).not.toHaveProperty('question')
  })

  it('dates an acceptance made in the editor, and drops the day of one taken back', () => {
    const candidate = { ...held, status: 'candidate' as const, acceptedOn: undefined }
    delete candidate.acceptedOn
    expect(principleOf({ ...draftOf(candidate), status: 'accepted' }, candidate, [], '2026-10-25').acceptedOn).toBe('2026-10-25')
    expect(principleOf({ ...draftOf(held), status: 'candidate' }, held, [], '2026-10-25')).not.toHaveProperty('acceptedOn')
  })

  it('knows when saving sharpens an accepted principle, and when the draft is ready', () => {
    expect(draftSharpens({ ...draftOf(held), statement: 'Reuse, always.' }, held, '2026-10-25')).toBe(true)
    expect(draftSharpens({ ...draftOf(held), title: 'Renamed' }, held, '2026-10-25')).toBe(false)
    expect(draftSharpens(draftOf(undefined), undefined, '2026-10-25')).toBe(false)
    expect(draftReady(draftOf(held))).toBe(true)
    expect(draftReady({ ...draftOf(held), aspects: [{ ...held.aspects[0], text: ' ' }] })).toBe(false)
  })
})

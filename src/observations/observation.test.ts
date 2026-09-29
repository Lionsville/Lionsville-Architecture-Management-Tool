// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { translator } from '../i18n'
import {
  absorbShared, absorbedBy, causeDepth, causeEvidence, explainedBy, formatCauseNumber, formatObservationNumber,
  isArchived, isMerged, isRootCause, linkCause, liveObservations, mergeObservations, newCause, newObservation,
  nextCauseNumber, nextObservationNumber, removeCause, removeObservation, rootCauses, seenAgain, seenDayProblem,
  setArchived, setShared, unlinkCause, updateCause, updateObservation, verifyCause, withConfirmation,
} from './observation'
import type { Analysis, Cause, Observation } from './observation'

const t = translator('en')

const observation = (over: Partial<Observation>): Observation => ({
  id: 'o1', number: 1, title: 'Batch overruns', date: '2026-09-08', impact: 'major', seen: 1, body: '',
  history: [{ date: '2026-09-08', kind: 'recorded' }], ...over,
})
const cause = (over: Partial<Cause>): Cause => ({
  id: 'c1', number: 1, title: 'Window too small', state: 'assumed', body: '', explains: [], ...over,
})

describe('numbering', () => {
  it('formats as OB- and CA- with four digits', () => {
    expect(formatObservationNumber(7)).toBe('OB-0007')
    expect(formatCauseNumber(12)).toBe('CA-0012')
  })
  it('is one past the highest, and never reuses a gap', () => {
    expect(nextObservationNumber([])).toBe(1)
    expect(nextObservationNumber([observation({ number: 4 }), observation({ id: 'o2', number: 2 })])).toBe(5)
    expect(nextCauseNumber([cause({ number: 3 })])).toBe(4)
  })
})

describe('a new record', () => {
  it('starts seen once, local, with a recorded event and the template', () => {
    const fresh = newObservation({ id: 'x', number: 1, title: '  Duplicate customers ', date: '2026-09-10', t })
    expect(fresh.title).toBe('Duplicate customers')
    expect(fresh.seen).toBe(1)
    expect(fresh.shared).toBeUndefined()
    expect(fresh.impact).toBe('minor')
    expect(fresh.history).toEqual([{ date: '2026-09-10', kind: 'recorded' }])
    expect(fresh.body.match(/^## /gm)?.length).toBe(3)
  })
  it('records the share on the day when it is shared from the start', () => {
    const fresh = newObservation({ id: 'x', number: 1, title: 'T', date: '2026-09-10', t, shared: true, where: ' Claims desk ' })
    expect(fresh.shared).toBe(true)
    expect(fresh.where).toBe('Claims desk')
    expect(fresh.history.map((one) => one.kind)).toEqual(['recorded', 'shared'])
  })
  it('a cause starts assumed and explains nothing', () => {
    const fresh = newCause({ id: 'c', number: 1, title: 'Why', t })
    expect(fresh.state).toBe('assumed')
    expect(fresh.explains).toEqual([])
    expect(fresh.body.match(/^## /gm)?.length).toBe(2)
  })
})

describe('seeing, sharing, editing', () => {
  it('seen again counts one more and dates it', () => {
    const list = seenAgain([observation({})], 'o1', '2026-09-12', 'Monday run')
    expect(list[0].seen).toBe(2)
    expect(list[0].history.at(-1)).toEqual({ date: '2026-09-12', kind: 'seen', note: 'Monday run' })
  })
  it('sharing writes the change of mind and not the confirmation', () => {
    const shared = setShared([observation({})], 'o1', true, '2026-09-12')
    expect(shared[0].shared).toBe(true)
    expect(shared[0].history.at(-1)?.kind).toBe('shared')
    const again = setShared(shared, 'o1', true, '2026-09-13')
    expect(again[0].history).toHaveLength(2)
    const back = setShared(again, 'o1', false, '2026-09-14')
    expect(back[0].shared).toBeUndefined()
    expect(back[0].history.at(-1)?.kind).toBe('unshared')
  })
  it('an emptied where is dropped rather than kept blank', () => {
    const list = updateObservation([observation({ where: 'Desk' })], 'o1', { where: '  ', title: ' New ' })
    expect(list[0].where).toBeUndefined()
    expect(list[0].title).toBe('New')
  })
  it('who saw it is free text, trimmed on the way in and dropped when emptied', () => {
    const fresh = newObservation({ id: 'x', number: 1, title: 'T', date: '2026-09-10', t, by: '  W.S. ' })
    expect(fresh.by).toBe('W.S.')
    expect(newObservation({ id: 'x', number: 1, title: 'T', date: '2026-09-10', t, by: ' ' }).by).toBeUndefined()
    expect(updateObservation([fresh], 'x', { by: '' })[0].by).toBeUndefined()
    expect(updateObservation([fresh], 'x', { by: 'The desk' })[0].by).toBe('The desk')
  })
})

describe('archiving', () => {
  it('closes the record with the day and the note, keeps it, and takes it out of the live ones', () => {
    const closed = setArchived([observation({}), observation({ id: 'o2', number: 2 })], 'o1', true, '2026-09-20', ' Fixed by the window change ')
    expect(closed).toHaveLength(2)
    expect(isArchived(closed[0])).toBe(true)
    expect(closed[0].history.at(-1)).toEqual({ date: '2026-09-20', kind: 'archived', note: 'Fixed by the window change' })
    expect(liveObservations(closed).map((one) => one.id)).toEqual(['o2'])
  })
  it('writes the change of mind and not the confirmation, and restores the same way', () => {
    const closed = setArchived([observation({})], 'o1', true, '2026-09-20')
    expect(setArchived(closed, 'o1', true, '2026-09-21')).toEqual(closed)
    const back = setArchived(closed, 'o1', false, '2026-09-22')
    expect(back[0].archived).toBeUndefined()
    expect(back[0].history.map((one) => one.kind)).toEqual(['recorded', 'archived', 'restored'])
    expect(liveObservations(back)).toHaveLength(1)
  })
  it('an archived observation is neither merged away nor merged into', () => {
    const analysis: Analysis = {
      observations: setArchived([observation({}), observation({ id: 'o2', number: 2 })], 'o1', true, '2026-09-20'),
      causes: [],
    }
    expect(mergeObservations(analysis, 'o1', 'o2', '2026-09-21')).toBe(analysis)
    expect(mergeObservations(analysis, 'o2', 'o1', '2026-09-21')).toBe(analysis)
    const below = { scope: 'acme/x', observation: observation({ id: 'b1', shared: true, archived: true }) }
    expect(absorbShared(analysis, below, 'o2', '2026-09-21')).toBe(analysis)
  })
})

describe('merging', () => {
  const two = (): Analysis => ({
    observations: [observation({}), observation({ id: 'o2', number: 2, title: 'Same thing', seen: 3 })],
    causes: [cause({ explains: [{ id: 'o2', strength: 'weak' }] }), cause({ id: 'c2', number: 2, explains: [{ id: 'o1', strength: 'normal' }, { id: 'o2', strength: 'strong' }] })],
  })
  it('moves the sightings and the links to the survivor, and both records say so', () => {
    const after = mergeObservations(two(), 'o2', 'o1', '2026-09-15')
    const survivor = after.observations.find((one) => one.id === 'o1')!
    const merged = after.observations.find((one) => one.id === 'o2')!
    expect(survivor.seen).toBe(4)
    expect(survivor.history.at(-1)).toEqual({ date: '2026-09-15', kind: 'absorbed', id: 'o2', seen: 3 })
    expect(merged.history.at(-1)).toEqual({ date: '2026-09-15', kind: 'merged', id: 'o1' })
    expect(after.causes[0].explains).toEqual([{ id: 'o1', strength: 'weak' }])
    // Both were explained by c2; the stronger of the two links survives.
    expect(after.causes[1].explains).toEqual([{ id: 'o1', strength: 'strong' }])
  })
  it('is derived from the survivor: the merged one is read as merged, and is not live', () => {
    const after = mergeObservations(two(), 'o2', 'o1', '2026-09-15')
    expect(isMerged(after.observations, 'o2')).toBe(true)
    expect(absorbedBy(after.observations, 'o2')?.id).toBe('o1')
    expect(liveObservations(after.observations).map((one) => one.id)).toEqual(['o1'])
  })
  it('refuses itself, a missing record, and a record merged before', () => {
    const held = two()
    expect(mergeObservations(held, 'o1', 'o1', 'd')).toBe(held)
    expect(mergeObservations(held, 'o9', 'o1', 'd')).toBe(held)
    const once = mergeObservations(held, 'o2', 'o1', 'd')
    expect(mergeObservations(once, 'o2', 'o1', 'd')).toBe(once)
    expect(mergeObservations(once, 'o1', 'o2', 'd')).toBe(once)
  })
  it('absorbs a shared observation from below by writing only the survivor', () => {
    const held: Analysis = {
      observations: [observation({})],
      causes: [cause({ explains: [{ id: 'b1', scope: 'acme/claims', strength: 'strong' }] })],
    }
    const below = { scope: 'acme/claims', observation: observation({ id: 'b1', number: 1, seen: 2, shared: true }) }
    const after = absorbShared(held, below, 'o1', '2026-09-16')
    expect(after.observations).toHaveLength(1)
    expect(after.observations[0].seen).toBe(3)
    expect(after.observations[0].history.at(-1)).toEqual({ date: '2026-09-16', kind: 'absorbed', id: 'b1', scope: 'acme/claims', seen: 2 })
    expect(after.causes[0].explains).toEqual([{ id: 'o1', strength: 'strong' }])
    expect(absorbedBy(after.observations, 'b1', 'acme/claims')?.id).toBe('o1')
    // Not twice.
    expect(absorbShared(after, below, 'o1', 'd')).toBe(after)
  })
})

describe('causes and their links', () => {
  it('links, restrengthens, and refuses a loop or itself', () => {
    let list = [cause({}), cause({ id: 'c2', number: 2 })]
    list = linkCause(list, 'c1', { id: 'o1', strength: 'normal' })
    list = linkCause(list, 'c1', { id: 'o1', strength: 'strong' })
    expect(list[0].explains).toEqual([{ id: 'o1', strength: 'strong' }])
    list = linkCause(list, 'c2', { id: 'c1', strength: 'normal' })
    expect(list[1].explains).toEqual([{ id: 'c1', strength: 'normal' }])
    expect(linkCause(list, 'c1', { id: 'c2', strength: 'weak' })).toEqual(list)
    expect(linkCause(list, 'c1', { id: 'c1', strength: 'weak' })).toEqual(list)
    expect(explainedBy(list, 'c1').map((one) => one.id)).toEqual(['c2'])
    list = unlinkCause(list, 'c2', 'c1')
    expect(list[1].explains).toEqual([])
  })
  it('a root cause explains something and is explained by nothing; depth counts the causes between', () => {
    const list = [
      cause({ explains: [{ id: 'o1', strength: 'strong' }] }),
      cause({ id: 'c2', number: 2, explains: [{ id: 'c1', strength: 'normal' }] }),
      cause({ id: 'c3', number: 3 }),
    ]
    expect(isRootCause(list[0], list)).toBe(false)
    expect(isRootCause(list[1], list)).toBe(true)
    expect(isRootCause(list[2], list)).toBe(false)
    expect(rootCauses(list).map((one) => one.id)).toEqual(['c2'])
    expect(causeDepth(list[0], list)).toBe(1)
    expect(causeDepth(list[1], list)).toBe(2)
    expect(causeDepth(list[2], list)).toBe(1)
  })
  it('removing takes the links with it', () => {
    const held: Analysis = {
      observations: [observation({})],
      causes: [cause({ explains: [{ id: 'o1', strength: 'strong' }] }), cause({ id: 'c2', number: 2, explains: [{ id: 'c1', strength: 'normal' }] })],
    }
    expect(removeCause(held, 'c1').causes).toEqual([cause({ id: 'c2', number: 2, explains: [] })])
    expect(removeObservation(held, 'o1').causes[0].explains).toEqual([])
    expect(removeObservation(held, 'o1').observations).toEqual([])
  })
})

describe('a sighting\'s day', () => {
  it('is today or earlier, and not before the observation was first seen', () => {
    const held = observation({})
    expect(seenDayProblem(held, '2026-09-20', '2026-09-20')).toBeUndefined()
    expect(seenDayProblem(held, '2026-09-08', '2026-09-20')).toBeUndefined()
    expect(seenDayProblem(held, '2026-09-21', '2026-09-20')).toBe('future')
    expect(seenDayProblem(held, '2026-09-07', '2026-09-20')).toBe('beforeFirst')
    expect(seenDayProblem(held, '20-09-2026', '2026-09-20')).toBe('notADay')
  })
})

describe('verifying a cause', () => {
  const evidenced = '## Why we think so\n\nVolumes doubled since 2019.\n\n## How to verify\n\n2026-09-18: the run log shows it.\n'
  it('reads the two sections a cause starts with, in any language the tool speaks', () => {
    expect(causeEvidence(newCause({ id: 'x', number: 1, title: 'X', t }).body)).toEqual({ why: false, verify: false, complete: false })
    expect(causeEvidence(evidenced)).toEqual({ why: true, verify: true, complete: true })
    expect(causeEvidence('## Waarom we dat denken\n\nVolumes.\n\n## Hoe te verifiëren\n\nHet log.\n').complete).toBe(true)
    expect(causeEvidence('## Why we think so\n\nVolumes.\n\n## How to verify\n\n').complete).toBe(false)
    // The German heading before its wording was mended, in a body written then.
    expect(causeEvidence('## Warum wir das annehmen\n\nVolumen.\n\n## Wie zu verifizieren\n\nDas Log.\n').complete).toBe(true)
    expect(causeEvidence('Just a note.').complete).toBe(false)
  })
  it('keeps a cause assumed when verified is asked of a body with no evidence', () => {
    expect(updateCause([cause({})], 'c1', { state: 'verified' })[0].state).toBe('assumed')
    expect(updateCause([cause({})], 'c1', { state: 'verified', body: evidenced })[0].state).toBe('verified')
    expect(updateCause([cause({ state: 'verified' })], 'c1', { state: 'assumed' })[0].state).toBe('assumed')
  })
  it('verifies on the evidence written down, or on what confirmed it, added dated under How to verify', () => {
    const args = { date: '2026-09-20', t }
    expect(verifyCause([cause({ body: evidenced })], 'c1', args)[0].state).toBe('verified')
    const bare = cause({ body: newCause({ id: 'x', number: 1, title: 'X', t }).body })
    expect(verifyCause([bare], 'c1', args)[0]).toBe(bare)
    const [confirmed] = verifyCause([bare], 'c1', { ...args, confirmed: ' The run log for June ' })
    expect(confirmed.state).toBe('verified')
    expect(confirmed.body).toContain('## How to verify\n\n2026-09-20: The run log for June\n')
  })
  it('adds the answer after what the section already says, and makes the section where there is none', () => {
    const written = '## How to verify\n\nRan the query.\n\n## More\n\nx\n'
    expect(withConfirmation(written, 'It held', '2026-09-20', t)).toBe('## How to verify\n\nRan the query.\n\n2026-09-20: It held\n\n## More\n\nx\n')
    expect(withConfirmation('A note.', 'It held', '2026-09-20', t)).toBe('A note.\n\n## How to verify\n\n2026-09-20: It held\n')
  })
})

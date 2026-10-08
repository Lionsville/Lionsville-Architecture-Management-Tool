// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { translator } from '../i18n'
import {
  absorbFromBelow, absorbedBy, causeDepth, causeEvidence, causeLabel, explainedBy, formatCauseNumber, formatObservationNumber,
  isArchived, isMerged, isRootCause, linkCause, linkRefusal, liveObservations, makeCause, makeRootCause, observationsBelow,
  mergeObservations, newCause, newObservation,
  nextCauseNumber, nextObservationNumber, removeCause, removeObservation, rootCauses, seenAgain, seenDayProblem,
  setArchived, unlinkCause, updateCause, updateObservation, verifyCause, withConfirmation, withReason,
  causeTemplate, causeAbsorbedBy, isCauseMerged, liveCauses, mergedInto,
} from './observation'
import type { Analysis, Cause, LinkContext, Observation, ScopeAnalysis } from './observation'

const t = translator('en')

const observation = (over: Partial<Observation>): Observation => ({
  id: 'o1', number: 1, title: 'Batch overruns', date: '2026-09-08', impact: 'major', seen: 1, body: '',
  history: [{ date: '2026-09-08', kind: 'recorded' }], ...over,
})
const cause = (over: Partial<Cause>): Cause => ({
  id: 'c1', number: 1, title: 'Window too small', state: 'assumed', body: '', explains: [], ...over,
})

describe('numbering', () => {
  it('formats as OB- and CA- with four digits, and a root cause as RC- on the same number', () => {
    expect(formatObservationNumber(7)).toBe('OB-0007')
    expect(formatCauseNumber(12)).toBe('CA-0012')
    expect(formatCauseNumber(12, true)).toBe('RC-0012')
    expect(causeLabel(cause({ number: 4 }))).toBe('CA-0004')
    expect(causeLabel(cause({ number: 4, root: true }))).toBe('RC-0004')
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
    expect(fresh.impact).toBe('minor')
    expect(fresh.history).toEqual([{ date: '2026-09-10', kind: 'recorded' }])
    expect(fresh.body.match(/^## /gm)?.length).toBe(3)
  })
  it('trims where it was seen, and records nothing but the day it was written down', () => {
    const fresh = newObservation({ id: 'x', number: 1, title: 'T', date: '2026-09-10', t, where: ' Claims desk ' })
    expect(fresh.where).toBe('Claims desk')
    expect(fresh.history.map((one) => one.kind)).toEqual(['recorded'])
  })
  it('a cause starts assumed and explains nothing', () => {
    const fresh = newCause({ id: 'c', number: 1, title: 'Why', t })
    expect(fresh.state).toBe('assumed')
    expect(fresh.explains).toEqual([])
    expect(fresh.body.match(/^## /gm)?.length).toBe(2)
  })
})

describe('seeing and editing', () => {
  it('seen again counts one more and dates it', () => {
    const list = seenAgain([observation({})], 'o1', '2026-09-12', 'Monday run')
    expect(list[0].seen).toBe(2)
    expect(list[0].history.at(-1)).toEqual({ date: '2026-09-12', kind: 'seen', note: 'Monday run' })
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
    const below = { scope: 'acme/x', observation: observation({ id: 'b1', archived: true }) }
    expect(absorbFromBelow(analysis, below, 'o2', '2026-09-21')).toBe(analysis)
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
  it('absorbs an observation of a scope below, with nothing shared first, by writing only the survivor', () => {
    const held: Analysis = {
      observations: [observation({})],
      causes: [cause({ explains: [{ id: 'b1', scope: 'acme/claims', strength: 'strong' }] })],
    }
    const below = { scope: 'acme/claims', observation: observation({ id: 'b1', number: 1, seen: 2 }) }
    const after = absorbFromBelow(held, below, 'o1', '2026-09-16')
    expect(after.observations).toHaveLength(1)
    expect(after.observations[0].seen).toBe(3)
    expect(after.observations[0].history.at(-1)).toEqual({ date: '2026-09-16', kind: 'absorbed', id: 'b1', scope: 'acme/claims', seen: 2 })
    expect(after.causes[0].explains).toEqual([{ id: 'o1', strength: 'strong' }])
    expect(absorbedBy(after.observations, 'b1', 'acme/claims')?.id).toBe('o1')
    // Not twice.
    expect(absorbFromBelow(after, below, 'o1', 'd')).toBe(after)
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
  it('a root cause is the one that says so, whatever the links; depth counts the causes between', () => {
    const list = [
      cause({ explains: [{ id: 'o1', strength: 'strong' }] }),
      cause({ id: 'c2', number: 2, explains: [{ id: 'c1', strength: 'normal' }] }),
      cause({ id: 'c3', number: 3, root: true }),
    ]
    // Explained by nothing is an open end, not a root: nobody said so.
    expect(isRootCause(list[0])).toBe(false)
    expect(isRootCause(list[1])).toBe(false)
    expect(isRootCause(list[2])).toBe(true)
    expect(rootCauses(list).map((one) => one.id)).toEqual(['c3'])
    expect(causeDepth(list[0], list)).toBe(1)
    expect(causeDepth(list[1], list)).toBe(2)
    expect(causeDepth(list[2], list)).toBe(1)
  })
  it('refuses a root cause as the thing a cause explains, and keeps a link that was there before', () => {
    const list = [cause({ root: true }), cause({ id: 'c2', number: 2 })]
    expect(linkRefusal(list, 'c2', { id: 'c1' })).toBe('root')
    expect(linkCause(list, 'c2', { id: 'c1', strength: 'strong' })).toEqual(list)
    expect(linkRefusal(list, 'c1', { id: 'c1' })).toBe('self')
    // A root cause may explain causes and observations.
    expect(linkCause(list, 'c1', { id: 'c2', strength: 'strong' })[0].explains).toEqual([{ id: 'c2', strength: 'strong' }])
    expect(linkRefusal(list, 'c1', { id: 'o1' })).toBeUndefined()
    const before = [cause({ root: true }), cause({ id: 'c2', number: 2, explains: [{ id: 'c1', strength: 'weak' }] })]
    expect(linkCause(before, 'c2', { id: 'c1', strength: 'strong' })[1].explains).toEqual([{ id: 'c1', strength: 'strong' }])
  })
  it('a new cause may be a root cause as it is made', () => {
    expect(newCause({ id: 'c', number: 1, title: 'Why', t, root: true }).root).toBe(true)
    expect(newCause({ id: 'c', number: 1, title: 'Why', t }).root).toBeUndefined()
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

describe('making a root cause, and a cause again (ADR-0032 §3)', () => {
  const solution = (id: string, number: number, causeId: string) => ({ id, number, title: `Fix ${number}`, addresses: [{ id: causeId }] })

  it('refuses a root cause while causes explain it, naming them', () => {
    const list = [cause({}), cause({ id: 'c2', number: 2, explains: [{ id: 'c1', strength: 'normal' }] })]
    const refused = makeRootCause(list, 'c1')
    expect(refused).toMatchObject({ ok: false, refusal: 'command.rootExplained' })
    expect(!refused.ok && refused.refusal === 'command.rootExplained' && refused.causes.map((one) => one.id)).toEqual(['c2'])
    const made = makeRootCause(list, 'c2')
    expect(made.ok && made.causes[1].root).toBe(true)
  })
  it('refuses a cause again while solutions address it, naming them — a dropped one too', () => {
    const list = [cause({ root: true })]
    const refused = makeCause(list, 'c1', [solution('s1', 1, 'c1'), solution('s2', 2, 'c9')])
    expect(refused).toEqual({ ok: false, refusal: 'command.rootAddressed', solutions: [{ id: 's1', number: 1, title: 'Fix 1' }] })
    const made = makeCause(list, 'c1', [])
    expect(made.ok && made.causes[0]).toEqual(cause({}))
  })
  it('changes nothing when it already is what is asked', () => {
    const list = [cause({ root: true }), cause({ id: 'c2', number: 2 })]
    expect(makeRootCause(list, 'c1')).toEqual({ ok: true, causes: list })
    expect(makeCause(list, 'c2', [])).toEqual({ ok: true, causes: list })
  })
})

/**
 * A three-level tree (ADR-0032 §4): the organisation, a domain under it, and
 * a team under that, with a sibling domain beside. A cause explains the
 * non-root causes of the scopes below its own, never upward, never
 * sideways, and never an observation below.
 */
describe('links down the tree', () => {
  const tree = (): ScopeAnalysis[] => [
    { scope: 'claims', observations: [observation({ id: 'ob-c' })], causes: [cause({ id: 'ca-c' }), cause({ id: 'rc-c', root: true })], solutions: [], experiments: [] },
    { scope: 'claims/intake', observations: [observation({ id: 'ob-i' })], causes: [cause({ id: 'ca-i' })], solutions: [], experiments: [] },
    { scope: 'billing', observations: [], causes: [cause({ id: 'ca-b' })], solutions: [], experiments: [] },
  ]
  const at = (here: string): LinkContext => ({ here, below: tree().filter((one) => one.scope.startsWith(here === '' ? '' : `${here}/`) && one.scope !== here) })
  const org = [cause({ id: 'ca-o' })]

  it('lets a cause explain a non-root cause of any scope below its own, and says so from below', () => {
    expect(linkRefusal(org, 'ca-o', { id: 'ca-c', scope: 'claims' }, at(''))).toBeUndefined()
    expect(linkRefusal(org, 'ca-o', { id: 'ca-i', scope: 'claims/intake' }, at(''))).toBeUndefined()
    const claims = [cause({ id: 'ca-c' })]
    expect(linkRefusal(claims, 'ca-c', { id: 'ca-i', scope: 'claims/intake' }, at('claims'))).toBeUndefined()
    expect(linkCause(org, 'ca-o', { id: 'ca-i', scope: 'claims/intake', strength: 'strong' }, at(''))[0].explains)
      .toEqual([{ id: 'ca-i', scope: 'claims/intake', strength: 'strong' }])
  })
  it('refuses a link upward, sideways, into a root cause below, or to an observation below', () => {
    const intake = [cause({ id: 'ca-i' })]
    expect(linkRefusal(intake, 'ca-i', { id: 'ca-c', scope: 'claims' }, at('claims/intake'))).toBe('upward')
    expect(linkRefusal(intake, 'ca-i', { id: 'ca-o', scope: '' }, at('claims/intake'))).toBe('upward')
    expect(linkRefusal(intake, 'ca-i', { id: 'ca-i', scope: 'claims/intake' }, at('claims/intake'))).toBe('upward')
    expect(linkRefusal([cause({ id: 'ca-c' })], 'ca-c', { id: 'ca-b', scope: 'billing' }, at('claims'))).toBe('sideways')
    expect(linkRefusal(org, 'ca-o', { id: 'rc-c', scope: 'claims' }, at(''))).toBe('root')
    expect(linkRefusal(org, 'ca-o', { id: 'ob-i', scope: 'claims/intake' }, at(''))).toBe('observationBelow')
    expect(linkRefusal(org, 'ca-o', { id: 'nope', scope: 'claims' }, at(''))).toBe('unknown')
    expect(linkRefusal(org, 'ca-o', { id: 'ca-c', scope: 'claims' })).toBe('unknown')
    expect(linkCause(org, 'ca-o', { id: 'ob-i', scope: 'claims/intake', strength: 'weak' }, at(''))).toEqual(org)
  })
  it('keeps a link to an observation below that was made before, and changes only its strength', () => {
    const before = [cause({ id: 'ca-o', explains: [{ id: 'ob-i', scope: 'claims/intake', strength: 'weak' }] })]
    expect(linkRefusal(before, 'ca-o', { id: 'ob-i', scope: 'claims/intake' }, at(''))).toBeUndefined()
    expect(linkCause(before, 'ca-o', { id: 'ob-i', scope: 'claims/intake', strength: 'strong' }, at(''))[0].explains)
      .toEqual([{ id: 'ob-i', scope: 'claims/intake', strength: 'strong' }])
  })
  it('refuses a root cause below that a cause above explains, naming it', () => {
    const above = [{ scope: '', cause: cause({ id: 'ca-o' }), strength: 'normal' as const }]
    const refused = makeRootCause([cause({ id: 'ca-i' })], 'ca-i', above)
    expect(refused).toMatchObject({ ok: false, refusal: 'command.rootExplained', causes: [], above })
  })
  it('reads the observations of every scope below as one list, scope by scope', () => {
    expect(observationsBelow(tree()).map((one) => `${one.scope}#${one.observation.id}`)).toEqual(['claims#ob-c', 'claims/intake#ob-i'])
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
  it('writes why we think so under its heading, in any language, and leaves the body alone with nothing to say', () => {
    const body = withReason(causeTemplate(t), 'Volumes doubled', t)
    expect(body).toBe('## Why we think so\n\nVolumes doubled\n\n## How to verify\n\n')
    expect(causeEvidence(body)).toMatchObject({ why: true, verify: false })
    expect(withReason('## Waarom we dat denken\n\n## Hoe te verifiëren\n', 'Twee keer zo veel', t))
      .toBe('## Waarom we dat denken\n\nTwee keer zo veel\n\n## Hoe te verifiëren\n')
    expect(withReason(causeTemplate(t), '  ', t)).toBe(causeTemplate(t))
  })
})

describe('a merged cause is history (ADR-0035 §4)', () => {
  const survivor = cause({ id: 'c1', root: true, history: [{ date: '2026-10-01', kind: 'absorbed', id: 'c2' }] })
  const absorbed = cause({ id: 'c2', number: 2, root: true, history: [{ date: '2026-10-01', kind: 'merged', id: 'c1' }] })
  const other = cause({ id: 'c3', number: 3 })

  it('is read as merged by the survivor of its scope, and by its own history', () => {
    expect(causeAbsorbedBy([survivor, absorbed], 'c2')?.id).toBe('c1')
    expect(isCauseMerged([survivor, absorbed], 'c2')).toBe(true)
    // Merged into a scope elsewhere: only the record itself says so.
    const elsewhere = cause({ id: 'c4', history: [{ date: '2026-10-01', kind: 'merged', id: 'x', scope: 'acme' }] })
    expect(isCauseMerged([elsewhere], 'c4')).toBe(true)
    expect(isCauseMerged([survivor, absorbed], 'c1')).toBe(false)
    expect(isCauseMerged([other], 'c3')).toBe(false)
  })
  it('is left out of the causes standing and of the root causes', () => {
    expect(liveCauses([survivor, absorbed, other]).map((one) => one.id)).toEqual(['c1', 'c3'])
    expect(rootCauses([survivor, absorbed, other]).map((one) => one.id)).toEqual(['c1'])
  })
  it('is never linked to, and links nothing', () => {
    const list = [survivor, cause({ ...absorbed, root: undefined }), other]
    expect(linkRefusal(list, 'c3', { id: 'c2' })).toBe('merged')
    expect(linkRefusal(list, 'c2', { id: 'c3' })).toBe('merged')
    const below: ScopeAnalysis[] = [{ scope: 'acme', observations: [], causes: [cause({ id: 'b1', history: [{ date: '2026-10-01', kind: 'merged', id: 'b2' }] })], solutions: [], experiments: [] }]
    expect(linkRefusal([other], 'c3', { id: 'b1', scope: 'acme' }, { here: '', below })).toBe('merged')
  })
  it('says where it went, the last merge first', () => {
    expect(mergedInto(absorbed.history)).toEqual({ id: 'c1', date: '2026-10-01' })
    expect(mergedInto([{ date: '2026-10-02', kind: 'merged', id: 'x', scope: 'acme' }])).toEqual({ id: 'x', scope: 'acme', date: '2026-10-02' })
    expect(mergedInto(undefined)).toBeUndefined()
    expect(mergedInto(survivor.history)).toBeUndefined()
  })
  it('an observation that says itself it was merged elsewhere is merged here too', () => {
    const gone = observation({ id: 'o9', history: [{ date: '2026-09-08', kind: 'recorded' }, { date: '2026-10-01', kind: 'merged', id: 'x', scope: 'acme' }] })
    expect(isMerged([gone], 'o9')).toBe(true)
    expect(liveObservations([gone])).toEqual([])
  })
})

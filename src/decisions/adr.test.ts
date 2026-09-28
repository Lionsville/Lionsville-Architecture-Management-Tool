// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The decision record's rules: where a status may go, what a locked record
 * refuses, and what a list does when one of its members is removed. The
 * template is checked for shape and language, not for wording.
 */
import { describe, expect, it } from 'vitest'
import { translator } from '../i18n'
import {
  adrGate, adrOpenItems, adrsFor, formatAdrNumber, isAdr, isAdrDeletable, isAdrLocked, madrTemplate, newAdr,
  nextAdrNumber, removeAdr, selfAccepted, setAdrStatus, sortAdrs, supersededByUnaccepted, transitionAdr,
  transitionsFrom, updateAdr,
} from './adr'
import type { Adr } from './adr'

const en = translator('en')

function adr(over: Partial<Adr> = {}): Adr {
  return {
    id: 'adr-a', number: 1, title: 'Use one queue', status: 'proposed', date: '2026-09-01',
    body: '## Context\n\nText.', signers: [], ...over,
  }
}

/** A body the gate to accepted is satisfied with. */
const DECIDED = [
  '## Context and Problem Statement', '', 'Orders are queued twice, and nobody knows which queue is right.', '',
  '## Considered Options', '', '* One queue', '* Two queues — as today', '',
  '## Decision Outcome', '', 'Chosen option: “One queue”, because there is one place to look.', '',
  '### Consequences', '', '* Good, because a lost order is found in one place.', '* Bad, because …', '',
].join('\n')

const approved = [{ name: 'Kim', verdict: 'approved' as const, signedAt: '2026-09-02' }]

describe('numbering', () => {
  it('pads to four digits under an ADR- prefix', () => {
    expect(formatAdrNumber(7)).toBe('ADR-0007')
    expect(formatAdrNumber(12345)).toBe('ADR-12345')
  })

  it('hands out one past the highest, never a gap left by a deletion', () => {
    expect(nextAdrNumber([])).toBe(1)
    expect(nextAdrNumber([adr({ number: 1 }), adr({ id: 'b', number: 4 })])).toBe(5)
  })
})

describe('a new record', () => {
  it('starts proposed, unsigned, with the MADR sections in the reader’s language', () => {
    const fresh = newAdr({ id: 'x', number: 3, title: '  Use PostgreSQL ', date: '2026-09-05', t: en })
    expect(fresh.status).toBe('proposed')
    expect(fresh.title).toBe('Use PostgreSQL')
    expect(fresh.signers).toEqual([])
    expect(fresh.subjectId).toBeUndefined()
    expect(fresh.body).toContain('## Context and Problem Statement')
    expect(fresh.body).toContain('## Decision Outcome')
    expect(fresh.body).toContain('## Pros and Cons of the Options')
    const nl = newAdr({ id: 'x', number: 3, title: 'T', date: '2026-09-05', t: translator('nl') })
    expect(nl.body).toContain('## Context en probleemstelling')
  })

  it('files itself under an application when told to', () => {
    expect(newAdr({ id: 'x', number: 1, title: 'T', date: 'd', t: en, subjectId: 'crm' }).subjectId).toBe('crm')
  })

  it('template: every heading level is well formed and the file ends in one newline', () => {
    const body = madrTemplate(en)
    expect(body.endsWith('\n')).toBe(true)
    expect(body.endsWith('\n\n')).toBe(false)
    expect(body.match(/^## /gm)?.length).toBe(6)
  })
})

describe('the state machine', () => {
  it('goes proposed → reviewing → accepted | rejected, a proposal may be withdrawn, and review may go back', () => {
    expect(transitionsFrom('proposed')).toEqual(['reviewing', 'rejected'])
    expect(transitionsFrom('reviewing')).toEqual(['accepted', 'rejected', 'proposed'])
  })

  it('only an accepted record can be superseded; the other end states are final', () => {
    expect(transitionsFrom('accepted')).toEqual(['superseded'])
    expect(transitionsFrom('rejected')).toEqual([])
    expect(transitionsFrom('superseded')).toEqual([])
  })

  it('applies an allowed move and stamps the date', () => {
    const moved = transitionAdr(adr(), 'reviewing', '2026-09-06')
    expect(moved.status).toBe('reviewing')
    expect(moved.date).toBe('2026-09-06')
  })

  it('returns the record untouched for a move the machine does not allow', () => {
    const it_ = adr()
    expect(transitionAdr(it_, 'accepted', 'd')).toBe(it_)
    expect(transitionAdr(adr({ status: 'rejected' }), 'proposed', 'd').status).toBe('rejected')
  })

  it('superseding needs a successor that is not itself', () => {
    const accepted = adr({ status: 'accepted' })
    expect(transitionAdr(accepted, 'superseded', 'd')).toBe(accepted)
    expect(transitionAdr(accepted, 'superseded', 'd', { supersededBy: 'adr-a' })).toBe(accepted)
    const done = transitionAdr(accepted, 'superseded', 'd', { supersededBy: 'adr-b' })
    expect(done.status).toBe('superseded')
    expect(done.supersededBy).toBe('adr-b')
  })

  it('locks the three end states and lets only the two working states be deleted', () => {
    expect(isAdrLocked(adr())).toBe(false)
    expect(isAdrLocked(adr({ status: 'reviewing' }))).toBe(false)
    for (const status of ['accepted', 'rejected', 'superseded'] as const) {
      expect(isAdrLocked(adr({ status }))).toBe(true)
      expect(isAdrDeletable(adr({ status }))).toBe(false)
    }
    expect(isAdrDeletable(adr({ status: 'reviewing' }))).toBe(true)
  })
})

describe('the list', () => {
  const list = [adr(), adr({ id: 'adr-b', number: 2, status: 'accepted' })]

  it('updates title, body and signers of a record still being written', () => {
    const next = updateAdr(list, 'adr-a', { title: ' New title ', body: 'B', signers: [{ name: 'Kim' }] })
    expect(next[0]).toMatchObject({ title: 'New title', body: 'B', signers: [{ name: 'Kim' }] })
  })

  it('refuses a blank title but takes the rest of the patch', () => {
    const next = updateAdr(list, 'adr-a', { title: '  ', body: 'B' })
    expect(next[0].title).toBe('Use one queue')
    expect(next[0].body).toBe('B')
  })

  it('leaves a locked record exactly as it was', () => {
    const next = updateAdr(list, 'adr-b', { title: 'Rewritten', body: 'X' })
    expect(next[1]).toBe(list[1])
  })

  it('supersedes only with a successor that is in the same list, and accepted', () => {
    expect(setAdrStatus(list, 'adr-b', 'superseded', 'd', { supersededBy: 'elsewhere' })[1].status).toBe('accepted')
    // A proposal cannot replace a decision in force: rejected later, it would
    // leave nothing accepted and both records locked.
    expect(setAdrStatus(list, 'adr-b', 'superseded', 'd', { supersededBy: 'adr-a' })[1].status).toBe('accepted')
    const both = [adr({ status: 'accepted' }), list[1]]
    const next = setAdrStatus(both, 'adr-b', 'superseded', 'd', { supersededBy: 'adr-a' })
    expect(next[1]).toMatchObject({ status: 'superseded', supersededBy: 'adr-a', date: 'd' })
  })

  it('takes supersedes and a proposer while the record is written, and drops them when emptied', () => {
    const named = updateAdr(list, 'adr-a', { supersedes: ['adr-b', 'adr-b', 'adr-a'], proposedBy: ' Kim ' })
    expect(named[0]).toMatchObject({ supersedes: ['adr-b'], proposedBy: 'Kim' })
    const cleared = updateAdr(named, 'adr-a', { supersedes: [], proposedBy: ' ' })
    expect(cleared[0]).not.toHaveProperty('supersedes')
    expect(cleared[0]).not.toHaveProperty('proposedBy')
    expect(updateAdr(list, 'adr-b', { supersedes: ['adr-a'] })[1]).toBe(list[1])
  })

  it('removes a working record and drops links that pointed at it', () => {
    const withLink = [
      adr({ id: 'old', status: 'superseded', supersededBy: 'adr-a' }),
      adr({ id: 'adr-a', number: 2 }),
    ]
    const next = removeAdr(withLink, 'adr-a')
    expect(next.map((a) => a.id)).toEqual(['old'])
    expect(next[0].supersededBy).toBeUndefined()
  })

  it('will not remove a locked record, or one that is not there', () => {
    expect(removeAdr(list, 'adr-b')).toEqual(list)
    expect(removeAdr(list, 'nope')).toEqual(list)
  })

  it('splits the landscape level from each application', () => {
    const mixed = [adr(), adr({ id: 'c', number: 2, subjectId: 'crm' }), adr({ id: 'd', number: 3, subjectId: 'erp' })]
    expect(adrsFor(mixed, undefined).map((a) => a.id)).toEqual(['adr-a'])
    expect(adrsFor(mixed, 'crm').map((a) => a.id)).toEqual(['c'])
  })

  it('sorts newest first without touching the input', () => {
    const input = [adr({ number: 1 }), adr({ id: 'b', number: 3 }), adr({ id: 'c', number: 2 })]
    expect(sortAdrs(input).map((a) => a.number)).toEqual([3, 2, 1])
    expect(input.map((a) => a.number)).toEqual([1, 3, 2])
  })
})

describe('the gate', () => {
  const reviewing = (over: Partial<Adr> = {}) => adr({ status: 'reviewing', body: DECIDED, signers: approved, ...over })

  it('lets a written, approved record be accepted', () => {
    expect(adrOpenItems(adrGate(reviewing(), 'accepted'))).toEqual([])
    const moved = setAdrStatus([reviewing()], 'adr-a', 'accepted', '2026-09-03')
    expect(moved[0]).toMatchObject({ status: 'accepted', date: '2026-09-03' })
  })

  it('names every line the untouched template leaves open', () => {
    const fresh = newAdr({ id: 'x', number: 1, title: 'T', date: 'd', t: en })
    expect(adrOpenItems(adrGate({ ...fresh, status: 'reviewing' }, 'accepted')))
      .toEqual(['context', 'options', 'outcome', 'consequence', 'approved'])
    expect(setAdrStatus([{ ...fresh, status: 'reviewing' }], 'x', 'accepted', 'd')[0].status).toBe('reviewing')
  })

  it('recognises the template in every language, whatever language is on screen now', () => {
    for (const language of ['en', 'nl', 'de'] as const) {
      const body = madrTemplate(translator(language))
      expect(adrOpenItems(adrGate(reviewing({ body }), 'accepted'))).toEqual(['context', 'options', 'outcome', 'consequence'])
    }
  })

  it('wants an outcome that names one of the options', () => {
    const elsewhere = DECIDED.replace('“One queue”', '“A third way”')
    expect(adrOpenItems(adrGate(reviewing({ body: elsewhere }), 'accepted'))).toEqual(['outcome'])
  })

  it('wants an approval and no rejection', () => {
    expect(adrOpenItems(adrGate(reviewing({ signers: [] }), 'accepted'))).toEqual(['approved'])
    const split = [...approved, { name: 'Ali', verdict: 'rejected' as const }]
    expect(adrOpenItems(adrGate(reviewing({ signers: split }), 'accepted'))).toEqual(['approved'])
  })

  it('withdraws a proposal only with a reason, and keeps the reason and the number', () => {
    const list = [adr()]
    expect(setAdrStatus(list, 'adr-a', 'rejected', 'd')[0].status).toBe('proposed')
    expect(setAdrStatus(list, 'adr-a', 'rejected', 'd', { reason: '  ' })[0].status).toBe('proposed')
    const withdrawn = setAdrStatus(list, 'adr-a', 'rejected', 'd', { reason: 'Overtaken by the merger.' })[0]
    expect(withdrawn).toMatchObject({ status: 'rejected', number: 1, reason: 'Overtaken by the merger.' })
  })

  it('rejects from review on a rejecting signer, or on a reason', () => {
    const turnedDown = [adr({ status: 'reviewing', signers: [{ name: 'Ali', verdict: 'rejected' }] })]
    expect(setAdrStatus(turnedDown, 'adr-a', 'rejected', 'd')[0].status).toBe('rejected')
    expect(setAdrStatus([adr({ status: 'reviewing' })], 'adr-a', 'rejected', 'd')[0].status).toBe('reviewing')
  })

  it('accepting a successor supersedes what it names, in the same step', () => {
    const old = adr({ id: 'old', number: 1, status: 'accepted' })
    const other = adr({ id: 'other', number: 2, status: 'accepted' })
    const successor = reviewing({ id: 'new', number: 3, supersedes: ['old'] })
    const next = setAdrStatus([old, other, successor], 'new', 'accepted', '2026-09-04')
    expect(next.map((one) => one.status)).toEqual(['superseded', 'accepted', 'accepted'])
    expect(next[0]).toMatchObject({ supersededBy: 'new', date: '2026-09-04' })
  })

  it('will not accept a successor that names a record not in force', () => {
    const old = adr({ id: 'old', number: 1, status: 'rejected' })
    const successor = reviewing({ id: 'new', number: 2, supersedes: ['old'] })
    expect(adrOpenItems(adrGate(successor, 'accepted', { list: [old, successor] }))).toEqual(['predecessors'])
    expect(setAdrStatus([old, successor], 'new', 'accepted', 'd')[1].status).toBe('reviewing')
  })

  it('rejecting a successor leaves what it named accepted', () => {
    const old = adr({ id: 'old', number: 1, status: 'accepted' })
    const successor = adr({ id: 'new', number: 2, status: 'reviewing', supersedes: ['old'] })
    const next = setAdrStatus([old, successor], 'new', 'rejected', 'd', { reason: 'Not now.' })
    expect(next.map((one) => one.status)).toEqual(['accepted', 'rejected'])
  })

  it('says when the only approval is the proposer’s own', () => {
    expect(selfAccepted({ proposedBy: 'Kim', signers: approved })).toBe(true)
    expect(selfAccepted({ proposedBy: ' kim ', signers: approved })).toBe(true)
    expect(selfAccepted({ proposedBy: 'Kim', signers: [...approved, { name: 'Ali', verdict: 'approved' }] })).toBe(false)
    expect(selfAccepted({ signers: approved })).toBe(false)
  })

  it('finds a record superseded by something that is not in force', () => {
    const broken = adr({ id: 'old', status: 'superseded', supersededBy: 'new' })
    expect(supersededByUnaccepted(broken, [broken, adr({ id: 'new', status: 'proposed' })])).toBe(true)
    expect(supersededByUnaccepted(broken, [broken])).toBe(true)
    expect(supersededByUnaccepted(broken, [broken, adr({ id: 'new', status: 'accepted' })])).toBe(false)
    expect(supersededByUnaccepted(adr(), [adr()])).toBe(false)
  })
})

describe('reading a record back out of storage', () => {
  it('accepts the shape this module writes', () => {
    expect(isAdr(adr())).toBe(true)
    expect(isAdr(adr({ signers: [{ name: 'K', role: 'CTO', verdict: 'approved', signedAt: '2026-09-01' }] }))).toBe(true)
    expect(isAdr(adr({ supersedes: ['adr-b'], proposedBy: 'Kim', reason: 'Why.' }))).toBe(true)
    expect(isAdr({ ...adr(), supersedes: 'adr-b' })).toBe(false)
  })

  it('refuses a status or a verdict outside the vocabulary, and a missing body', () => {
    expect(isAdr({ ...adr(), status: 'draft' })).toBe(false)
    expect(isAdr({ ...adr(), signers: [{ name: 'K', verdict: 'maybe' }] })).toBe(false)
    expect(isAdr({ ...adr(), body: undefined })).toBe(false)
    expect(isAdr(null)).toBe(false)
  })
})

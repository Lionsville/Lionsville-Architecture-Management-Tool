/**
 * The decision record's rules: where a status may go, what a locked record
 * refuses, and what a list does when one of its members is removed. The
 * template is checked for shape and language, not for wording.
 */
import { describe, expect, it } from 'vitest'
import { translator } from '../i18n'
import {
  adrsFor, formatAdrNumber, isAdr, isAdrDeletable, isAdrLocked, madrTemplate, newAdr, nextAdrNumber,
  removeAdr, setAdrStatus, sortAdrs, transitionAdr, transitionsFrom, updateAdr,
} from './adr'
import type { Adr } from './adr'

const en = translator('en')

function adr(over: Partial<Adr> = {}): Adr {
  return {
    id: 'adr-a', number: 1, title: 'Use one queue', status: 'proposed', date: '2026-09-01',
    body: '## Context\n\nText.', signers: [], ...over,
  }
}

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
    expect(fresh.applicationId).toBeUndefined()
    expect(fresh.body).toContain('## Context and Problem Statement')
    expect(fresh.body).toContain('## Decision Outcome')
    expect(fresh.body).toContain('## Pros and Cons of the Options')
    const nl = newAdr({ id: 'x', number: 3, title: 'T', date: '2026-09-05', t: translator('nl') })
    expect(nl.body).toContain('## Context en probleemstelling')
  })

  it('files itself under an application when told to', () => {
    expect(newAdr({ id: 'x', number: 1, title: 'T', date: 'd', t: en, applicationId: 'crm' }).applicationId).toBe('crm')
  })

  it('template: every heading level is well formed and the file ends in one newline', () => {
    const body = madrTemplate(en)
    expect(body.endsWith('\n')).toBe(true)
    expect(body.endsWith('\n\n')).toBe(false)
    expect(body.match(/^## /gm)?.length).toBe(6)
  })
})

describe('the state machine', () => {
  it('goes proposed → reviewing → accepted | rejected, and review may go back', () => {
    expect(transitionsFrom('proposed')).toEqual(['reviewing'])
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

  it('supersedes only with a successor that is in the same list', () => {
    expect(setAdrStatus(list, 'adr-b', 'superseded', 'd', { supersededBy: 'elsewhere' })[1].status).toBe('accepted')
    const next = setAdrStatus(list, 'adr-b', 'superseded', 'd', { supersededBy: 'adr-a' })
    expect(next[1]).toMatchObject({ status: 'superseded', supersededBy: 'adr-a' })
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
    const mixed = [adr(), adr({ id: 'c', number: 2, applicationId: 'crm' }), adr({ id: 'd', number: 3, applicationId: 'erp' })]
    expect(adrsFor(mixed, undefined).map((a) => a.id)).toEqual(['adr-a'])
    expect(adrsFor(mixed, 'crm').map((a) => a.id)).toEqual(['c'])
  })

  it('sorts newest first without touching the input', () => {
    const input = [adr({ number: 1 }), adr({ id: 'b', number: 3 }), adr({ id: 'c', number: 2 })]
    expect(sortAdrs(input).map((a) => a.number)).toEqual([3, 2, 1])
    expect(input.map((a) => a.number)).toEqual([1, 3, 2])
  })
})

describe('reading a record back out of storage', () => {
  it('accepts the shape this module writes', () => {
    expect(isAdr(adr())).toBe(true)
    expect(isAdr(adr({ signers: [{ name: 'K', role: 'CTO', verdict: 'approved', signedAt: '2026-09-01' }] }))).toBe(true)
  })

  it('refuses a status or a verdict outside the vocabulary, and a missing body', () => {
    expect(isAdr({ ...adr(), status: 'draft' })).toBe(false)
    expect(isAdr({ ...adr(), signers: [{ name: 'K', verdict: 'maybe' }] })).toBe(false)
    expect(isAdr({ ...adr(), body: undefined })).toBe(false)
    expect(isAdr(null)).toBe(false)
  })
})

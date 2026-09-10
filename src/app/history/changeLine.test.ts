/**
 * Every row the diff can produce has a sentence. The page once threw on a
 * project with a plan in its history, because `transition` had been added to
 * the diff and not here; this walks the whole product so the next subject is
 * caught by a test as well as by the type.
 */
import { describe, expect, it } from 'vitest'
import { changeLine } from './changeLine'
import { translator } from '../../i18n'
import type { ChangeKind, ChangeSubject, ModelChange } from '../../model/diff'

const SUBJECTS: ChangeSubject[] = ['element', 'connection', 'diagram', 'decision', 'transition', 'membership', 'geometry']
const KINDS: ChangeKind[] = ['added', 'removed', 'changed']

describe('changeLine', () => {
  it('has a sentence for every subject and kind the diff can emit', () => {
    const s = translator('en')
    for (const what of SUBJECTS) {
      for (const kind of KINDS) {
        const change: ModelChange = { kind, what, id: 'x', name: 'Thing', fields: ['title'], count: 2 }
        const line = changeLine(change, s)
        expect(line, `${what}:${kind}`).toContain('Thing')
        expect(line, `${what}:${kind}`).not.toMatch(/^change\./)
      }
    }
  })

  it('says what came onto which board, and where the geometry went as a number', () => {
    const s = translator('en')
    expect(changeLine(
      { kind: 'added', what: 'membership', id: 'wms', name: 'Warehouse', on: 'Roadmap', onId: 'd1' }, s,
    )).toBe('Put Warehouse on Roadmap')
    expect(changeLine({ kind: 'changed', what: 'geometry', id: 'd1', name: 'Roadmap', count: 40 }, s))
      .toBe('Moved 40 on Roadmap')
  })

  it('names a plan as a plan', () => {
    const s = translator('en')
    expect(changeLine({ kind: 'added', what: 'transition', id: 't1', name: 'Retire the old ledger' }, s))
      .toBe('Added the plan Retire the old ledger')
  })
})

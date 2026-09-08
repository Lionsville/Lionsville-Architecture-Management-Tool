/**
 * A plan, as a file (ADR-0009).
 *
 * The round trip is the point: what is written must read back identical, and a
 * file a person edited by hand must still half-parse rather than vanish. The
 * codec is forgiving in exactly one direction, and these say where.
 */
import { describe, expect, it } from 'vitest'
import { transitionFileText, transitionFromFile, transitionPath } from './transitionFile'
import type { Transition } from '../model/transition'

function plan(over: Partial<Transition> = {}): Transition {
  return {
    id: 'tr-1', number: 3, title: 'Replace the warehouse system', status: 'agreed',
    from: '2027-01-15', to: '2028-01-31', owner: 'Logistics IT',
    elements: [
      { elementId: 'wms-new', role: 'introduces' },
      { elementId: 'wms-old', role: 'retires' },
    ],
    decisions: ['adr-4', 'adr-9'],
    milestones: [{ date: '2027-04-01', name: 'Cutover begins' }],
    body: '## Goal\n\nOne warehouse system.',
    ...over,
  }
}

const roundTrip = (one: Transition) => transitionFromFile(transitionFileText(one), transitionPath(one))

describe('transitionPath', () => {
  it('leads with the number, so the folder sorts and a README is not a plan', () => {
    expect(transitionPath(plan())).toBe('transitions/0003-replace-the-warehouse-system.md')
  })

  it('has something to call a plan with no title yet', () => {
    expect(transitionPath(plan({ title: '   ' }))).toBe('transitions/0003-plan.md')
  })
})

describe('the round trip', () => {
  it('reads back exactly what was written', () => {
    expect(roundTrip(plan())).toEqual(plan())
  })

  it('reads back a plan with nothing optional on it', () => {
    const bare = plan({
      from: undefined, to: undefined, owner: undefined,
      elements: [], decisions: [], milestones: [], body: '',
    })
    expect(roundTrip(bare)).toEqual(bare)
  })

  it('writes the same bytes twice', () => {
    expect(transitionFileText(plan())).toBe(transitionFileText(plan()))
  })

  it('puts the title in the heading, so it renders as a plan anywhere', () => {
    const text = transitionFileText(plan())
    expect(text).toContain('# TR-0003 — Replace the warehouse system')
    expect(text).toContain('## Goal')
  })
})

describe('a file somebody edited by hand', () => {
  it('takes the number off the file name when the front matter lost it', () => {
    const text = '---\nstatus: running\n---\n\n# TR-0007 — Written by hand\n\nBody.\n'
    const back = transitionFromFile(text, 'transitions/0007-written-by-hand.md')
    expect(back).toMatchObject({ number: 7, title: 'Written by hand', status: 'running' })
  })

  it('is not a plan at all when nothing says which number it is', () => {
    expect(transitionFromFile('# Notes\n\nSome notes.\n', 'transitions/notes.md')).toBeUndefined()
  })

  it('falls back rather than failing on a status or a role it does not know', () => {
    const text = [
      '---', 'number: 2', 'status: halfway',
      'elements:', '  - elementId: a', '    role: destroys',
      '---', '', '# TR-0002 — Odd', '', 'Body.', '',
    ].join('\n')
    const back = transitionFromFile(text, 'transitions/0002-odd.md')!
    expect(back.status).toBe('draft')
    expect(back.elements).toEqual([{ elementId: 'a', role: 'changes' }])
  })

  it('drops an element row with no id rather than keeping a nameless one', () => {
    const text = [
      '---', 'number: 2', 'elements:', '  - role: retires', '---', '', '# TR-0002 — Odd', '', 'Body.', '',
    ].join('\n')
    expect(transitionFromFile(text, 'transitions/0002-odd.md')!.elements).toEqual([])
  })
})

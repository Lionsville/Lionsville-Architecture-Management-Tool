// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { Principle } from '../../../model/principle'
import {
  isPrinciplePath, PRINCIPLE_GROUPS_FILE, principleFileText, principleFromFile, principleGroupFiles, principleGroupsFrom,
  principleGroupsUnreadable, principlePath, principlesFrom,
} from './principleFile'

const full: Principle = {
  id: 'pr-1', number: 1, title: 'Reuse before buy', statement: 'Reuse before buy before build.\n\n## Not a heading of ours\n\nStill the statement.',
  rationale: 'Two systems doing one thing\ncost twice.', implications: 'A catalogue is kept.', keywords: ['reuse', 'catalogue'],
  aspects: [
    { id: 'a1', number: 1, text: 'Look for one first', nature: 'design', signal: 'Share reused', steering: 'The design review' },
    { id: 'a3', number: 3, text: 'Say why not', nature: 'behaviour' },
  ],
  lastAspect: 3, groups: ['pg-1', 'pg-2'], regime: 'fixed', status: 'accepted', acceptedOn: '2026-10-01',
  relations: [{ kind: 'refines', to: { scope: '', id: 'pr-9' } }, { kind: 'tension', to: { scope: 'acme/rail', id: 'pr-2' } }],
  sharpened: [{ on: '2026-10-20', note: 'Said plainer: "first" means first.' }],
}

describe('a principle as a file (ADR-0041 §14)', () => {
  it('is kept under _principles by number and title, which no scope can be called', () => {
    expect(principlePath(full)).toBe('_principles/0001-reuse-before-buy.md')
    expect(isPrinciplePath('_principles/0001-reuse-before-buy.md')).toBe(true)
    expect(isPrinciplePath(PRINCIPLE_GROUPS_FILE)).toBe(false)
    expect(isPrinciplePath('_principles/README.md')).toBe(false)
  })

  it('reads back exactly what it wrote, a heading in the statement and quotes in a note included', () => {
    expect(principleFromFile(principleFileText(full), principlePath(full))).toEqual(full)
    const candidate: Principle = { ...full, status: 'candidate', question: 'Is buying reuse?', acceptedOn: undefined, mergedInto: 'pr-7' }
    delete candidate.acceptedOn
    expect(principleFromFile(principleFileText(candidate), principlePath(candidate))).toEqual(candidate)
  })

  it('writes nothing it does not have', () => {
    const plain: Principle = { ...full, rationale: undefined, implications: undefined, keywords: undefined, relations: undefined, sharpened: undefined, acceptedOn: undefined }
    for (const key of ['rationale', 'implications', 'keywords', 'relations', 'sharpened', 'acceptedOn'] as const) delete plain[key]
    const text = principleFileText(plain)
    expect(text).not.toMatch(/^(rationale|implications|keywords|relations|sharpened|acceptedOn):/m)
    expect(principleFromFile(text, principlePath(plain))).toEqual(plain)
  })

  it('reads what it can of a hand-edited file, and never gives an aspect number again', () => {
    const edited = principleFileText(full)
      .replace('regime: fixed', 'regime: rigid')
      .replace('lastAspect: 3', 'lastAspect: 1')
      .replace('    nature: behaviour\n', '    nature: mood\n')
    const read = principleFromFile(edited, principlePath(full))!
    expect(read.regime).toBe('fixed')
    // Never below what the aspects say: the next aspect is 4, whatever the file claimed.
    expect(read.lastAspect).toBe(3)
    expect(read.aspects[1].nature).toBe('design')
    expect(principleFromFile('# Just a note\n', '_principles/0002-x.md')).toBeUndefined()
  })

  it('finds every principle among a folder\'s files, in number order', () => {
    const second = { ...full, id: 'pr-2', number: 2, title: 'Data where made' }
    const files = [second, full].map((one) => ({ path: principlePath(one), text: principleFileText(one) }))
    expect(principlesFrom([...files, { path: '_principles/README.md', text: 'notes' }]).principles?.map((one) => one.id)).toEqual(['pr-1', 'pr-2'])
    expect(principlesFrom([])).toEqual({})
  })
})

describe('the groups as a file (ADR-0041 §3)', () => {
  it('is one list in the scope\'s order, read back as written', () => {
    const groups = [{ id: 'pg-2', name: 'Reuse' }, { id: 'pg-1', name: 'Data', description: 'Where data lives' }]
    const files = principleGroupFiles({ principleGroups: groups })
    expect(files.map((one) => one.path)).toEqual([PRINCIPLE_GROUPS_FILE])
    expect(principleGroupsFrom((path) => files.find((one) => one.path === path)?.text)).toEqual({ principleGroups: groups })
    expect(principleGroupFiles({})).toEqual([])
  })

  it('passes over a row with no id or name, keeps an id said twice once, and says a file that is not a list', () => {
    const text = JSON.stringify([{ id: 'pg-1', name: 'A' }, { id: 'pg-1', name: 'B' }, { name: 'No id' }])
    expect(principleGroupsFrom(() => text)).toEqual({ principleGroups: [{ id: 'pg-1', name: 'A' }] })
    expect(principleGroupsUnreadable('{"not": "a list"}')).toBe(true)
    expect(principleGroupsUnreadable(text)).toBe(false)
    expect(principleGroupsUnreadable(undefined)).toBe(false)
  })
})

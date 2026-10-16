// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { translator } from '../i18n'
import type { ScopeAnalysis } from '../model/observation'
import type { MovePlan } from './move'
import { moveBlocked, moveNote, moveTargets, withEveryScope } from './moveScreen'

const t = translator('en')
const trail = (path: string) => (path === '' ? 'Port' : path.split('/').join(' › '))
const OK: MovePlan = { ok: true, number: 3, revived: false, cut: [], restored: [], comments: 0, observation: {} as never, writes: [] }

describe('moveTargets', () => {
  it('offers every other scope nearest first, by its path, and says why one cannot be picked', () => {
    const rows = moveTargets({ paths: ['', 'north', 'north/east', 'south', 'north'], here: 'north', query: '', trail, writable: (path) => path !== 'south', t })
    expect(rows).toEqual([
      { path: '', name: 'Port' },
      { path: 'north/east', name: 'north › east' },
      { path: 'south', name: 'south', closed: 'You may read south, not change it.' },
    ])
  })
  it('finds a scope by every word of what it is called', () => {
    expect(moveTargets({ paths: ['', 'north', 'north/east'], here: '', query: 'north east', trail, writable: () => true, t }).map((one) => one.path))
      .toEqual(['north/east'])
  })
})

describe('withEveryScope', () => {
  it('adds an empty analysis for a scope that holds none yet', () => {
    const held: ScopeAnalysis = { scope: 'north', observations: [], causes: [], solutions: [], experiments: [] }
    expect(withEveryScope([held], ['north', 'south']).map((one) => one.scope)).toEqual(['north', 'south'])
  })
})

describe('moveBlocked', () => {
  const ask = (over: Partial<Parameters<typeof moveBlocked>[0]> = {}) => moveBlocked({
    plan: OK, here: 'north', target: 'south', readOnly: false, across: true, writable: () => true, trail, t, ...over,
  })
  it('says why Move cannot be pressed, in order, or nothing', () => {
    expect(ask({ readOnly: true })).toBe(t('observation.moveReadOnly'))
    expect(ask({ target: undefined, plan: undefined })).toBe(t('observation.movePick'))
    expect(ask({ plan: { ok: false, refusal: 'archived', cut: [] } })).toBe(t('observation.moveArchived'))
    expect(ask({ writable: (path) => path !== 'south' })).toBe('You may read south, but not change it, so it cannot move there.')
    expect(ask({ across: false })).toBe(t('observation.moveNotFromHere'))
    expect(ask()).toBeUndefined()
  })
})

describe('moveNote', () => {
  const moved = { label: 'OB-0003', scope: 'south' }
  it('says where it went, or why nothing moved', () => {
    expect(moveNote({ ok: true, changed: ['north', 'south'] }, moved, trail, t)).toContain('Moved to OB-0003 in south.')
    expect(moveNote({ ok: true, changed: ['north'], unsaved: true }, moved, trail, t)).toContain(t('observation.mergedUnsaved'))
    expect(moveNote({ ok: false, reason: 'refused', refused: 'taken' }, moved, trail, t)).toBe(`Nothing was moved: ${t('observation.moveTaken')}`)
    expect(moveNote({ ok: false, reason: 'shell.scopeReadOnly', scope: 'south' }, moved, trail, t)).toBe('Nothing was moved: you may read south, but not change it.')
    expect(moveNote({ ok: false, reason: 'shell.scopeMoved' }, moved, trail, t)).toBe(t('observation.moveNotMadeMoved'))
    expect(moveNote({ ok: false, reason: 'partial', changed: ['south'] }, moved, trail, t)).toContain('south were changed')
    expect(moveNote({ ok: false, reason: 'gone' }, moved, trail, t)).toBe(`Nothing was moved: ${t('observation.moveUnknownScope')}`)
    expect(moveNote({ ok: false, reason: 'command.gone' }, moved, trail, t)).toContain('Nothing was moved: ')
    expect(moveNote({ ok: false, reason: 'unchanged' }, moved, trail, t)).toBe(t('observation.moveNotMade'))
  })
})

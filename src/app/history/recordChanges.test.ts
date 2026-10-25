// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { HostModel } from '../../model/hostModel'
import type { Observation } from '../../model/observation'
import { DEFAULT_TRANSLATE } from '../../i18n/strings'
import { aboutRecord, recordChangeLines } from './recordChanges'

const seen = (title: string, extra: Partial<Observation> = {}): Observation => ({
  id: 'ob-1', number: 1, title, date: '2026-10-01', impact: 'minor', seen: 1, body: '', history: [{ date: '2026-10-01', kind: 'recorded' }], ...extra,
})
const at = (...observations: Observation[]): HostModel => ({ name: 'Acme', elements: [], relations: [], diagrams: [], observations })
const about = { kind: 'observation' as const, id: 'ob-1' }

describe('a record\'s changes (ADR-0038, amended §11)', () => {
  it('says what each entry did to the record against the one before it, newest first', () => {
    const models = [at(seen('Late', { tone: 'problem' })), at(seen('Late')), at(seen('Slow'))]
    const lines = recordChangeLines(about, models, true, 'Created', DEFAULT_TRANSLATE)
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('tone')
    expect(lines[1]).toContain('title')
    expect(lines[2]).toBe('Created')
  })

  it('says nothing of the oldest where older entries were left unread', () => {
    const lines = recordChangeLines(about, [at(seen('Late')), at(seen('Slow'))], false, 'Created', DEFAULT_TRANSLATE)
    expect(lines[1]).toBe('')
  })

  it('leaves out what the entry did to other records', () => {
    const other = { ...seen('Other'), id: 'ob-2', number: 2 }
    const lines = recordChangeLines(about, [at(seen('Late'), { ...other, title: 'Changed' }), at(seen('Late'), other)], true, 'Created', DEFAULT_TRANSLATE)
    expect(lines[0]).toBe('')
  })

  it('files a view\'s membership and geometry under the view', () => {
    expect(aboutRecord({ kind: 'added', what: 'membership', id: 'el-1', name: 'A', onId: 'v-1' }, { kind: 'diagram', id: 'v-1' })).toBe(true)
    expect(aboutRecord({ kind: 'changed', what: 'geometry', id: 'v-1', name: 'V', count: 2 }, { kind: 'diagram', id: 'v-1' })).toBe(true)
    expect(aboutRecord({ kind: 'changed', what: 'element', id: 'v-1', name: 'V' }, { kind: 'diagram', id: 'v-1' })).toBe(false)
  })
})

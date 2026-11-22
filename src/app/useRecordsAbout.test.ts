// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { translator } from '../i18n'
import type { Adr } from '../model/adr'
import type { Observation } from '../model/observation'
import { recordsAbout } from './useRecordsAbout'

const ob = (id: string, number: number, over: Partial<Observation> = {}): Observation => ({
  id, number, title: id, date: '2026-11-01', impact: 'minor', seen: 1, body: '', history: [{ date: '2026-11-01', kind: 'recorded' }], ...over,
})
const adr: Adr = { id: 'adr-1', number: 1, title: 'Keep one ledger', status: 'accepted', date: '2026-11-01', body: '', signers: [], subjectId: 'ledger' }

describe('recordsAbout', () => {
  const input = {
    decisions: [adr], observations: [ob('o1', 1, { about: ['ledger'], tone: 'problem' })],
    tree: [{ scope: 'finance', observations: [ob('f1', 3, { about: ['ledger'] })], causes: [], solutions: [], experiments: [] }],
    here: '', scopeLabel: (path: string) => (path === 'finance' ? 'Finance' : path), t: translator('en'),
  }

  it('says each record in words: number, title, status or tone, and the scope where it is another', () => {
    expect(recordsAbout(input, 'ledger')).toEqual({
      decisions: [{ kind: 'decision', id: 'adr-1', label: 'ADR-0001', title: 'Keep one ledger', status: 'Accepted' }],
      observations: [
        { kind: 'observation', id: 'o1', label: 'OB-0001', title: 'o1', status: 'Problem', tone: 'problem' },
        { kind: 'observation', id: 'f1', label: 'OB-0003', title: 'f1', status: 'Neutral', tone: 'neutral', scope: 'finance', where: 'Finance' },
      ],
      observationsAcross: true,
    })
  })

  it('says the observations are this scope\'s where the tree was not read', () => {
    expect(recordsAbout({ ...input, tree: [] }, 'ledger').observationsAcross).toBe(false)
  })
})

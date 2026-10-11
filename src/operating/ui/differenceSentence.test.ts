// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { translator } from '../../i18n'
import type { Difference } from '../compare'
import { differenceSentence } from './LibrariesPanel'

const item = { kind: 'role' as const, id: 'ro-1', name: 'Team coach' }
const say = (difference: Omit<Difference, 'item'>) => differenceSentence({ item, ...difference }, translator('en'))

describe('a difference, said', () => {
  it('says each kind of difference as a sentence', () => {
    expect(say({ what: 'own' })).toBe('Team coach is the organisation\'s own, from no library.')
    expect(say({ what: 'libraryGone', there: 'scrum' })).toBe('Team coach came from a library this version no longer ships.')
    expect(say({ what: 'entryGone', there: 'x' })).toBe('Team coach: its library no longer has the entry it came from.')
    expect(say({ what: 'version', here: '1', there: '2' })).toBe('Team coach came from version 1; the library is at 2 now.')
    expect(say({ what: 'name', here: 'Team coach', there: 'Scrum Master' })).toBe('Team coach — the name: here “Team coach”, in the library “Scrum Master”.')
    expect(say({ what: 'name', here: 'Team coach', there: 'Scrum Master', chosen: 'Agile coach' })).toBe('Team coach — renamed since it came in as “Agile coach”.')
    expect(say({ what: 'manages', here: 'true' })).toBe('Team coach — manages its unit: here “yes”, in the library “nothing”.')
    expect(say({ what: 'duty', about: 'Plan the cycle', there: 'C' })).toBe('Team coach — its part in Plan the cycle: here nothing, in the library C.')
  })

  it('says a move since a type came in against where it was put then, not against the library', () => {
    expect(say({ what: 'top', here: 'true', moved: true })).toBe('Team coach — sits at the top: here “yes”, when it came in “nothing”.')
    expect(say({ what: 'within', about: 'Cluster', there: 'true', moved: true })).toBe('Team coach — sits in Cluster: here nothing, when it came in yes.')
    expect(differenceSentence({ item, what: 'within', about: 'Cluster', here: 'true', moved: true }, translator('nl')))
      .toBe('Team coach — valt onder Cluster: hier ja, bij binnenkomst niets.')
  })
})

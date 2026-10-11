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
    expect(say({ what: 'manages', here: 'true' })).toBe('Team coach — manages its unit: here “yes”, in the library “nothing”.')
    expect(say({ what: 'duty', about: 'Plan the cycle', there: 'C' })).toBe('Team coach — its part in Plan the cycle: here nothing, in the library C.')
  })
})

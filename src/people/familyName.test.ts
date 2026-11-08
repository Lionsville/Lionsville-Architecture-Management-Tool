// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { familyName } from './familyName'

describe('a name\'s family part', () => {
  it('is what follows the first word, filed past the words in lower case that open it', () => {
    expect(familyName('Noa van Farrow')).toEqual({ said: 'van Farrow', key: 'Farrow' })
    expect(familyName('Ivo de Hartwell')).toEqual({ said: 'de Hartwell', key: 'Hartwell' })
    expect(familyName('Jo von der Elst')).toEqual({ said: 'von der Elst', key: 'Elst' })
    expect(familyName('Alex Ashdown')).toEqual({ said: 'Ashdown', key: 'Ashdown' })
  })
  it('is the whole name where there is one word, and the family part where every word is lower case', () => {
    expect(familyName('Cher')).toEqual({ said: 'Cher', key: 'Cher' })
    expect(familyName('bell hooks')).toEqual({ said: 'hooks', key: 'hooks' })
  })
})

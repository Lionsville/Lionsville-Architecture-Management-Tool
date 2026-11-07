// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { translator } from '../../i18n/strings'
import type { Finding } from '../../model/checks'
import { findingWords } from './FindingSentence'

const implied = (count: number): Finding => ({ kind: 'impliedInterface', subject: 'element', id: 'a', name: 'Billing', detail: 'Warehouse', count })

describe('a finding that counts', () => {
  it('says one in the singular, in every language', () => {
    expect(findingWords(implied(1), translator('en'))).toBe('1 container interface between Billing and Warehouse without an application interface.')
    expect(findingWords(implied(1), translator('nl'))).toContain('1 koppelvlak op containerniveau')
    expect(findingWords(implied(1), translator('de'))).toContain('1 Container-Schnittstelle zwischen')
  })

  it('says more than one in the plural', () => {
    expect(findingWords(implied(2), translator('en'))).toBe('2 container interfaces between Billing and Warehouse without an application interface.')
  })
})

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a document may refer to, read off a scope: its views and elements, and
 * no decisions or observations where the scope keeps none.
 */
import { describe, expect, it } from 'vitest'
import { translator } from '../i18n/strings'
import { diagram, element } from '../model/testFixtures'
import { referablesIn } from './referables'

describe('what a document here may refer to', () => {
  it('is the views and elements of a scope that keeps no decisions or observations', () => {
    const refs = referablesIn({
      model: { diagrams: [diagram('d1', { name: 'Landscape' })], elements: [element('a', { name: 'Billing' })] },
      principles: [], blocks: [], evaluations: [], scopeLabel: (path) => path, s: translator('en'),
    })
    expect(refs.map((ref) => [ref.kind, ref.markdown])).toEqual([['view', '![Landscape](view:d1)'], ['element', '[[Billing]]']])
  })
})

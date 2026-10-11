// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { DATE_CHECK } from '../model/checkCatalogue'
import type { FindingKind } from '../model/checks'
import { CHECK_SENTENCE } from './labels'

/**
 * What the dates contradict is said under its check's own key (ADR-0009;
 * `model/checkCatalogue.ts`): the sentence of a finding and the entry that
 * explains its kind are found by the same key.
 */
describe('the sentence of each finding of the dates', () => {
  it('is keyed by the check its kind is in the catalogue', () => {
    for (const kind of Object.keys(DATE_CHECK) as FindingKind[]) expect(CHECK_SENTENCE[kind]).toBe(DATE_CHECK[kind])
  })
})

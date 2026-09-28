// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Every line of every gate says, on hover and on focus, what it asks — in
 * every language.
 *
 * The three maps are typed `Record<…GateItem, StringKey>`, so a gate line
 * added to a record's rules without a hint does not compile, and the Dutch
 * and German tables are typed from the English, so a hint missing in one
 * does not compile either. What a type cannot see is a hint written empty,
 * or copied over in English; this reads each one out of each table.
 */
import { describe, expect, it } from 'vitest'
import { GATE_HINT as ADR_GATE_HINT } from '../decisions/ui/AdrReaderParts'
import { GATE_HINT as SOLUTION_GATE_HINT } from '../observations/observationScope'
import { PLAN_GATE_HINT } from '../roadmap/planGateHints'
import { LANGUAGES, STRINGS } from '../i18n/strings'
import type { StringKey } from '../i18n'

const GATES: Record<string, Record<string, StringKey>> = {
  decision: ADR_GATE_HINT,
  plan: PLAN_GATE_HINT,
  solution: SOLUTION_GATE_HINT,
}

describe('the gates', () => {
  it.each(Object.entries(GATES))('say what each %s gate line asks, in every language, in its own words', (_gate, hints) => {
    for (const key of Object.values(hints)) {
      for (const language of LANGUAGES) {
        const words = STRINGS[language][key]
        expect(words?.trim(), `${key} in ${language}`).toBeTruthy()
        if (language !== 'en') expect(words, `${key} in ${language}`).not.toBe(STRINGS.en[key])
      }
    }
  })
})

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Every refusal the writer can answer is a sentence in every language.
 *
 * A refusal is a key the shell turns into a toast, so a key with no words is
 * a toast that says the key. `EVERY_REFUSAL` is a `Record` over the closed
 * set, so a refusal added to `CommandRefusal` does not compile until it is
 * listed here, and then this reads its words out of each table — which a
 * type cannot do for a value written empty, or copied over in English.
 */
import { describe, expect, it } from 'vitest'
import { LANGUAGES, STRINGS } from '../../i18n/strings'
import type { CommandRefusal } from './handler'

const EVERY_REFUSAL: Record<CommandRefusal, true> = {
  'command.gone': true,
  'command.lastLandscape': true,
  'command.datesOutOfOrder': true,
  'command.refinesEnds': true,
  'command.refinesLevel': true,
  'command.hostedOnContainers': true,
  'command.technologyEnds': true,
  'command.taken': true,
  'command.notAField': true,
  'command.ownedElsewhere': true,
  'command.rootExplained': true,
  'command.rootAddressed': true,
}

describe('the writer’s refusals', () => {
  it.each(Object.keys(EVERY_REFUSAL) as CommandRefusal[])('%s is said in every language, in its own words', (key) => {
    for (const language of LANGUAGES) {
      const words = STRINGS[language][key]
      expect(words?.trim(), `${key} in ${language}`).toBeTruthy()
      if (language !== 'en') expect(words, `${key} in ${language}`).not.toBe(STRINGS.en[key])
    }
  })
})

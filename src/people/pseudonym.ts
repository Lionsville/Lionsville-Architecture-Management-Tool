// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A pseudonym: four characters drawn at random, such as `4K7Q`, shown with a
 * word in the language that is on — *Former colleague 4K7Q* once the person
 * is forgotten, *Person 4K7Q* where a name is withheld (`shown.ts`).
 *
 * **Drawn, never derived.** Nothing of the name goes into it, so a pseudonym
 * says nothing about who it stood for, and two people with one name have two.
 * The code alone is kept, not a sentence, because the word around it is the
 * reader's language and not the register's.
 *
 * **Easy to say and to copy.** No vowel, so no word is spelt by accident, and
 * none of 0, 1, O, I or L, which read as each other. Unique in its register:
 * a code an entry already holds is drawn again, and once four characters are
 * crowded, a fifth is added.
 */

/** Twenty-seven characters nobody misreads. */
export const PSEUDONYM_ALPHABET = '23456789BCDFGHJKMNPQRSTVWXZ'

const LENGTH = 4

/** A number in `[0, 1)`, as `Math.random` gives one; a test hands in its own. */
export type Draw = () => number

/** A pseudonym none of `taken` is. */
export function drawPseudonym(taken: ReadonlySet<string>, draw: Draw = Math.random): string {
  // Lengthen before the draws start colliding often: at half full, a code more.
  let length = LENGTH
  while (taken.size * 2 >= PSEUDONYM_ALPHABET.length ** length) length++
  for (;;) {
    let code = ''
    for (let at = 0; at < length; at++) code += PSEUDONYM_ALPHABET[Math.floor(draw() * PSEUDONYM_ALPHABET.length) % PSEUDONYM_ALPHABET.length]
    if (!taken.has(code)) return code
  }
}

/** Whether text is a pseudonym as this draws them. */
export function isPseudonym(value: unknown): value is string {
  return typeof value === 'string' && value.length >= LENGTH
    && [...value].every((character) => PSEUDONYM_ALPHABET.includes(character))
}

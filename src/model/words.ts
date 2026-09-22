// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The model's own words, in English, for a caller that hands over no translate.
 *
 * Every label table down here takes a {@link Translate} and defaults to English,
 * so a pure function stays pure and a caller with no language to be in still
 * gets a sentence (`kinds`, `zones`, `deletion`, `logoRegistry`). That default
 * used to be the registry's `DEFAULT_TRANSLATE` — and the registry
 * (`i18n/strings.ts`) composes every module's slice, so `model/kinds.ts` reached
 * `app/strings` and `editor/strings` at module load. Four files did, which meant
 * every node process that imported the model at all loaded the whole shell's
 * vocabulary, and the day something in `app/` grows an import that needs a
 * browser, that process stops starting.
 *
 * So the model reads its own slice: `strings/en.ts` is an `as const` object with
 * no graph behind it, and `translateFrom` is the eight lines that look a key up
 * in it. `projects/commitMessage.ts` did this first and says the same thing
 * about a snapshot's message.
 *
 * The slice whole, rather than the two dozen keys these files reach today: a key
 * added to the model's words is a key the model's own labels should have.
 *
 * What this deliberately does NOT carry is anybody else's words. A logo pack a
 * build registered brings its own label key (ADR-0022), and that key is in the
 * table of whoever brought it — so a caller that wants to read one hands over a
 * translator from the registry, which is what a screen has anyway.
 */
import { translateFrom } from '../i18n/interpolate'
import type { Translate } from '../i18n/strings'
import { EN } from './strings/en'

/** The model's slice, as a table a lookup can be done in. */
export const MODEL_WORDS: Readonly<Record<string, string>> = EN

/** English over {@link MODEL_WORDS}: what every label table here falls back on. */
export const MODEL_ENGLISH: Translate = translateFrom(MODEL_WORDS)

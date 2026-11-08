// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What row one lets go of when it runs out, and in which order — which hangs
 * on what the status word has to say.
 *
 * A calm word (saved, nothing waiting, reading only) says nothing a person has
 * to act on, so it is the first to go, to its mark, whole: still the button's
 * name, its tooltip and its live text. A word that is not calm — offline,
 * waiting, a problem, or work on its way for longer than is ordinary — is what
 * the row is for, so it outranks everything that can fold and never folds: it
 * keeps at least its first words even once a name in the trail is cut, and
 * only the open scope's name goes after it (`Frame.css`, `--least`).
 *
 * Then the Agent, before Activity, which says what was lately done to the work;
 * Help and the text size, the size last since it is what makes room for
 * reading; and Forward after everything, beside a Back that never goes, Back
 * being the press people miss most. Once all of it is gone the find field may
 * go to its glass, and only then is a name in the trail cut (`Crumbs`' `capped`).
 *
 * Each step is measured (`useRowFold`) rather than set at a width, since what a
 * row needs depends on the language and the text size as much as the window.
 */
import type { StatusTone } from '../../ports/ProviderParts'

export type RowOneFold = 'status' | 'agent' | 'activity' | 'help' | 'size' | 'forward'

const AFTER_THE_WORD: readonly RowOneFold[] = ['agent', 'activity', 'help', 'size', 'forward']

/**
 * How long work may be on its way before the word stops calling that ordinary.
 * An edit waits a few seconds before it is written and every keystroke starts
 * that wait again, so a sentence being typed reads as not saved for as long as
 * it takes to type: under this the word stays calm and the row stands still.
 * It is the span after which a source that sends steps says it is still sending.
 */
export const BUSY_ORDINARY_MS = 10_000

/** Whether the word is calm, given how long it has said that work is on its way. */
export function statusCalm(tone: StatusTone, busyForMs = 0): boolean {
  switch (tone) {
    case 'saved':
    case 'reading':
      return true
    case 'busy':
      return busyForMs < BUSY_ORDINARY_MS
    case 'waiting':
    case 'offline':
    case 'problem':
      return false
  }
}

/** Row one's folds, first to go first. */
export function rowOneFolds(calm: boolean): readonly RowOneFold[] {
  return calm ? ['status', ...AFTER_THE_WORD] : AFTER_THE_WORD
}

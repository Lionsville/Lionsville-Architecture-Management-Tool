// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a change that was not kept is said as, wherever it is said: the toast,
 * *Your work*, a setting that did not land.
 *
 * Two parts, in this order. First the place's own truth — *the folder did not
 * take the change* — in the words of the source that keeps the work
 * (`SourceProvider.keepFailedKey`), or in words that name no place where it
 * gave none. Then the refusal's reason, in whatever words it came with: a key
 * the store refused with is its sentence, a refusal answered rather than
 * thrown is its key's, and anything else is quoted. A fault in the app's own
 * code has no reason a person can act on, and is left out.
 *
 * One sentence for every source used to be a browser's — *storage full or
 * blocked, it is gone when you close the tab* — said on the desktop over a
 * folder that would not be written.
 */
import type { StringKey, Translate } from '../i18n'
import { reasonOf as messageOf, ShellError } from '../platform/errors'

/** A source's key for the first part, which may be in a table this tree does not hold. */
export type KeepFailedKey = StringKey | (string & {}) | undefined

/** A JavaScript fault rather than a refusal with words: what no sentence for a person should quote. */
export function isFault(cause: unknown): boolean {
  return cause instanceof Error && ['TypeError', 'ReferenceError', 'SyntaxError', 'RangeError'].includes(cause.name)
}

/** Why a write was refused, as a sentence, or nothing where there is nothing a person could use. */
export function refusalReason(cause: unknown, s: Translate): string | undefined {
  if (cause === undefined || cause === null || isFault(cause)) return undefined
  if (cause instanceof ShellError) return s(cause.key, cause.params)
  if (typeof cause === 'object' && 'refused' in cause && typeof (cause as { refused: unknown }).refused === 'string') {
    return s((cause as { refused: string }).refused as StringKey)
  }
  const message = messageOf(cause).trim()
  return message ? s('shell.refusalSaid', { message }) : undefined
}

/** The place's sentence, then the reason where there is one. */
export function notKeptSentence(s: Translate, keepFailedKey: KeepFailedKey, cause?: unknown): string {
  const place = s((keepFailedKey ?? 'shell.keepFailed') as StringKey)
  const reason = refusalReason(cause, s)
  return reason ? `${place} ${reason}` : place
}

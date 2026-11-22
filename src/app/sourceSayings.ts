// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the open source's provider says about where work is kept, for a
 * screen that says it: keys of the provider's own table, read by the shell
 * off the registration and handed down.
 */
import type { StringKey } from '../i18n'

/** A provider's sentences about its source, as keys of its own table. */
export type SourceSayings = {
  readonly labelKey?: StringKey | (string & {})
  readonly whereKey?: StringKey | (string & {})
  /** What can lose the work here, for *Your work* and the first run. */
  readonly riskKey?: StringKey | (string & {})
  readonly removeKey?: StringKey | (string & {})
  readonly unreadableKey?: StringKey | (string & {})
  /** What a change this place would not take means here (`SourceProvider.keepFailedKey`). */
  readonly keepFailedKey?: StringKey | (string & {})
  /** The status word while a refused change stands, naming this place (`SourceProvider.refusedWordKey`). */
  readonly refusedWordKey?: StringKey | (string & {})
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What crosses the desktop's channel from main when a call fails, and what the
 * page makes of it: main says a key (`electron/main/sayable.ts`), and this
 * takes it back out of the channel's wrapping.
 */
import { ShellError } from '../../platform/errors'

/** A refusal's key, as `ShellError` takes one. */
type Key = ConstructorParameters<typeof ShellError>[0]

/**
 * The key a git the app would not run in a folder crosses from the desktop's
 * main process under, with the refusal's own words after it
 * (`electron/main/sayable.ts`, `platform/node/gitGuard.ts`).
 */
export const GIT_REFUSED = 'shell.gitRefused'

/**
 * A failure from the desktop's main process, as the refusal it is.
 *
 * Main says a failure as a key (`electron/main/sayable.ts`), and the channel
 * wraps it in a sentence of its own on the way (*Error invoking remote method
 * …: Error: shell.gitMissing*), which is no sentence a person should read. So
 * the key is taken back out and becomes a {@link ShellError} — with the words
 * after it as its `reason` where main sent some, as a git refused in the
 * folder does. Anything without a key is handed back as it came.
 */
export function crossedFromMain(cause: unknown): unknown {
  const message = cause instanceof Error ? cause.message : undefined
  if (message === undefined) return cause
  const said = /(?:^|Error: )(shell\.[A-Za-z]+)(?:: ([\s\S]+))?$/.exec(message)
  if (!said) return cause
  const [, key, reason] = said
  return reason === undefined ? new ShellError(key as Key) : new ShellError(key as Key, { reason })
}

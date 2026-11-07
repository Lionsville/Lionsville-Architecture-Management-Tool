// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A document handed to the person, and what is said about it — after it happened.
 *
 * Every save goes through this one, so none can toast before it knows, or say
 * *saved* of a save dialog the person closed: that is `'cancelled'`, which is no
 * save and no failure, and nothing is said of it. A gateway that throws rather than
 * rejects is a failure like any other.
 */
export function handOver(
  save: () => Promise<void | 'cancelled'>,
  said: { saved(): void; failed(cause: unknown): void },
): Promise<void> {
  let going: Promise<void | 'cancelled'>
  // At once: a save dialog opened later than the press is one a browser may refuse.
  try {
    going = save()
  } catch (cause) {
    going = Promise.reject(cause as Error)
  }
  return going.then(
    (answer) => { if (answer !== 'cancelled') said.saved() },
    (cause: unknown) => { said.failed(cause) },
  )
}

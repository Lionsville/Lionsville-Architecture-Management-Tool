// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a failure in main may say to the page: its key, and nothing else.
 *
 * git's own words and a file system's name paths off the person's disk, and
 * the page is where somebody else's document is opened. So a refusal that is
 * already a key crosses as it is; anything else is said on the trail by its
 * code alone — the trail is a file a person is invited to hand over — and
 * crosses as one sentence of ours.
 */
export function sayable(channel: string, cause: unknown, note: (said: string) => void): Error {
  const message = cause instanceof Error ? cause.message : ''
  if (/^shell\.[A-Za-z]+$/.test(message)) return new Error(message)
  const code = (cause as { code?: unknown } | undefined)?.code
  note(`${channel} failed: ${typeof code === 'string' || typeof code === 'number' ? String(code) : 'unknown'}`)
  return new Error(channel.startsWith('git:') ? 'shell.historyFailed' : 'shell.folderUnavailable')
}

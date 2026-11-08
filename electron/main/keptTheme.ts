// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The theme the page last said, kept beside the other settings in `userData`.
 *
 * The page keeps the preference in its own storage, which main cannot read
 * before there is a page; a window is made before that, and its ground is what
 * shows until the page paints. So main keeps the one word it was told
 * (`app:theme`) and reads it back at the next start: a person in the light
 * theme no longer opens the app on a dark window that then turns light.
 */
import { readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { isThemeMode } from '../../src/platform/theme'
import type { ThemeMode } from '../../src/platform/theme'

/** The mode kept at `path`, or nothing where none was, or it cannot be read: the system's then. */
export function readKeptTheme(path: string): ThemeMode | undefined {
  try {
    const held: unknown = JSON.parse(readFileSync(path, 'utf8'))
    const mode = typeof held === 'object' && held !== null ? (held as { themeMode?: unknown }).themeMode : undefined
    return isThemeMode(mode) ? mode : undefined
  } catch {
    return undefined
  }
}

/** Kept for the next start; a failure costs only the ground of the next window, so it is not worth a word. */
export function keepTheme(path: string, mode: ThemeMode): Promise<void> {
  return writeFile(path, `${JSON.stringify({ themeMode: mode })}\n`, 'utf8').catch(() => undefined)
}

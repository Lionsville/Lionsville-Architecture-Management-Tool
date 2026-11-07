// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The help as a second page of the build, beside the app's (`help/index.html`).
 *
 * Its own scripts go under `assets/help/`, so the budget can count them apart:
 * the help is read now and then, by whoever asks, and its words in three
 * languages are not part of what the app downloads to start
 * (`bundleBudget.ts`'s `HELP_BUDGET`). What both pages use — React, the words
 * of the controls, the fonts — stays where the app had it.
 *
 * Shared by the web build, the desktop's renderer and a build composed from
 * this one, which is why it is a function of the root rather than a constant.
 */
import { resolve } from 'node:path'

/** Where the help's own files land in the build. */
export const HELP_ASSETS = 'assets/help/'

const isHelp = (id: string) => /[\\/]src[\\/]help[\\/]/.test(id)

export function helpPage(root: string, main = resolve(root, 'index.html')) {
  return {
    input: { main, help: resolve(root, 'help/index.html') },
    output: {
      entryFileNames: (chunk: { name: string }) => (chunk.name === 'help' ? `${HELP_ASSETS}[name]-[hash].js` : 'assets/[name]-[hash].js'),
      chunkFileNames: (chunk: { moduleIds: readonly string[] }) => (
        chunk.moduleIds.length > 0 && chunk.moduleIds.every(isHelp) ? `${HELP_ASSETS}[name]-[hash].js` : 'assets/[name]-[hash].js'
      ),
      assetFileNames: (asset: { names?: readonly string[] }) => (
        (asset.names ?? []).some((name) => name.startsWith('help')) ? `${HELP_ASSETS}[name]-[hash][extname]` : 'assets/[name]-[hash][extname]'
      ),
    },
  }
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** A view's picture to a file the person picks, said as saved or why not: the landscape's and the chart's Export…. */
import { handOver } from './handOver'
import type { WorkspaceParts } from './workspaceParts'

export function savePicture(parts: WorkspaceParts, name: string, png: Uint8Array, where: string): void {
  const { files: { documents }, shell: { notify, s }, host: { diagnostics } } = parts.props
  void handOver(() => documents.save({ name, mediaType: 'image/png', bytes: png }), {
    saved: () => notify(s('shell.savedPicture'), 'success'),
    failed: (cause) => {
      diagnostics.report({ level: 'error', where, message: 'shell.saveFileFailed', cause })
      notify(s('shell.saveFileFailed', { message: cause instanceof Error ? cause.message : String(cause) }), 'error')
    },
  })
}

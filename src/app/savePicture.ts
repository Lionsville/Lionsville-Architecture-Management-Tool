// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** A view's picture to a file the person picks, said as saved or why not: the board's, the landscape's and the chart's Export…. */
import { handOver } from './handOver'
import type { WorkspaceParts } from './workspaceParts'

/** The size a PNG says in its header, or none where the bytes are not one. */
export function pngSize(png: Uint8Array): { width: number; height: number } | undefined {
  // The signature, then the IHDR chunk: width and height as big-endian words at 16 and 20.
  if (png.length < 24 || png[0] !== 0x89 || png[1] !== 0x50 || png[2] !== 0x4e || png[3] !== 0x47) return undefined
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(2)} s`

/**
 * The one line a picture export leaves on the log: its size, how long it took
 * to raster where that is known, and whether it was saved, the save panel
 * cancelled, or the write failed — with how long the panel took, so the line's
 * own time says when it started. No name and no path: those are the person's.
 */
export function pictureLine(where: string, png: Uint8Array, outcome: 'saved' | 'cancelled' | 'failed', panelMs: number, rasterMs?: number): string {
  const size = pngSize(png)
  return [
    `picture export (${where}): ${size ? `${size.width} × ${size.height} px` : 'size unknown'}, ${png.byteLength} bytes`,
    ...(rasterMs !== undefined ? [`rastered in ${seconds(rasterMs)}`] : []),
    `${outcome} ${seconds(panelMs)} after`,
  ].join(', ')
}

export function savePicture(parts: WorkspaceParts, name: string, png: Uint8Array, where: string, rasterMs?: number): void {
  const { files: { documents }, shell: { notify, s }, host: { diagnostics } } = parts.props
  const asked = Date.now()
  const log = (outcome: 'saved' | 'cancelled' | 'failed') => {
    diagnostics.report({ level: 'info', where, message: pictureLine(where, png, outcome, Date.now() - asked, rasterMs) })
  }
  void handOver(() => documents.save({ name, mediaType: 'image/png', bytes: png }), {
    saved: () => { log('saved'); notify(s('shell.savedPicture'), 'success') },
    cancelled: () => log('cancelled'),
    failed: (cause) => {
      log('failed')
      diagnostics.report({ level: 'error', where, message: 'shell.saveFileFailed', cause })
      notify(s('shell.saveFileFailed', { message: cause instanceof Error ? cause.message : String(cause) }), 'error')
    },
  })
}

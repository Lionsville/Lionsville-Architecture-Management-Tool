// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** A view's picture to a file the person picks, said as saved or why not: every view's Export… and a drawing's. */
import type { Diagnostics } from '../ports/Diagnostics'
import { refused } from '../widgets/pictureRefused'
import { handOver } from './handOver'
import type { WorkspaceParts } from './workspaceParts'

/** The size a PNG says in its header, or none where the bytes are not one. */
export function pngSize(png: Uint8Array): { width: number; height: number } | undefined {
  // The signature, then the IHDR chunk: width and height as big-endian words at 16 and 20.
  if (png.length < 24 || png[0] !== 0x89 || png[1] !== 0x50 || png[2] !== 0x4e || png[3] !== 0x47) return undefined
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

/** What a picture is, read from its bytes: a PNG's size, or the kind of file a drawing's export made. */
function pictureSaid(bytes: Uint8Array): string {
  const size = pngSize(bytes)
  if (size) return `${size.width} × ${size.height} px`
  const head = new TextDecoder().decode(bytes.subarray(0, 256))
  if (head.startsWith('%PDF')) return 'PDF'
  if (head.includes('<svg') || head.startsWith('<?xml')) return 'SVG'
  return 'size unknown'
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(2)} s`

/**
 * The one line a picture export leaves on the log: its size, how long it took
 * to raster where that is known, and whether it was saved, the save panel
 * cancelled, or the write failed — with how long the panel took, so the line's
 * own time says when it started. No name and no path: those are the person's.
 */
export function pictureLine(where: string, png: Uint8Array, outcome: 'saved' | 'cancelled' | 'failed', panelMs: number, rasterMs?: number): string {
  return [
    `picture export (${where}): ${pictureSaid(png)}, ${png.byteLength} bytes`,
    ...(rasterMs !== undefined ? [`rastered in ${seconds(rasterMs)}`] : []),
    `${outcome}; the save panel took ${seconds(panelMs)}`,
  ].join(', ')
}

/** Why a picture could not be made, as words: an image's error event says "[object Event]" and nothing else. */
export function pictureCause(cause: unknown): string {
  const said = refused(cause)
  return said instanceof Error ? said.message : String(said)
}

/** The line a picture that could not be made leaves on the log, so a failed export is not silent. */
export function pictureFailed(diagnostics: Pick<Diagnostics, 'report'>, where: string, cause: unknown): void {
  diagnostics.report({ level: 'error', where, message: `picture export (${where}): failed: ${pictureCause(cause)}` })
}

/** Starts the save panel's clock, and answers with what logs the export's one line when the panel has answered. */
export function pictureLog(diagnostics: Pick<Diagnostics, 'report'>, where: string, bytes: Uint8Array, rasterMs?: number) {
  const asked = Date.now()
  return (outcome: 'saved' | 'cancelled' | 'failed') => {
    diagnostics.report({ level: 'info', where, message: pictureLine(where, bytes, outcome, Date.now() - asked, rasterMs) })
  }
}

export function savePicture(parts: WorkspaceParts, name: string, png: Uint8Array, where: string, rasterMs?: number): void {
  const { files: { documents }, shell: { notify, s }, host: { diagnostics } } = parts.props
  const log = pictureLog(diagnostics, where, png, rasterMs)
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

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { pictureLine, pngSize } from './savePicture'

/** The first 24 bytes of a PNG of this size: the signature, then IHDR's length, type, width and height. */
function pngOf(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(32)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

describe('the line a picture export leaves on the log', () => {
  it('reads the size from the picture itself', () => {
    expect(pngSize(pngOf(5994, 4006))).toEqual({ width: 5994, height: 4006 })
    expect(pngSize(new Uint8Array([1, 2, 3]))).toBeUndefined()
  })

  it('says the size, the raster, the outcome and the panel time, and nothing of the name', () => {
    const line = pictureLine('boardExport', pngOf(6402, 4856), 'cancelled', 2100, 5380)
    expect(line).toBe('picture export (boardExport): 6402 × 4856 px, 32 bytes, rastered in 5.38 s, cancelled 2.10 s after')
    expect(pictureLine('chartExport', pngOf(10, 20), 'saved', 5)).toBe('picture export (chartExport): 10 × 20 px, 32 bytes, saved 0.01 s after')
  })
})

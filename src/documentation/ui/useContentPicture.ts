// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A picture kept by its content address, as an address a browser can draw.
 *
 * This is the path a drawing's picture takes (`DrawingView`): the bytes are
 * asked for by address, not by a library name, and shown as an image so
 * nothing inside them runs. `bytesAt` is the repository's. Absent bytes are
 * `'absent'`, so a caller can say the drawing has not been drawn; `undefined`
 * is still waiting, or there was no address to ask for.
 */
import { useEffect, useState } from 'react'
import { mediaTypeOfBytes } from '../../model/imageName'

/** The box a picture is laid out in, so a link's area can be placed over it. */
export type PictureFrame = { minX: number; minY: number; width: number; height: number }

export type ContentPicture = { url: string; frame?: PictureFrame }

export type PictureBytes = { mediaType?: string; bytes: Uint8Array }

/**
 * `bytesAt` must be stable: a new function is a new ask. The frame is read
 * off an SVG's `viewBox` — draw.io's export — so a shape's area, which is in
 * that coordinate space, lands on the picture.
 */
export function useContentPicture(
  bytesAt: ((address: string) => Promise<PictureBytes | undefined>) | undefined,
  address: string | undefined,
): ContentPicture | 'absent' | undefined {
  const [shown, setShown] = useState<ContentPicture | 'absent' | undefined>(undefined)
  useEffect(() => {
    if (!bytesAt || !address) {
      setShown(undefined)
      return undefined
    }
    let gone = false
    let objectUrl: string | undefined
    void bytesAt(address).then((held) => {
      if (gone) return
      if (!held) {
        setShown('absent')
        return
      }
      const type = held.mediaType && held.mediaType !== 'application/octet-stream' ? held.mediaType : mediaTypeOfBytes(held.bytes)
      const copy = new Uint8Array(held.bytes)
      objectUrl = URL.createObjectURL(new Blob([copy], { type }))
      if (!gone) setShown({ url: objectUrl, frame: frameOf(copy, type) })
    }).catch(() => {
      if (!gone) setShown('absent')
    })
    return () => {
      gone = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [bytesAt, address])
  return shown
}

/** An SVG's page box, from its `viewBox` or its width and height. Anything else has none. */
function frameOf(bytes: Uint8Array, mediaType: string): PictureFrame | undefined {
  if (mediaType !== 'image/svg+xml') return undefined
  const head = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 4096)))
  const viewBox = /viewBox=["']([^"']+)["']/.exec(head)?.[1]
  if (viewBox) {
    const n = viewBox.trim().split(/[\s,]+/).map(Number)
    if (n.length === 4 && n.every((part) => Number.isFinite(part)) && n[2] > 0 && n[3] > 0) {
      return { minX: n[0], minY: n[1], width: n[2], height: n[3] }
    }
  }
  const width = Number(/width=["']([\d.]+)/.exec(head)?.[1])
  const height = Number(/height=["']([\d.]+)/.exec(head)?.[1])
  if (width > 0 && height > 0) return { minX: 0, minY: 0, width, height }
  return undefined
}

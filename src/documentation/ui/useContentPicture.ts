// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A picture kept by its content address, as an address a browser can draw.
 *
 * The one path a drawing's picture takes, for its view and for a document:
 * the bytes are asked for by address, not by a library name, and shown as an
 * image so nothing inside them runs. `bytesAt` is the repository's. Absent
 * bytes are `'absent'`, so a caller can say the drawing has not been drawn;
 * `undefined` is still waiting, or there was no address to ask for.
 */
import { useEffect, useState } from 'react'
import { svgFrame } from '../../model/drawing'
import type { PictureFrame } from '../../model/drawing'
import { mediaTypeOfBytes } from '../../model/imageName'

/** The picture, and the box its SVG names: draw.io's export, in its own units. */
export type ContentPicture = { url: string; frame?: PictureFrame }

export type PictureBytes = { mediaType?: string; bytes: Uint8Array }

/** `bytesAt` must be stable: a new function is a new ask. */
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
    setShown(undefined)
    void bytesAt(address).then((held) => {
      if (gone) return
      if (!held) {
        setShown('absent')
        return
      }
      const type = held.mediaType && held.mediaType !== 'application/octet-stream' ? held.mediaType : mediaTypeOfBytes(held.bytes)
      const copy = new Uint8Array(held.bytes)
      objectUrl = URL.createObjectURL(new Blob([copy], { type }))
      const frame = type === 'image/svg+xml' ? svgFrame(new TextDecoder().decode(copy)) : undefined
      setShown({ url: objectUrl, ...(frame ? { frame } : {}) })
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

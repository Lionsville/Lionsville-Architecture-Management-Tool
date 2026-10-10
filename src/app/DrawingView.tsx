// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A drawing, as it is read: its picture, or the words for one that has not
 * been drawn. Nothing here edits. The picture is an image, so nothing inside
 * it runs.
 */
import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { ContentAddress } from '../model/imageName'
import { mediaTypeOfBytes } from '../model/imageName'
import type { DesignDiagram } from '../model'
import type { ImageRepository } from '../ports/ImageRepository'
import type { Translate } from '../i18n'

export function DrawingView({ diagram, scope, images, s }: {
  diagram: DesignDiagram
  /** The scope the picture's bytes are kept for. Absent: there is nowhere to ask. */
  scope: string | undefined
  images: Pick<ImageRepository, 'bytesAt'> | undefined
  s: Translate
}) {
  const address = diagram.drawing?.picture
  const url = useDrawingPicture(scope, images, address)
  return (
    <Box
      data-testid="drawing-view"
      sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}
    >
      {url ? (
        <Box
          component="img"
          src={url}
          alt={diagram.name}
          data-testid="drawing-picture"
          sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
        />
      ) : (
        <Typography data-testid="drawing-not-drawn" sx={{ color: 'text.secondary' }}>
          {s('shell.drawingNotDrawn')}
        </Typography>
      )}
    </Box>
  )
}

/**
 * The picture's bytes, as an address a browser can draw, or nothing when the
 * drawing has no picture or the bytes are not there.
 */
function useDrawingPicture(
  scope: string | undefined,
  images: Pick<ImageRepository, 'bytesAt'> | undefined,
  address: ContentAddress | undefined,
): string | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined)
  useEffect(() => {
    if (!scope || !images || !address) {
      setUrl(undefined)
      return undefined
    }
    let gone = false
    let objectUrl: string | undefined
    void images.bytesAt(scope, address).then((held) => {
      if (gone || !held) return
      const type = held.mediaType && held.mediaType !== 'application/octet-stream' ? held.mediaType : mediaTypeOfBytes(held.bytes)
      const copy = new Uint8Array(held.bytes)
      objectUrl = URL.createObjectURL(new Blob([copy], { type }))
      if (!gone) setUrl(objectUrl)
    }).catch(() => {
      if (!gone) setUrl(undefined)
    })
    return () => {
      gone = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [scope, images, address])
  return url
}

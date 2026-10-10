// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A drawing, as it is read: its picture, or the words for one that has not
 * been drawn. Nothing here edits. The picture is an image, so nothing inside
 * it runs.
 */
import { useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { DesignDiagram } from '../model'
import type { ImageRepository } from '../ports/ImageRepository'
import type { Translate } from '../i18n'
import { useContentPicture } from '../documentation/ui/useContentPicture'

export function DrawingView({ diagram, scope, images, s }: {
  diagram: DesignDiagram
  /** The scope the picture's bytes are kept for. Absent: there is nowhere to ask. */
  scope: string | undefined
  images: Pick<ImageRepository, 'bytesAt'> | undefined
  s: Translate
}) {
  const address = diagram.drawing?.picture
  const load = useCallback(
    (asked: string) => (scope && images ? images.bytesAt(scope, asked) : Promise.resolve(undefined)),
    [scope, images],
  )
  const shown = useContentPicture(scope && images && address ? load : undefined, address)
  const url = shown && shown !== 'absent' ? shown.url : undefined
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


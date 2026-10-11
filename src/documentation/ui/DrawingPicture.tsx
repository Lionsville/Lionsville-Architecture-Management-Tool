// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A drawing's picture, and one transparent button per shape that points at an
 * element — the one way a picture is laid out, for a drawing's own view and
 * for a document that shows it.
 *
 * The picture is an image, so nothing inside it runs. Its frame in model
 * coordinates is {@link pictureFrame}: draw.io's export is cropped to the
 * shapes, so the origin is where they begin and the size is the export's
 * viewBox. The box is sized to the picture's own proportions and the image
 * fills it exactly, so a fraction of the frame is that fraction of the box
 * however the box is scaled.
 *
 * **The app's theme, not the system's.** draw.io's export draws in adaptive
 * colours (`light-dark()`, `color-scheme: light dark`), and an SVG shown as an
 * image resolves them by the image element's own `color-scheme`. That is set
 * from the MUI theme's mode — the one value the app resolves from its setting
 * and, for *system*, the media query — so the picture follows the app.
 */
import Box from '@mui/material/Box'
import { useTheme } from '@mui/material/styles'
import { areaOnPicture, pictureFrame } from '../../model/drawing'
import type { PictureFrame } from '../../model/drawing'
import type { DrawingLink } from '../../model/types'

export function DrawingPicture({ url, picture, xml, links, alt, label, onOpen, testIds }: {
  url: string
  /** The export's own box, read off the SVG; absent where it names none. */
  picture: PictureFrame | undefined
  xml: string
  links: readonly DrawingLink[]
  alt: string
  /** What a button over a shape says: its element, opened. */
  label: (elementId: string) => string
  onOpen?: (elementId: string) => void
  testIds: { frame: string; picture: string; area: (link: DrawingLink) => string }
}) {
  const mode = useTheme().palette.mode
  const frame = pictureFrame(xml, picture)
  return (
    <Box
      component="span"
      data-testid={testIds.frame}
      sx={{
        display: 'block',
        position: 'relative',
        width: '100%',
        maxWidth: frame ? `${frame.width}px` : '100%',
        ...(frame ? { aspectRatio: `${frame.width} / ${frame.height}` } : {}),
      }}
    >
      <Box
        component="img"
        src={url}
        alt={alt}
        data-testid={testIds.picture}
        style={{ colorScheme: mode }}
        sx={{
          display: 'block',
          width: '100%',
          height: frame ? '100%' : 'auto',
          ...(frame ? { position: 'absolute', inset: 0, objectFit: 'fill' } : {}),
        }}
      />
      {frame && links.map((link) => {
        const place = areaOnPicture(link.area, frame)
        if (!place) return null
        return (
          <Box
            key={link.shapeId}
            component="button"
            type="button"
            data-testid={testIds.area(link)}
            data-element={link.elementId}
            aria-label={label(link.elementId)}
            onClick={() => onOpen?.(link.elementId)}
            style={{
              position: 'absolute',
              left: `${place.left * 100}%`,
              top: `${place.top * 100}%`,
              width: `${place.width * 100}%`,
              height: `${place.height * 100}%`,
              padding: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
            }}
          />
        )
      })}
    </Box>
  )
}

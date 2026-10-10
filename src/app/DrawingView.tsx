// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A drawing, as it is read, and the editor *Edit* opens.
 *
 * Reading is the picture, or the words for one that has not been drawn. The
 * picture is an image, so nothing inside it runs. Over it lies one
 * transparent area per shape that points at an element; choosing the area
 * opens that element through the destination `app.open` takes. The editor is
 * a frame, and only when this source has an origin for one; otherwise Edit
 * says it is not available, and the picture is what there is.
 */
import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import type { Destination } from '../agent/screen'
import type { ContentAddress } from '../model/imageName'
import { imageName, mediaTypeOfBytes } from '../model/imageName'
import type { DesignDiagram, DrawingContent, DrawingLink } from '../model'
import { areaOnPicture, modelFrame, svgFrame, type PictureFrame } from '../model/drawing'
import type { ImageRepository } from '../ports/ImageRepository'
import type { Language, Translate } from '../i18n'
import type { Notify } from './useToasts'
import { DrawingEditor } from './DrawingEditor'
import type { DrawingKeeper } from './DrawingEditor'
import type { PaletteElement } from './drawingProtocol'

export function DrawingView({ diagram, scope, images, elements, origin, language, dispatch, notify, onOpen, s }: {
  diagram: DesignDiagram
  /** The scope the picture's bytes are kept for. Absent: there is nowhere to ask. */
  scope: string | undefined
  images: (Pick<ImageRepository, 'bytesAt'> & Partial<Pick<ImageRepository, 'put'>>) | undefined
  /** The scope's elements, as the editor's palette. */
  elements?: readonly PaletteElement[]
  /** Where the editor is served (`ProviderParts.drawingOrigin`). Absent: Edit says it is not. */
  origin?: () => string | undefined
  language?: Language
  dispatch?: (command: { type: 'diagram.update'; id: string; patch: { drawing: DrawingContent } }) => unknown
  notify?: Notify
  /**
   * Open what an area points at. The destination is the one `app.open` takes;
   * the scope that is open is the caller's to add.
   */
  onOpen?: (to: Destination) => void
  s: Translate
}) {
  const address = diagram.drawing?.picture
  const picture = useDrawingPicture(scope, images, address)
  const url = picture.url
  const editor = drawingOriginOf(origin)
  const [editing, setEditing] = useState(false)
  const keeper = keeperFor(scope, images, diagram, dispatch)
  return (
    <Box
      data-testid="drawing-view"
      sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}
    >
      {editing && editor && keeper && notify ? (
        <DrawingEditor
          origin={editor}
          language={language ?? 'en'}
          xml={diagram.drawing?.xml}
          elements={elements ?? []}
          paletteTitle={s('shell.drawingElements')}
          keeper={keeper}
          notify={notify}
          s={s}
        />
      ) : (
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, p: 3 }}>
          {editor && keeper ? (
            <Button data-testid="drawing-edit" onClick={() => setEditing(true)}>{s('shell.drawingEdit')}</Button>
          ) : (
            <>
              <Button data-testid="drawing-edit" disabled>{s('shell.drawingEdit')}</Button>
              <Typography data-testid="drawing-editor-unavailable" sx={{ color: 'text.secondary' }}>
                {s('shell.drawingEditorUnavailable')}
              </Typography>
            </>
          )}
          {url ? (
            <DrawingPicture
              url={url}
              name={diagram.name}
              links={diagram.drawing?.links ?? []}
              frame={picture.frame ?? modelFrame(diagram.drawing?.xml ?? '')}
              elements={elements ?? []}
              onOpen={onOpen}
              s={s}
            />
          ) : (
            <Typography data-testid="drawing-not-drawn" sx={{ color: 'text.secondary' }}>
              {s('shell.drawingNotDrawn')}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  )
}

/**
 * The picture, and one transparent area per link.
 *
 * The frame is the picture's own viewBox where the export named one, and the
 * model's page otherwise. Each area is model coordinates, laid as a fraction
 * of that frame, so it scales with the image. The box is the image: the areas
 * share its cell.
 */
function DrawingPicture({ url, name, links, frame, elements, onOpen, s }: {
  url: string
  name: string
  links: readonly DrawingLink[]
  frame: PictureFrame
  elements: readonly PaletteElement[]
  onOpen?: (to: Destination) => void
  s: Translate
}) {
  return (
    <Box
      data-testid="drawing-picture-frame"
      sx={{
        display: 'grid',
        maxWidth: '100%',
        maxHeight: '100%',
        minHeight: 0,
        minWidth: 0,
      }}
    >
      <Box
        component="img"
        src={url}
        alt={name}
        data-testid="drawing-picture"
        sx={{ gridArea: '1 / 1', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', justifySelf: 'center', alignSelf: 'center' }}
      />
      <Box sx={{ gridArea: '1 / 1', position: 'relative', pointerEvents: 'none' }}>
        {links.map((link) => {
          const place = areaOnPicture(link.area, frame)
          if (!place) return null
          const called = elements.find((element) => element.id === link.elementId)?.name || link.elementId
          return (
            <Box
              key={link.shapeId}
              component="button"
              type="button"
              data-testid={`drawing-area-${link.shapeId}`}
              aria-label={s('shell.drawingOpenElement', { name: called })}
              onClick={() => onOpen?.({ page: 'element', id: link.elementId })}
              style={{
                position: 'absolute',
                left: `${place.left * 100}%`,
                top: `${place.top * 100}%`,
                width: `${place.width * 100}%`,
                height: `${place.height * 100}%`,
              }}
              sx={{ padding: 0, border: 0, background: 'transparent', cursor: 'pointer', pointerEvents: 'auto' }}
            />
          )
        })}
      </Box>
    </Box>
  )
}

/** The origin a source gave, or nothing when it gave none or could not say. */
function drawingOriginOf(origin: (() => string | undefined) | undefined): string | undefined {
  try {
    const said = origin?.()
    return said && said.length > 0 ? said : undefined
  } catch {
    return undefined
  }
}

/**
 * The save: the picture's bytes, then one `diagram.update`.
 *
 * The bytes are kept by their content address and not added to the library —
 * a drawing's picture has no library name of its own. The name is only how
 * the repository knows the bytes are SVG.
 */
function keeperFor(
  scope: string | undefined,
  images: Partial<Pick<ImageRepository, 'put'>> | undefined,
  diagram: DesignDiagram,
  dispatch: ((command: { type: 'diagram.update'; id: string; patch: { drawing: DrawingContent } }) => unknown) | undefined,
): DrawingKeeper | undefined {
  if (!scope || !images?.put || !dispatch) return undefined
  const put = images.put
  return {
    put: async (bytes) => {
      const answer = await put(scope, imageName('drawing.svg'), bytes)
      if ('refused' in answer) return { refused: answer.refused }
      return { contentAddress: answer.contentAddress }
    },
    update: async (drawing) => {
      const landed = dispatch({ type: 'diagram.update', id: diagram.id, patch: { drawing } })
      // A refusal is said by the session, the way every other command's is.
      // What comes back here is only whether it landed, so a channel's own
      // key — the overlap — is not this answer. The model changing afterwards
      // is, and the editor merges that.
      return landed === undefined ? { refused: 'command.gone' } : { ok: true }
    },
    xml: () => diagram.drawing?.xml,
  }
}

/**
 * The picture's bytes, as an address a browser can draw, or nothing when the
 * drawing has no picture or the bytes are not there.
 */
function useDrawingPicture(
  scope: string | undefined,
  images: Pick<ImageRepository, 'bytesAt'> | undefined,
  address: ContentAddress | undefined,
): { url: string | undefined; frame: PictureFrame | undefined } {
  const [picture, setPicture] = useState<{ url?: string; frame?: PictureFrame }>({})
  useEffect(() => {
    if (!scope || !images || !address) {
      setPicture({})
      return undefined
    }
    let gone = false
    let objectUrl: string | undefined
    void images.bytesAt(scope, address).then((held) => {
      if (gone || !held) return
      const type = held.mediaType && held.mediaType !== 'application/octet-stream' ? held.mediaType : mediaTypeOfBytes(held.bytes)
      const copy = new Uint8Array(held.bytes)
      objectUrl = URL.createObjectURL(new Blob([copy], { type }))
      const frame = svgFrame(new TextDecoder().decode(copy))
      if (!gone) setPicture({ url: objectUrl, ...(frame ? { frame } : {}) })
    }).catch(() => {
      if (!gone) setPicture({})
    })
    return () => {
      gone = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [scope, images, address])
  return { url: picture.url, frame: picture.frame }
}

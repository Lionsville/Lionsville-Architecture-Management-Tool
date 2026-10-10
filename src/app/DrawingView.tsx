// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A drawing, as it is read, and the editor *Edit* opens.
 *
 * Reading is the picture, or the words for one that has not been drawn. The
 * picture is an image, so nothing inside it runs. The editor is a frame, and
 * only when this source has an origin for one; otherwise Edit says it is not
 * available, and the picture is what there is.
 */
import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import type { ContentAddress } from '../model/imageName'
import { imageName, mediaTypeOfBytes } from '../model/imageName'
import type { DesignDiagram, DrawingContent } from '../model'
import type { ImageRepository } from '../ports/ImageRepository'
import type { Language, Translate } from '../i18n'
import type { Notify } from './useToasts'
import { DrawingEditor } from './DrawingEditor'
import type { DrawingKeeper } from './DrawingEditor'
import type { PaletteElement } from './drawingProtocol'

export function DrawingView({ diagram, scope, images, elements, origin, language, dispatch, notify, s }: {
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
  s: Translate
}) {
  const address = diagram.drawing?.picture
  const url = useDrawingPicture(scope, images, address)
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
      )}
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

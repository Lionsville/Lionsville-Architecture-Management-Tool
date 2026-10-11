// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A drawing, as it is read, and the editor *Edit* opens.
 *
 * Reading is the picture, or the words for one that has not been drawn — laid
 * out by `DrawingPicture`, the same as a document showing it, with one
 * transparent area per shape that points at an element; choosing the area
 * opens that element through the destination `app.open` takes. The editor is
 * a frame, and only when this source has an origin for one; otherwise Edit
 * says it is not available, and the picture is what there is. A read-only
 * view offers no Edit at all.
 *
 * One drawing per mount: the workspace keys this by the drawing's id, so
 * switching tabs while the editor is open never saves one drawing into
 * another.
 */
import { useCallback, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import type { Destination } from '../agent/screen'
import { imageName } from '../model/imageName'
import type { DesignDiagram, DrawingContent } from '../model'
import type { ImageRepository } from '../ports/ImageRepository'
import type { Language, Translate } from '../i18n'
import { DrawingPicture } from '../documentation/ui/DrawingPicture'
import { useContentPicture } from '../documentation/ui/useContentPicture'
import type { Notify } from './useToasts'
import { DrawingEditor } from './DrawingEditor'
import type { DrawingKeeper } from './DrawingEditor'
import type { PaletteElement } from './drawingProtocol'

type Dispatch = (command: { type: 'diagram.update'; id: string; patch: { drawing: DrawingContent } }) => unknown

export function DrawingView({ diagram, scope, images, elements, origin, language, readOnly, dispatch, notify, onOpen, s }: {
  diagram: DesignDiagram
  /** The scope the picture's bytes are kept for. Absent: there is nowhere to ask. */
  scope: string | undefined
  images: (Pick<ImageRepository, 'bytesAt'> & Partial<Pick<ImageRepository, 'put'>>) | undefined
  /** The scope's elements, as the editor's palette. */
  elements?: readonly PaletteElement[]
  /** Where the editor is served (`ProviderParts.drawingOrigin`). Absent: Edit says it is not. */
  origin?: () => string | undefined
  language?: Language
  /** The view may not be changed: no Edit, and nothing put. */
  readOnly?: boolean
  dispatch?: Dispatch
  notify?: Notify
  /**
   * Open what an area points at. The destination is the one `app.open` takes;
   * the scope that is open is the caller's to add.
   */
  onOpen?: (to: Destination) => void
  s: Translate
}) {
  const mode = useTheme().palette.mode
  const editor = drawingOriginOf(origin)
  const [editing, setEditing] = useState(false)
  const keeper = readOnly ? undefined : keeperFor(scope, images, diagram, dispatch)
  return (
    <Box
      data-testid="drawing-view"
      sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}
    >
      {editing && editor && keeper && notify ? (
        <DrawingEditor
          origin={editor}
          language={language ?? 'en'}
          mode={mode}
          xml={diagram.drawing?.xml}
          elements={elements ?? []}
          paletteTitle={s('shell.drawingElements')}
          keeper={keeper}
          notify={notify}
          onClose={() => setEditing(false)}
          s={s}
        />
      ) : (
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, p: 3 }}>
          {readOnly ? null : <EditButton available={Boolean(editor && keeper)} onEdit={() => setEditing(true)} s={s} />}
          <Shown diagram={diagram} scope={scope} images={images} elements={elements ?? []} onOpen={onOpen} s={s} />
        </Box>
      )}
    </Box>
  )
}

function EditButton({ available, onEdit, s }: { available: boolean; onEdit: () => void; s: Translate }) {
  if (available) return <Button data-testid="drawing-edit" onClick={onEdit}>{s('shell.drawingEdit')}</Button>
  return (
    <>
      <Button data-testid="drawing-edit" disabled>{s('shell.drawingEdit')}</Button>
      <Typography data-testid="drawing-editor-unavailable" sx={{ color: 'text.secondary' }}>
        {s('shell.drawingEditorUnavailable')}
      </Typography>
    </>
  )
}

/** The picture with its areas, or the words for a drawing that has none. */
function Shown({ diagram, scope, images, elements, onOpen, s }: {
  diagram: DesignDiagram
  scope: string | undefined
  images: Pick<ImageRepository, 'bytesAt'> | undefined
  elements: readonly PaletteElement[]
  onOpen?: (to: Destination) => void
  s: Translate
}) {
  const bytesAt = useCallback(
    (address: string) => (scope && images ? images.bytesAt(scope, address) : Promise.resolve(undefined)),
    [scope, images],
  )
  const address = diagram.drawing?.picture
  const shown = useContentPicture(scope && images ? bytesAt : undefined, address)
  if (!shown || shown === 'absent') {
    return (
      <Typography data-testid="drawing-not-drawn" sx={{ color: 'text.secondary' }}>
        {s('shell.drawingNotDrawn')}
      </Typography>
    )
  }
  return (
    <DrawingPicture
      url={shown.url}
      picture={shown.frame}
      xml={diagram.drawing?.xml ?? ''}
      links={diagram.drawing?.links ?? []}
      alt={diagram.name}
      label={(elementId) => s('shell.drawingOpenElement', { name: elements.find((element) => element.id === elementId)?.name || elementId })}
      onOpen={(elementId) => onOpen?.({ page: 'element', id: elementId })}
      testIds={{ frame: 'drawing-picture-frame', picture: 'drawing-picture', area: (link) => `drawing-area-${link.shapeId}` }}
    />
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
  dispatch: Dispatch | undefined,
): DrawingKeeper | undefined {
  if (!scope || !images?.put || !dispatch) return undefined
  const held = images as Pick<ImageRepository, 'put'>
  return {
    put: async (bytes) => {
      // Called on the repository, never taken off it: an implementation's
      // `put` may be a method that reads its own fields.
      const answer = await held.put(scope, imageName('drawing.svg'), bytes)
      if ('refused' in answer) return { refused: answer.refused }
      return { contentAddress: answer.contentAddress }
    },
    update: (drawing) => {
      const landed = dispatch({ type: 'diagram.update', id: diagram.id, patch: { drawing } })
      // A refusal is said by the session, the way every other command's is.
      // A channel's own refusal arrives later, as the model going back to the
      // newer drawing, and the editor merges that.
      return Promise.resolve(landed === undefined ? { refused: 'command.gone' } : { ok: true as const })
    },
    xml: () => diagram.drawing?.xml,
  }
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The drawing editor: one frame, and the JSON protocol across it.
 *
 * Reading a drawing is its picture. This is what *Edit* opens, and only then.
 * A save asks the frame for `xmlsvg`, keeps those bytes by their content
 * address, and writes one `diagram.update` — the XML, the picture and the
 * links, the one key a drawing already has. A channel that refuses that write
 * as an overlap is answered by merging the newer drawing, and saving again
 * is the person's.
 */
import { useEffect, useRef } from 'react'
import Box from '@mui/material/Box'
import type { StringKey, Translate } from '../i18n'
import type { Language } from '../i18n/languages'
import type { DrawingContent } from '../model'
import type { Notify } from './useToasts'
import {
  drawingFrameSrc, frameEvent, frameTarget, isDrawingOverlap, newerDrawing, replyTo, savedDrawing, savedXml, svgBytes,
  type PaletteElement,
} from './drawingProtocol'

/** What a save needs from the scope, and nothing else. */
export type DrawingKeeper = {
  /** Keep the picture's bytes and answer their content address, or why not, as a key. */
  put(bytes: Uint8Array): Promise<{ contentAddress: string } | { refused: StringKey }>
  /**
   * One `diagram.update` of the drawing. A refusal is the key: the reducer's,
   * already said, or a channel's when the write overlaps one already sequenced.
   */
  update(drawing: DrawingContent): Promise<{ ok: true } | { refused: string }>
  /** The drawing's XML as the model holds it now, after a refusal has landed. */
  xml(): string | undefined
}

export function DrawingEditor({ origin, language, xml, elements, paletteTitle, keeper, notify, s }: {
  origin: string
  language: Language
  /** The drawing as it was when Edit was opened. */
  xml: string | undefined
  elements: readonly PaletteElement[]
  paletteTitle: string
  keeper: DrawingKeeper
  notify: Notify
  s: Translate
}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const held = useRef(keeper)
  held.current = keeper
  const opened = useRef({ xml, elements, paletteTitle })
  opened.current = { xml, elements, paletteTitle }
  const written = useRef<string | undefined>(undefined)
  const watching = useRef(false)
  const fromSave = useRef<string | undefined>(undefined)

  const post = (message: { action: string }) => {
    const target = frameTarget(origin)
    frame.current?.contentWindow?.postMessage(JSON.stringify(message), target)
  }

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return
      const heard = frameEvent(event.data)
      if (!heard?.event) return
      if (heard.event === 'save' && typeof heard.xml === 'string') fromSave.current = heard.xml
      if (heard.event === 'export') {
        void commitExport(heard, held.current, fromSave.current, written, watching, post, notify, s)
        return
      }
      const reply = replyTo(heard, opened.current)
      if (reply) post(reply)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [origin, language, notify, s])

  // A refusal that lands after the save returned: the model now holds the
  // newer drawing, and the frame is asked to merge it.
  const live = keeper.xml()
  useEffect(() => {
    if (!watching.current || written.current === undefined) return
    const newer = newerDrawing(live, written.current)
    if (!newer) return
    written.current = newer
    post(mergeOf(newer))
  }, [live])

  return (
    <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex' }}>
      <Box
        component="iframe"
        ref={frame}
        src={drawingFrameSrc(origin, language)}
        title={paletteTitle}
        data-testid="drawing-frame"
        sx={{ flex: 1, width: '100%', height: '100%', border: 0 }}
      />
    </Box>
  )
}

function mergeOf(xml: string): { action: 'merge'; xml: string } {
  return { action: 'merge', xml }
}

async function commitExport(
  heard: { xml?: unknown; data?: unknown },
  keeper: DrawingKeeper,
  saved: string | undefined,
  written: { current: string | undefined },
  watching: { current: boolean },
  post: (message: { action: string }) => void,
  notify: Notify,
  s: Translate,
): Promise<void> {
  const xml = savedXml(heard.xml, saved)
  const bytes = typeof heard.data === 'string' ? svgBytes(heard.data) : undefined
  if (!xml || !bytes) {
    notify(s('shell.drawingSaveFailed'), 'error')
    return
  }
  const put = await keeper.put(bytes)
  if ('refused' in put) {
    notify(s(put.refused), 'error')
    return
  }
  const drawing = savedDrawing(xml, put.contentAddress)
  written.current = drawing.xml
  watching.current = true
  const answer = await keeper.update(drawing)
  if ('ok' in answer) return
  if (!isDrawingOverlap(answer.refused)) return
  const newer = newerDrawing(keeper.xml(), drawing.xml)
  if (!newer) return
  written.current = newer
  post(mergeOf(newer))
}

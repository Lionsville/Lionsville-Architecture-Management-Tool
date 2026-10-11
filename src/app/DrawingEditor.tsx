// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The drawing editor: one frame, and the JSON protocol across it.
 *
 * Reading a drawing is its picture. This is what *Edit* opens, and only then.
 * A save asks the frame for `xmlsvg`, keeps those bytes by their content
 * address, and writes one `diagram.update` — the XML, the picture and the
 * links, the one key a drawing already has.
 *
 * **Only the frame is heard.** A message counts when it comes from the frame's
 * own window and from the drawing origin. The frame is sandboxed to scripts on
 * its own origin.
 *
 * **The model is watched from the moment the editor opens.** When the drawing
 * the model holds changes to one this editor did not write — somebody else
 * saved it, before or after this editor's own save, or a channel refused this
 * save as an overlap and the model went back to theirs — the newer drawing is
 * handed to draw.io's own merge, and saving again is the person's. That is the
 * one way a refusal is answered: what reaches the model is what is merged.
 *
 * **Saves in order.** Two saves in a row export twice, and the bytes of each
 * are put before its step is written; a save whose export is overtaken by a
 * later one before its step is written is dropped, so the older drawing can
 * never land after the newer.
 *
 * **The app's look.** The frame opens in the app's resolved theme. When the
 * theme changes while it is open, the drawing as it is in the editor is asked
 * for first and loaded again in the new look, and the editor is told it still
 * holds changes when it does.
 */
import { useEffect, useRef } from 'react'
import Box from '@mui/material/Box'
import type { StringKey, Translate } from '../i18n'
import type { Language } from '../i18n/languages'
import type { DrawingContent } from '../model'
import type { Notify } from './useToasts'
import {
  currentXmlMessage, DRAWING_FRAME_SANDBOX, drawingFrameSrc, frameEvent, frameTarget, loadMessage, mergeMessage,
  newerDrawing, replyTo, savedDrawing, savedStatus, savedXml, svgBytes, unsavedStatus,
  type DrawingMode, type FrameEvent, type PaletteElement,
} from './drawingProtocol'

/** What a save needs from the scope, and nothing else. */
export type DrawingKeeper = {
  /** Keep the picture's bytes and answer their content address, or why not, as a key. */
  put(bytes: Uint8Array): Promise<{ contentAddress: string } | { refused: StringKey }>
  /**
   * One `diagram.update` of the drawing. A refusal the reducer makes is said
   * by the session, as every command's is; what comes back is whether it
   * landed.
   */
  update(drawing: DrawingContent): Promise<{ ok: true } | { refused: string }>
  /** The drawing's XML as the model holds it now. */
  xml(): string | undefined
}

type Props = {
  origin: string
  language: Language
  /** The app's look, as its theme resolves it. */
  mode: DrawingMode
  /** The drawing as it was when Edit was opened. */
  xml: string | undefined
  elements: readonly PaletteElement[]
  paletteTitle: string
  keeper: DrawingKeeper
  notify: Notify
  /** The person left the editor: its Exit, or a save and exit that landed. */
  onClose?: () => void
  s: Translate
}

export function DrawingEditor(props: Props) {
  const { origin, language, mode } = props
  const frame = useDrawingFrame(props)
  // The look the frame was opened in; a later change goes over the protocol.
  const opened = useRef(mode)
  return (
    <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex' }}>
      <Box
        component="iframe"
        ref={frame}
        src={drawingFrameSrc(origin, language, opened.current)}
        sandbox={DRAWING_FRAME_SANDBOX}
        title={props.paletteTitle}
        data-testid="drawing-frame"
        data-mode={mode}
        sx={{ flex: 1, width: '100%', height: '100%', border: 0 }}
      />
    </Box>
  )
}

/** What the frame's conversation keeps between messages. */
type Held = {
  /** The XML this editor last loaded or wrote: what the model holding something else means somebody else wrote. */
  written: string | undefined
  /** The XML each save event named, oldest first, each waiting for its export. */
  saves: { xml: string; exit: boolean }[]
  /** Exports begun; one overtaken before its step is written is dropped. */
  exports: number
  /** The look a reload was asked for, waiting for the drawing as it is in the editor. */
  reloading?: DrawingMode
}

/** The frame's conversation: who is heard, what each event is answered with, and the model watched. */
function useDrawingFrame(props: Props) {
  const frame = useRef<HTMLIFrameElement>(null)
  const latest = useRef(props)
  latest.current = props
  const held = useRef<Held>({ written: props.xml, saves: [], exports: 0 })
  const target = frameTarget(props.origin)

  const post = (message: { action: string }) => {
    frame.current?.contentWindow?.postMessage(JSON.stringify(message), target)
  }

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== target) return
      const heard = frameEvent(event.data)
      if (heard?.event) answer(heard, held.current, latest.current, post)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [target])

  // The drawing the model holds, changed to one this editor did not write.
  const live = props.keeper.xml()
  useEffect(() => {
    const written = held.current.written
    if (written === undefined && live === undefined) return
    const newer = newerDrawing(live, written ?? '')
    if (!newer || live === undefined) return
    held.current.written = newer
    post(mergeMessage(newer))
  }, [live])

  // The app's look changed while the editor is open: ask for the drawing as it is, then load it in the new look.
  const lastMode = useRef(props.mode)
  useEffect(() => {
    if (lastMode.current === props.mode) return
    lastMode.current = props.mode
    held.current.reloading = props.mode
    post(currentXmlMessage())
  }, [props.mode])

  return frame
}

/** One event from the frame, answered. */
function answer(heard: FrameEvent, held: Held, props: Props, post: (message: { action: string }) => void): void {
  if (heard.event === 'exit') {
    props.onClose?.()
    return
  }
  if (heard.event === 'save' && typeof heard.xml === 'string') held.saves.push({ xml: heard.xml, exit: heard.exit === true })
  if (heard.event === 'export' && heard.format === 'xml') {
    reload(heard, held, props, post)
    return
  }
  if (heard.event === 'export') {
    const save = held.saves.shift()
    held.exports += 1
    void commitExport(heard, save, held, held.exports, props, post).catch(() => {
      props.notify(props.s('shell.drawingSaveFailed'), 'error')
    })
    return
  }
  const reply = replyTo(heard, { xml: props.xml, elements: props.elements, paletteTitle: props.paletteTitle, mode: props.mode })
  if (reply) {
    if (reply.action === 'load') held.written = props.xml
    post(reply)
  }
}

/** The drawing as it is in the editor, loaded again in the look asked for; still unsaved where it was. */
function reload(heard: FrameEvent, held: Held, props: Props, post: (message: { action: string }) => void): void {
  const mode = held.reloading
  held.reloading = undefined
  if (!mode || typeof heard.xml !== 'string' || heard.xml.length === 0) return
  post(loadMessage(heard.xml, mode))
  if (heard.xml !== held.written) post(unsavedStatus())
}

async function commitExport(
  heard: FrameEvent,
  save: { xml: string; exit: boolean } | undefined,
  held: Held,
  mine: number,
  props: Props,
  post: (message: { action: string }) => void,
): Promise<void> {
  const { keeper, notify, s } = props
  const xml = savedXml(heard.xml, save?.xml)
  const bytes = typeof heard.data === 'string' ? svgBytes(heard.data) : undefined
  if (!xml || !bytes) {
    notify(s('shell.drawingSaveFailed'), 'error')
    return
  }
  const put = await keeper.put(bytes)
  // A later save's export has begun: this one is older, and is not written.
  if (mine !== held.exports) return
  if ('refused' in put) {
    notify(s(put.refused), 'error')
    return
  }
  const drawing = savedDrawing(xml, put.contentAddress)
  held.written = drawing.xml
  const landed = await keeper.update(drawing)
  if (!('ok' in landed)) return
  post(savedStatus())
  if (save?.exit) props.onClose?.()
}

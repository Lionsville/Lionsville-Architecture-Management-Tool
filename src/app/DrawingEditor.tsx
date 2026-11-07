// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The drawing editor: one frame, and the JSON protocol across it.
 *
 * Reading a drawing is its picture. This is what *Edit drawing* opens, and only
 * then. The frame is draw.io and everything round it is the app's: the name,
 * whether the work is saved (said by the frame's status word, as every other
 * state is), Save and Done, what happens on leaving, and what happens when the
 * frame never answers. A separate service on a separate host will fail, and the
 * frame cannot offer a way back from inside itself if it did not arrive.
 *
 * **Work is never lost without a question.** While the frame holds changes no
 * save has kept, a guard stands in the frame's store: every way out (a tab, a
 * page, the tree, Back, an agent) asks first, and the window asks on closing.
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
 * handed to draw.io's own merge, said once in the bar, and saving again is the
 * person's. That is the one way a refusal is answered: what reaches the model is
 * what is merged.
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
 *
 * **A file the person exports.** The frame may not download, so what its menu
 * exports is posted here and saved through the same gateway as every other
 * file. It is told from this side's own exports by {@link exportRoute}, and it
 * touches neither the drawing nor a save waiting for its export.
 */
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { Destination } from '../agent/screen'
import type { StringKey, Translate } from '../i18n'
import type { Language } from '../i18n/languages'
import type { DrawingContent } from '../model'
import { reasonOf } from '../platform/errors'
import type { Diagnostics } from '../ports/Diagnostics'
import type { DocumentGateway } from '../ports/DocumentGateway'
import { Button } from '../widgets/kit/Button'
import { PageState } from '../widgets/kit/PageState'
import { FrameStoreContext } from './frame/frameStore'
import type { OwnWork } from './frame/frameStore'
import type { Notify } from './useToasts'
import { DrawingLeaveDialog, ShapeStrip } from './DrawingEditorParts'
import {
  currentXmlMessage, DRAWING_FRAME_SANDBOX, drawingFrameSrc, exportedFile, exportMessage, exportRoute, frameEvent, frameTarget, loadMessage, mergeMessage,
  newerDrawing, pointMessage, replyTo, savedDrawing, savedStatus, savedXml, svgBytes, unsavedStatus,
  type DrawingLook, type DrawingMode, type FrameEvent, type PaletteElement,
} from './drawingProtocol'
import './DrawingView.css'

/** How long a frame may stay silent before the app says so: it is another service, on another host. */
export const FRAME_SILENCE_MS = 15_000

/** How long a save may say *Saving*. A status that cannot end is not a status. */
export const SAVE_LIMIT_MS = 30_000

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
  /** The app's words and tokens for the palette and the frame. */
  look?: DrawingLook
  keeper: DrawingKeeper
  /** The drawing's name: what the bar says, and what a file exported from the editor is called. */
  name: string
  /** Where a file exported from the editor goes. */
  documents: Pick<DocumentGateway, 'save'>
  diagnostics: Pick<Diagnostics, 'report'>
  notify: Notify
  /** The person left the editor: Done, or a save and leave that landed. */
  onClose?: () => void
  /** Open an element's page from the strip under a selected shape. */
  onOpenElement?: (elementId: string) => void
  /** Where a move is going, in words: *You are going to Organisation chart*. */
  whereTo?: (to: Destination) => string | undefined
  /** Moving to this is not leaving: this drawing's own editor. */
  staysHere?: (to: Destination) => boolean
  kindWord?: (kind: string | undefined) => string
  s: Translate
}

type Stage = 'opening' | 'silent' | 'ready'

/** A question about leaving: where to, and how to go once it is answered. */
type Leaving = { to?: string; go: () => void }

export function DrawingEditor(props: Props) {
  const { origin, language, mode, name, s } = props
  const editor = useDrawingFrame(props)
  // The look the frame was opened in; a later change goes over the protocol.
  const opened = useRef(mode)
  const failed = editor.work.state === 'failed'
  return (
    <div className="drawing-editor">
      <div className="drawing-editor__bar" role="group" aria-label={s('drawing.editing', { name })} data-testid="drawing-editor-bar" data-guide="drawing.editorBar">
        <span className="drawing-editor__name">{s('drawing.editing', { name })}</span>
        {failed && <span className="drawing-editor__says" role="alert" data-testid="drawing-save-failed">{editor.refusal ?? s('drawing.saveFailed')}</span>}
        {editor.merged && <span className="drawing-editor__says" role="status" data-testid="drawing-merged">{s('drawing.merged')}</span>}
        <span className="drawing-editor__end">
          {editor.stage === 'ready' && (
            <Button variant={failed ? 'primary' : 'plain'} size="small" working={editor.work.state === 'saving'} onClick={() => { void editor.save() }} data-testid="drawing-save" data-guide="drawing.save">
              {s(failed ? 'drawing.saveAgain' : 'drawing.save')}
            </Button>
          )}
          <Button variant="primary" size="small" onClick={editor.done} data-testid="drawing-done" data-guide="drawing.done">{s('drawing.done')}</Button>
        </span>
      </div>
      {editor.stage === 'silent' ? (
        <div className="drawing-view__state" data-testid="drawing-editor-silent">
          <PageState
            state="offline" title={s('drawing.silentTitle')} where={s('drawing.silentWho')} note={s('drawing.silentAsk')}
            onRetry={editor.retry} wayOut={{ label: s('drawing.backToPicture'), onPress: () => props.onClose?.() }}
          />
        </div>
      ) : (
        <div className="drawing-editor__body">
          <iframe
            key={editor.attempt}
            ref={editor.frame}
            className="drawing-editor__frame"
            src={drawingFrameSrc(origin, language, opened.current)}
            sandbox={DRAWING_FRAME_SANDBOX}
            title={props.paletteTitle}
            data-testid="drawing-frame"
            data-mode={mode}
          />
          {editor.selected && (
            <ShapeStrip
              element={props.elements.find((element) => element.id === editor.selected?.element)} elementId={editor.selected.element} elements={props.elements}
              onOpen={props.onOpenElement} onPoint={editor.point} kindWord={props.kindWord} s={s}
            />
          )}
        </div>
      )}
      <DrawingLeaveDialog
        open={editor.leaving !== undefined} to={editor.leaving?.to} failed={failed} saving={editor.work.state === 'saving'}
        onLeave={editor.leaveUnsaved} onStay={editor.stay} onSave={() => { void editor.saveAndLeave() }} s={s}
      />
    </div>
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
  /** The bar's Save, waiting for the drawing as it is in the editor. */
  asked: boolean
}

/** What the conversation tells the screen. */
type Said = {
  ready(): void
  worked(): void
  saving(): void
  saved(): void
  failed(refusal?: string): void
  merged(): void
  selected(shape: string | undefined, element: string | undefined): void
}

/** The frame's conversation: who is heard, what each event is answered with, and the model watched. */
function useDrawingFrame(props: Props) {
  const frame = useRef<HTMLIFrameElement>(null)
  const latest = useRef(props)
  latest.current = props
  const held = useRef<Held>({ written: props.xml, saves: [], exports: 0, asked: false })
  const target = frameTarget(props.origin)
  const store = useContext(FrameStoreContext)

  const [stage, setStage] = useState<Stage>('opening')
  const [attempt, setAttempt] = useState(0)
  const [work, setWork] = useState<OwnWork>({ state: 'clean' })
  const [refusal, setRefusal] = useState<string | undefined>(undefined)
  const [merged, setMerged] = useState(false)
  const [selected, setSelected] = useState<{ shape: string; element?: string } | undefined>(undefined)
  const [leaving, setLeaving] = useState<Leaving | undefined>(undefined)
  /** Whoever waits for the save under way: a person leaving, once it lands. */
  const waiting = useRef<((landed: boolean) => void)[]>([])

  const post = (message: { action: string }) => {
    frame.current?.contentWindow?.postMessage(JSON.stringify(message), target)
  }
  const settle = (landed: boolean) => {
    const those = waiting.current
    waiting.current = []
    those.forEach((one) => one(landed))
  }
  const said = useRef<Said>(undefined as unknown as Said)
  said.current = {
    ready: () => setStage('ready'),
    worked: () => setWork((was) => (was.state === 'saving' ? was : { state: 'dirty' })),
    saving: () => setWork({ state: 'saving' }),
    saved: () => { setRefusal(undefined); setMerged(false); setWork({ state: 'saved', savedAt: new Date() }); settle(true) },
    failed: (why) => { setRefusal(why); setWork({ state: 'failed' }); settle(false) },
    merged: () => { setMerged(true); setWork({ state: 'dirty' }) },
    selected: (shape, element) => setSelected(shape === undefined ? undefined : { shape, ...(element ? { element } : {}) }),
  }

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== target) return
      const heard = frameEvent(event.data)
      if (heard?.event) answer(heard, held.current, latest.current, post, said.current)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [target])

  useEffect(() => {
    if (stage !== 'opening') return undefined
    const timer = window.setTimeout(() => setStage('silent'), FRAME_SILENCE_MS)
    return () => window.clearTimeout(timer)
  }, [stage, attempt])

  useEffect(() => {
    if (work.state !== 'saving') return undefined
    const timer = window.setTimeout(() => said.current.failed(), SAVE_LIMIT_MS)
    return () => window.clearTimeout(timer)
  }, [work])

  // The drawing the model holds, changed to one this editor did not write.
  const live = props.keeper.xml()
  useEffect(() => {
    const written = held.current.written
    if (written === undefined && live === undefined) return
    const newer = newerDrawing(live, written ?? '')
    if (!newer || live === undefined) return
    held.current.written = newer
    post(mergeMessage(newer))
    said.current.merged()
  }, [live])

  // The app's look changed while the editor is open: ask for the drawing as it is, then load it in the new look.
  const lastMode = useRef(props.mode)
  useEffect(() => {
    if (lastMode.current === props.mode) return
    lastMode.current = props.mode
    held.current.reloading = props.mode
    post(currentXmlMessage())
  }, [props.mode])

  const save = useCallback(() => new Promise<boolean>((resolve) => {
    waiting.current.push(resolve)
    if (held.current.asked) return
    held.current.asked = true
    said.current.saving()
    // The drawing as it is, then its picture: the same two the frame's own save hands over.
    post(currentXmlMessage())
  }), [target])

  const unsaved = work.state === 'dirty' || work.state === 'failed' || work.state === 'saving'
  const close = () => latest.current.onClose?.()

  // The status word says this, and the frame's undo gives way to the editor's own, for as long as the editor is up.
  useEffect(() => {
    store?.set({ work })
  }, [store, work])
  useEffect(() => () => store?.set({ work: undefined }), [store])

  // Standing in every way out, for as long as there is something to lose.
  useEffect(() => {
    if (!store || !unsaved) return undefined
    store.set({
      guard: (to, go) => {
        if (latest.current.staysHere?.(to)) return false
        setLeaving({ ...optional(latest.current.whereTo?.(to)), go })
        return true
      },
    })
    return () => store.set({ guard: undefined })
  }, [store, unsaved])
  useEffect(() => {
    if (!unsaved) return undefined
    const onLeaving = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener('beforeunload', onLeaving)
    return () => window.removeEventListener('beforeunload', onLeaving)
  }, [unsaved])

  /** Going, with nothing left to stand in the way of it. */
  const go = (leave: Leaving) => {
    setLeaving(undefined)
    store?.set({ guard: undefined })
    leave.go()
  }
  return {
    frame, stage, attempt, work, refusal, merged, selected, leaving, save,
    done: () => { if (unsaved && stage === 'ready') setLeaving({ go: close }); else close() },
    retry: () => { setStage('opening'); setAttempt((count) => count + 1) },
    stay: () => setLeaving(undefined),
    leaveUnsaved: () => { if (leaving) go(leaving) },
    saveAndLeave: async () => { if (await save() && leaving) go(leaving) },
    point: (element: PaletteElement | undefined) => { if (selected) post(pointMessage(selected.shape, element)) },
  }
}

function optional(to: string | undefined): { to?: string } {
  return to === undefined ? {} : { to }
}

/** One event from the frame, answered. */
function answer(heard: FrameEvent, held: Held, props: Props, post: (message: { action: string }) => void, said: Said): void {
  if (heard.event === 'exit') {
    props.onClose?.()
    return
  }
  if (heard.event === 'init') said.ready()
  if (heard.event === 'autosave') {
    if (heard.xml !== held.written) said.worked()
    return
  }
  if (heard.event === 'lvSelection') {
    said.selected(typeof heard.shape === 'string' ? heard.shape : undefined, typeof heard.element === 'string' ? heard.element : undefined)
    return
  }
  if (heard.event === 'save' && typeof heard.xml === 'string') {
    held.saves.push({ xml: heard.xml, exit: heard.exit === true })
    said.saving()
  }
  const route = heard.event === 'export' ? exportRoute(heard) : undefined
  if (route === 'reload') {
    if (held.asked && !held.reloading) {
      held.asked = false
      if (typeof heard.xml !== 'string' && typeof heard.data !== 'string') { said.failed(); return }
      held.saves.push({ xml: String(heard.xml ?? heard.data), exit: false })
      post(exportMessage())
      return
    }
    reload(heard, held, props, post)
    return
  }
  if (route === 'file') {
    handOver(heard, props)
    return
  }
  if (route === 'save') {
    const save = held.saves.shift()
    held.exports += 1
    void commitExport(heard, save, held, held.exports, props, post, said).catch(() => said.failed())
    return
  }
  const reply = replyTo(heard, { xml: props.xml, elements: props.elements, paletteTitle: props.paletteTitle, mode: props.mode, ...(props.look ? { look: props.look } : {}) })
  if (reply) {
    if (reply.action === 'load') held.written = props.xml
    post(reply)
  }
}

/**
 * A file the person exported, handed to them: said once it is saved, said as a
 * failure when it could not be, and not said at all when they closed the dialog.
 */
function handOver(heard: FrameEvent, props: Props): void {
  const { documents, diagnostics, notify, s } = props
  const file = exportedFile(heard, props.name)
  if (!file) {
    diagnostics.report({ level: 'error', where: 'drawingExport', message: 'shell.drawingExportFailed' })
    notify(s('shell.drawingExportFailed'), 'error')
    return
  }
  // Inside the chain: a gateway that throws rather than rejects is a failure like any other.
  Promise.resolve().then(() => documents.save(file)).then(
    (answer) => {
      if (answer !== 'cancelled') notify(s('shell.drawingExported', { name: file.name }), 'success')
    },
    (cause: unknown) => {
      diagnostics.report({ level: 'error', where: 'drawingExport', message: 'shell.saveFileFailed', cause })
      notify(s('shell.saveFileFailed', { message: reasonOf(cause) }), 'error')
    },
  )
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
  said: Said,
): Promise<void> {
  const { keeper, s } = props
  const xml = savedXml(heard.xml, save?.xml)
  const bytes = typeof heard.data === 'string' ? svgBytes(heard.data) : undefined
  if (!xml || !bytes) {
    said.failed()
    return
  }
  const put = await keeper.put(bytes)
  // A later save's export has begun: this one is older, and is not written.
  if (mine !== held.exports) return
  if ('refused' in put) {
    said.failed(s(put.refused))
    return
  }
  const drawing = savedDrawing(xml, put.contentAddress)
  held.written = drawing.xml
  const landed = await keeper.update(drawing)
  if (!('ok' in landed)) {
    said.failed()
    return
  }
  post(savedStatus())
  said.saved()
  if (save?.exit) props.onClose?.()
}

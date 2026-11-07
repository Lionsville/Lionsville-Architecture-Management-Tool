// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A drawing, as it is read, and the editor *Edit drawing* opens.
 *
 * A drawing is the one view the person draws and the model does not, so the bar
 * says so and says how far it reaches into the model. Reading is the picture, laid
 * out by `DrawingPicture`, the same as a document showing it, with one area per
 * shape that points at an element: pressing one opens that element in the panel
 * beside the picture, and the picture does not move. Every state that cannot show
 * a picture says why and what to do, told apart here because the words differ:
 * nothing drawn, drawn by an agent and not pictured yet, no editor where you are.
 *
 * The editor is a frame, only where this source has an origin for one, and a
 * read-only view offers no way to it.
 *
 * Whether the editor is open is the workspace's (`useDrawing`), so the address
 * says it and an agent can open it. One drawing per mount: the workspace keys this
 * by the drawing's id, so an editor can never save one drawing into another, and
 * no way out of it passes without the question the editor's guard asks.
 */
import { useCallback, useMemo, useState } from 'react'
import { useTheme } from '@mui/material/styles'
import type { Destination } from '../agent/screen'
import { imageName } from '../model/imageName'
import { drawnShapes, pageCount, pictureFrame } from '../model/drawing'
import type { DesignDiagram, DrawingContent } from '../model'
import type { Diagnostics } from '../ports/Diagnostics'
import type { DocumentGateway } from '../ports/DocumentGateway'
import type { ImageRepository } from '../ports/ImageRepository'
import type { Language, Translate } from '../i18n'
import { DrawingPicture } from '../documentation/ui/DrawingPicture'
import { useContentPicture } from '../documentation/ui/useContentPicture'
import { Button } from '../widgets/kit/Button'
import { CanvasDock } from '../widgets/kit/CanvasDock'
import { PageState } from '../widgets/kit/PageState'
import { ViewBar, ViewBarButton, ViewBarMenu } from '../widgets/kit/ViewBar'
import { steppedZoomTarget, useCanvasZoom } from '../widgets/kit/useCanvasZoom'
import { clampZoom, stepZoom, ZOOM_HOME } from '../widgets/kit/zoom'
import type { Notify } from './useToasts'
import { DrawingEditor } from './DrawingEditor'
import type { DrawingKeeper } from './DrawingEditor'
import { DrawingLinksPanel, ElementReader, linkFacts } from './DrawingPanels'
import type { LinkFact, ReadElement } from './DrawingPanels'
import { DRAWING_DARK_COLOUR, drawingSkin } from './drawingSkin'
import type { DrawingLook } from './drawingProtocol'
import { handOver } from './handOver'
import { pictureFile } from './drawingExport'
import type { PrintHost } from './drawingExport'
import './DrawingView.css'

type Dispatch = (command: { type: 'diagram.update'; id: string; patch: { drawing: DrawingContent } }) => unknown

export type DrawingViewProps = {
  diagram: DesignDiagram
  /** The scope the picture's bytes are kept for. Absent: there is nowhere to ask. */
  scope: string | undefined
  images: (Pick<ImageRepository, 'bytesAt'> & Partial<Pick<ImageRepository, 'put'>>) | undefined
  /** The scope's elements: the editor's palette, and what the links are read against. */
  elements?: readonly ReadElement[]
  /** The scope's views, for what a shown element is also on and where a move out is going. */
  diagrams?: readonly DesignDiagram[]
  /** Where the editor is served (`ProviderParts.drawingOrigin`). Absent: no editor where you are. */
  origin?: () => string | undefined
  language?: Language
  /** The view may not be changed: no Edit, and nothing put. */
  readOnly?: boolean
  dispatch?: Dispatch
  /** Where a file goes, from the bar's Export or the editor's, and where its failure is written. */
  documents?: Pick<DocumentGateway, 'save'>
  /** What the editor's Print ends in. */
  print?: PrintHost
  diagnostics?: Pick<Diagnostics, 'report'>
  notify?: Notify
  /**
   * Open what an area points at. The destination is the one `app.open` takes;
   * the scope that is open is the caller's to add.
   */
  onOpen?: (to: Destination) => void
  /** Open another view of this scope. */
  onOpenView?: (id: string) => void
  /** Is the editor open, and the press that opens or shuts it. Held by the workspace, so the address can say it. */
  editing?: boolean
  onEditing?: (editing: boolean) => void
  /** Where a move out of the editor is going, in words. */
  whereTo?: (to: Destination) => string | undefined
  /** The way to a view the model draws, from a drawing that should have been one. */
  onNewView?: () => void
  /** Where the desktop app is got: said where there is no editor here. */
  onGetDesktop?: () => void
  /** What a kind of element is called, one and many. */
  kindWord?: (kind: string | undefined) => string
  kindGroup?: (kind: string, count: number) => string
  s: Translate
}

export function DrawingView(props: DrawingViewProps) {
  const { diagram, readOnly, origin, s } = props
  const editor = drawingOriginOf(origin)
  const mode = useTheme().palette.mode
  const shades = useTheme().tokens?.shades
  const [localEditing, setLocalEditing] = useState(false)
  const editing = props.editing ?? localEditing
  const setEditing = props.onEditing ?? setLocalEditing
  const keeper = readOnly ? undefined : keeperFor(props.scope, props.images, diagram, props.dispatch)
  const { documents, diagnostics, notify } = props
  const canEdit = Boolean(editor && keeper && documents && diagnostics && notify)
  const look = useMemo<DrawingLook>(() => ({
    css: drawingSkin(shades), darkColor: DRAWING_DARK_COLOUR, ...(props.kindGroup ? { groupTitle: props.kindGroup } : {}),
  }), [shades, props.kindGroup])
  if (editing && canEdit && editor && keeper && documents && diagnostics && notify) {
    return (
      <div className="drawing-view" data-testid="drawing-view">
        <DrawingEditor
          origin={editor} language={props.language ?? 'en'} mode={mode} xml={diagram.drawing?.xml}
          elements={props.elements ?? []} paletteTitle={s('shell.drawingElements')} look={look} keeper={keeper} name={diagram.name}
          documents={documents} diagnostics={diagnostics} notify={notify} onClose={() => setEditing(false)}
          {...(props.print ? { print: props.print } : {})}
          onOpenElement={(id) => props.onOpen?.({ page: 'element', id })}
          staysHere={(to) => to.page === 'drawing' && to.id === diagram.id && to.edit === true}
          {...(props.whereTo ? { whereTo: props.whereTo } : {})} {...(props.kindWord ? { kindWord: props.kindWord } : {})} s={s}
        />
      </div>
    )
  }
  return <DrawingReading {...props} canEdit={canEdit} noEditor={!editor} onEdit={() => setEditing(true)} />
}

function DrawingReading(props: DrawingViewProps & { canEdit: boolean; noEditor: boolean; onEdit: () => void }) {
  const { diagram, scope, images, elements = [], readOnly, canEdit, noEditor, onEdit, documents, notify, s } = props
  const bytesAt = useCallback(
    (address: string) => (scope && images ? images.bytesAt(scope, address) : Promise.resolve(undefined)),
    [scope, images],
  )
  const address = diagram.drawing?.picture
  const shown = useContentPicture(scope && images ? bytesAt : undefined, address)
  const xml = diagram.drawing?.xml ?? ''
  const links = useMemo(() => diagram.drawing?.links ?? [], [diagram.drawing?.links])
  const shapes = useMemo(() => drawnShapes(xml), [xml])
  const facts = useMemo(() => linkFacts(links, shapes, elements), [links, shapes, elements])
  const pictured = shown !== undefined && shown !== 'absent'
  const [linksOpen, setLinksOpen] = useState(false)
  const [reading, setReading] = useState<string | undefined>(undefined)
  const frame = pictured ? pictureFrame(xml, shown.frame) : undefined
  const zoom = usePictureZoom(frame?.width, frame?.height)
  const trouble = facts.filter((fact) => fact.state !== 'inStep').length

  const openArea = (elementId: string) => {
    if (!elements.some((element) => element.id === elementId)) { setReading(undefined); setLinksOpen(true); return }
    setLinksOpen(false)
    setReading(elementId)
  }
  const saveAs = async (format: 'svg' | 'png') => {
    if (!address || !images || !scope || !documents) return
    const failed = () => {
      props.diagnostics?.report({ level: 'error', where: 'drawingExport', message: 'drawing.exportFailed' })
      notify?.(s('drawing.exportFailed'), 'error')
    }
    let name = ''
    await handOver(async () => {
      const held = await images.bytesAt(scope, address)
      if (!held) throw new Error('gone')
      const file = await pictureFile(diagram.name, held.bytes, format, frame)
      name = file.name
      return documents.save(file)
    }, { saved: () => notify?.(s('shell.drawingExported', { name }), 'success'), failed })
  }
  const element = reading ? elements.find((one) => one.id === reading) : undefined
  return (
    <div className="drawing-view" data-testid="drawing-view">
      <ViewBar
        label={s('drawing.barLabel')} data-guide="drawing.bar"
        reading={<Statement name={diagram.name} shapes={shapes.length} links={links.length} pages={pageCount(xml)} readOnly={readOnly} noEditor={noEditor} s={s} />}
        show={links.length > 0 ? (
          <ViewBarButton on={linksOpen} aria-pressed={linksOpen} onClick={() => { setReading(undefined); setLinksOpen(!linksOpen) }} data-testid="drawing-links" data-guide="drawing.links">
            {linksWords(links.length, trouble, s)}
          </ViewBarButton>
        ) : undefined}
        exportAs={pictured && documents ? (
          <ViewBarMenu
            label={s('drawing.export')} data-guide="drawing.export"
            items={[{ label: 'SVG', onSelect: () => { void saveAs('svg') } }, { label: 'PNG', onSelect: () => { void saveAs('png') } }]}
          />
        ) : undefined}
        more={<EditWay canEdit={canEdit} noEditor={noEditor} readOnly={readOnly} pictured={pictured} onEdit={onEdit} onGetDesktop={props.onGetDesktop} s={s} />}
      />
      <div className="drawing-view__body">
        <div className="drawing-view__canvas" ref={zoom.ref} tabIndex={pictured ? 0 : undefined} data-testid="drawing-canvas">
          {pictured ? (
            <>
              {/* A picture whose frame cannot be read has no areas to place, and is still shown. */}
              <div className="drawing-view__sheet" style={frame ? { width: `${frame.width * zoom.value}px` } : { width: '100%' }}>
                <DrawingPicture
                  url={shown.url} picture={shown.frame} xml={xml} links={links} alt={diagram.name} fill
                  label={(elementId) => s('shell.drawingOpenElement', { name: facts.find((fact) => fact.link.elementId === elementId)?.name || elementId })}
                  markAll={linksOpen} chosen={reading} stateOf={(link) => facts.find((fact) => fact.link.shapeId === link.shapeId)?.state}
                  onOpen={openArea}
                  testIds={{ frame: 'drawing-picture-frame', picture: 'drawing-picture', area: (link) => `drawing-area-${link.shapeId}` }}
                />
              </div>
              {frame && <CanvasDock zoom={zoom.value} onZoomIn={() => zoom.step('in')} onZoomOut={() => zoom.step('out')} onFit={zoom.fit} onHome={zoom.home} data-testid="drawing-dock" />}
            </>
          ) : (
            <NoPicture {...props} shapes={shapes.length} links={links.length} facts={facts} waiting={Boolean(address) && shown === undefined} canEdit={canEdit} noEditor={noEditor} onEdit={onEdit} onRead={openArea} />
          )}
        </div>
        {element && (
          <ElementReader
            element={element} diagrams={props.diagrams ?? []} kindWord={props.kindWord} onClose={() => setReading(undefined)}
            onOpenPage={(id) => props.onOpen?.({ page: 'element', id })} onOpenView={props.onOpenView} s={s}
          />
        )}
        {linksOpen && <DrawingLinksPanel facts={facts} shapes={shapes} canEdit={canEdit} onEdit={onEdit} onRead={openArea} onClose={() => setLinksOpen(false)} s={s} />}
      </div>
    </div>
  )
}

/** One sentence on the bar: whose this is, and how far it reaches. Said once, whoever is reading. */
function Statement({ name, shapes, links, pages, readOnly, noEditor, s }: {
  name: string; shapes: number; links: number; pages: number; readOnly: boolean | undefined; noEditor: boolean; s: Translate
}) {
  const whose = s(readOnly ? 'drawing.youRead' : 'drawing.youDraw')
  const reach = shapes === 0 ? s('drawing.nothingYet') : noEditor && !readOnly ? s('drawing.readOnlyHere') : s('drawing.reach', { links, shapes })
  return (
    <span className="drawing-view__statement" data-testid="drawing-statement">
      <strong>{name}</strong> {whose} {reach}
      {pages > 1 ? ` ${s('drawing.firstPageOnly', { pages })}` : ''}
    </span>
  )
}

/** The bar's way into the editor, or to where one is. Never a disabled button: nothing to press means nothing shown. */
function EditWay({ canEdit, noEditor, readOnly, pictured, onEdit, onGetDesktop, s }: {
  canEdit: boolean; noEditor: boolean; readOnly: boolean | undefined; pictured: boolean; onEdit: () => void; onGetDesktop: (() => void) | undefined; s: Translate
}) {
  if (readOnly) return null
  // With no picture yet the page itself offers it, in words that say what it is for.
  if (canEdit && !pictured) return null
  if (canEdit) return <Button variant="primary" size="small" onClick={onEdit} data-testid="drawing-edit" data-guide="drawing.edit">{s('drawing.edit')}</Button>
  if (noEditor && pictured && onGetDesktop) return <Button variant="plain" size="small" onClick={onGetDesktop} data-testid="drawing-get-desktop-bar">{s('drawing.editInDesktop')}</Button>
  return null
}

/** The states with no picture to show, each with its own words and one way on. */
function NoPicture({ shapes, links, facts, waiting, canEdit, noEditor, onEdit, onRead, readOnly, onNewView, onGetDesktop, s }: DrawingViewProps & {
  shapes: number; links: number; facts: readonly LinkFact[]; waiting: boolean; canEdit: boolean; noEditor: boolean; onEdit: () => void; onRead: (id: string) => void
}) {
  if (waiting) return <div className="drawing-view__state"><PageState state="loading" /></div>
  const toBoard = onNewView && !readOnly ? <p><Button variant="quiet" onClick={onNewView} data-testid="drawing-new-board">{s('drawing.letTheModel')}</Button></p> : null
  if (shapes > 0) {
    return (
      <div className="drawing-view__state" data-testid="drawing-not-pictured">
        <PageState
          state="empty" title={s('drawing.notPicturedTitle')}
          body={(
            <>
              <p>{s('drawing.notPicturedBody', { shapes, links })}</p>
              {facts.length > 0 && (
                <>
                  <p><strong>{s('drawing.pointsAt')}</strong></p>
                  <ul className="drawing-view__points">
                    {facts.map((fact) => (
                      <li key={fact.link.shapeId}>
                        <Button variant="quiet" size="small" onClick={() => onRead(fact.link.elementId)} data-testid={`drawing-points-${fact.link.shapeId}`}>{fact.name}</Button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
          {...(canEdit ? { action: { label: s('drawing.makePicture'), onPress: onEdit, dataGuide: 'drawing.edit' } } : {})}
        />
      </div>
    )
  }
  if (noEditor && !readOnly) {
    return (
      <div className="drawing-view__state" data-testid="drawing-editor-unavailable">
        <PageState
          state="empty" title={s('drawing.noEditorTitle')}
          body={<><p>{s('drawing.noEditorBody')}</p>{toBoard}<p>{s('drawing.noEditorEmpty')}</p></>}
          {...(onGetDesktop ? { action: { label: s('drawing.getDesktop'), onPress: onGetDesktop } } : {})}
        />
      </div>
    )
  }
  return (
    <div className="drawing-view__state" data-testid="drawing-not-drawn">
      <PageState
        state="empty" title={s('shell.drawingNotDrawn')}
        body={<><p>{s('drawing.emptyBody')}</p>{canEdit ? toBoard : null}{canEdit ? <p>{s('drawing.emptyChoose')}</p> : null}</>}
        {...(canEdit ? { action: { label: s('drawing.start'), onPress: onEdit, dataGuide: 'drawing.edit' } } : {})}
      />
    </div>
  )
}

/** The kit's zoom, for a picture: its own size is 100%, and it opens fitted to the room there is. */
function usePictureZoom(width: number | undefined, height: number | undefined) {
  const [asked, setAsked] = useState<number | undefined>(undefined)
  const [room, setRoom] = useState<{ width: number; height: number } | undefined>(undefined)
  const canvas = useMemo(() => {
    let observer: ResizeObserver | undefined
    return (element: HTMLElement | null) => {
      observer?.disconnect()
      if (!element) return
      const measure = () => setRoom({ width: element.clientWidth, height: element.clientHeight })
      measure()
      if (typeof ResizeObserver !== 'undefined') {
        observer = new ResizeObserver(measure)
        observer.observe(element)
      }
    }
  }, [])
  const fitted = width && height && room && room.width > 0 && room.height > 0
    ? Math.min(ZOOM_HOME, (room.width - FIT_MARGIN) / width, (room.height - FIT_MARGIN) / height)
    : ZOOM_HOME
  const value = asked ?? fitted
  const zoomRef = useCanvasZoom(steppedZoomTarget({ zoom: () => value, to: (zoom) => setAsked(zoom), fit: () => setAsked(undefined) }))
  const ref = useCallback((element: HTMLElement | null) => { canvas(element); zoomRef(element) }, [canvas, zoomRef])
  return {
    ref, value,
    step: (way: 'in' | 'out') => setAsked(clampZoom(stepZoom(value, way))),
    fit: () => setAsked(undefined),
    home: () => setAsked(ZOOM_HOME),
  }
}

/** Room left round a fitted picture, so the dock does not sit on it. */
const FIT_MARGIN = 96

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

/** How many links, and how many need a look, with one said as one. */
function linksWords(count: number, trouble: number, s: Translate): string {
  const links = count === 1 ? s('drawing.oneLink') : s('drawing.links', { count })
  if (trouble === 0) return links
  return trouble === 1 ? s('drawing.linksTroubleOne', { links }) : s('drawing.linksTrouble', { links, trouble })
}

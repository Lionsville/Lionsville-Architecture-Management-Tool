// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The sheet as one poster: every block in its place on a page of fixed size, read
 * from far off or close up, the way a board is, with nothing to lay out on a zoom.
 *
 * One transform over plain DOM, and no React Flow: every tile stays in the DOM, or
 * Find, the keyboard, a print and a screen reader would lose what is off screen. The
 * camera lives in a ref and is written straight to the element, and the distances are
 * one attribute and CSS, so a zoom or a pan renders no tile. Only the dock's number
 * has state, in a component of its own.
 *
 * Read-only: a function is opened from here, and nothing is placed.
 */
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import type { DesignElement, ElementId } from '../../model'
import type { Translate } from '../../i18n'
import { CanvasDock } from '../../widgets/kit/CanvasDock'
import { steppedZoomTarget, useCanvasZoom } from '../../widgets/kit/useCanvasZoom'
import { canvasZoomProps, clampZoomTo } from '../../widgets/kit/zoom'
import type { Point, ZoomRange } from '../../widgets/kit/zoom'
import { tokenVar } from '../../widgets/kit/tokens'
import { locatedSelector } from '../../widgets/useLocated'
import type { FunctionCoverage } from '../coverage'
import type { LensValue, SheetLens } from '../lens'
import { bandStepRoomy, firstLayout, POSTER_COLUMN_ID, POSTER_TILE, POSTER_WIDTH, readingOrder, tileColumns } from '../posterLayout'
import type { PosterAreaSize, PosterBlock, PosterLayout } from '../posterLayout'
import type { LaidOutSheet, SheetActor, SheetArea, SheetCapability, SheetJourney, SheetLane } from '../sheet'
import { lookOf } from './sheetLook'
import './SheetPoster.css'

/** This canvas only: it is read whole from far off, where every other stops at the zoom a name can be read at. */
export const POSTER_ZOOM: ZoomRange = {
  floor: 0.2, ceiling: 3,
  stops: [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.2, 1.4, 1.6, 2, 2.5, 3],
}

/** The zoom it opens at when it does not fit: a name reads there. */
const READABLE = 0.9
const MARGIN = 8
/** How long after the last move the page is sharpened. */
const SETTLE_MS = 140
/** Below this a step's words have stopped being read, and go. */
const WORDS_FROM = 0.8

/** What a tile says up close. */
type Facts = { apps: string; unit: string }

export type SheetPosterProps = {
  laidOut: LaidOutSheet
  areaSpans?: Readonly<Record<string, number>> | undefined
  lens: SheetLens | undefined
  valueOf(element: DesignElement): LensValue | undefined
  coverageAt(id: ElementId): FunctionCoverage
  nameOf(id: ElementId): string
  selectedId: ElementId | undefined
  onSelect(id: ElementId): void
  /** What the strip under the canvas says beside the dock. */
  strip?: ReactNode
  t: Translate
}

function sizeOf(area: SheetArea, spans: Readonly<Record<string, number>> | undefined): PosterAreaSize {
  const span = spans?.[area.element.id]
  return {
    id: area.element.id,
    groupings: area.groupings.map((grouping) => grouping.capabilities.length),
    loose: area.capabilities.length,
    ...(span !== undefined ? { span } : {}),
  }
}

function layoutOf(laidOut: LaidOutSheet, spans: Readonly<Record<string, number>> | undefined): PosterLayout {
  const parties = laidOut.actors.filter((actor) => actor.group === 'parties')
  const steps = laidOut.journey?.lanes[0]?.cells.reduce((sum, cell) => sum + cell.steps.length, 0) ?? 0
  return firstLayout({
    areas: laidOut.areas.map((area) => sizeOf(area, spans)),
    ...(laidOut.journey ? { band: { id: laidOut.journey.element.id, steps, lanes: laidOut.journey.lanes.length } } : {}),
    ...(parties.length > 0 ? { column: { groups: parties.filter((actor) => actor.depth === 0).length, rows: parties.filter((actor) => actor.depth > 0).length } } : {}),
  })
}

function place(block: PosterBlock): CSSProperties {
  return { left: block.x, top: block.y, width: block.width, height: block.height, containIntrinsicSize: `${block.width}px ${block.height}px` }
}

const Tile = memo(function Tile({ capability, lens, value, facts }: { capability: SheetCapability; lens: SheetLens | undefined; value: LensValue | undefined; facts: Facts | undefined }) {
  const { element } = capability
  const look = lens && value ? lookOf(lens, value) : undefined
  return (
    <li>
      <button type="button" tabIndex={-1} className="poster-tile" title={element.name} data-element-id={element.id} data-testid={`poster-tile-${element.id}`} data-value={value?.value}>
        {look?.mark && <i className="poster-tile__mark" />}
        <span className="poster-tile__name">{element.name}</span>
        {facts?.apps && <span className="poster-tile__near">{facts.apps}</span>}
        {facts?.unit && <span className="poster-tile__near">{facts.unit}</span>}
      </button>
    </li>
  )
})

type Drawing = {
  lens: SheetLens | undefined
  valueOf(element: DesignElement): LensValue | undefined
  factsOf: ReadonlyMap<ElementId, Facts>
}

function Tiles({ capabilities, drawing }: { capabilities: readonly SheetCapability[]; drawing: Drawing }) {
  return (
    <ul className="poster-flow">
      {capabilities.map((capability) => (
        <Tile key={capability.element.id} capability={capability} lens={drawing.lens} value={drawing.valueOf(capability.element)} facts={drawing.factsOf.get(capability.element.id)} />
      ))}
    </ul>
  )
}

const basis = (cols: number) => `${cols} ${cols} ${cols * (POSTER_TILE.minWidth + POSTER_TILE.gap) + POSTER_TILE.gap}px`

/** An area: a bar, a meter, then its groupings and its loose tiles. */
const AreaBlock = memo(function AreaBlock({ area, block, drawing, span }: { area: SheetArea; block: PosterBlock; drawing: Drawing; span: number | undefined }) {
  const all = [...area.groupings.flatMap((grouping) => grouping.capabilities), ...area.capabilities]
  const parts = new Map<string, number>()
  for (const { element } of all) {
    const value = drawing.lens ? drawing.valueOf(element)?.value : undefined
    if (value) parts.set(value, (parts.get(value) ?? 0) + 1)
  }
  const accent = area.element.accentColor
  const looseCols = span ?? tileColumns(Math.max(area.capabilities.length, 1))
  return (
    <section className="poster-block" style={{ ...place(block), ...(accent ? { '--poster-rail': accent } as CSSProperties : {}) }} data-accent={accent ? '' : undefined} data-block={area.element.id} aria-labelledby={`poster-title-${area.element.id}`}>
      <h3 className="poster-title" id={`poster-title-${area.element.id}`} data-element-id={area.element.id}>
        <span className="poster-title__name">{area.element.name}</span>
        {drawing.factsOf.get(area.element.id)?.unit && <span className="poster-title__unit">{drawing.factsOf.get(area.element.id)?.unit}</span>}
      </h3>
      <span className="poster-meter" aria-hidden="true">
        {[...parts].map(([value, count]) => (
          <i key={value} style={{ flex: count, background: tokenVar((drawing.lens && lookOf(drawing.lens, { value }).colour) || 'line-strong') }} />
        ))}
      </span>
      <div className="poster-body">
        {area.groupings.map((grouping) => (
          <div key={grouping.element.id} className="poster-grouping" style={{ flex: basis(tileColumns(Math.max(grouping.capabilities.length, 1))) }} data-element-id={grouping.element.id}>
            <h4 className="poster-grouping__head"><span className="poster-grouping__name">{grouping.element.name}</span></h4>
            <Tiles capabilities={grouping.capabilities} drawing={drawing} />
          </div>
        ))}
        {area.capabilities.length > 0 && (
          <div style={area.groupings.length > 0 ? { flex: basis(looseCols), minWidth: 0 } : { flex: '1 1 100%', minWidth: 0 }}>
            <Tiles capabilities={area.capabilities} drawing={drawing} />
          </div>
        )}
      </div>
    </section>
  )
})

function Lane({ lane, phases }: { lane: SheetLane; phases: readonly { id: ElementId; weight: number }[] }) {
  return (
    <div className="poster-band__lane">
      {phases.map((phase) => {
        const cell = lane.cells.find((held) => held.phaseId === phase.id)
        return (
          <div key={phase.id} className="poster-band__cell" style={{ flex: `${phase.weight} ${phase.weight} 0` }}>
            {cell?.steps.map((step) => (
              <button key={step.element.id} type="button" tabIndex={-1} className="poster-step" data-outside={step.outside || undefined} data-element-id={step.element.id} title={step.element.name}>
                <span className="poster-step__name">{step.element.name}</span>
              </button>
            ))}
          </div>
        )
      })}
    </div>
  )
}

/** A journey's phases over as many rows as the band has, split where the steps come to half. */
function bandRowsOf(journey: SheetJourney, rows: 1 | 2): (typeof journey.phases)[] {
  if (rows === 1) return [journey.phases]
  const stepsIn = (phase: DesignElement) => journey.lanes[0]?.cells.find((cell) => cell.phaseId === phase.id)?.steps.length ?? 0
  const total = journey.phases.reduce((sum, phase) => sum + stepsIn(phase), 0)
  const first: DesignElement[] = []
  let held = 0
  for (const phase of journey.phases) {
    if (held >= total / 2) break
    first.push(phase)
    held += stepsIn(phase)
  }
  return [first, journey.phases.slice(first.length)]
}

const Band = memo(function Band({ journey, block, rows }: { journey: SheetJourney; block: PosterBlock; rows: 1 | 2 }) {
  const steps = journey.lanes[0]?.cells.reduce((sum, cell) => sum + cell.steps.length, 0) ?? 0
  return (
    <section className="poster-block poster-band" style={place(block)} data-block={block.id} data-roomy={bandStepRoomy(steps, block.width, rows) ? '' : undefined} aria-label={journey.element.name} data-element-id={journey.element.id}>
      {bandRowsOf(journey, rows).map((phases, index) => {
        const weighted = phases.map((phase) => ({
          id: phase.id, name: phase.name,
          weight: Math.max(1, ...journey.lanes.map((lane) => lane.cells.find((cell) => cell.phaseId === phase.id)?.steps.length ?? 0)),
        }))
        return (
          <div key={index} className="poster-band__row">
            <div className="poster-band__phases">
              {weighted.map((phase) => <div key={phase.id} className="poster-band__phase" style={{ flex: `${phase.weight} ${phase.weight} 0` }} data-element-id={phase.id}>{phase.name}</div>)}
            </div>
            {journey.lanes.map((lane, at) => <Lane key={lane.actorId ?? at} lane={lane} phases={weighted} />)}
          </div>
        )
      })}
    </section>
  )
})

const Column = memo(function Column({ actors, block }: { actors: readonly SheetActor[]; block: PosterBlock }) {
  return (
    <section className="poster-block poster-column" style={place(block)} data-block={block.id}>
      {actors.map(({ element, depth }) => (depth === 0
        ? <div key={element.id} className="poster-column__group" data-element-id={element.id}>{element.name}</div>
        : <button key={element.id} type="button" tabIndex={-1} className="poster-person" data-element-id={element.id}>{element.name}</button>))}
    </section>
  )
})

type Camera = { x: number; y: number; zoom: number }

/** The zoom that shows the whole page, leaving the margin. */
function fitOf(pane: { width: number; height: number }, page: { width: number; height: number }): number {
  return clampZoomTo(Math.min(1, (pane.width - 2 * MARGIN) / page.width, (pane.height - 2 * MARGIN) / page.height), POSTER_ZOOM)
}

/** At Fit where that can be read, centred; otherwise at a readable zoom from the top left, with the rest a pan. */
export function openingCamera(pane: { width: number; height: number }, page: { width: number; height: number }): Camera {
  const fit = fitOf(pane, page)
  const zoom = Math.max(fit, READABLE)
  if (zoom > fit) return { x: MARGIN, y: MARGIN, zoom }
  return { x: (pane.width - page.width * zoom) / 2, y: (pane.height - page.height * zoom) / 2, zoom }
}

/** A person can pan as far as they like, short of losing the page: this much of it stays in the window. */
const STAYS_IN_VIEW = 64

export function heldInView(camera: Camera, pane: { width: number; height: number }, page: { width: number; height: number }): Camera {
  const hold = (at: number, room: number, size: number) => Math.min(room - STAYS_IN_VIEW, Math.max(STAYS_IN_VIEW - size, at))
  return { ...camera, x: hold(camera.x, pane.width, page.width * camera.zoom), y: hold(camera.y, pane.height, page.height * camera.zoom) }
}

/** The dock's number is the one thing here that renders on a zoom. */
function Dock({ listen, onGo }: { listen(to: (zoom: number) => void): () => void; onGo(how: 'in' | 'out' | 'home' | 'fit'): void }) {
  const [zoom, setZoom] = useState(1)
  useEffect(() => listen(setZoom), [listen])
  return (
    <CanvasDock
      corner={false} zoom={zoom} floor={POSTER_ZOOM.floor} ceiling={POSTER_ZOOM.ceiling} data-testid="poster-dock"
      onZoomIn={() => onGo('in')} onZoomOut={() => onGo('out')} onFit={() => onGo('fit')} onHome={() => onGo('home')}
    />
  )
}

function useCamera(page: { width: number; height: number }) {
  const pane = useRef<HTMLDivElement | null>(null)
  const stage = useRef<HTMLDivElement | null>(null)
  const camera = useRef<Camera>({ x: 0, y: 0, zoom: 1 })
  const listeners = useRef(new Set<(zoom: number) => void>())
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const size = useRef(page)
  size.current = page

  const write = useCallback((moving: boolean) => {
    const on = stage.current
    const held = pane.current
    if (!on || !held) return
    camera.current = heldInView(camera.current, { width: held.clientWidth, height: held.clientHeight }, size.current)
    const { x, y, zoom } = camera.current
    on.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`
    if (moving) {
      held.dataset.moving = ''
      clearTimeout(settle.current)
      settle.current = setTimeout(() => { delete held.dataset.moving }, SETTLE_MS)
    }
  }, [])
  const distances = useCallback(() => {
    const on = stage.current
    if (!on) return
    const props = canvasZoomProps(camera.current.zoom, WORDS_FROM)
    if (on.dataset.distance !== props['data-distance']) on.dataset.distance = props['data-distance']
    if (on.dataset.labels !== props['data-labels']) on.dataset.labels = props['data-labels']
    // Only the far sizes read it, and an inherited property touches every descendant: a step inside reading distance pays nothing.
    if (props['data-distance'] === 'far') on.style.setProperty('--canvas-zoom', props.style['--canvas-zoom'])
    for (const tell of listeners.current) tell(camera.current.zoom)
  }, [])
  const to = useCallback((zoom: number, at?: Point) => {
    const held = pane.current
    const was = camera.current
    const next = clampZoomTo(zoom, POSTER_ZOOM)
    const around = at ?? (held ? { x: held.clientWidth / 2, y: held.clientHeight / 2 } : { x: 0, y: 0 })
    const ratio = next / was.zoom
    camera.current = { x: around.x - (around.x - was.x) * ratio, y: around.y - (around.y - was.y) * ratio, zoom: next }
    write(true)
    distances()
  }, [write, distances])
  const panBy = useCallback((dx: number, dy: number) => {
    camera.current = { ...camera.current, x: camera.current.x + dx, y: camera.current.y + dy }
    write(true)
  }, [write])
  const fit = useCallback(() => {
    const held = pane.current
    if (!held) return
    const box = { width: held.clientWidth, height: held.clientHeight }
    const zoom = fitOf(box, size.current)
    camera.current = { x: (box.width - size.current.width * zoom) / 2, y: (box.height - size.current.height * zoom) / 2, zoom }
    write(true)
    distances()
  }, [write, distances])
  const open = useCallback(() => {
    const held = pane.current
    if (!held) return
    camera.current = openingCamera({ width: held.clientWidth, height: held.clientHeight }, size.current)
    write(false)
    distances()
  }, [write, distances])
  const target = useMemo(() => steppedZoomTarget({ zoom: () => camera.current.zoom, to, fit }, POSTER_ZOOM), [to, fit])
  const attachZoom = useCanvasZoom(target)
  const attach = useCallback((element: HTMLDivElement | null) => {
    pane.current = element
    attachZoom(element)
  }, [attachZoom])
  const listen = useCallback((tell: (zoom: number) => void) => {
    listeners.current.add(tell)
    tell(camera.current.zoom)
    return () => { listeners.current.delete(tell) }
  }, [])
  useEffect(() => () => clearTimeout(settle.current), [])
  return { attach, stage, pane, panBy, open, target, listen }
}

/** Pan on a plain wheel and on a drag; a press that did not move is a press. */
function usePan(pane: { current: HTMLDivElement | null }, panBy: (dx: number, dy: number) => void) {
  const held = useRef<{ x: number; y: number; moved: boolean } | undefined>(undefined)
  useEffect(() => {
    const on = pane.current
    if (!on) return undefined
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return
      event.preventDefault()
      panBy(-event.deltaX, -event.deltaY)
    }
    on.addEventListener('wheel', wheel, { passive: false })
    return () => on.removeEventListener('wheel', wheel)
  }, [pane, panBy])
  return {
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => { held.current = { x: event.clientX, y: event.clientY, moved: false } },
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => {
      const at = held.current
      if (!at) return
      const [dx, dy] = [event.clientX - at.x, event.clientY - at.y]
      if (!at.moved && Math.hypot(dx, dy) < 4) return
      if (!at.moved) { event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.dataset.panning = '' }
      held.current = { x: event.clientX, y: event.clientY, moved: true }
      panBy(dx, dy)
    },
    onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => {
      delete event.currentTarget.dataset.panning
      // Kept for the click that follows, which a drag's end should not be taken for.
      const at = held.current
      held.current = undefined
      return at?.moved
    },
    moved: held,
  }
}

export function SheetPoster({ laidOut, areaSpans, lens, valueOf, coverageAt, nameOf, selectedId, onSelect, strip, t }: SheetPosterProps) {
  const layout = useMemo(() => layoutOf(laidOut, areaSpans), [laidOut, areaSpans])
  const camera = useCamera({ width: POSTER_WIDTH, height: layout.height })
  const { attach, stage, pane, panBy, open, target, listen } = camera
  const pan = usePan(pane, panBy)
  const dragged = useRef(false)
  // Once a page: a change to the sheet does not take the reader's place away.
  useLayoutEffect(open, [open])

  // What a tile says up close, worked out with the page: the zoom is not an input to it.
  const named = useRef(nameOf)
  named.current = nameOf
  const factsOf = useMemo(() => {
    const facts = new Map<ElementId, Facts>()
    const ofOne = (id: ElementId) => {
      const held = coverageAt(id)
      facts.set(id, { apps: held.supportedBy.map((one) => named.current(one)).join(', '), unit: held.assignedTo.map((one) => named.current(one)).join(', ') })
    }
    for (const area of laidOut.areas) {
      ofOne(area.element.id)
      for (const grouping of area.groupings) grouping.capabilities.forEach((one) => ofOne(one.element.id))
      area.capabilities.forEach((one) => ofOne(one.element.id))
    }
    return facts
  }, [laidOut, coverageAt])
  const drawing: Drawing = useMemo(() => ({ lens, valueOf, factsOf }), [lens, valueOf, factsOf])

  // A pick is one attribute on two tiles, not a render of all of them.
  useEffect(() => {
    if (selectedId === undefined) return undefined
    const on = stage.current?.querySelector(locatedSelector(selectedId))
    on?.setAttribute('aria-current', 'true')
    return () => on?.removeAttribute('aria-current')
  }, [selectedId, stage, drawing])

  const areaById = useMemo(() => new Map(laidOut.areas.map((area) => [area.element.id, area])), [laidOut])
  const parties = useMemo(() => laidOut.actors.filter((actor) => actor.group === 'parties'), [laidOut])
  const blocks = useMemo(() => readingOrder(layout.blocks).map((block) => {
    if (block.id === POSTER_COLUMN_ID) return <Column key={block.id} actors={parties} block={block} />
    if (laidOut.journey?.element.id === block.id) return <Band key={block.id} journey={laidOut.journey} block={block} rows={layout.bandRows} />
    const area = areaById.get(block.id)
    return area ? <AreaBlock key={block.id} area={area} block={block} drawing={drawing} span={areaSpans?.[area.element.id]} /> : null
  }), [layout, laidOut.journey, parties, areaById, drawing, areaSpans])

  return (
    <div className="poster" data-testid="sheet-poster" data-guide="sheet.poster">
      <div
        ref={attach} className="poster__pane" role="group" aria-label={t('sheet.reading.poster')} tabIndex={0} data-testid="poster-pane"
        onPointerDown={pan.onPointerDown} onPointerMove={pan.onPointerMove}
        onPointerUp={(event) => { dragged.current = pan.onPointerUp(event) === true }}
        onClick={(event) => {
          if (dragged.current) { dragged.current = false; return }
          const id = (event.target as Element).closest<HTMLElement>('[data-element-id]')?.dataset.elementId
          if (id) onSelect(id)
        }}
      >
        <div ref={stage} className="poster__stage" data-testid="poster-stage" style={{ width: POSTER_WIDTH, height: layout.height }}>{blocks}</div>
      </div>
      <div className="poster__strip">
        <Dock listen={listen} onGo={(how) => target.go(how)} />
        {strip}
      </div>
    </div>
  )
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The sheet as one poster: every block in its place on a page of fixed size, read
 * from far off or close up, the way a board is, with nothing to lay out on a zoom.
 *
 * One transform over plain DOM, and no React Flow: every tile stays in the DOM, or
 * Find, the keyboard, a print and a screen reader would lose what is off screen. The
 * camera lives in a ref (`posterCamera`), and the distances are one attribute and
 * CSS, so a zoom or a pan renders no tile. What is lit, quieted or picked is one
 * attribute per tile too, for the same reason.
 *
 * The DOM runs in reading order, worked out from the places (`readingOrder`), never
 * from how anybody dragged. Each block is one stop for Tab; the arrows go from tile
 * to tile across blocks, by what is on screen, and the camera follows.
 *
 * In Read a drag pans, and nothing on the page moves. Design hands in its gestures
 * (`PosterDesign`); opening a poster or reading it writes nothing, ever.
 */
import { memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, FocusEvent as ReactFocusEvent, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode, Ref } from 'react'
import type { DesignDiagram, DesignElement, ElementId, PosterCell, PosterItem as PosterItemRecord, PosterItemPlace } from '../../model'
import type { Translate } from '../../i18n'
import { Button } from '../../widgets/kit/Button'
import { CanvasDock } from '../../widgets/kit/CanvasDock'
import { Menu } from '../../widgets/kit/Menu'
import { tokenVar } from '../../widgets/kit/tokens'
import type { ColourToken } from '../../widgets/kit/tokens'
import { locatedSelector } from '../../widgets/useLocated'
import type { FunctionCoverage } from '../coverage'
import type { LensValue, SheetLens } from '../lens'
import { bandStepRoomy, POSTER_COLUMN_ID, POSTER_TILES, readingOrder, tileColumns } from '../posterLayout'
import type { PosterBlock, PosterTileSize } from '../posterLayout'
import { posterPlaces, posterTiles } from '../posterPlaces'
import type { PosterSheet } from '../posterPlaces'
import type { LaidOutSheet, SheetActor, SheetArea, SheetCapability, SheetJourney, SheetLane } from '../sheet'
import { IconOrImage } from './posterIcons'
import { usePosterGestures } from './PosterDesign'
import type { PosterDesign } from './PosterDesign'
import { PosterItem } from './PosterItem'
import { POSTER_ZOOM, usePosterCamera } from './posterCamera'
import { unitTargets, UnitLabel } from './Responsible'
import type { Who } from './Responsible'
import { lookOf, valueWord } from './sheetLook'
import { chordHeld } from '../../widgets/kit/keys'
import './SheetPoster.css'
import { plural } from '../../i18n/strings'

export { heldInView, openingCamera, POSTER_ZOOM } from './posterCamera'

/** How long a word from the page stays up. */
const SAY_MS = 6000

/** Far from what is read close up: the words a tile says about itself. */
type Facts = {
  apps: string
  unit: string
  /** The applications filed in a subscope it is handed to: read, and never counted as coverage. */
  via: string
  /** What a label on the tile says, where one shows at reading distance. */
  label?: string
  /** The label names something that is not a unit. */
  labelTyped?: boolean
  /** The label says nobody answers for it: its mark is hollow, as no unit's is. */
  labelNone?: boolean
}

export type PosterHandle = {
  /** Bring this on screen, at a zoom it can be read at. */
  bringOn(id: ElementId): void
  /** Put the keyboard on this. */
  focus(id: ElementId): void
  /** The page as drawn, for paper. */
  page(): { node: HTMLElement; width: number; height: number } | undefined
  /** A word to the person, said aloud. */
  say(words: string): void
  /** The middle of what is on screen, in units: where something new lands. */
  centre(): { x: number; y: number }
  /** Bring these blocks on screen and mark them for a moment: what overlaps, found. */
  flash(blocks: readonly string[]): void
}

export type SheetPosterProps = {
  laidOut: LaidOutSheet
  /** The view, for its places and its own settings. Absent reads as a sheet that says nothing. */
  sheet?: PosterSheet & Partial<Pick<DesignDiagram, 'id' | 'labels'>>
  lens: SheetLens | undefined
  valueOf(element: DesignElement): LensValue | undefined
  coverageAt(id: ElementId): FunctionCoverage
  nameOf(id: ElementId): string
  selectedId: ElementId | undefined
  onSelect(id: ElementId | undefined): void
  /** What the strip under the canvas says beside the dock. */
  strip?: ReactNode
  /** A value of the key pressed: the rest go quiet. */
  only?: string | undefined
  /** What Find or a pressed application lights; the rest go quiet. */
  lit?: ReadonlySet<ElementId> | undefined
  who?: Who | undefined
  /** Where a stand-in is defined, for the line under its title. */
  ownerLabel?: ((id: ElementId) => string | undefined) | undefined
  domainName?: ((scope: string) => string) | undefined
  domainKnown?: ((scope: string) => boolean) | undefined
  /** The applications filed in a scope, by name, read off the register. */
  appsIn?: ((scope: string) => readonly { id: string; name: string }[]) | undefined
  /** The day read: a function not there yet is dashed, and one gone is struck through. */
  day?: string | undefined
  /** Design is up: what it may do. Absent in Read. */
  design?: PosterDesign | undefined
  handle?: Ref<PosterHandle | undefined>
  /** Beside the dock's own, such as Full window. */
  dockExtra?: ReactNode
  t: Translate
}

function place(block: PosterBlock): CSSProperties {
  return { left: block.x, top: block.y, width: block.width, minHeight: block.height, containIntrinsicSize: `${block.width}px ${block.height}px` }
}

/** What a day makes of a function: places have no date, so this is all it does to one. */
function lifeOn(element: DesignElement, day: string | undefined): 'planned' | 'gone' | undefined {
  if (day === undefined) return undefined
  const dates = element.lifecycleDates
  if (dates?.retired !== undefined && dates.retired <= day) return 'gone'
  if (dates?.live !== undefined && dates.live > day) return 'planned'
  return undefined
}

/** What a tile says inside: a name always, the rest as far as the distance and the label allow. */
function TileWords({ element, inside, value, facts, labelled, mark, t }: {
  element: DesignElement
  inside: number
  value: LensValue | undefined
  facts: Facts | undefined
  labelled: boolean
  mark: boolean
  t: Translate
}) {
  const last = facts?.label === undefined ? facts?.via || facts?.unit : undefined
  return (
    <>
      {mark && <i className="poster-tile__mark" />}
      {value?.heat !== undefined && <span className="poster-tile__value">{value.said}</span>}
      <span className="poster-tile__name">{element.name}</span>
      {facts?.apps && <span className="poster-tile__near">{facts.apps}</span>}
      {labelled && facts?.label !== undefined && <span className="poster-tile__label" data-tile-label={element.id} data-typed={facts.labelTyped ? '' : undefined} data-none={facts.labelNone ? '' : undefined}>{facts.label}</span>}
      {last && <span className="poster-tile__near" data-via={facts?.via ? '' : undefined}>{last}</span>}
      {inside > 0 && <span className="poster-tile__inside" title={t('sheet.poster.inside', { count: inside })}>+{inside}</span>}
    </>
  )
}

const flag = (on: boolean) => (on ? '' : undefined)

/** Where a hand placed it, and its fill: the lens's tile colour, the one the key draws too (`sheetLook`). */
function tileStyle(cell: PosterCell | undefined, fill: ColourToken | undefined): CSSProperties | undefined {
  if (!cell && !fill) return undefined
  return {
    ...(cell ? { gridColumn: `${cell.col + 1} / span ${cell.span ?? 1}`, gridRow: cell.row + 1 } : {}),
    ...(fill ? { '--poster-tile-fill': tokenVar(fill) } : {}),
  } as CSSProperties
}


const Tile = memo(function Tile({ capability, inside, lens, value, facts, cell, labelled, standIn, life, say, t }: {
  capability: SheetCapability
  inside: number
  lens: SheetLens | undefined
  value: LensValue | undefined
  facts: Facts | undefined
  cell: PosterCell | undefined
  labelled: boolean
  standIn: boolean
  life: 'planned' | 'gone' | undefined
  say: string | undefined
  t: Translate
}) {
  const { element } = capability
  const look = lens && value ? lookOf(lens, value) : undefined
  return (
    <li>
      <button
        type="button" tabIndex={-1} className="poster-tile" title={element.name} data-element-id={element.id} data-testid={`poster-tile-${element.id}`}
        data-value={value?.value} data-heat={value?.heat} data-hand={flag(cell !== undefined)} data-labelled={flag(labelled)} data-stand-in={flag(standIn)} data-life={life}
        aria-label={say ? `${element.name}, ${say}` : undefined}
        style={tileStyle(cell, look?.tile)}
      >
        <TileWords element={element} inside={inside} value={value} facts={facts} labelled={labelled} mark={look?.mark !== undefined} t={t} />
      </button>
    </li>
  )
})

type Drawing = {
  lens: SheetLens | undefined
  valueOf(element: DesignElement): LensValue | undefined
  factsOf: ReadonlyMap<ElementId, Facts>
  cells: ReadonlyMap<ElementId, PosterCell>
  labels: ReadonlySet<ElementId>
  who: Who | undefined
  ownerLabel: SheetPosterProps['ownerLabel']
  domainName: SheetPosterProps['domainName']
  domainKnown: SheetPosterProps['domainKnown']
  day: string | undefined
  tile: PosterTileSize
  design: PosterDesign | undefined
  t: Translate
}

function Tiles({ capabilities, drawing }: { capabilities: readonly SheetCapability[]; drawing: Drawing }) {
  const { lens, t } = drawing
  return (
    <ul className="poster-flow">
      {posterTiles(capabilities).map(({ capability, inside }) => {
        const value = drawing.valueOf(capability.element)
        const id = capability.element.id
        return (
          <Tile
            key={id} capability={capability} inside={inside} lens={lens} value={value} facts={drawing.factsOf.get(id)} cell={drawing.cells.get(id)}
            labelled={lens === 'who' || drawing.labels.has(id)} standIn={capability.element.ref !== undefined} life={lifeOn(capability.element, drawing.day)}
            say={lens && value ? valueWord(lens, value.value, t) : undefined} t={t}
          />
        )
      })}
    </ul>
  )
}

const basis = (cols: number, size: PosterTileSize) => `${cols} ${cols} ${cols * (POSTER_TILES[size].minWidth + 6) + 6}px`

/**
 * The line under a title: where it is kept, or who it is handed to, marked where nobody can open that.
 * A handing nobody can open is said on the area only in Design, where it can be put right; Read
 * leaves it to the one line at the sheet's foot, so a picture is not spotted with the same warning.
 */
function AreaLine({ area, drawing }: { area: SheetArea; drawing: Drawing }) {
  const { t, domainName, domainKnown, ownerLabel, design } = drawing
  const owner = ownerLabel?.(area.element.id)
  if (owner !== undefined) return <div className="poster-line">{t('sheet.poster.keptIn', { scope: owner })}</div>
  const domain = area.domain
  if (domain === undefined) return null
  const name = domainName?.(domain) ?? domain
  const broken = domainKnown !== undefined && !domainKnown(domain)
  if (broken && !design) return null
  const more = (area.element.scopes?.length ?? 1) - 1
  return (
    <div className="poster-line" data-warn={broken ? '' : undefined} title={name}>
      {broken ? t('sheet.domainGone', { name }) : name}{more > 0 ? ` +${more}` : ''}
    </div>
  )
}

/** What Design offers on a block: a + at the place it would land, on hover or focus and by keyboard. */
/** A press that adds here: a + where there is one thing to add, its word where two sit side by side. */
function AddHere({ label, word, onAdd }: { label: string; word?: string; onAdd(): void }) {
  return (
    <span className="poster-add" data-sheet-add>
      <button type="button" tabIndex={-1} aria-label={label} title={label} onClick={(event) => { event.stopPropagation(); onAdd() }}>{word ?? '+'}</button>
    </span>
  )
}

/** A corner to pull: only drawn by CSS under Design, so going to Design renders no block for it. */
const Handle = () => <i className="poster-handle" data-resize="" aria-hidden="true" />

/** An area: a bar, a meter, then its groupings and its loose tiles. */
const AreaBlock = memo(function AreaBlock({ area, block, drawing, span }: { area: SheetArea; block: PosterBlock; drawing: Drawing; span: number | undefined }) {
  const { element } = area
  const { t, design } = drawing
  const all = [...area.groupings.flatMap((grouping) => grouping.capabilities), ...area.capabilities]
  const parts = new Map<string, { count: number; colour: string }>()
  for (const { element: one } of all) {
    const value = drawing.lens ? drawing.valueOf(one) : undefined
    if (!value) continue
    const held = parts.get(value.value)
    parts.set(value.value, { count: (held?.count ?? 0) + 1, colour: held?.colour ?? tokenVar((drawing.lens && lookOf(drawing.lens, value).colour) || 'line-strong') })
  }
  const accent = element.accentColor
  const looseCols = span ?? tileColumns(Math.max(area.capabilities.length, 1))
  const facts = drawing.factsOf.get(element.id)
  const units = drawing.who?.units(element.id) ?? []
  return (
    <section
      className="poster-block" style={{ ...place(block), ...(accent ? { '--poster-rail': accent } as CSSProperties : {}) }}
      data-accent={accent ? '' : undefined} data-block={element.id} data-drop={element.id} data-stand-in={element.ref !== undefined ? '' : undefined}
      aria-labelledby={`poster-title-${element.id}`} aria-description={plural(t, { one: 'sheet.poster.areaSaysOne', other: 'sheet.poster.areaSays' }, all.length)}
    >
      <h3 className="poster-title" id={`poster-title-${element.id}`}>
        <button type="button" className="poster-title__name" data-element-id={element.id} data-testid={`poster-title-${element.id}`} title={element.name}>{element.name}</button>
        {units.length > 0
          ? <span className="poster-title__unit"><UnitLabel who={drawing.who} functionId={element.id} t={t} /></span>
          : facts?.unit && <span className="poster-title__unit">{facts.unit}</span>}
        {design && <AddHere label={t('sheet.poster.addInto', { name: element.name })} word={t('sheet.addCapability')} onAdd={() => design.addUnder(element.id, 'capability')} />}
        {design && <AddHere label={t('sheet.poster.addGroupingInto', { name: element.name })} word={t('sheet.addGrouping')} onAdd={() => design.addUnder(element.id, 'grouping')} />}
      </h3>
      <AreaLine area={area} drawing={drawing} />
      <span className="poster-meter" aria-hidden="true">
        {[...parts].map(([value, part]) => <i key={value} style={{ flex: part.count, background: part.colour }} />)}
      </span>
      <div className="poster-body">
        {area.groupings.map((grouping) => {
          const tiles = posterTiles(grouping.capabilities).length
          const id = grouping.element.id
          const label = drawing.labels.has(id) ? drawing.factsOf.get(id) : undefined
          return (
            <div key={id} className="poster-grouping" style={{ flex: basis(tileColumns(Math.max(tiles, 1)), drawing.tile) }} data-drop={id}>
              <h4 className="poster-grouping__head">
                <button type="button" tabIndex={-1} className="poster-grouping__name" data-element-id={id} title={grouping.element.name}>{grouping.element.name}</button>
                {label?.label !== undefined && <span className="poster-grouping__label" data-typed={label.labelTyped ? '' : undefined}>{label.label}</span>}
                {design && <AddHere label={t('sheet.poster.addInto', { name: grouping.element.name })} onAdd={() => design.addUnder(id, 'capability')} />}
              </h4>
              <Tiles capabilities={grouping.capabilities} drawing={drawing} />
            </div>
          )
        })}
        {area.capabilities.length > 0 && (
          <div style={area.groupings.length > 0 ? { flex: basis(looseCols, drawing.tile), minWidth: 0 } : { flex: '1 1 100%', minWidth: 0 }}>
            <Tiles capabilities={area.capabilities} drawing={drawing} />
          </div>
        )}
      </div>
      <Handle />
    </section>
  )
})

function Step({ step, first, drawing }: { step: { element: DesignElement; outside: boolean }; first: boolean; drawing: Drawing }) {
  const { element, outside } = step
  const { t, design } = drawing
  return (
    <div className="poster-st" data-outside={outside ? '' : undefined}>
      {element.icon && (
        <span className="poster-st__pic" aria-hidden="true"><IconOrImage icon={element.icon} size={28} /></span>
      )}
      <button
        type="button" tabIndex={first ? 0 : -1} className="poster-step" data-outside={outside ? '' : undefined} data-element-id={element.id} title={element.name}
        aria-label={outside ? t('sheet.outsideStep', { name: element.name }) : undefined}
      >
        <span className="poster-step__name">{element.name}</span>
      </button>
      {design && (
        <span className="poster-add poster-add--icon" data-sheet-add>
          <button type="button" tabIndex={-1} aria-label={t('sheet.poster.iconFor', { name: element.name })} title={t('sheet.poster.iconFor', { name: element.name })} onClick={(event) => { event.stopPropagation(); design.chooseIcon(element.id) }}>◇</button>
        </span>
      )}
    </div>
  )
}

function Lane({ lane, phases, labelled, name, firstId, drawing }: {
  lane: SheetLane
  phases: readonly { id: ElementId; name: string; weight: number }[]
  labelled: boolean
  name: string
  firstId: ElementId | undefined
  drawing: Drawing
}) {
  const { t, design } = drawing
  return (
    <div className="poster-band__lane" data-labelled={labelled ? '' : undefined}>
      {labelled && <div className="poster-band__laneName" title={name}>{name}{lane.actor?.outside ? ` ${t('sheet.outsideWord')}` : ''}</div>}
      {phases.map((phase) => {
        const cell = lane.cells.find((held) => held.phaseId === phase.id)
        return (
          <div key={phase.id} className="poster-band__cell" style={{ flex: `${phase.weight} ${phase.weight} 0` }}>
            {cell?.steps.map((step) => <Step key={step.element.id} step={step} first={step.element.id === firstId} drawing={drawing} />)}
            {cell?.passThrough && <span className="poster-band__above">{t('sheet.asAbove')}</span>}
            {design && (
              <AddHere
                label={t('sheet.addStepTo', { phase: phase.name, lane: name })}
                onAdd={() => design.addStep(phase.id, lane.actorId)}
              />
            )}
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

const Band = memo(function Band({ journey, block, rows, drawing }: { journey: SheetJourney; block: PosterBlock; rows: 1 | 2; drawing: Drawing }) {
  const { t, design } = drawing
  const steps = journey.lanes[0]?.cells.reduce((sum, cell) => sum + cell.steps.length, 0) ?? 0
  const laned = journey.lanes.length > 1
  const firstId = journey.lanes.flatMap((lane) => lane.cells.flatMap((cell) => cell.steps))[0]?.element.id
  return (
    <section
      className="poster-block poster-band" style={place(block)} data-block={block.id} data-roomy={bandStepRoomy(steps, block.width, rows) ? '' : undefined}
      aria-label={journey.element.name} data-laned={laned ? '' : undefined}
    >
      {bandRowsOf(journey, rows).map((phases, index) => {
        const weighted = phases.map((phase) => ({
          id: phase.id, name: phase.name,
          weight: Math.max(1, ...journey.lanes.map((lane) => lane.cells.find((cell) => cell.phaseId === phase.id)?.steps.length ?? 0)),
        }))
        return (
          <div key={index} className="poster-band__row">
            <div className="poster-band__phases" data-laned={laned ? '' : undefined}>
              {weighted.map((phase) => (
                <button key={phase.id} type="button" tabIndex={-1} className="poster-band__phase" style={{ flex: `${phase.weight} ${phase.weight} 0` }} data-element-id={phase.id} title={phase.name}>{phase.name}</button>
              ))}
            </div>
            {journey.lanes.map((lane, at) => (
              <Lane
                key={lane.actorId ?? at} lane={lane} phases={weighted} labelled={laned} firstId={firstId} drawing={drawing}
                name={lane.actor?.name ?? (at === 0 ? t('sheet.commonLane') : lane.actorId ?? '')}
              />
            ))}
          </div>
        )
      })}
      {design && (
        <span className="poster-adds" data-sheet-add>
          <Button variant="quiet" size="small" tabIndex={-1} onClick={(event) => { event.stopPropagation(); design.addPhase(journey.element.id) }}>{t('sheet.addPhase')}</Button>
          <Button variant="quiet" size="small" tabIndex={-1} onClick={(event) => { event.stopPropagation(); design.addLane() }}>{t('sheet.addLane')}</Button>
        </span>
      )}
      <Handle />
    </section>
  )
})

const Column = memo(function Column({ actors, block, kept, drawing }: { actors: readonly SheetActor[]; block: PosterBlock; kept: ReadonlySet<ElementId> | undefined; drawing: Drawing }) {
  const { t, design } = drawing
  const group = (at: number) => actors.slice(0, at + 1).reverse().find((one) => one.depth === 0)
  return (
    <section className="poster-block poster-column" style={place(block)} data-block={block.id} aria-label={t('sheet.stakeholders')}>
      {actors.map(({ element, depth, outside }, at) => (depth === 0
        ? (
          <div key={element.id} className="poster-column__group" data-outside={outside ? '' : undefined}>
            <button type="button" tabIndex={at === 0 ? 0 : -1} data-element-id={element.id} title={element.name}>{element.name}{outside ? ` ${t('sheet.outsideWord')}` : ''}</button>
            {design && <AddHere label={t('sheet.addStakeholderTo', { name: element.name })} onAdd={() => design.addStakeholder(element.id)} />}
          </div>
        )
        : (
          <div key={element.id} className="poster-person-row">
            <button type="button" tabIndex={-1} className="poster-person" data-element-id={element.id} title={kept?.has(element.id) ? `${element.name}. ${t('sheet.nowAUnit')}` : element.name}>
              {element.icon && <IconOrImage icon={element.icon} size={20} wide alt={element.name} />}
              <span className="poster-person__name">{element.name}{outside && !group(at)?.outside ? ` ${t('sheet.outsideWord')}` : ''}</span>
            </button>
            {design && (
              <span className="poster-add poster-add--icon" data-sheet-add>
                <button type="button" tabIndex={-1} aria-label={t('sheet.poster.iconFor', { name: element.name })} title={t('sheet.poster.iconFor', { name: element.name })} onClick={(event) => { event.stopPropagation(); design.chooseIcon(element.id) }}>◇</button>
              </span>
            )}
          </div>
        )))}
      {design && (
        <span className="poster-adds" data-sheet-add>
          <Button variant="quiet" size="small" tabIndex={-1} onClick={(event) => { event.stopPropagation(); design.addGroup() }}>{t('sheet.addGroup')}</Button>
        </span>
      )}
      <Handle />
    </section>
  )
})

/** The dock's number is the one thing here that renders on a zoom. */
function Dock({ listen, onGo, extra }: { listen(to: (zoom: number) => void): () => void; onGo(how: 'in' | 'out' | 'home' | 'fit'): void; extra: ReactNode }) {
  const [zoom, setZoom] = useState(1)
  useEffect(() => listen(setZoom), [listen])
  return (
    <CanvasDock
      corner={false} zoom={zoom} floor={POSTER_ZOOM.floor} ceiling={POSTER_ZOOM.ceiling} data-testid="poster-dock" extra={extra}
      onZoomIn={() => onGo('in')} onZoomOut={() => onGo('out')} onFit={() => onGo('fit')} onHome={() => onGo('home')}
    />
  )
}

/** Pan on a plain wheel and on a drag; a press that did not move is a press. */
function usePan(pane: { current: HTMLDivElement | null }, panBy: (dx: number, dy: number) => void) {
  const held = useRef<{ x: number; y: number; moved: boolean } | undefined>(undefined)
  useEffect(() => {
    const on = pane.current
    if (!on) return undefined
    const wheel = (event: WheelEvent) => {
      if (chordHeld(event)) return
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
  }
}

const ARROWS: Readonly<Record<string, readonly [number, number]>> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }

/** What the arrows land on: anything on the page that can be pressed. */
const ROUTE = '[data-element-id]:is(button), [data-item-id], .poster-add button, .poster-adds button'

/** The next thing that way on screen, across into the next block at the edge of this one. */
function nextThatWay(stage: HTMLElement, from: Element, [dx, dy]: readonly [number, number]): HTMLElement | undefined {
  const a = from.getBoundingClientRect()
  let best: HTMLElement | undefined
  let least = Infinity
  for (const other of stage.querySelectorAll<HTMLElement>(ROUTE)) {
    if (other === from) continue
    const b = other.getBoundingClientRect()
    const vx = b.left + b.width / 2 - a.left - a.width / 2
    const vy = b.top + b.height / 2 - a.top - a.height / 2
    const along = vx * dx + vy * dy
    if (along <= 1) continue
    const score = along + (Math.abs(vx * dy) + Math.abs(vy * dx)) * 2.5
    if (score < least) { least = score; best = other }
  }
  return best
}

function useFactsOf(props: SheetPosterProps) {
  const { laidOut, coverageAt, lens, sheet, appsIn, t } = props
  const named = useRef(props.nameOf)
  named.current = props.nameOf
  const typed = useRef(props.who)
  typed.current = props.who
  // What a tile says up close, worked out with the page: the zoom is not an input to it.
  return useMemo(() => {
    const facts = new Map<ElementId, Facts>()
    const labels = new Set(sheet?.labels ?? [])
    const ofOne = (element: DesignElement) => {
      const held = coverageAt(element.id)
      const unit = held.assignedTo.map((one) => named.current(one)).join(', ')
      const units = typed.current?.units(element.id) ?? []
      const showsLabel = lens === 'who' || labels.has(element.id)
      const handed = element.scopes?.[0]
      const via = handed !== undefined ? (appsIn?.(handed) ?? []).map((one) => one.name).join(', ') : ''
      facts.set(element.id, {
        apps: held.supportedBy.map((one) => named.current(one)).join(', '),
        unit, via,
        ...(showsLabel ? { label: unit || t('sheet.lens.who.nobody'), labelTyped: unit !== '' && units.length === 0 && typed.current !== undefined, labelNone: unit === '' } : {}),
      })
    }
    for (const area of laidOut.areas) {
      ofOne(area.element)
      for (const grouping of area.groupings) {
        ofOne(grouping.element)
        grouping.capabilities.forEach((one) => ofOne(one.element))
      }
      area.capabilities.forEach((one) => ofOne(one.element))
    }
    return facts
    // `who` and the namer move with the same rows as the coverage; the zoom moves none of these.
  }, [laidOut, coverageAt, lens, sheet?.labels, appsIn, t])
}

const EMPTY_ITEMS: readonly PosterItemRecord[] = []

/** How long blocks found for a person stay marked. */
const FLASH_MS = 1600

/** Attributes, not a render of every tile: what is lit, quieted and picked comes and goes often. */
function useTileMarks(stage: { current: HTMLDivElement | null }, marks: { selectedId: ElementId | undefined; only: string | undefined; lit: ReadonlySet<ElementId> | undefined; picked: ReadonlySet<ElementId> | undefined }, drawn: unknown) {
  const { selectedId, only, lit, picked } = marks
  useEffect(() => {
    if (selectedId === undefined) return undefined
    const on = stage.current?.querySelector(locatedSelector(selectedId))
    on?.setAttribute('aria-current', 'true')
    return () => on?.removeAttribute('aria-current')
  }, [selectedId, stage, drawn])
  useEffect(() => {
    const on = stage.current
    if (!on) return
    for (const tile of on.querySelectorAll<HTMLElement>('.poster-tile')) tile.toggleAttribute('data-quiet', only !== undefined && tile.dataset.value !== only)
  }, [only, stage, drawn])
  useEffect(() => {
    const on = stage.current
    if (!on) return
    if (lit) on.dataset.finding = ''
    else delete on.dataset.finding
    for (const held of on.querySelectorAll<HTMLElement>('[data-element-id], [data-item-id]')) {
      held.toggleAttribute('data-hit', lit?.has(held.dataset.elementId ?? held.dataset.itemId ?? '') ?? false)
    }
  }, [lit, stage, drawn])
  useEffect(() => {
    const on = stage.current
    if (!on) return
    for (const tile of on.querySelectorAll<HTMLElement>('.poster-tile')) tile.toggleAttribute('data-picked', picked?.has(tile.dataset.elementId ?? '') ?? false)
  }, [picked, stage, drawn])
}

export function SheetPoster(props: SheetPosterProps) {
  const { laidOut, sheet, lens, valueOf, selectedId, onSelect, strip, only, lit, who, ownerLabel, domainName, domainKnown, day, design, handle, dockExtra, t } = props
  const places = useMemo(() => posterPlaces(laidOut, sheet ?? {}), [laidOut, sheet])
  const items = sheet?.poster?.items ?? EMPTY_ITEMS
  const itemPlaces = sheet?.geometry?.items
  const itemPlace = useMemo(() => new Map((itemPlaces ?? []).map((one) => [one.id, one])), [itemPlaces])
  const page = useMemo(() => {
    const rects: { x: number; y: number; width: number; height: number }[] = [...places.blocks, ...places.waiting, ...(itemPlaces ?? [])]
    return {
      width: Math.max(places.width, ...rects.map((one) => one.x + one.width)),
      height: Math.max(places.height, ...rects.map((one) => one.y + one.height)),
    }
  }, [places, itemPlaces])
  const camera = usePosterCamera(page, sheet?.id)
  const { attach, stage, pane, panBy, open, follow, target, listen } = camera
  const pan = usePan(pane, panBy)
  const dragged = useRef(false)
  // Once a page: a change to the sheet does not take the reader's place away.
  useLayoutEffect(open, [open])

  const factsOf = useFactsOf(props)
  const tile = sheet?.poster?.tile ?? 'm'
  const cellsList = sheet?.geometry?.cells
  const labelsList = sheet?.labels
  const drawing: Drawing = useMemo(() => ({
    lens, valueOf, factsOf, who, ownerLabel, domainName, domainKnown, day, tile, design, t,
    cells: new Map((cellsList ?? []).map((cell) => [cell.id, cell])),
    labels: new Set(labelsList ?? []),
  }), [lens, valueOf, factsOf, who, ownerLabel, domainName, domainKnown, day, tile, design, t, cellsList, labelsList])
  useTileMarks(stage, { selectedId, only, lit, picked: design?.picked }, drawing)

  const areaById = useMemo(() => new Map(laidOut.areas.map((area) => [area.element.id, area])), [laidOut])
  const parties = useMemo(() => laidOut.actors.filter((actor) => actor.group === 'parties'), [laidOut])
  const spans = sheet?.areaSpans
  const blocks = useMemo(() => {
    const things: ({ x: number; y: number; node: ReactNode })[] = [...places.blocks, ...places.waiting].map((block) => {
      if (block.id === POSTER_COLUMN_ID) return { ...block, node: <Column key={block.id} actors={parties} block={block} kept={design?.keptOnRail} drawing={drawing} /> }
      if (laidOut.journey?.element.id === block.id) return { ...block, node: <Band key={block.id} journey={laidOut.journey} block={block} rows={places.bandRows} drawing={drawing} /> }
      const area = areaById.get(block.id)
      return { ...block, node: area ? <AreaBlock key={block.id} area={area} block={block} drawing={drawing} span={spans?.[area.element.id]} /> : null }
    })
    for (const item of items) {
      const at: PosterItemPlace | undefined = itemPlace.get(item.id)
      if (at) things.push({ ...at, node: <PosterItem key={item.id} item={item} at={at} design={design} t={t} /> })
    }
    return readingOrder(things).map((thing) => thing.node)
  }, [places, laidOut.journey, parties, areaById, drawing, spans, items, itemPlace, design, t])

  const say = useRef<HTMLDivElement | null>(null)
  const sayTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // A word's moment: it goes by itself, and a screen reader has had it by then.
  const telling = useCallback((words: string) => {
    if (say.current) say.current.textContent = words
    clearTimeout(sayTimer.current)
    sayTimer.current = setTimeout(() => { if (say.current) say.current.textContent = '' }, SAY_MS)
  }, [])
  useEffect(() => () => clearTimeout(sayTimer.current), [])
  const gestures = usePosterGestures({ design, camera, places, sheet, laidOut, say: telling, t })

  useImperativeHandle(handle, () => ({
    bringOn(id) {
      // A capability under a capability has no tile: its parent's is where it is.
      const on = stage.current?.querySelector(locatedSelector(id)) ?? stage.current?.querySelector(`[data-item-id="${CSS.escape(id)}"]`)
      if (on) follow(on, true)
    },
    focus(id) {
      const on = stage.current?.querySelector<HTMLElement>(locatedSelector(id))
      on?.focus({ preventScroll: true })
    },
    page() {
      const node = stage.current
      return node ? { node, ...page } : undefined
    },
    say: telling,
    flash(ids) {
      const found = ids.flatMap((id) => [...(stage.current?.querySelectorAll<HTMLElement>(`[data-block="${CSS.escape(id)}"]`) ?? [])])
      if (found[0]) follow(found[0], true)
      for (const one of found) one.setAttribute('data-flash', '')
      setTimeout(() => { for (const one of found) one.removeAttribute('data-flash') }, FLASH_MS)
    },
    centre() {
      const held = pane.current
      const { x, y, zoom } = camera.camera.current
      return { x: Math.round(((held?.clientWidth ?? 0) / 2 - x) / zoom), y: Math.round(((held?.clientHeight ?? 0) / 2 - y) / zoom) }
    },
  }), [stage, pane, camera, follow, page, telling])

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (gestures.onKeyDown(event)) return
    const way = ARROWS[event.key]
    const from = (event.target as Element).closest<HTMLElement>(ROUTE)
    if (!way || !from || !stage.current) return
    const next = nextThatWay(stage.current, from, way)
    if (!next) return
    event.preventDefault()
    next.tabIndex = 0
    next.focus({ preventScroll: true })
    follow(next)
  }
  // A stop is the block's first: a tile an arrow reached is a stop only while it has the keyboard.
  const onBlur = (event: ReactFocusEvent<HTMLDivElement>) => {
    const was = event.target as HTMLElement
    if (was.matches('.poster-tile, .poster-grouping__name, .poster-band__phase, .poster-person, .poster-add button, .poster-adds button')) was.tabIndex = -1
  }

  const [unitMenu, setUnitMenu] = useState<{ anchor: HTMLElement; id: ElementId } | undefined>(undefined)
  const unitTargetsNow = unitMenu && who ? unitTargets(who.units(unitMenu.id), who.open, t) : []

  return (
    <div className="poster" data-testid="sheet-poster" data-guide="sheet.poster">
      <div
        ref={attach} className="poster__pane" role="group" aria-label={t('sheet.reading.poster')} tabIndex={-1} data-testid="poster-pane" data-posture={design ? 'design' : 'read'}
        onPointerDown={(event) => { if (!gestures.onPointerDown(event)) pan.onPointerDown(event) }}
        onPointerMove={(event) => { if (!gestures.onPointerMove(event)) pan.onPointerMove(event) }}
        onPointerUp={(event) => {
          const done = gestures.onPointerUp(event)
          dragged.current = done !== undefined ? done : pan.onPointerUp(event) === true
        }}
        onKeyDown={onKeyDown} onBlur={onBlur}
        onClick={(event) => {
          if (dragged.current) { dragged.current = false; return }
          const element = event.target as Element
          if (element.closest('[data-sheet-add], .sheet-unit')) return
          const label = element.closest<HTMLElement>('[data-tile-label]')
          if (label && who && who.units(label.dataset.tileLabel ?? '').length > 0) {
            const id = label.dataset.tileLabel ?? ''
            const targets = unitTargets(who.units(id), who.open, t)
            if (targets.length === 1) { targets[0].go(); return }
            if (targets.length > 1) { setUnitMenu({ anchor: label, id }); return }
          }
          const id = element.closest<HTMLElement>('[data-element-id]')?.dataset.elementId
          if (design?.onPress(id, event.shiftKey || event.metaKey)) return
          onSelect(id)
        }}
      >
        <div ref={stage} className="poster__stage" data-testid="poster-stage" data-lens={lens?.startsWith('aspect:') ? 'aspect' : lens} data-tile={tile} style={{ width: page.width, height: page.height }}>
          {blocks}
        </div>
        <div className="poster__say" ref={say} role="status" aria-live="polite" data-testid="poster-say" />
      </div>
      <div className="poster__strip">
        <Dock listen={listen} onGo={(how) => target.go(how)} extra={dockExtra} />
        {strip}
      </div>
      <Menu
        open={unitMenu !== undefined} anchorEl={unitMenu?.anchor ?? null} label={t('sheet.lens.who')} onClose={() => setUnitMenu(undefined)}
        items={unitTargetsNow.map((one) => ({ label: one.note ? `${one.label} · ${one.note}` : one.label, onSelect: one.go }))}
      />
    </div>
  )
}

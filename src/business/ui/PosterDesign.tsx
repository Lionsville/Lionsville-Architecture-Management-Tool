// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Placing a poster by hand (ADR-0048). The page stays plain DOM: a gesture writes
 * straight to the block it holds while it moves, and one command when it lands, so a
 * drag is one step and a move renders nothing on the way.
 *
 * A block snaps to eight units, and to a neighbour's edge within six pixels on
 * screen with a line where it aligns; Alt lets go of the grid. A tile dropped in its
 * own block takes a cell and the others flow round it; dropped on another block it
 * moves there, in the model, on every view, with the panel's own refusals. Everything
 * here has a way for the keyboard: Space lifts a block, the arrows move it a grid step,
 * ⇧ resizes, Alt steps a unit, Space drops and Esc puts it back.
 */
import { useCallback, useRef } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import type { DomainGroupRect, ElementId, NodeGeometry, PosterCell, PosterItem as PosterItemRecord, PosterItemPlace } from '../../model'
import type { Translate } from '../../i18n'
import { plural } from '../../i18n/strings'
import { Button } from '../../widgets/kit/Button'
import { POSTER_COLUMN_ID, POSTER_TILE, POSTER_TILES, overlapsOf } from '../posterLayout'
import type { PosterBlock } from '../posterLayout'
import { posterBlockFloor } from '../posterPlaces'
import type { PosterPlaces, PosterSheet } from '../posterPlaces'
import type { LaidOutSheet } from '../sheet'
import { locatedSelector } from '../../widgets/useLocated'
import type { PosterCamera } from './posterCamera'
import { chordHeld, claimKey } from '../../widgets/kit/keys'

/** What placing and mapping on a poster writes. Each is one step. */
export type PosterActions = {
  place(blocks: readonly NodeGeometry[], boxes: readonly DomainGroupRect[]): void
  firstLayout(): void
  resetTiles(): void
  /** A tile in a cell, or flowing again; `freeing` is a tile that had that cell, and flows now. */
  cell(id: ElementId, cell: Omit<PosterCell, 'id'> | undefined, freeing?: ElementId): void
  /** The same `assigned` rows as the panel's, and the label on this view. Answers the team's id. */
  team(ids: readonly ElementId[], team: { id: ElementId } | { name: string }): ElementId | undefined
  showLabel(id: ElementId, on: boolean): void
  cover(ids: readonly ElementId[], applicationId: ElementId): void
  hand(ids: readonly ElementId[], scope: string): void
  addItem(item: Omit<PosterItemRecord, 'id'>, at: Omit<PosterItemPlace, 'id'>): string | undefined
  updateItem(id: string, patch: Partial<Omit<PosterItemRecord, 'id'>>): void
  placeItem(place: PosterItemPlace): void
  removeItem(id: string): void
  undo(): void
  redo(): void
}

/** What Design hands the page while it is up. */
export type PosterDesign = {
  actions: PosterActions
  /** Why this tile may not sit under that one, in the panel's words; nothing when it may. */
  refusal(id: ElementId, to: ElementId): string | undefined
  /** The same action as the panel's parent field. */
  moveTile(id: ElementId, to: ElementId): void
  /** A press on the page: whether it took it, for several picked or a tray's drop. */
  onPress(id: ElementId | undefined, adding: boolean): boolean
  /** A box drawn with ⇧: what it holds. */
  onBox(ids: readonly ElementId[]): void
  picked: ReadonlySet<ElementId>
  keptOnRail?: ReadonlySet<ElementId> | undefined
  /** L or A on a tile: the tray's list, at the tile. */
  onPick(kind: 'team' | 'application', id: ElementId, anchor: HTMLElement): void
  addUnder(id: ElementId, what: 'capability' | 'grouping'): void
  addStep(phaseId: ElementId, lane: ElementId | undefined): void
  addPhase(journeyId: ElementId): void
  addLane(): void
  addStakeholder(groupId: ElementId): void
  addGroup(): void
  chooseIcon(id: ElementId): void
  /** The words a name is said by, for what is said aloud. */
  nameOf(id: string): string
}

const GRID = 8
const SNAP_PX = 6
const LEAST_WIDTH = 120
const LEAST_HEIGHT = 40
const MOVED_PX = 4

type Rect = { x: number; y: number; width: number; height: number }

type Gesture = {
  kind: 'block' | 'resize' | 'tile' | 'box'
  id: string
  element: HTMLElement
  /** Where it began, in units on the page. */
  at: { x: number; y: number }
  rect: Rect
  now: Rect
  moved: boolean
  target?: HTMLElement | undefined
  box?: HTMLElement | undefined
}

/** The block or grouping under a point, for a tile or a tray's item. */
export function dropTargetAt(x: number, y: number): HTMLElement | undefined {
  const under = document.elementsFromPoint?.(x, y) ?? []
  for (const element of under) {
    const target = element.closest<HTMLElement>('[data-drop]')
    if (target) return target
  }
  return undefined
}

export function tileAt(x: number, y: number): HTMLElement | undefined {
  const under = document.elementsFromPoint?.(x, y) ?? []
  for (const element of under) {
    const tile = element.closest<HTMLElement>('.poster-tile')
    if (tile) return tile
  }
  return undefined
}

const edgesOf = (rect: Rect, along: 'x' | 'y') => (along === 'x' ? [rect.x, rect.x + rect.width] : [rect.y, rect.y + rect.height])

/** The nearest neighbour's edge in reach, or nothing. */
function snapped(value: number, edges: readonly number[], reach: number): number | undefined {
  let best: number | undefined
  let least = reach
  for (const edge of edges) {
    const off = Math.abs(edge - value)
    if (off < least) { least = off; best = edge }
  }
  return best
}

function writeRect(element: HTMLElement, rect: Rect) {
  element.style.left = `${rect.x}px`
  element.style.top = `${rect.y}px`
  element.style.width = `${rect.width}px`
  element.style.minHeight = `${rect.height}px`
  if (element.dataset.itemId !== undefined) element.style.height = `${rect.height}px`
}

/** Where a block lands that was asked to be somewhere, with the line where it aligns. */
function useSnapping(camera: PosterCamera, places: PosterPlaces, sheet: PosterSheet | undefined, laidOut: LaidOutSheet) {
  const others = (id: string): Rect[] => [
    ...[...places.blocks, ...places.waiting].filter((block) => block.id !== id),
    ...(sheet?.geometry?.items ?? []).filter((item) => item.id !== id),
  ]

  const guides = () => camera.stage.current?.querySelectorAll('.poster-guide').forEach((line) => line.remove())
  const guide = (along: 'x' | 'y', at: number) => {
    const line = document.createElement('div')
    line.className = 'poster-guide'
    line.dataset.along = along
    line.style.setProperty(along === 'x' ? 'left' : 'top', `${at}px`)
    camera.stage.current?.append(line)
  }

  /** Where a block lands that was asked to be here: on a neighbour's edge in reach, else on the grid. */
  const landed = (id: string, wanted: Rect, free: boolean): Rect => {
    guides()
    const reach = SNAP_PX / camera.camera.current.zoom
    const near = others(id)
    const place = (along: 'x' | 'y', size: number): number => {
      const edges = near.flatMap((one) => edgesOf(one, along))
      const value = wanted[along]
      const front = snapped(value, edges, reach)
      if (front !== undefined) { guide(along, front); return front }
      const back = snapped(value + size, edges, reach)
      if (back !== undefined) { guide(along, back); return back - size }
      return free ? Math.round(value) : Math.round(value / GRID) * GRID
    }
    return { ...wanted, x: place('x', wanted.width), y: place('y', wanted.height) }
  }

  const pulled = (id: string, wanted: Rect, free: boolean): Rect => {
    guides()
    const reach = SNAP_PX / camera.camera.current.zoom
    const near = others(id)
    const size = (along: 'x' | 'y', value: number, start: number): number => {
      const hit = snapped(start + value, near.flatMap((one) => edgesOf(one, along)), reach)
      if (hit !== undefined) { guide(along, hit); return hit - start }
      return free ? Math.round(value) : Math.round(value / GRID) * GRID
    }
    const width = Math.max(LEAST_WIDTH, size('x', wanted.width, wanted.x))
    const floor = sheet ? posterBlockFloor(laidOut, sheet, id, width) : LEAST_HEIGHT
    return { ...wanted, width, height: Math.max(floor, size('y', wanted.height, wanted.y)) }
  }

  return { guides, landed, pulled }
}

/** A tile let go: a cell in its own block, or a move to another, with the panel's refusals. */
function dropTile(held: Gesture, event: { clientX: number; clientY: number }, at: { design: PosterDesign; camera: PosterCamera; sheet: PosterSheet | undefined; say(words: string): void; t: Translate }) {
  const { design, camera, sheet, say, t } = at
  const id = held.id
  delete held.target?.dataset.over
  const home = held.element.closest<HTMLElement>('[data-drop]')
  const over = dropTargetAt(event.clientX, event.clientY)
  const to = over?.dataset.drop
  if (!over || !to) return
  // A loose tile's home is the area, and so is a press on the area around a grouping.
  if (to !== home?.dataset.drop) {
    const refused = design.refusal(id, to)
    if (refused) { say(refused); return }
    design.moveTile(id, to)
    say(t('sheet.poster.tileMoved', { name: design.nameOf(id), to: design.nameOf(to) }))
    return
  }
  const flow = held.element.closest<HTMLElement>('.poster-flow')
  if (!flow) return
  const frame = flow.getBoundingClientRect()
  const { zoom } = camera.camera.current
  const tile = POSTER_TILES[sheet?.poster?.tile ?? 'm']
  const widths = flow.querySelector('.poster-tile')?.getBoundingClientRect().width ?? tile.width * zoom
  const col = Math.max(0, Math.floor((event.clientX - frame.left) / (widths + POSTER_TILE.gap * zoom)))
  const row = Math.max(0, Math.floor((event.clientY - frame.top) / ((tile.height + POSTER_TILE.gap) * zoom)))
  const freeing = sheet?.geometry?.cells?.find((cell) => cell.id !== id && cell.col === col && cell.row === row && flow.querySelector(locatedSelector(cell.id)))
  design.actions.cell(id, { col, row }, freeing?.id)
  say(t('sheet.poster.tilePlaced', { name: design.nameOf(id) }))
}

/** The keyboard's way to everything a drag does: a block lifted, moved and dropped, a tile's pickers. */
function useLift({ design, camera, say, t, commit, rectOf }: {
  design: PosterDesign | undefined
  camera: PosterCamera
  say(words: string): void
  t: Translate
  commit(id: string, rect: Rect): void
  rectOf(id: string): Rect | undefined
}) {
  const lifted = useRef<{ id: string; element: HTMLElement; was: Rect; now: Rect } | undefined>(undefined)
  return (event: ReactKeyboardEvent<HTMLDivElement>): boolean => {
    if (!design) return false
    const element = event.target as HTMLElement
    if (element.closest('textarea, input')) return false
    const held = lifted.current
    if (held) {
      if (event.key === ' ') {
        event.preventDefault()
        lifted.current = undefined
        delete held.element.dataset.moving
        commit(held.id, held.now)
        say(t('sheet.poster.dropped', { name: design.nameOf(held.id), x: held.now.x, y: held.now.y }))
        return true
      }
      if (event.key === 'Escape') {
        claimKey(event)
        lifted.current = undefined
        delete held.element.dataset.moving
        writeRect(held.element, held.was)
        say(t('sheet.poster.putBack', { name: design.nameOf(held.id) }))
        return true
      }
      const way = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]
      if (way) {
        event.preventDefault()
        const by = event.altKey ? 1 : GRID
        const now = event.shiftKey
          ? { ...held.now, width: Math.max(LEAST_WIDTH, held.now.width + way[0] * by), height: Math.max(LEAST_HEIGHT, held.now.height + way[1] * by) }
          : { ...held.now, x: held.now.x + way[0] * by, y: held.now.y + way[1] * by }
        held.now = now
        writeRect(held.element, now)
        camera.follow(held.element)
        say(event.shiftKey
          ? t('sheet.poster.nowSized', { width: now.width, height: now.height })
          : t('sheet.poster.nowAt', { x: now.x, y: now.y }))
        return true
      }
      return true
    }
    const tile = element.closest<HTMLElement>('.poster-tile')
    if (tile) {
      const key = event.key.toLowerCase()
      if ((key === 'l' || key === 'a') && !chordHeld(event) && tile.dataset.elementId) {
        event.preventDefault()
        design.onPick(key === 'l' ? 'team' : 'application', tile.dataset.elementId, tile)
        return true
      }
      return false
    }
    const block = element.closest<HTMLElement>('[data-block], [data-item-id]')
    if (block && event.key === ' ') {
      const id = block.dataset.block ?? block.dataset.itemId ?? ''
      const rect = rectOf(id)
      if (!rect) return false
      event.preventDefault()
      lifted.current = { id, element: block, was: rect, now: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } }
      block.dataset.moving = ''
      say(t('sheet.poster.lifted', { name: design.nameOf(id) }))
      return true
    }
    return false
  }
}

export function usePosterGestures(args: {
  design: PosterDesign | undefined
  camera: PosterCamera
  places: PosterPlaces
  sheet: PosterSheet | undefined
  laidOut: LaidOutSheet
  say(words: string): void
  t: Translate
}) {
  const { design, camera, places, sheet, laidOut, say, t } = args
  const gesture = useRef<Gesture | undefined>(undefined)

  const unitsAt = useCallback((event: { clientX: number; clientY: number }) => {
    const frame = camera.pane.current?.getBoundingClientRect()
    const { x, y, zoom } = camera.camera.current
    return { x: (event.clientX - (frame?.left ?? 0) - x) / zoom, y: (event.clientY - (frame?.top ?? 0) - y) / zoom }
  }, [camera])

  const { guides, landed, pulled } = useSnapping(camera, places, sheet, laidOut)

  /** A block's place written: every block with it the first time, so the poster stops following the first layout at once. */
  const commit = (id: string, rect: Rect) => {
    if (!design) return
    if (sheet?.geometry?.items?.some((item) => item.id === id)) {
      design.actions.placeItem({ id, ...rect })
      return
    }
    const all = [...places.blocks, ...places.waiting]
    const landing: PosterBlock[] = (places.placed ? all.filter((block) => block.id === id) : all).map((block) => (block.id === id ? { ...block, ...rect, id } : block))
    design.actions.place(
      landing.filter((block) => block.id !== POSTER_COLUMN_ID),
      landing.filter((block) => block.id === POSTER_COLUMN_ID),
    )
  }

  const rectOf = (id: string): Rect | undefined => {
    const block = [...places.blocks, ...places.waiting].find((one) => one.id === id)
    return block ?? sheet?.geometry?.items?.find((item) => item.id === id)
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>): boolean => {
    if (!design || event.button !== 0) return false
    const element = event.target as HTMLElement
    if (element.closest('[data-sheet-add], textarea, input')) return true
    const at = unitsAt(event)
    const tile = element.closest<HTMLElement>('.poster-tile')
    if (tile) {
      const rect = { x: 0, y: 0, width: tile.offsetWidth, height: tile.offsetHeight }
      gesture.current = { kind: 'tile', id: tile.dataset.elementId ?? '', element: tile, at, rect, now: rect, moved: false }
      return true
    }
    const block = element.closest<HTMLElement>('[data-block], [data-item-id]')
    if (block && !element.closest('.sheet-unit')) {
      const id = block.dataset.block ?? block.dataset.itemId ?? ''
      const rect = rectOf(id)
      if (!rect) return false
      gesture.current = { kind: element.closest('[data-resize]') ? 'resize' : 'block', id, element: block, at, rect, now: rect, moved: false }
      return true
    }
    if (event.shiftKey) {
      const rect = { ...at, width: 0, height: 0 }
      gesture.current = { kind: 'box', id: '', element, at, rect, now: rect, moved: false }
      return true
    }
    return false
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>): boolean => {
    const held = gesture.current
    if (!held) return false
    const at = unitsAt(event)
    const [dx, dy] = [at.x - held.at.x, at.y - held.at.y]
    if (!held.moved) {
      if (Math.hypot(dx, dy) * camera.camera.current.zoom < MOVED_PX) return true
      held.moved = true
      event.currentTarget.setPointerCapture(event.pointerId)
      if (held.kind !== 'box') held.element.dataset.moving = ''
    }
    const free = event.altKey
    if (held.kind === 'block') {
      held.now = landed(held.id, { ...held.rect, x: held.rect.x + dx, y: held.rect.y + dy }, free)
      writeRect(held.element, held.now)
    } else if (held.kind === 'resize') {
      held.now = pulled(held.id, { ...held.rect, width: held.rect.width + dx, height: held.rect.height + dy }, free)
      writeRect(held.element, held.now)
    } else if (held.kind === 'tile') {
      held.element.style.transform = `translate(${dx}px, ${dy}px)`
      const over = dropTargetAt(event.clientX, event.clientY)
      if (held.target !== over) {
        delete held.target?.dataset.over
        held.target = over
        if (over && over.dataset.drop !== held.element.closest<HTMLElement>('[data-drop]')?.dataset.drop) over.dataset.over = ''
      }
    } else {
      held.box ??= (() => {
        const box = document.createElement('div')
        box.className = 'poster-box'
        camera.stage.current?.append(box)
        return box
      })()
      held.now = { x: Math.min(held.at.x, at.x), y: Math.min(held.at.y, at.y), width: Math.abs(dx), height: Math.abs(dy) }
      writeRect(held.box, held.now)
      held.box.style.height = `${held.now.height}px`
    }
    return true
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>): boolean | undefined => {
    const held = gesture.current
    if (!held) return undefined
    gesture.current = undefined
    delete held.element.dataset.moving
    guides()
    if (!held.moved) return false
    if (held.kind === 'tile') {
      held.element.style.transform = ''
      if (design) dropTile(held, event, { design, camera, sheet, say, t })
    } else if (held.kind === 'box') {
      const stage = camera.stage.current
      const frame = held.box?.getBoundingClientRect()
      held.box?.remove()
      if (stage && frame && design) {
        const inside: ElementId[] = []
        for (const tile of stage.querySelectorAll<HTMLElement>('.poster-tile')) {
          const box = tile.getBoundingClientRect()
          if (box.left < frame.right && frame.left < box.right && box.top < frame.bottom && frame.top < box.bottom && tile.dataset.elementId) inside.push(tile.dataset.elementId)
        }
        design.onBox(inside)
      }
    } else if (design) {
      commit(held.id, held.now)
      say(held.kind === 'resize'
        ? t('sheet.poster.blockResized', { name: design.nameOf(held.id), width: Math.round(held.now.width) })
        : t('sheet.poster.blockMoved', { name: design.nameOf(held.id) }))
    }
    return true
  }

  const onKeyDown = useLift({ design, camera, say, t, commit, rectOf })

  return { onPointerDown, onPointerMove, onPointerUp, onKeyDown }
}

/** The acts of Design, in the strip: undo, the layouts, the free items, and what the page should know. */
export function DesignBar({ actions, places, onPaperLayout, onAddArea, fromAbove, onNote, onPicture, t }: {
  actions: PosterActions
  places: PosterPlaces
  onPaperLayout(): void
  onAddArea(): void
  fromAbove?: ReactNode
  onNote(): void
  onPicture(): void
  t: Translate
}) {
  const overlaps = overlapsOf(places.blocks).length
  return (
    <div className="poster-bar" role="toolbar" aria-label={t('sheet.poster.design')} data-testid="poster-design-bar">
      <Button variant="quiet" size="small" onClick={actions.undo}>{t('sheet.poster.undo')}</Button>
      <Button variant="quiet" size="small" onClick={actions.redo}>{t('sheet.poster.redo')}</Button>
      <span className="kit-dock__rule" />
      <Button variant="quiet" size="small" onClick={actions.firstLayout} data-testid="poster-first-layout">{t('sheet.poster.firstLayout')}</Button>
      <Button variant="quiet" size="small" onClick={actions.resetTiles}>{t('sheet.poster.resetTiles')}</Button>
      <Button variant="quiet" size="small" onClick={onPaperLayout}>{t('sheet.poster.paperLayout')}</Button>
      <span className="kit-dock__rule" />
      <Button variant="quiet" size="small" onClick={onAddArea}>{t('sheet.addArea')}</Button>
      {fromAbove}
      <Button variant="quiet" size="small" onClick={onNote} data-testid="poster-add-note">{t('sheet.poster.addNote')}</Button>
      <Button variant="quiet" size="small" onClick={onPicture}>{t('sheet.poster.addPicture')}</Button>
      {overlaps > 0 && <span className="poster-bar__warn" data-testid="poster-overlaps">{plural(t, { one: 'sheet.poster.overlapOne', other: 'sheet.poster.overlapOther' }, overlaps)}</span>}
      {places.waiting.length > 0 && <span className="poster-bar__warn" data-testid="poster-waiting">{plural(t, { one: 'sheet.poster.waitingOne', other: 'sheet.poster.waitingOther' }, places.waiting.length)}</span>}
    </div>
  )
}

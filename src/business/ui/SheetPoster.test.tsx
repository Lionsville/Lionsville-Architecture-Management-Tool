// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV
// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Profiler } from 'react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LanguageProvider } from '../../i18n/LanguageContext'
import type { DesignElement } from '../../model'
import { DEFAULT_LENS, lensValue } from '../lens'
import { coverageOf } from '../coverage'
import { sheetPage } from '../sheet'
import { area, capability, grouping, journey, phase, relation, application } from '../testFixtures'
import { heldInView, openingCamera, SheetPoster } from './SheetPoster'
import type { SheetPosterProps } from './SheetPoster'
import type { PosterActions, PosterDesign } from './PosterDesign'
import { axeFindings } from '../../app/testing/axe'

afterEach(cleanup)

const elements: DesignElement[] = [
  area('a', 'Area one'), capability('t1', 'Tile one', 'a'), capability('t2', 'Tile two', 'a'),
  area('b', 'Area two'), grouping('g', 'A grouping', 'b'), capability('t3', 'Tile three', 'g'),
  journey('j', 'A journey'), phase('p', 'A phase', 'j'), phase('s', 'A step', 'p'),
  application('app', 'An application'),
]
const relations = [relation('r', 'supports', 'app', 't1')]

function Poster({ selectedId, onSelect = () => {}, ...more }: { selectedId?: string; onSelect?(id: string | undefined): void } & Partial<Omit<SheetPosterProps, 'onSelect' | 'selectedId' | 'valueOf'>>) {
  const laidOut = more.laidOut ?? sheetPage({ elements, relations }, { journeyId: 'j', areas: ['a', 'b'], showActors: true })
  const covering = coverageOf(relations)
  const none = { supportedBy: [], assignedTo: [], coverage: 'uncovered' as const }
  const coverageAt = (id: string) => covering.get(id) ?? none
  return (
    <SheetPoster
      laidOut={laidOut} lens={DEFAULT_LENS} coverageAt={coverageAt} nameOf={(id) => elements.find((one) => one.id === id)?.name ?? id}
      valueOf={(element) => lensValue(element, DEFAULT_LENS, { coverage: coverageAt, retiring: () => false })}
      selectedId={selectedId} onSelect={onSelect} t={(key) => key} {...more}
    />
  )
}

const inLanguage = (node: ReactNode) => render(<LanguageProvider language="en">{node}</LanguageProvider>)

describe('the poster', () => {
  it('draws every tile, whatever is on screen: Find, a print and a screen reader need them there', () => {
    inLanguage(<Poster />)
    for (const id of ['t1', 't2', 't3']) expect(screen.getByTestId(`poster-tile-${id}`)).toBeTruthy()
    expect(screen.getByRole('button', { name: /A step/ })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Area one' })).toBeTruthy()
  })

  it('does not render a tile on a zoom: the camera and the distance are written to the element', () => {
    const commits = vi.fn()
    inLanguage(<Profiler id="poster" onRender={commits}><Poster /></Profiler>)
    const stage = screen.getByTestId('poster-stage')
    const tile = screen.getByTestId('poster-tile-t1')
    const before = stage.style.transform
    commits.mockClear()
    act(() => { fireEvent.click(screen.getByTestId('zoom-in')) })
    expect(stage.style.transform).not.toBe(before)
    // The dock's number renders, on its own: one commit, and much the smallest part of the tree.
    expect(commits.mock.calls.length).toBeLessThanOrEqual(1)
    expect(screen.getByTestId('poster-tile-t1')).toBe(tile)
    act(() => { for (let i = 0; i < 4; i++) fireEvent.click(screen.getByTestId('zoom-in')) })
    expect(stage.dataset.distance).toBe('near')
    act(() => { fireEvent.click(screen.getByTestId('zoom-fit')) })
    for (let i = 0; i < 12; i++) act(() => { fireEvent.click(screen.getByTestId('zoom-out')) })
    expect(stage.dataset.distance).toBe('far')
    expect(stage.style.getPropertyValue('--canvas-zoom')).toBe('0.2')
  })

  it('stops at 20% and 300%', () => {
    inLanguage(<Poster />)
    const stage = screen.getByTestId('poster-stage')
    for (let i = 0; i < 20; i++) act(() => { fireEvent.click(screen.getByTestId('zoom-out')) })
    expect(stage.style.transform).toContain('scale(0.2)')
    for (let i = 0; i < 20; i++) act(() => { fireEvent.click(screen.getByTestId('zoom-in')) })
    expect(stage.style.transform).toContain('scale(3)')
  })

  it('opens a press on a tile, and marks the one selected without a render', () => {
    const onSelect = vi.fn()
    const { rerender } = inLanguage(<Poster onSelect={onSelect} />)
    fireEvent.click(screen.getByTestId('poster-tile-t2'))
    expect(onSelect).toHaveBeenCalledWith('t2')
    const tile = screen.getByTestId('poster-tile-t2')
    rerender(<LanguageProvider language="en"><Poster onSelect={onSelect} selectedId="t2" /></LanguageProvider>)
    expect(tile.getAttribute('aria-current')).toBe('true')
    rerender(<LanguageProvider language="en"><Poster onSelect={onSelect} /></LanguageProvider>)
    expect(tile.getAttribute('aria-current')).toBeNull()
  })

  it('does not take a drag for a press', () => {
    const onSelect = vi.fn()
    inLanguage(<Poster onSelect={onSelect} />)
    const pane = screen.getByTestId('poster-pane')
    const tile = screen.getByTestId('poster-tile-t2')
    pane.setPointerCapture = () => {}
    fireEvent.pointerDown(tile, { clientX: 10, clientY: 10, pointerId: 1 })
    fireEvent.pointerMove(tile, { clientX: 60, clientY: 40, pointerId: 1 })
    fireEvent.pointerUp(tile, { clientX: 60, clientY: 40, pointerId: 1 })
    fireEvent.click(tile)
    expect(onSelect).not.toHaveBeenCalled()
  })
})

describe('where the poster opens', () => {
  const page = { width: 1860, height: 1000 }

  it('opens at Fit, centred, where Fit can be read', () => {
    const camera = openingCamera({ width: 2200, height: 1200 }, page)
    expect(camera.zoom).toBe(1)
    expect(camera.x).toBe((2200 - 1860) / 2)
  })

  it('opens at 90% from the top left where it cannot, with the rest a pan', () => {
    expect(openingCamera({ width: 1440, height: 700 }, page)).toEqual({ x: 8, y: 8, zoom: 0.9 })
  })
})

describe('panning', () => {
  it('stops short of losing the page, at any zoom', () => {
    const pane = { width: 1000, height: 600 }
    const page = { width: 1860, height: 1000 }
    expect(heldInView({ x: 5000, y: 5000, zoom: 1 }, pane, page)).toEqual({ x: 936, y: 536, zoom: 1 })
    expect(heldInView({ x: -9000, y: -9000, zoom: 2 }, pane, page)).toEqual({ x: 64 - 3720, y: 64 - 2000, zoom: 2 })
    expect(heldInView({ x: -10, y: 4, zoom: 1 }, pane, page)).toEqual({ x: -10, y: 4, zoom: 1 })
  })
})

const fakeDesign = (over: Partial<PosterDesign> = {}): PosterDesign => ({
  actions: { place: vi.fn(), firstLayout: vi.fn(), resetTiles: vi.fn(), cell: vi.fn(), team: vi.fn(), showLabel: vi.fn(), cover: vi.fn(), hand: vi.fn(), addItem: vi.fn(), updateItem: vi.fn(), placeItem: vi.fn(), removeItem: vi.fn(), undo: vi.fn(), redo: vi.fn() } as PosterActions,
  picked: new Set(), refusal: () => undefined, moveTile: vi.fn(), onPress: () => false, onBox: vi.fn(), onPick: vi.fn(), addUnder: vi.fn(), addStep: vi.fn(), addPhase: vi.fn(), addLane: vi.fn(),
  addStakeholder: vi.fn(), addGroup: vi.fn(), chooseIcon: vi.fn(), nameOf: (id) => id,
  ...over,
})

describe('reading a poster', () => {
  it('has a stop per block and the arrows for the rest, and nothing is placed by a drag in Read', async () => {
    inLanguage(<Poster />)
    const stops = [...screen.getByTestId('poster-stage').querySelectorAll('button[tabindex="0"]')]
    expect(stops.map((stop) => stop.textContent)).toEqual(['A step', 'Area one', 'Area two'].filter((name) => stops.some((held) => held.textContent === name)))
    expect(screen.getByTestId('poster-title-a').tabIndex).toBe(0)
    expect(screen.getByTestId('poster-tile-t1').tabIndex).toBe(-1)
    expect(document.querySelector('[data-sheet-add]')).toBeNull()
    expect(await axeFindings()).toEqual([])
  })

  it('draws the blocks in reading order, whatever order they were placed in', () => {
    const sheet = { geometry: { nodes: [{ id: 'b', x: 0, y: 0, width: 400, height: 200 }, { id: 'a', x: 0, y: 500, width: 400, height: 200 }, { id: 'j', x: 0, y: 300, width: 400, height: 112 }] } }
    inLanguage(<Poster sheet={sheet} />)
    const order = [...screen.getByTestId('poster-stage').querySelectorAll<HTMLElement>('[data-block]')].map((block) => block.dataset.block)
    expect(order).toEqual(['b', 'j', 'a'])
  })

  it('names a label a person placed on the tile, and nobody else', () => {
    const coverageAt = () => ({ supportedBy: [], assignedTo: ['app'], coverage: 'manual' as const })
    inLanguage(<Poster sheet={{ labels: ['t2'] }} coverageAt={coverageAt} />)
    expect(screen.getByTestId('poster-tile-t2').hasAttribute('data-labelled')).toBe(true)
    expect(screen.getByTestId('poster-tile-t2').textContent).toContain('An application')
    expect(screen.getByTestId('poster-tile-t1').hasAttribute('data-labelled')).toBe(false)
  })

  it('marks a hand-placed tile in its cell and lets the others flow', () => {
    inLanguage(<Poster sheet={{ geometry: { nodes: [], cells: [{ id: 't2', col: 2, row: 1 }] } }} />)
    const tile = screen.getByTestId('poster-tile-t2')
    expect(tile.style.gridColumn).toContain('3')
    expect(tile.style.gridRow).toContain('2')
    expect(screen.getByTestId('poster-tile-t1').style.gridColumn).toBe('')
  })

  it('dashes what is not there yet on the day read, and strikes through what is gone, and neither moves', () => {
    const dated: DesignElement[] = elements.map((one) => (one.id === 't1' ? { ...one, lifecycleDates: { live: '2030-01-01' } } : one.id === 't2' ? { ...one, lifecycleDates: { retired: '2020-01-01' } } : one))
    const laidOut = sheetPage({ elements: dated, relations }, { areas: ['a'], showActors: true })
    inLanguage(<Poster laidOut={laidOut} day="2026-01-01" />)
    expect(screen.getByTestId('poster-tile-t1').dataset.life).toBe('planned')
    expect(screen.getByTestId('poster-tile-t2').dataset.life).toBe('gone')
  })
})

describe('designing a poster', () => {
  const blockRect = { left: 0, top: 0 }

  it('offers nothing to place in Read, and its corners and adds in Design', () => {
    inLanguage(<Poster design={fakeDesign()} />)
    expect(screen.getByTestId('poster-pane').dataset.posture).toBe('design')
    expect(document.querySelectorAll('[data-sheet-add]').length).toBeGreaterThan(0)
  })

  it('writes every block on the first move, as one step, and only the one moved after that', () => {
    const design = fakeDesign()
    inLanguage(<Poster design={design} />)
    const pane = screen.getByTestId('poster-pane')
    pane.setPointerCapture = () => {}
    const title = screen.getByTestId('poster-title-a')
    fireEvent.pointerDown(title, { clientX: 10, clientY: 10, pointerId: 1, button: 0, ...blockRect })
    fireEvent.pointerMove(title, { clientX: 110, clientY: 90, pointerId: 1 })
    fireEvent.pointerUp(title, { clientX: 110, clientY: 90, pointerId: 1 })
    expect(design.actions.place).toHaveBeenCalledTimes(1)
    const [nodes] = vi.mocked(design.actions.place).mock.calls[0]
    expect(nodes.map((node) => node.id).sort()).toEqual(['a', 'b', 'j'])
    const moved = nodes.find((node) => node.id === 'a')
    expect((moved?.x ?? 0) % 8).toBe(0)
  })

  it('lifts a block by the keyboard, moves it a grid step, and puts it back on Escape with nothing written', () => {
    const design = fakeDesign()
    inLanguage(<Poster design={design} />)
    const title = screen.getByTestId('poster-title-a')
    fireEvent.keyDown(title, { key: ' ' })
    fireEvent.keyDown(title, { key: 'ArrowDown' })
    fireEvent.keyDown(title, { key: 'Escape' })
    expect(design.actions.place).not.toHaveBeenCalled()
    fireEvent.keyDown(title, { key: ' ' })
    fireEvent.keyDown(title, { key: 'ArrowDown' })
    fireEvent.keyDown(title, { key: ' ' })
    expect(design.actions.place).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('poster-say').textContent).toContain('sheet.poster.dropped')
  })

  it('offers a tile the tray at the tile, by L and by A', () => {
    const design = fakeDesign()
    inLanguage(<Poster design={design} />)
    fireEvent.keyDown(screen.getByTestId('poster-tile-t1'), { key: 'l' })
    expect(design.onPick).toHaveBeenCalledWith('team', 't1', expect.anything())
    fireEvent.keyDown(screen.getByTestId('poster-tile-t1'), { key: 'a' })
    expect(design.onPick).toHaveBeenCalledWith('application', 't1', expect.anything())
  })

  it('reads and writes a free note as this view\'s, and takes it off with Delete', () => {
    const design = fakeDesign()
    const sheet = { poster: { items: [{ id: 'n', kind: 'note' as const, text: 'Reviewed' }] }, geometry: { nodes: [], items: [{ id: 'n', x: 10, y: 10, width: 100, height: 40 }] } }
    inLanguage(<Poster design={design} sheet={sheet} />)
    const note = screen.getByTestId('poster-item-n')
    expect(note.textContent).toContain('Reviewed')
    fireEvent.keyDown(note, { key: 'Delete' })
    expect(design.actions.removeItem).toHaveBeenCalledWith('n')
  })
})

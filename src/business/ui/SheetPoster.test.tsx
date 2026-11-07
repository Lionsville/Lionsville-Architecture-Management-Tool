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

afterEach(cleanup)

const elements: DesignElement[] = [
  area('a', 'Area one'), capability('t1', 'Tile one', 'a'), capability('t2', 'Tile two', 'a'),
  area('b', 'Area two'), grouping('g', 'A grouping', 'b'), capability('t3', 'Tile three', 'g'),
  journey('j', 'A journey'), phase('p', 'A phase', 'j'), phase('s', 'A step', 'p'),
  application('app', 'An application'),
]
const relations = [relation('r', 'supports', 'app', 't1')]

function Poster({ selectedId, onSelect = () => {} }: { selectedId?: string; onSelect?(id: string): void }) {
  const laidOut = sheetPage({ elements, relations }, { journeyId: 'j', areas: ['a', 'b'], showActors: true })
  const covering = coverageOf(relations)
  const none = { supportedBy: [], assignedTo: [], coverage: 'uncovered' as const }
  const coverageAt = (id: string) => covering.get(id) ?? none
  return (
    <SheetPoster
      laidOut={laidOut} lens={DEFAULT_LENS} coverageAt={coverageAt} nameOf={(id) => elements.find((one) => one.id === id)?.name ?? id}
      valueOf={(element) => lensValue(element, DEFAULT_LENS, { coverage: coverageAt, retiring: () => false })}
      selectedId={selectedId} onSelect={onSelect} t={(key) => key}
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

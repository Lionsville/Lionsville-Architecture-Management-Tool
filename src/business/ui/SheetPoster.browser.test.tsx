// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What jsdom cannot show: that a browser's layout of a block comes to the height
 * `posterLayout` worked out with no browser (ADR-0048). An agent on a server places
 * by that arithmetic, so a block taller on screen than the sum says would overlap
 * the one under it where nobody can see it happen.
 */
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { exampleFiles } from '../../adapters/folder/format/exampleFolder'
import type { ExampleFolder } from '../../adapters/folder/format/exampleFolder'
import acmeLogistics from '../../adapters/folder/format/examples/acme-logistics.json' with { type: 'json' }
import { scopeFromFolder } from '../../adapters/folder/format/folderFormat'
import { LanguageProvider } from '../../i18n/LanguageContext'
import { tokenVariables } from '../../widgets/kit/tokens'
import type { DesignDiagram, DesignElement } from '../../model'
import { DEFAULT_LENS, lensValue } from '../lens'
import { coverageOf } from '../coverage'
import { contentHeight, contentHeightAt, minWidth, POSTER_COLUMN_ID } from '../posterLayout'
import type { PosterAreaSize } from '../posterLayout'
import { posterFirstLayout } from '../posterPlaces'
import { sheetPage } from '../sheet'
import { denseSheet } from '../testFixtures'
import type { LaidOutSheet } from '../sheet'
import { SheetPoster } from './SheetPoster'

const mounted: Root[] = []
afterEach(() => {
  for (const root of mounted.splice(0)) root.unmount()
  document.body.replaceChildren()
})

function draw(laidOut: LaidOutSheet, elements: readonly DesignElement[]): HTMLElement {
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;inset:0;display:flex'
  for (const [name, value] of Object.entries(tokenVariables('light'))) document.documentElement.style.setProperty(name, value)
  document.body.append(host)
  const root = createRoot(host)
  mounted.push(root)
  const covering = coverageOf([])
  const none = { supportedBy: [], assignedTo: [], coverage: 'uncovered' as const }
  const coverageAt = (id: string) => covering.get(id) ?? none
  flushSync(() => {
    root.render(
      <LanguageProvider language="en">
        <SheetPoster
          laidOut={laidOut} lens={DEFAULT_LENS} coverageAt={coverageAt} nameOf={(id) => elements.find((one) => one.id === id)?.name ?? id}
          valueOf={(element) => lensValue(element, DEFAULT_LENS, { coverage: coverageAt, retiring: () => false })}
          selectedId={undefined} onSelect={() => {}} t={(key) => key}
        />
      </LanguageProvider>,
    )
  })
  return host
}

const sizeOf = (area: LaidOutSheet['areas'][number]): PosterAreaSize => ({
  id: area.element.id, groupings: area.groupings.map((one) => one.capabilities.length), loose: area.capabilities.length,
})

const fn = (id: string, parentId?: string): DesignElement => ({ id, name: `Function ${id}`, kind: 'function', lifecycle: 'live', isManaged: true, aspects: {}, ...(parentId ? { parentId } : {}) })

/** Areas of every shape a sheet comes in: few tiles and many, grouped, loose and both. */
function shapes(): DesignElement[] {
  const out: DesignElement[] = []
  const tiles = (parent: string, count: number) => { for (let i = 0; i < count; i += 1) out.push(fn(`${parent}-t${i}`, parent)) }
  for (const count of [1, 2, 3, 5, 8, 13, 21, 34]) { out.push(fn(`plain${count}`)); tiles(`plain${count}`, count) }
  for (const counts of [[1], [2, 3], [4, 9, 1], [12, 12]]) {
    const area = `grouped${counts.join('x')}`
    out.push(fn(area))
    counts.forEach((count, at) => {
      out.push(fn(`${area}-g${at}`, area))
      tiles(`${area}-g${at}`, count)
    })
  }
  out.push(fn('both'), fn('both-g0', 'both'))
  tiles('both-g0', 4)
  // A leaf beside a grouping. A capability with something under it is a grouping.
  tiles('both', 3)
  return out
}

/** The height a block comes to with nothing telling it, at the width it is drawn at. */
function measured(host: HTMLElement, id: string): number {
  const block = host.querySelector<HTMLElement>(`[data-block="${id}"]`)!
  block.style.height = 'auto'
  block.style.minHeight = '0'
  // Off screen a block is held at its intrinsic size, which is the sum itself: ask for its content.
  block.style.contentVisibility = 'visible'
  return block.getBoundingClientRect().height
}

describe('a block in a real browser', () => {
  const sheetOf = (elements: DesignElement[]) => sheetPage({ elements, relations: [] }, { areas: elements.filter((one) => !one.parentId).map((one) => one.id), showActors: false })

  it('comes to contentHeightAt when pulled to another width, for every shape', () => {
    const elements = shapes()
    const laidOut = sheetOf(elements)
    const host = draw(laidOut, elements)
    host.querySelector<HTMLElement>('[data-testid="poster-stage"]')!.style.transform = 'none'
    const wrong: string[] = []
    for (const area of laidOut.areas) {
      for (const width of [300, 520, 900]) {
        const block = host.querySelector<HTMLElement>(`[data-block="${area.element.id}"]`)!
        block.style.width = `${width}px`
        const height = measured(host, area.element.id)
        const worked = contentHeightAt(sizeOf(area), width)
        if (Math.abs(height - worked) > 0.5) wrong.push(`${area.element.id} at ${width}: drawn ${height}, worked out ${worked}`)
      }
    }
    expect(wrong).toEqual([])
  })

  it('comes to contentHeight at its narrowest, for every shape', () => {
    const elements = shapes()
    const laidOut = sheetOf(elements)
    const host = draw(laidOut, elements)
    // Measured unscaled, whatever the camera opened at.
    host.querySelector<HTMLElement>('[data-testid="poster-stage"]')!.style.transform = 'none'
    const wrong: string[] = []
    for (const area of laidOut.areas) {
      const size = sizeOf(area)
      const block = host.querySelector<HTMLElement>(`[data-block="${size.id}"]`)!
      block.style.width = `${minWidth(size)}px`
      const height = measured(host, size.id)
      if (Math.abs(height - contentHeight(size)) > 0.5) wrong.push(`${size.id}: drawn ${height}, worked out ${contentHeight(size)}`)
    }
    expect(wrong).toEqual([])
  })

  it('is no taller than the first layout gives it at the width it is given, across the example organisation', () => {
    const scope = scopeFromFolder(exampleFiles(acmeLogistics as ExampleFolder), '')!
    const sheet = scope.model.diagrams.find((one) => one.kind === 'sheet')!
    const laidOut = sheetPage(scope.model, sheet)
    expect(laidOut.areas.length).toBeGreaterThan(0)
    const host = draw(laidOut, scope.model.elements)
    host.querySelector<HTMLElement>('[data-testid="poster-stage"]')!.style.transform = 'none'
    const layout = posterFirstLayout(laidOut, sheet)
    const wrong: string[] = []
    for (const block of layout.blocks) {
      if (block.id === POSTER_COLUMN_ID || block.id === laidOut.journey?.element.id) continue
      const height = measured(host, block.id)
      if (height > block.height + 0.5) wrong.push(`${block.id}: drawn ${height}, given ${block.height}`)
    }
    expect(wrong).toEqual([])
  })

  it('is no taller than the first layout gives it, on a dense sheet of 188 functions in 17 areas', () => {
    const elements = denseSheet()
    const diagram = { id: 'dense', kind: 'sheet', name: 'Dense', members: [], areas: elements.filter((one) => !one.parentId).map((one) => one.id), showActors: false, geometry: { nodes: [] } } as DesignDiagram
    const laidOut = sheetPage({ elements, relations: [] }, diagram)
    const host = draw(laidOut, elements)
    host.querySelector<HTMLElement>('[data-testid="poster-stage"]')!.style.transform = 'none'
    const layout = posterFirstLayout(laidOut, diagram)
    expect(layout.blocks).toHaveLength(17)
    const wrong: string[] = []
    for (const block of layout.blocks) {
      const height = measured(host, block.id)
      if (height > block.height + 0.5) wrong.push(`${block.id}: drawn ${height}, given ${block.height}`)
    }
    expect(wrong).toEqual([])
  })
})

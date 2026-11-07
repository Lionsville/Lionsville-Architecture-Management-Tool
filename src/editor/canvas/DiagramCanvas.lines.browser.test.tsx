// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A commit takes no line off a board, in Chromium and WebKit
 * (`vitest.browser.config.ts`, `npm run test:browser`).
 *
 * React Flow draws a line only between cards it holds handles for. A node
 * pushed without `measured` loses them until the ResizeObserver answers, and
 * it is observed again only when the card went from measured to not. So a
 * second push whose store update runs just before the answer's render leaves
 * the card unmeasured for good: the boxes stay and every line that touches them
 * paints nothing, until the board is left. That hangs on when a browser
 * delivers an observation against React's commits, which jsdom's mock does not
 * show, so these run in a browser.
 *
 * Any model with a platform in it makes every application card a new object on
 * each derive (`withDerivedAspects`), so any commit at all pushes those.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import type { DesignModel, PlacedNode } from '../../model/types'
import { connection, diagram, element, model } from '../../model/testFixtures'
import { HostedEditor } from '../testing/editorHost'
import type { EditorHostState } from '../testing/editorHost'

const SYSTEMS = ['s0', 's1', 's2', 's3']
const PLATFORMS = ['p0', 'p1', 'p2', 'p3']
const LINES = 1 + SYSTEMS.length + PLATFORMS.length

const board = (): DesignModel => model({
  elements: [
    element('visitor', { kind: 'actor' }),
    element('shop'),
    ...SYSTEMS.map((id) => element(id, { outside: true })),
    ...PLATFORMS.map((id) => element(id, { kind: 'platform' })),
  ],
  relations: [
    connection('r-visitor', 'visitor', 'shop'),
    ...[...SYSTEMS, ...PLATFORMS].map((id) => connection(`r-${id}`, 'shop', id)),
  ],
  diagrams: [
    diagram('d1', {
      placements: [
        { id: 'visitor', x: 700, y: 30, zone: 'actors' },
        { id: 'shop', x: 700, y: 420, zone: 'landscape' },
        ...SYSTEMS.map((id, n) => ({ id, x: 1400, y: 180 + n * 120, zone: 'externalSystems' as const })),
        ...PLATFORMS.map((id, n) => ({ id, x: 300 + n * 200, y: 900, zone: 'management' as const })),
      ],
    }),
  ],
})

let root: Root | undefined
let holder: HTMLElement | undefined
let style: HTMLStyleElement | undefined
const hostRef: { current: EditorHostState } = { current: undefined as never }

afterEach(() => {
  root?.unmount()
  holder?.remove()
  style?.remove()
  root = undefined
  holder = undefined
  style = undefined
})

const sleep = (ms: number) => new Promise((resolve) => { setTimeout(resolve, ms) })
const nextFrame = () => new Promise((resolve) => { requestAnimationFrame(resolve) })
const lines = () => holder!.querySelectorAll('.react-flow__edge').length

async function settled(what: () => boolean, label: string): Promise<void> {
  const until = performance.now() + 20_000
  while (!what()) {
    if (performance.now() > until) throw new Error(`never settled: ${label}`)
    await sleep(20)
  }
}

async function openBoard(): Promise<void> {
  holder = document.createElement('div')
  holder.style.cssText = 'position:fixed;inset:0;width:1500px;height:1000px;display:flex'
  document.body.append(holder)
  root = createRoot(holder)
  root.render(
    <ThemeProvider theme={createTheme()}>
      <div style={{ flex: 1, display: 'flex' }}>
        <HostedEditor model={board()} activeDiagramId="d1" hostRef={hostRef} />
      </div>
    </ThemeProvider>,
  )
  await settled(() => lines() === LINES, 'the first lines')
}

/** A card's stored geometry, as the model now holds it. */
function geometryOf(id: string): PlacedNode {
  const held = hostRef.current.model.diagrams.find((d) => d.id === 'd1')!
  return { ...held.geometry!.nodes.find((n) => n.id === id)!, id }
}

/** One write from outside any React event: an agent's call, a worker's answer. */
function commit(id: string, change: Partial<PlacedNode>): void {
  hostRef.current.dispatch({ type: 'node.set', diagramId: 'd1', nodes: [{ ...geometryOf(id), ...change }] })
}

describe('the lines on a board, in a real browser', () => {
  it('stay in the page through a commit, not gone for a frame and back', async () => {
    await openBoard()
    const taken: string[] = []
    const watching = new MutationObserver((records) => {
      for (const record of records) {
        for (const gone of record.removedNodes) {
          // A line is drawn in an `svg` of its own, and that is what goes.
          const line = gone instanceof Element ? gone.querySelector('.react-flow__edge') : null
          if (line) taken.push(line.getAttribute('data-id') ?? '?')
        }
      }
    })
    watching.observe(holder!.querySelector('.react-flow__edges')!, { childList: true, subtree: true })
    for (let n = 0; n < 3; n += 1) {
      commit('p1', { y: 900 + (n + 1) * 10 })
      await sleep(150)
    }
    watching.disconnect()
    expect(taken).toEqual([])
    expect(lines()).toBe(LINES)
  })

  it('stay after two commits about a frame apart, whichever way they fall', async () => {
    await openBoard()
    // Without `measured` this loses every line within a few dozen rounds;
    // each round's gap and phase against the frame is what is being varied.
    for (const gap of [16, 17, 18, 15, 14, 19]) {
      for (let n = 0; n < 24; n += 1) {
        await nextFrame()
        await sleep(n % 17)
        const nudge = n % 2 ? 10 : -10
        commit('p2', { x: geometryOf('p2').x + nudge })
        await sleep(gap)
        commit('p3', { x: geometryOf('p3').x + nudge })
        await sleep(100)
        expect(lines(), `gap ${gap}, round ${n}`).toBe(LINES)
      }
    }
  })

  it('follow a card the model resizes, and keep to a card whose box is larger than its rect', async () => {
    await openBoard()
    const startOf = (id: string) => {
      const path = holder!.querySelector(`.react-flow__edge[data-id="${id}"] path.react-flow__edge-path`)
      return Number(/^M\s*(-?[\d.]+)/.exec(path?.getAttribute('d') ?? '')?.[1])
    }
    const shop = geometryOf('shop')
    commit('shop', { width: 420, height: 200 })
    await settled(() => startOf('r-s0') === shop.x + 420, 'the line off the resized side')
    expect(holder!.querySelector<HTMLElement>('.react-flow__node[data-id="shop"]')!.offsetWidth).toBe(420)

    // Nothing the app draws does this; a stylesheet can. The card's lines survive it.
    style = document.createElement('style')
    style.textContent = '.react-flow__node[data-id="s0"] { min-width: 400px; min-height: 200px; }'
    document.head.append(style)
    await sleep(100)
    commit('s0', { y: geometryOf('s0').y + 10 })
    await sleep(200)
    expect(holder!.querySelector<HTMLElement>('.react-flow__node[data-id="s0"]')!.offsetWidth).toBe(400)
    expect(lines()).toBe(LINES)
  })
})

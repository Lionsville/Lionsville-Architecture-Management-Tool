// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A commit takes no line off a board, in `npm run check` and on the runner.
 *
 * `DiagramCanvas.lines.browser.test.tsx` is the same question in Chromium and
 * WebKit, where a browser decides when an observation lands, and neither of
 * those starts on a fast loop or on the runner. This holds the order instead:
 * an observer whose answers wait until the test lets them go, so a push, a
 * second push and the first's measure fall in the order a real board lost its
 * lines in. A card pushed without `measured` fails here on its first commit: every
 * line goes while the measure is out. That the loss then lasts for good hangs on
 * React's scheduling in a browser, and stays the browser suite's to show.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import type { DesignModel, PlacedNode } from '../../model/types'
import { connection, diagram, element, model } from '../../model/testFixtures'
import { installReactFlowMocks } from '../reactFlowTestSetup'
import { HostedEditor } from '../testing/editorHost'
import type { EditorHostState } from '../testing/editorHost'
import { testTheme } from '../testing/theme'

const SYSTEMS = ['s0', 's1']
const PLATFORMS = ['p0', 'p1']
const LINES = 1 + SYSTEMS.length + PLATFORMS.length

// A platform in the model makes every application card a new object on each derive, so any commit pushes those.
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

/** The observers' answers, held until a test lets them go. */
let held: (() => void)[] = []

/** The installed mock's answers, kept back: a browser's frame, in the test's hand. */
class LateObserver {
  private readonly targets = new Set<Element>()
  private readonly callback: ResizeObserverCallback
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }

  observe(target: Element) {
    this.targets.add(target)
    held.push(() => {
      if (!this.targets.has(target)) return
      const width = (target as HTMLElement).offsetWidth
      const height = (target as HTMLElement).offsetHeight
      this.callback([{ target, contentRect: { width, height } } as unknown as ResizeObserverEntry], this as unknown as ResizeObserver)
    })
  }

  unobserve(target: Element) {
    this.targets.delete(target)
  }

  disconnect() {
    this.targets.clear()
  }
}

const hostRef: { current: EditorHostState } = { current: undefined as never }
const lines = () => document.querySelectorAll('.react-flow__edge').length

/** Every observation so far landed, and the render it causes done: one frame of a browser. */
const answer = () => act(async () => {
  const now = held
  held = []
  for (const one of now) one()
  await new Promise((done) => { requestAnimationFrame(done) })
})

function geometryOf(id: string): PlacedNode {
  const kept = hostRef.current.model.diagrams.find((one) => one.id === 'd1')!
  return { ...kept.geometry!.nodes.find((one) => one.id === id)!, id }
}

/** One write from outside any React event: an agent's call, a worker's answer. */
const commit = (id: string, change: Partial<PlacedNode>) => act(async () => {
  hostRef.current.dispatch({ type: 'node.set', diagramId: 'd1', nodes: [{ ...geometryOf(id), ...change }] })
  await Promise.resolve()
})

async function openBoard(): Promise<void> {
  render(
    <ThemeProvider theme={testTheme}>
      <HostedEditor model={board()} activeDiagramId="d1" hostRef={hostRef} />
    </ThemeProvider>,
  )
  // The board's first measures take a few rounds: the viewport, then its cards, then their handles.
  for (let round = 0; round < 6 && lines() < LINES; round += 1) await answer()
  expect(lines()).toBe(LINES)
}

beforeAll(() => installReactFlowMocks())
beforeEach(() => {
  held = []
  globalThis.ResizeObserver = LateObserver as unknown as typeof ResizeObserver
})
afterEach(() => cleanup())

describe('the lines on a board, with the measures in the test\'s hand', () => {
  it('stay in the page through a commit, with no measure having come back', async () => {
    await openBoard()
    const taken: string[] = []
    const watching = new MutationObserver((records) => {
      for (const record of records) {
        for (const gone of record.removedNodes) {
          const line = gone instanceof Element ? gone.querySelector('.react-flow__edge') : null
          if (line) taken.push(line.getAttribute('data-id') ?? '?')
        }
      }
    })
    watching.observe(document.querySelector('.react-flow__edges')!, { childList: true, subtree: true })
    for (let n = 0; n < 3; n += 1) await commit('p1', { y: 900 + (n + 1) * 10 })
    await act(async () => { await Promise.resolve() })
    watching.disconnect()
    expect(taken).toEqual([])
    expect(lines()).toBe(LINES)
  })

  it('stay when a second commit lands between the first and its measure', async () => {
    await openBoard()
    for (let round = 0; round < 6; round += 1) {
      const nudge = round % 2 ? 10 : -10
      await commit('p0', { x: geometryOf('p0').x + nudge })
      await commit('p1', { x: geometryOf('p1').x + nudge })
      await answer()
      expect(lines(), `round ${round}`).toBe(LINES)
    }
  })

  it('stay on a card the model resizes', async () => {
    await openBoard()
    await commit('shop', { width: 420, height: 200 })
    await answer()
    expect(lines()).toBe(LINES)
    expect(document.querySelector<HTMLElement>('.react-flow__node[data-id="shop"]')!.style.width).toBe('420px')
  })
})

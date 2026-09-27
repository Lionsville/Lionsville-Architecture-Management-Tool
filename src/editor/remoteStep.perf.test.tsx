// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * What one step made by somebody else costs the board it lands on: the editor
 * drawn over a board of six hundred elements, one of them renamed from
 * outside it, and the render that follows timed to the end.
 *
 * A step that arrives from another author is applied to the model the same way
 * one made here is — the reducer, a new model, one render — so what is timed is
 * that render, not the network that brought it: `graph.perf.test.ts` times the
 * derive under it, and this is the whole of the editor's answer to a colleague
 * typing a name. It is the number a person watching a shared board feels, once
 * per step that everybody else makes.
 *
 * jsdom lays nothing out, so this is React's work and React Flow's over the
 * cards and lines, without paint: a floor for what a browser pays, and the
 * right thing to hold, because it is the part a change to this tree moves.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import type { Command } from '../model'
import { BUDGET, measure } from '../model/testing/measure'
import { syntheticModel } from '../model/testing/synthetic'
import type { SyntheticSpec } from '../model/testing/synthetic'
import { installReactFlowMocks } from './reactFlowTestSetup'
import { HostedEditor } from './testing/editorHost'
import type { EditorHostState } from './testing/editorHost'

/** The board `graph.perf.test.ts` derives: six hundred elements on one landscape. */
const SPEC: SyntheticSpec = {
  elements: 700, connections: 1_600, diagrams: 8, descriptionBytes: 2048, decisions: 12, seed: 5,
}

const model = syntheticModel(SPEC)
const board = model.diagrams[0]

beforeAll(() => installReactFlowMocks())
afterAll(() => cleanup())

describe('a step from somebody else, on a board of six hundred', () => {
  it('draws the board the budget is written for', () => {
    expect(board.members.length).toBeGreaterThan(550)
    expect(board.members.length).toBeLessThan(650)
  })

  it('renders the board again after one remote step', async () => {
    const host = { current: undefined as unknown as EditorHostState }
    render(
      <ThemeProvider theme={createTheme()}>
        <HostedEditor model={model} activeDiagramId={board.id} hostRef={host} />
      </ThemeProvider>,
    )
    // React Flow measures the cards a microtask after it observes them.
    await act(async () => {})
    const members = board.members.map((member) => member.id)
    let step = 0
    const renamed = (): Command => {
      const id = members[step % members.length]
      step += 1
      return { type: 'element.update', id, patch: { name: `Renamed elsewhere ${step}` } }
    }
    const ms = measure('render: one remote step on a 600-node board', () => {
      act(() => { host.current.dispatch(renamed()) })
    }, { runs: 7, warmup: 2 })
    expect(host.current.model.elements.some((element) => element.name.startsWith('Renamed elsewhere'))).toBe(true)
    expect(ms).toBeLessThan(BUDGET.remoteStep)
  })
})

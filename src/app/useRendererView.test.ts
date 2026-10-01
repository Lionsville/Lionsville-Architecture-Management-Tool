// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The editor's handle as the agent's renderer view (ADR-0007): a picture is
 * taken once the board has settled, of the board as the screen draws it.
 *
 * A board nobody has laid out is shown laid out to somebody who may only read
 * it, by a pass that is never saved (`useReadingLayout`). The agent works out
 * where to crop from the board, so it must wait for that pass and be handed
 * what it drew, not the board as stored with every card at the origin.
 */
import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { laidOut } from '../model/testFixtures'
import type { EditorHandle } from '../editor'
import { placedOn } from '../model/normalised'
import type { ModelSession } from './useModelSession'
import { useRendererView } from './useRendererView'

const drawn = laidOut({ id: 'd1', kind: 'container', name: 'Containers', placements: [{ id: 'api', x: 400, y: 240 }] })

function handleWith(over: Partial<EditorHandle>): EditorHandle {
  return {
    activeDiagramId: 'd1',
    busy: false,
    tidy: async () => {},
    routeEdges: async () => {},
    capture: async () => new Blob(),
    deleteSelection: () => {},
    selectAll: () => {},
    showShortcuts: () => {},
    ...over,
  }
}

function view() {
  let active = 'd1'
  const session = {
    currentActiveId: () => active,
    setActiveDiagramId: (id: string) => { active = id },
  } as unknown as ModelSession
  return renderHook(() => useRendererView(session, () => {})).result.current
}

describe('the renderer view over the editor’s handle', () => {
  it('hands the agent the board the screen draws, where it is not the board stored', () => {
    const seam = view()
    seam.onEditorHandle(handleWith({ drawn }))
    const board = seam.renderer.drawn?.('d1')
    expect(board && placedOn(board, 'api')).toMatchObject({ x: 400, y: 240 })
    // Another board is not on screen, and a handle with nothing of its own
    // draws what is stored.
    expect(seam.renderer.drawn?.('d2')).toBeUndefined()
    seam.onEditorHandle(handleWith({}))
    expect(seam.renderer.drawn?.('d1')).toBeUndefined()
  })

  it('says the board is shown only once the pass the editor is running has ended', async () => {
    const seam = view()
    seam.onEditorHandle(handleWith({ busy: true }))
    let shown = false
    const showing = seam.renderer.show('d1').then(() => { shown = true })
    await new Promise((resolve) => setTimeout(resolve, 250))
    expect(shown).toBe(false)

    seam.onEditorHandle(handleWith({ busy: false, drawn }))
    await showing
    expect(shown).toBe(true)
  })
})

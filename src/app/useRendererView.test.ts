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

/** ADR-0033, amended 11 October 2026: what a link made from the view up selects again. */
describe('the selection a link carries', () => {
  const kinds = { b1: 'layer7', s1: 'sheet', m1: 'map', t1: 'technology' } as const
  function seamOn(first: keyof typeof kinds) {
    let active: string = first
    const session = {
      currentActiveId: () => active,
      setActiveDiagramId: (id: string) => { active = id },
      current: () => ({ diagrams: Object.entries(kinds).map(([id, kind]) => ({ id, kind })) }),
    } as unknown as ModelSession
    const seam = renderHook(() => useRendererView(session, () => {})).result.current
    return { seam, show: (id: keyof typeof kinds) => { active = id } }
  }
  const page = (diagramId: string, selectedId?: string) => ({
    diagramId, capture: async () => ({ png: new Uint8Array(), width: 1, height: 1 }), ...(selectedId ? { selectedId } : {}),
  }) as never

  it('is the board’s, while a board is up', () => {
    const { seam } = seamOn('b1')
    seam.onEditorHandle(handleWith({ activeDiagramId: 'b1', selectedElementId: 'crm' }))
    expect(seam.renderer.selected?.()).toBe('crm')
  })

  it('is a sheet’s, a map’s and the landscape’s own, never the board’s left behind', () => {
    const { seam, show } = seamOn('b1')
    seam.onEditorHandle(handleWith({ activeDiagramId: 'b1', selectedElementId: 'crm' }))
    for (const id of ['s1', 'm1', 't1'] as const) {
      show(id)
      // The editor still says the board's selection, now under the page's id.
      seam.onEditorHandle(handleWith({ activeDiagramId: id, selectedElementId: 'crm' }))
      seam.onSheetHandle(page(id))
      expect(seam.renderer.selected?.()).toBeUndefined()
      seam.onSheetHandle(page(id, `chosen-on-${id}`))
      expect(seam.renderer.selected?.()).toBe(`chosen-on-${id}`)
    }
  })

  it('is nothing while the page up has not handed its handle over yet', () => {
    const { seam, show } = seamOn('b1')
    seam.onSheetHandle(page('s1', 'old'))
    show('m1')
    seam.onEditorHandle(handleWith({ activeDiagramId: 'm1', selectedElementId: 'crm' }))
    expect(seam.renderer.selected?.()).toBeUndefined()
  })
})

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The editor's handle and the laid-out views' handle, as the agent's renderer
 * view (ADR-0007, ADR-0016).
 */
import { useCallback, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import { EditorRefused } from '../editor'
import type { EditorHandle } from '../editor'
import { RendererRefused } from '../agent/renderer'
import type { RendererView } from '../agent/renderer'
import type { SheetHandle } from '../business'
import type { ModelSession } from './useModelSession'

export type RendererSeam = {
  renderer: RendererView
  /** The editor's current handle, for the Edit menu's selection commands too. */
  editorHandle: RefObject<EditorHandle | undefined>
  onEditorHandle: (handle: EditorHandle | undefined) => void
  onSheetHandle: (handle: SheetHandle | undefined) => void
}

export function useRendererView(session: ModelSession, focusElement: (id: string) => void): RendererSeam {
  /**
   * The editor's handle, as the agent's renderer view (ADR-0007). Held in a
   * ref because the editor hands out a new one whenever a pass starts or
   * ends, and the view must always reach the current one without the
   * subscription being rebuilt.
   */
  const editorHandle = useRef<EditorHandle | undefined>(undefined)
  const onEditorHandle = useCallback((handle: EditorHandle | undefined) => { editorHandle.current = handle }, [])
  /**
   * The same arrangement for the laid-out views, which are drawn in the tab
   * in place of the canvas (ADR-0016). One ref for all of them: only one is
   * the active view, and the agent asks for a picture by diagram id.
   */
  const sheetHandle = useRef<SheetHandle | undefined>(undefined)
  const onSheetHandle = useCallback((handle: SheetHandle | undefined) => { sheetHandle.current = handle }, [])
  const renderer = useMemo<RendererView>(() => {
    const current = (): EditorHandle => {
      const held = editorHandle.current
      if (!held) throw new RendererRefused('gone')
      return held
    }
    const asRefusal = (error: unknown): never => {
      if (error instanceof EditorRefused) throw new RendererRefused(error.reason)
      throw error
    }
    /** Poll until the editor says it is on the diagram and idle, or give up. */
    const settled = async (diagramId: string) => {
      const deadline = Date.now() + 10_000
      while (Date.now() < deadline) {
        const held = editorHandle.current
        if (held && held.activeDiagramId === diagramId && !held.busy) return
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      throw new RendererRefused('busy')
    }
    return {
      async show(diagramId) {
        if (session.currentActiveId() !== diagramId) session.setActiveDiagramId(diagramId)
        await settled(diagramId)
        // A settling pass on a machine-laid-out diagram starts a moment after
        // the switch; give it that moment, then wait it out.
        await new Promise((resolve) => setTimeout(resolve, 150))
        await settled(diagramId)
      },
      tidy: () => current().tidy().catch(asRefusal),
      route: () => current().routeEdges().catch(asRefusal),
      capture: async (options) => {
        const blob = await current().capture(options).catch(asRefusal)
        return new Uint8Array(await blob.arrayBuffer())
      },
      focus: focusElement,
      /**
       * A laid-out view is drawn in the tab, not on the canvas: make it the
       * active view, wait for it to hand over its handle, and rasterise what
       * it drew. Nothing is laid out asynchronously here, so the wait is for
       * React rather than for a worker — but it is still a wait, and a page
       * that never arrives is a refusal rather than a hang.
       */
      async sheet(diagramId, options) {
        if (session.currentActiveId() !== diagramId) session.setActiveDiagramId(diagramId)
        const deadline = Date.now() + 5_000
        while (Date.now() < deadline) {
          const held = sheetHandle.current
          if (held?.diagramId === diagramId) return held.capture(options)
          await new Promise((resolve) => setTimeout(resolve, 50))
        }
        throw new RendererRefused('gone')
      },
    }
  }, [session, focusElement])
  return { renderer, editorHandle, onEditorHandle, onSheetHandle }
}

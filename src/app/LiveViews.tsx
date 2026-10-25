// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A view shown in a document as itself (ADR-0043, amended): drawn live,
 * read-only, by the same code that draws it in its tab — a board by the
 * canvas, a sheet, a map, the technology landscape or a chart by its page —
 * so it is always the view as it is now, in the theme the reader has on.
 * Not a picture and not a frame: nothing is kept that can go stale, and
 * nothing loads the app a second time.
 *
 * The documentation module draws a description and may not reach the
 * editor, so the workspace hands this over as a slot of the view embeds.
 */
import { useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import Box from '@mui/material/Box'
import type { DesignDiagram } from '../model/types'
import type { PageView } from '../editor'
import { Layer7Canvas } from '../editor/canvas/Layer7Canvas'
import { ContainerCanvas } from '../editor/canvas/ContainerCanvas'
import { EMPTY_SELECTION } from '../editor/useEditorState'
import type { EditorActions } from '../editor/useEditorState'
import { laidOutPage } from './WorkspaceEditor'
import type { WorkspaceParts } from './workspaceParts'

/** What a laid-out page is told when it is only to be read: nothing it does reaches the model. */
const READING: PageView = {
  readOnly: true,
  onSelect: () => undefined,
  onAdd: () => undefined,
  onHost: () => undefined,
  onUse: () => undefined,
}

/** Every action a canvas could ask for, answered with nothing: a read-only board asks none, and one it does is ignored. */
const NO_ACTIONS = new Proxy({}, { get: () => () => undefined }) as EditorActions


/** How tall a view stands in a document before it scrolls. */
export const LIVE_VIEW_HEIGHT = 600

/** A laid-out page's own height in a document: it scrolls inside itself, as in its tab. */
const LAID_OUT_HEIGHT = 600

/** The default Layer 7 board, as the editor draws it where the geometry says no size. */
const LAYER7_DEFAULT = { width: 1680, height: 1040 }

/**
 * A board at its own size, so the document's frame scrolls through it rather
 * than shrinking it to fit: a landscape its canvas, a container view the box
 * around its nodes.
 */
function boardSize(diagram: DesignDiagram): { width: number; height: number } {
  const geometry = diagram.geometry
  if (diagram.kind === 'layer7') return geometry?.canvas ?? LAYER7_DEFAULT
  const nodes = geometry?.nodes ?? []
  const width = Math.max(480, ...nodes.map((one) => one.x + (one.width ?? 220))) + 80
  const height = Math.max(240, ...nodes.map((one) => one.y + (one.height ?? 120))) + 80
  return { width, height }
}

/**
 * The view is read and never used: inert, so no pointer and no key reaches it
 * — nothing is selected, dragged or zoomed, and nothing in it takes focus —
 * while the frame around it, which is not, still scrolls through it. A
 * capture of the events at the frame would not do: the canvas's pan and zoom
 * listen on its own element, under any handler of ours.
 */
const READ_ONLY = { inert: true, 'data-testid': 'view-inert' } as const

/** The slot: a view of the open scope, drawn live and read-only, or nothing for a kind that is a picture. */
export function useLiveViews(parts: WorkspaceParts): (diagram: DesignDiagram) => ReactNode {
  const model = parts.session.model
  const board = useCallback((diagram: DesignDiagram) => {
    const shared = {
      model, diagram, readOnly: true, selection: EMPTY_SELECTION, onSelectionChange: () => undefined, actions: NO_ACTIONS,
      snapToGrid: false, showGrid: false, showLifecycle: false, showMinimap: false, showEdgeLabels: true, mountEveryElement: true,
      onToggleShowGrid: () => undefined, onToggleSnapToGrid: () => undefined,
    }
    return (
      <ReactFlowProvider>
        {diagram.kind === 'layer7'
          ? <Layer7Canvas {...(shared as Parameters<typeof Layer7Canvas>[0])} />
          : <ContainerCanvas {...(shared as Parameters<typeof ContainerCanvas>[0])} showDeployment={false} />}
      </ReactFlowProvider>
    )
  }, [model])
  return useMemo(() => (diagram: DesignDiagram) => {
    if (diagram.kind === 'drawing') return undefined
    const isBoard = diagram.kind === 'layer7' || diagram.kind === 'container'
    const size = isBoard ? boardSize(diagram) : undefined
    return (
      // Read, not used: as large as the view is, scrolled through in a frame
      // the document's width, and the caption under it opens the view. The
      // view alone: its details pane, its outline and the seams beside them
      // are the tab's, not the document's.
      <Box
        sx={{
          maxHeight: LIVE_VIEW_HEIGHT, width: '100%', overflow: 'auto', position: 'relative',
          '& [data-testid="sheet-inspector"], & [data-testid="chart-outline"], & [data-testid="chart-outline-seam"], & [role="separator"], & .react-flow__panel': { display: 'none !important' },
        }}
      >
        {size ? (
          <Box {...READ_ONLY} sx={{ width: size.width, height: size.height, display: 'flex', '& > *': { flex: 1, minWidth: 0 } }}>{board(diagram)}</Box>
        ) : (
          <Box {...READ_ONLY} sx={{ height: LAID_OUT_HEIGHT, display: 'flex', '& > *': { flex: 1, minWidth: 0 } }}>{laidOutPage(parts, diagram, READING)}</Box>
        )}
      </Box>
    )
  }, [board, parts])
}

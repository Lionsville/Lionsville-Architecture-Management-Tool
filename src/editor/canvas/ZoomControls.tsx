// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { useCallback } from 'react';
import type { RefObject } from 'react';
import { Panel, useReactFlow, useStore } from '@xyflow/react';
import { CanvasDock } from '../../widgets/kit/CanvasDock';
import { steppedZoomTarget, useCanvasZoom } from '../../widgets/kit/useCanvasZoom';
import { stepZoom, zoomAbout, ZOOM_HOME } from '../../widgets/kit/zoom';
import { useFitBoard } from './fitAll';
import { useStrings } from '../../i18n/LanguageContext';

/**
 * The kit's one zoom behaviour on React Flow's viewport: ⌘ or Ctrl with + − 0, and
 * Safari's pinch. React Flow takes the wheel and any other pinch itself, and the
 * keymap has the board's own = and − and ⇧ keys. The ref goes on the canvas's element.
 */
export function useBoardZoom(container: RefObject<HTMLDivElement | null>): (element: HTMLDivElement | null) => void {
  const { getViewport, getZoom, setViewport } = useReactFlow();
  const fit = useFitBoard();
  const attach = useCanvasZoom(steppedZoomTarget({
    zoom: getZoom,
    to: (zoom, at) => {
      const box = container.current?.getBoundingClientRect();
      const about = at ?? { x: (box?.width ?? 0) / 2, y: (box?.height ?? 0) / 2 };
      // At once: a press reads the zoom the last one left, and one still animating has not left it yet.
      void setViewport(zoomAbout(getViewport(), about, zoom));
    },
    fit: () => fit(),
    pan: (dx) => {
      const at = getViewport();
      void setViewport({ ...at, x: at.x + dx });
    },
  }), { wheel: false, plainKeys: false });
  return useCallback((element: HTMLDivElement | null) => {
    container.current = element;
    attach(element);
  }, [container, attach]);
}

/**
 * The dock, bottom left and the same on every zoomable canvas. Grid opens both of what
 * goes with it, for whoever may place things. A router that declined says so here.
 */
export function ZoomControls({ grid, map, note }: {
  grid?: { showGrid: boolean; onToggleShowGrid(): void; snapToGrid: boolean; onToggleSnapToGrid(): void };
  map?: { on: boolean; onToggle: () => void };
  note?: string;
}) {
  const { t } = useStrings();
  const { zoomTo, getZoom } = useReactFlow();
  const fit = useFitBoard();
  const zoom = useStore((state) => state.transform[2]);
  return (
    <Panel position="bottom-left">
      <CanvasDock
        corner={false}
        data-testid="zoom-controls"
        zoom={zoom}
        onZoomIn={() => void zoomTo(stepZoom(getZoom(), 'in'))}
        onZoomOut={() => void zoomTo(stepZoom(getZoom(), 'out'))}
        onFit={() => fit()}
        onHome={() => void zoomTo(ZOOM_HOME, { duration: 300 })}
        {...(grid ? {
          gridItems: [
            { label: t('canvas.gridToggle'), checked: grid.showGrid, onSelect: grid.onToggleShowGrid },
            { label: t('canvas.snapToggle'), checked: grid.snapToGrid, onSelect: grid.onToggleSnapToGrid },
          ],
        } : {})}
        {...(map ? { map } : {})}
        {...(note ? { note } : {})}
      />
    </Panel>
  );
}

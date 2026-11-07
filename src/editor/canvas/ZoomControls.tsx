// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { useCallback } from 'react';
import type { RefObject } from 'react';
import { Panel, useReactFlow, useStore } from '@xyflow/react';
import { CanvasDock } from '../../widgets/kit/CanvasDock';
import { steppedZoomTarget, useCanvasZoom } from '../../widgets/kit/useCanvasZoom';
import { stepZoom, zoomAbout, ZOOM_HOME } from '../../widgets/kit/zoom';
import { FIT_ALL } from './fitAll';
import { PlacementToolbar } from './PlacementToolbar';
import type { PlacementToolbarProps } from './PlacementToolbar';

/**
 * The kit's one zoom behaviour on React Flow's viewport: ⌘ or Ctrl with + − 0, and
 * Safari's pinch. React Flow takes the wheel and any other pinch itself, and the
 * keymap has the board's own = and − and ⇧ keys. The ref goes on the canvas's element.
 */
export function useBoardZoom(container: RefObject<HTMLDivElement | null>): (element: HTMLDivElement | null) => void {
  const { getViewport, getZoom, setViewport, fitView } = useReactFlow();
  const attach = useCanvasZoom(steppedZoomTarget({
    zoom: getZoom,
    to: (zoom, at) => {
      const box = container.current?.getBoundingClientRect();
      const about = at ?? { x: (box?.width ?? 0) / 2, y: (box?.height ?? 0) / 2 };
      // At once: a press reads the zoom the last one left, and one still animating has not left it yet.
      void setViewport(zoomAbout(getViewport(), about, zoom));
    },
    fit: () => void fitView({ ...FIT_ALL, duration: 300 }),
  }), { wheel: false, plainKeys: false });
  return useCallback((element: HTMLDivElement | null) => {
    container.current = element;
    attach(element);
  }, [container, attach]);
}

/**
 * The one cluster floating on the canvas, bottom left: the kit's dock, and on a
 * canvas that may be edited the grid, the snap and the align and distribute buttons
 * beside it. One cluster, not one at the top centre and another at the bottom left:
 * a person looks in one place for what the canvas offers.
 */
export function ZoomControls({ placement, map }: {
  placement?: PlacementToolbarProps;
  map?: { on: boolean; onToggle: () => void };
}) {
  const { zoomTo, fitView, getZoom } = useReactFlow();
  const zoom = useStore((state) => state.transform[2]);
  return (
    <Panel position="bottom-left">
      <CanvasDock
        corner={false}
        data-testid="zoom-controls"
        zoom={zoom}
        onZoomIn={() => void zoomTo(stepZoom(getZoom(), 'in'))}
        onZoomOut={() => void zoomTo(stepZoom(getZoom(), 'out'))}
        onFit={() => void fitView({ ...FIT_ALL, duration: 300 })}
        onHome={() => void zoomTo(ZOOM_HOME, { duration: 300 })}
        map={map}
        extra={placement && <PlacementToolbar {...placement} />}
      />
    </Panel>
  );
}

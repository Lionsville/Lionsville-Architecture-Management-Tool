// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { useEffect, useState } from 'react';
import { Panel, useStore, useStoreApi } from '@xyflow/react';
import { useStrings } from '../../i18n/LanguageContext';
import { Button } from '../../widgets/kit/Button';

const SETTLE_MS = 300;
const STEP = 12;
/** A line runs along a box's edge when it enters it: only its inside counts. */
const INSET = 6;

type Box = { id: string; x: number; y: number; width: number; height: number };

/** Which of the given routes run through a box that is not one of their two ends. */
export function linesThroughBoxes(
  routes: readonly { id: string; source: string; target: string; points: readonly { x: number; y: number }[] }[],
  boxes: readonly Box[],
): string[] {
  const inside = (box: Box, at: { x: number; y: number }) =>
    at.x > box.x + INSET && at.x < box.x + box.width - INSET && at.y > box.y + INSET && at.y < box.y + box.height - INSET;
  return routes.filter((route) => boxes.some((box) => box.id !== route.source && box.id !== route.target && route.points.some((at) => inside(box, at)))).map((route) => route.id);
}

/**
 * A line through a box reads as a connection to it, and hides its words. The router
 * treats boxes as obstacles, so what is left is a stored route or a box moved since:
 * this says so and offers a pass over those lines alone, so that no bend somebody
 * placed elsewhere moves, and does not take it unasked.
 */
export function LinesCrossing({ onRoute, boundary }: { onRoute: (lines: readonly string[]) => void; boundary: string | undefined }) {
  const { t } = useStrings();
  const flow = useStoreApi();
  const edges = useStore((state) => state.edges);
  const nodes = useStore((state) => state.nodes);
  const [lines, setLines] = useState<readonly string[]>([]);
  useEffect(() => {
    const timer = setTimeout(() => {
      const root = flow.getState().domNode;
      if (!root) return;
      const boxes = nodes.filter((node) => node.id !== boundary).map((node) => ({
        id: node.id, x: node.position.x, y: node.position.y,
        width: node.measured?.width ?? node.width ?? 0, height: node.measured?.height ?? node.height ?? 0,
      }));
      // Each line's path by its id, read in one pass: an id is the model's, and a selector built from one would need escaping.
      const drawn = new Map(Array.from(root.querySelectorAll('.react-flow__edge'), (line) =>
        [line.getAttribute('data-id'), line.querySelector<SVGPathElement>('path.react-flow__edge-path')] as const));
      const routes = edges.flatMap((edge) => {
        const path = drawn.get(edge.id);
        if (!path?.getTotalLength) return [];
        const length = path.getTotalLength();
        const points = Array.from({ length: Math.ceil(length / STEP) }, (_, index) => path.getPointAtLength(index * STEP));
        return [{ id: edge.id, source: edge.source, target: edge.target, points }];
      });
      setLines(linesThroughBoxes(routes, boxes));
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [edges, nodes, flow, boundary]);
  if (lines.length === 0) return null;
  return (
    <Panel position="top-right" data-canvas-float="">
      <div className="lv-crossing" role="status" data-testid="lines-crossing">
        <span>{lines.length === 1 ? t('c4.crossingOne') : t('c4.crossingMany', { count: lines.length })}</span>
        <Button size="small" onClick={() => onRoute(lines)}>{t('c4.routeAgain')}</Button>
      </div>
    </Panel>
  );
}

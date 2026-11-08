// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { useEffect, useMemo, useState } from 'react';
import { Panel, useStore, useStoreApi } from '@xyflow/react';
import { useStrings } from '../../i18n/LanguageContext';
import { Button } from '../../widgets/kit/Button';

const STEP = 12;
/** How long the lines are still before a redrawn one is checked: a box dragged redraws them every frame. */
const REDRAWN_MS = 120;
/** A line runs along a box's edge when it enters it: only its inside counts. */
const INSET = 6;

type Box = { id: string; x: number; y: number; width: number; height: number };

/** The least room left between a box moved clear and the boxes around it. */
const CLEAR_GAP = 16;

const intersect = (a: Box, b: Box, gap = 0) =>
  a.x < b.x + b.width + gap && b.x < a.x + a.width + gap && a.y < b.y + b.height + gap && b.y < a.y + a.height + gap;
const holds = (outer: Box, inner: Box) =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;

/**
 * The boxes that lie over a box drawn before them, each once: the later of two is the one said and moved, since
 * the earlier stood there first. A box wholly inside another is held by it, not lying over it.
 */
export function overlappingBoxes(boxes: readonly Box[]): string[] {
  const over: string[] = [];
  boxes.forEach((box, at) => {
    if (boxes.slice(0, at).some((before) => intersect(box, before) && !holds(before, box) && !holds(box, before))) over.push(box.id);
  });
  return over;
}

/**
 * Where a box goes to lie clear of every other: the nearest place just past one of them — or past the
 * boundary — on one of its four sides, keeping the room it had from the rest, and on the side of the boundary it
 * stood on, so a person outside the application is never moved into it. Nothing where no such place is near.
 */
export function clearPlace(box: Box, others: readonly Box[], boundary?: Box): { x: number; y: number } | undefined {
  const inside = boundary !== undefined && intersect(box, boundary) && box.x + box.width / 2 > boundary.x
    && box.x + box.width / 2 < boundary.x + boundary.width && box.y + box.height / 2 > boundary.y && box.y + box.height / 2 < boundary.y + boundary.height;
  const edges = [...others, ...(boundary && !inside ? [boundary] : [])];
  const candidates = edges.flatMap((other) => [
    { x: other.x - box.width - CLEAR_GAP, y: box.y },
    { x: other.x + other.width + CLEAR_GAP, y: box.y },
    { x: box.x, y: other.y - box.height - CLEAR_GAP },
    { x: box.x, y: other.y + other.height + CLEAR_GAP },
  ]);
  const fits = (at: { x: number; y: number }) => {
    const moved = { ...box, ...at };
    if (others.some((other) => intersect(moved, other, CLEAR_GAP - 1))) return false;
    if (!boundary) return true;
    return inside ? holds(boundary, moved) : !intersect(moved, boundary, CLEAR_GAP - 1);
  };
  const distance = (at: { x: number; y: number }) => Math.hypot(at.x - box.x, at.y - box.y);
  return candidates.filter(fits).sort((a, b) => distance(a) - distance(b))[0];
}

/** Which of the given routes run through a box that is not one of their two ends. */
export function linesThroughBoxes(
  routes: readonly { id: string; source: string; target: string; points: readonly { x: number; y: number }[] }[],
  boxes: readonly Box[],
): string[] {
  const inside = (box: Box, at: { x: number; y: number }) =>
    at.x > box.x + INSET && at.x < box.x + box.width - INSET && at.y > box.y + INSET && at.y < box.y + box.height - INSET;
  return routes.filter((route) => boxes.some((box) => box.id !== route.source && box.id !== route.target && route.points.some((at) => inside(box, at)))).map((route) => route.id);
}

/** A change to a line's drawing: one added or taken away, or its path drawn again. */
export function isLine(change: MutationRecord): boolean {
  if (change.type === 'attributes') return change.target instanceof Element && change.target.classList.contains('react-flow__edge-path');
  const lineIn = (node: Node) => node instanceof Element && (node.classList.contains('react-flow__edge') || node.querySelector('.react-flow__edge') !== null);
  return Array.from(change.addedNodes).some(lineIn) || Array.from(change.removedNodes).some(lineIn);
}

/**
 * A line through a box reads as a connection to it, and hides its words. The router
 * treats boxes as obstacles, so what is left is a stored route or a box moved since:
 * this says so and offers a pass over those lines alone, so that no bend somebody
 * placed elsewhere moves, and does not take it unasked.
 */
export function LinesCrossing({ onRoute, onMoveClear, boundary }: {
  onRoute: (lines: readonly string[]) => void;
  /** Where boxes lie over others, the press that moves them clear: never taken unasked, since a box may be where a person put it. */
  onMoveClear?: (moves: readonly { id: string; x: number; y: number }[]) => void;
  boundary: string | undefined;
}) {
  const { t } = useStrings();
  const flow = useStoreApi();
  const edges = useStore((state) => state.edges);
  const nodes = useStore((state) => state.nodes);
  const [lines, setLines] = useState<readonly string[]>([]);
  // Checked in the frame after the boxes are measured, never on a fixed timer: a fixed wait landed the notice
  // about half a second into an open, after the page had looked done (15–20 ms of work). The lines may be drawn
  // after the boxes, though, and routed again after that: a board opened from another of the same scope had its
  // boxes measured before a line was drawn, found nothing and was never asked again. So a line drawn or redrawn
  // asks again, once the drawing has been still for a moment.
  useEffect(() => {
    if (!nodes.every((node) => node.measured?.width !== undefined || node.width !== undefined)) return undefined;
    const check = () => {
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
      const through = linesThroughBoxes(routes, boxes);
      setLines((held) => (held.length === through.length && held.every((id, at) => id === through[at]) ? held : through));
    };
    const frame = requestAnimationFrame(check);
    let later: ReturnType<typeof setTimeout> | undefined;
    const root = flow.getState().domNode;
    const redrawn = root && typeof MutationObserver !== 'undefined'
      ? new MutationObserver((changes) => {
        if (!changes.some(isLine)) return;
        clearTimeout(later);
        later = setTimeout(check, REDRAWN_MS);
      })
      : undefined;
    if (redrawn && root) redrawn.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['d'] });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(later);
      redrawn?.disconnect();
    };
  }, [edges, nodes, flow, boundary]);
  const measured = useMemo(() => nodes.filter((node) => node.id !== boundary && node.type !== 'group').map((node) => ({
    id: node.id, x: node.position.x, y: node.position.y,
    width: node.measured?.width ?? node.width ?? 0, height: node.measured?.height ?? node.height ?? 0,
  })).filter((box) => box.width > 0 && box.height > 0), [nodes, boundary]);
  const over = useMemo(() => (onMoveClear ? overlappingBoxes(measured) : []), [measured, onMoveClear]);
  const moveClear = () => {
    if (!onMoveClear) return;
    const frame = nodes.find((node) => node.id === boundary);
    const around = frame ? { id: frame.id, x: frame.position.x, y: frame.position.y, width: frame.measured?.width ?? frame.width ?? 0, height: frame.measured?.height ?? frame.height ?? 0 } : undefined;
    let placed = measured;
    const moves: { id: string; x: number; y: number }[] = [];
    // One after another, each clear of where the ones before it went.
    for (const id of over) {
      const box = placed.find((one) => one.id === id);
      const at = box && clearPlace(box, placed.filter((one) => one.id !== id), around);
      if (!box || !at) continue;
      moves.push({ id, x: Math.round(at.x), y: Math.round(at.y) });
      placed = placed.map((one) => (one.id === id ? { ...one, ...at } : one));
    }
    if (moves.length > 0) onMoveClear(moves);
  };
  if (lines.length === 0 && over.length === 0) return null;
  return (
    <Panel position="top-right" data-canvas-float="">
      {lines.length > 0 && (
        <div className="lv-crossing" role="status" data-testid="lines-crossing">
          <span>{lines.length === 1 ? t('c4.crossingOne') : t('c4.crossingMany', { count: lines.length })}</span>
          <Button size="small" onClick={() => onRoute(lines)}>{t('c4.routeAgain')}</Button>
        </div>
      )}
      {over.length > 0 && (
        <div className="lv-crossing" role="status" data-testid="boxes-overlapping">
          <span>{over.length === 1 ? t('c4.overlapOne') : t('c4.overlapMany', { count: over.length })}</span>
          <Button size="small" onClick={moveClear} data-testid="boxes-move-clear">{t('c4.moveClear')}</Button>
        </div>
      )}
    </Panel>
  );
}

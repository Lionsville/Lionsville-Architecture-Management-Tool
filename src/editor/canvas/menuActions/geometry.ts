// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { ElementId, PlacedNode, Rect } from '../../../model/types';
import { placedNodes, placementRect } from '../../../model/placement';
import { nodeFigure } from '../../../model/kinds';
import type { MenuActionHost } from './types';

/** Measured rect of a node when React Flow has one, else the placement's. */
export function rectOf(host: MenuActionHost, elementId: ElementId): Rect | undefined {
  const measured = host.nodeBounds().find((n) => n.id === elementId);
  if (measured && measured.width > 0 && measured.height > 0) return measured;
  const placement = placedNodes(host.diagram).find((p) => p.id === elementId);
  const element = host.model.elements.find((e) => e.id === elementId);
  return placement && element
    ? placementRect(nodeFigure(element, placement.zone), placement)
    : undefined;
}

/** Placement rects of every OTHER element whose placement satisfies `where`. */
export function occupiedRects(
  host: MenuActionHost,
  except: ElementId,
  where: (placement: PlacedNode) => boolean,
): Rect[] {
  const elementsById = new Map(host.model.elements.map((e) => [e.id, e]));
  return placedNodes(host.diagram)
    .filter((p) => p.id !== except && where(p))
    .flatMap((p) => {
      const element = elementsById.get(p.id);
      return element ? [placementRect(nodeFigure(element, p.zone), p)] : [];
    });
}

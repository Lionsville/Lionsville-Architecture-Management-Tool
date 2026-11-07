// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { useNodes, ViewportPortal } from '@xyflow/react';
import { categoryBands, type CategoryBox } from '../../layout/categoryLayers';
import type { ElementNodeData } from '../nodes/nodeData';

/** A row per category behind the containers, measured off the live nodes as the deployment boxes are. */
export function CategoryBands() {
  const nodes = useNodes();
  const boxes: CategoryBox[] = [];
  for (const node of nodes) {
    const { element } = node.data as ElementNodeData;
    if (element.kind !== 'component') continue;
    boxes.push({
      id: node.id,
      x: node.position.x,
      y: node.position.y,
      width: node.measured?.width ?? node.width ?? 0,
      height: node.measured?.height ?? node.height ?? 0,
      ...(element.category ? { category: element.category } : {}),
    });
  }
  const bands = categoryBands(boxes);
  if (bands.length === 0) return null;
  return (
    <ViewportPortal>
      {bands.map((band) => (
        <div
          key={band.category}
          className="lv-layer"
          data-testid="category-band"
          style={{ left: band.rect.x, top: band.rect.y, width: band.rect.width, height: band.rect.height }}
        >
          <span className="lv-layer__name">{band.category}</span>
        </div>
      ))}
    </ViewportPortal>
  );
}

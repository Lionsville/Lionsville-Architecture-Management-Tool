// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { useNodes, ViewportPortal } from '@xyflow/react';
import { alpha, useTheme } from '@mui/material/styles';
import { getNodeTokens } from '../theme/tokens';
import { deploymentBoxes } from '../../model/deployment';
import type { PlatformTree } from '../../model/deployment';
import { unionRects } from '../../model/placement';
import type { DesignDiagram, DesignModel, ElementId, Rect } from '../../model/types';

/**
 * The platforms a container diagram\'s containers run on, drawn around them
 * (ADR-0013, redone) — Structurizr\'s deployment diagram over the canvas that
 * already exists.
 *
 * Derived, never stored, never dragged: `model/deployment.ts` says which
 * containers are in which box and how deep it sits, and this measures the
 * members as React Flow has them RIGHT NOW, so the box follows a card the
 * moment it is dropped and there is no geometry to keep in step. The boxes are
 * `pointer-events: none` throughout — there is nothing to click, because there
 * is nothing about a derived box a person could change here. What it says is
 * changed on the container, which is where the row is.
 *
 * The nesting is paid for in padding: an outer box is padded further out than
 * the one inside it, so a namespace whose members are the whole cluster\'s is
 * still visibly inside it rather than exactly on top of it.
 */
const PADDING = 26;
const NESTING_STEP = 18;
const LABEL_ROOM = 18;

export interface DeploymentLayerProps {
  model: DesignModel;
  diagram: DesignDiagram;
  /** The platform tree, where another scope answers for it — see `model/deployment`. */
  platformTree?: PlatformTree;
}

export function DeploymentLayer(props: DeploymentLayerProps) {
  const theme = useTheme();
  const tokens = getNodeTokens(theme);
  // The live nodes, so a box re-measures mid-drag rather than at the drop — and
  // so the day the board shows needs no second answer here: a card that is
  // retired by then is not a node, and takes its box with it.
  const nodes = useNodes();
  const rects = new Map<ElementId, Rect>();
  for (const node of nodes) {
    const width = node.measured?.width ?? node.width ?? 0;
    const height = node.measured?.height ?? node.height ?? 0;
    if (width === 0 || height === 0) continue;
    rects.set(node.id, { x: node.position.x, y: node.position.y, width, height });
  }
  const boxes = deploymentBoxes(props.model, props.diagram, new Set(rects.keys()), props.platformTree);
  if (boxes.length === 0) return null;
  const deepest = boxes.reduce((held, box) => Math.max(held, box.depth), 0);

  return (
    <ViewportPortal>
      {boxes.map((box) => {
        const members = box.memberIds.map((id) => rects.get(id)).filter((rect): rect is Rect => rect !== undefined);
        const union = unionRects(members);
        if (!union) return null;
        const pad = PADDING + (deepest - box.depth) * NESTING_STEP;
        const rect = {
          x: union.x - pad,
          y: union.y - pad - LABEL_ROOM,
          width: union.width + pad * 2,
          height: union.height + pad * 2 + LABEL_ROOM,
        };
        return (
          <div
            key={box.id}
            data-testid="lv-deployment-box"
            data-platform={box.id}
            style={{
              position: 'absolute',
              left: rect.x,
              top: rect.y,
              width: rect.width,
              height: rect.height,
              border: `1.5px dashed ${tokens.domainGroup.border}`,
              borderRadius: 10,
              background: alpha(tokens.domainGroup.border, theme.palette.mode === 'dark' ? 0.07 : 0.04),
              pointerEvents: 'none',
              // Under the cards and under the boundary box, deepest nearest the
              // front, so an inner box reads on top of the one it sits in.
              zIndex: -20 + box.depth,
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 3,
                left: 10,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.04em',
                color: tokens.domainGroup.label,
                whiteSpace: 'nowrap',
              }}
            >
              {box.name}
            </span>
          </div>
        );
      })}
    </ViewportPortal>
  );
}

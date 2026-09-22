// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { NodeResizer } from '@xyflow/react';
import { useTheme } from '@mui/material/styles';
import { getNodeTokens } from '../theme/tokens';
import { useNodeResize } from '../canvas/NodeResizeContext';
import type { ElementId } from '../../model/types';
import type { ElementNodeData } from './nodeData';

/**
 * The selected-only resize frame, once. Five node components carried a
 * byte-identical copy of this block and the actor carried a sixth as its own
 * `ActorResizer` (the stickman branch needed one too), which meant every change
 * to the handle size or the commit shape was a six-file edit.
 *
 * Two gates, both deliberate and both previously repeated in all six copies:
 * a resizer mounts only for a SINGLE selected node (`resize.singleSelection`) —
 * one per node in a multi-selection churns dimensions inside React Flow's
 * `<NodesSelection>` and loops the store — and never at all in read-only mode,
 * which is the caller's job (`NodeShell` omits it).
 */
export function ElementResizer({
  elementId,
  selected,
  limits,
}: {
  elementId: ElementId;
  selected: boolean;
  limits: ElementNodeData['resizeLimits'];
}) {
  const tokens = getNodeTokens(useTheme());
  const resize = useNodeResize();
  return (
    <NodeResizer
      isVisible={selected && resize.singleSelection}
      minWidth={limits.min.width}
      minHeight={limits.min.height}
      maxWidth={limits.max.width}
      maxHeight={limits.max.height}
      lineStyle={{ borderColor: tokens.card.selectedRing }}
      // The handles too, or they fall through to the library's own blue and
      // the ring and its corners disagree about which colour selection is.
      handleStyle={{
        width: 8,
        height: 8,
        borderRadius: 2,
        backgroundColor: tokens.card.selectedRing,
        borderColor: tokens.card.bg,
      }}
      onResizeEnd={(_event, params) =>
        resize.commitResize(elementId, {
          x: params.x,
          y: params.y,
          width: params.width,
          height: params.height,
        })
      }
    />
  );
}

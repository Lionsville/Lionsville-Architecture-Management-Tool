import type { Node, NodeProps } from '@xyflow/react';
import type { AspectConfigEntry, DesignElement, DiagramPlacement } from '../../model/types';
import type { ElementDecoration } from '../props';

/** Shared payload for every element node on the canvas. */
export interface ElementNodeData extends Record<string, unknown> {
  element: DesignElement;
  placement: DiagramPlacement;
  decoration?: ElementDecoration;
  readOnly: boolean;
  /** The active diagram's configured aspect columns (badge row order). */
  aspectConfig: readonly AspectConfigEntry[];
  /** True when the node has its own container diagram (drill-down hint). */
  hasContainerDiagram?: boolean;
  /**
   * Resize floor and ceiling for this node's NodeResizer. Projected here rather
   * than read in the component because the ceiling depends on the band the node
   * sits in, and bands follow the board's layoutConfig.
   */
  resizeLimits: { min: { width: number; height: number }; max: { width: number; height: number } };
  /** Toolbar toggle (U5): show the lifecycle badge and the retired dim. */
  showLifecycle: boolean;
}

export type ElementNode = Node<ElementNodeData>;
export type ElementNodeProps = NodeProps<ElementNode>;

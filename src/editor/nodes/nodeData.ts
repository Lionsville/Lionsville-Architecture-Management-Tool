import type { Node, NodeProps } from '@xyflow/react';
import type { AspectConfigEntry, DesignElement, PlacedNode, Lifecycle } from '../../model/types';

/** Shared payload for every element node on the canvas. */
export interface ElementNodeData extends Record<string, unknown> {
  element: DesignElement;
  placement: PlacedNode;
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
  /**
   * The phase this element is in **on the day the diagram shows** (ADR-0009).
   *
   * A field beside the element rather than a rewritten `element.lifecycle`,
   * because `sameNodeData` compares the element by identity: handing the card a
   * fresh object every derive is what ADR-0004 measured and removed. A string
   * costs one comparison.
   */
  phase: Lifecycle;
}

export type ElementNode = Node<ElementNodeData>;
export type ElementNodeProps = NodeProps<ElementNode>;

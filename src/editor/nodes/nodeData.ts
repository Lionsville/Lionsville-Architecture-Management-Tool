import type { Node, NodeProps } from '@xyflow/react';
import type { AspectConfigEntry, DesignElement, PlacedNode, Lifecycle } from '../../model/types';

/**
 * What a card says about a record another scope defines (ADR-0012 §3).
 *
 * Two sentences, already in the reader's language: the editor may not know a
 * scope tree exists, so it is handed the words rather than the paths. The
 * OBJECT is what `sameNodeData` compares, so whoever supplies it must hand
 * back the same one until something about it changes — a fresh object per
 * derive is what ADR-0004 measured and removed from every card on the board.
 */
export interface StandInNote {
  /** "from acme/retail" — where the thing is really defined. */
  from: string;
  /** A finding about this record, as its sentence: drift, or dangling. */
  warning?: string;
  /**
   * The owner's account of the thing — the description as the scope that
   * defines it holds it, read from there and never written here. What the
   * card and the inspector show for a stand-in, because a description is
   * maintained where the thing is defined and an overview only reads it.
   */
  description?: string;
}

/**
 * The description a card shows: a stand-in's owner's, and a definition's own.
 *
 * A stand-in nobody defines, or whose owner has not been read yet, falls back
 * to whatever text it holds itself rather than to nothing.
 */
export function shownDescription(data: Pick<ElementNodeData, 'element' | 'note'>): string | undefined {
  return data.note?.description ?? data.element.description;
}

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
  /** See {@link StandInNote}. Absent on a record this scope defines. */
  note?: StandInNote;
}

export type ElementNode = Node<ElementNodeData>;
export type ElementNodeProps = NodeProps<ElementNode>;

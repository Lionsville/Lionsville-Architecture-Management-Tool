import { createContext, useContext } from 'react';
import type { ElementId } from '../types';

/**
 * Lets card nodes commit a NodeResizer gesture into the overlay without
 * threading actions through node data (which stays a pure model projection).
 * Mirrors RouteEditingContext.
 */
export interface NodeResizeApi {
  commitResize(
    elementId: ElementId,
    rect: { x: number; y: number; width: number; height: number },
  ): void;
  /**
   * True only when exactly one item is selected. Resizable nodes gate their
   * NodeResizer on this: a resizer per node in a multi-selection churns
   * dimensions inside React Flow's <NodesSelection> and loops the store (and
   * resizing during a multi-select has no defined behaviour anyway).
   */
  singleSelection: boolean;
}

const noop: NodeResizeApi = { commitResize: () => {}, singleSelection: true };

export const NodeResizeContext = createContext<NodeResizeApi>(noop);

export function useNodeResize(): NodeResizeApi {
  return useContext(NodeResizeContext);
}

import { nodeMaxSize, nodeMinSize } from '../../model/placement';
import type { ElementKind, Layer7Zone } from '../../model/types';
import type { ElementNodeData } from './nodeData';

/**
 * The resize limits a node's NodeResizer reads. Production gets them from
 * `buildNodes`, which knows the diagram's layoutConfig; a test rendering a node
 * in isolation has no diagram, so it takes the default board's bands.
 */
export function testResizeLimits(
  kind: ElementKind,
  zone: Layer7Zone = 'landscape',
): ElementNodeData['resizeLimits'] {
  return { min: nodeMinSize(kind), max: nodeMaxSize(kind, zone) };
}
